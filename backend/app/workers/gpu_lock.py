"""Redis-based distributed GPU lock."""

import time
import redis

from app.config import settings

r = redis.from_url(settings.REDIS_URL, decode_responses=True)

GPU_LOCK_KEY = "gpu:lock"
GPU_LOCK_TTL = settings.GPU_LOCK_TTL


class GPULock:
    """Ensures only one REINVENT4 container uses the GPU at a time."""

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.acquired = False

    def acquire(self, timeout: int | None = None) -> bool:
        if timeout is None:
            timeout = settings.GPU_LOCK_TIMEOUT
        deadline = time.time() + timeout
        while time.time() < deadline:
            if r.set(GPU_LOCK_KEY, self.task_id, nx=True, ex=GPU_LOCK_TTL):
                self.acquired = True
                return True
            time.sleep(5)
        return False

    def release(self):
        if not self.acquired:
            return
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        r.eval(script, 1, GPU_LOCK_KEY, self.task_id)
        self.acquired = False

    def heartbeat(self):
        if not self.acquired:
            return
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("expire", KEYS[1], ARGV[2])
        else
            return 0
        end
        """
        r.eval(script, 1, GPU_LOCK_KEY, self.task_id, GPU_LOCK_TTL)


def is_gpu_available() -> bool:
    return not r.exists(GPU_LOCK_KEY)


def get_current_task_id() -> str | None:
    return r.get(GPU_LOCK_KEY)
