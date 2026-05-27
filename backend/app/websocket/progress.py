"""WebSocket progress manager for task monitoring."""

import json
import asyncio

import redis.asyncio as aioredis
from fastapi import WebSocket, WebSocketDisconnect

from app.config import settings


class ProgressManager:
    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self.connections: dict[str, list[WebSocket]] = {}

    async def initialize(self):
        self.redis = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def connect(self, task_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(task_id, []).append(websocket)

    async def disconnect(self, task_id: str, websocket: WebSocket):
        if task_id in self.connections:
            try:
                self.connections[task_id].remove(websocket)
            except ValueError:
                pass
            if not self.connections[task_id]:
                del self.connections[task_id]

    async def broadcast(self, task_id: str, data: dict):
        if task_id in self.connections:
            dead = []
            for ws in self.connections[task_id]:
                try:
                    await ws.send_json(data)
                except (WebSocketDisconnect, RuntimeError):
                    dead.append(ws)
            for ws in dead:
                await self.disconnect(task_id, ws)

    async def listen_and_broadcast(self, task_id: str):
        if not self.redis:
            await self.initialize()
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"task:{task_id}:progress", f"task:{task_id}:log")
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    channel = message["channel"]
                    data_str = message["data"]
                    if channel == f"task:{task_id}:log":
                        data = {"type": "log", "line": data_str}
                    else:
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            data = {"type": "log", "line": data_str}
                    await self.broadcast(task_id, data)
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(f"task:{task_id}:progress", f"task:{task_id}:log")


progress_manager = ProgressManager()
