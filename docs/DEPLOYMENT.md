# 部署文档 / Deployment Guide

## 系统要求

### 硬件要求
- **CPU**: 4 核以上
- **内存**: 16 GB 以上（推荐 32 GB）
- **存储**: 100 GB 以上可用空间
- **GPU**: NVIDIA GPU（可选，用于加速分子对接）

### 软件要求
- **操作系统**: Windows 10/11, Linux, macOS
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (用于前端开发)
- **Python**: 3.10+ (用于后端开发)

---

## 快速部署（推荐）

### 1. 克隆项目

```bash
git clone https://github.com/your-username/de-novo-platform.git
cd de-novo-platform
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库密码等
```

### 3. 启动所有服务

```bash
docker-compose up -d
```

### 4. 访问平台

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

---

## 开发环境部署

### 后端开发

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python init_db.py

# 启动后端服务
uvicorn app.main:app --reload --port 8000
```

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 启动 Redis（用于 Celery）

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 启动 Celery Worker

```bash
cd backend
python -m celery -A app.workers.celery_app worker --loglevel=info --queues=gpu
```

---

## 生产环境部署

### 1. 构建生产镜像

```bash
# 后端
cd backend
docker build -t de-novo-backend .

# 前端
cd frontend
docker build --target production -t de-novo-frontend .
```

### 2. 配置 Nginx

参考 `nginx/nginx.conf` 配置反向代理。

### 3. 使用 Docker Compose 启动

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql+asyncpg://reinvent:reinvent_dev@localhost:5432/reinvent_platform` |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379` |
| `SECRET_KEY` | JWT 密钥 | 需要修改 |
| `DATA_DIR` | 数据存储目录 | `/data` |
| `REINVENT4_IMAGE` | REINVENT4 Docker 镜像 | `reinvent4-tools:1.0.0` |
| `GPU_ENABLED` | 是否启用 GPU | `true` |

---

## 故障排除

### 问题 1: 数据库连接失败

检查 PostgreSQL 是否正常运行：
```bash
docker ps | grep postgres
docker logs postgres
```

### 问题 2: Redis 连接失败

检查 Redis 是否正常运行：
```bash
docker ps | grep redis
redis-cli ping
```

### 问题 3: REINVENT4 容器启动失败

检查 Docker 是否有足够权限：
```bash
docker info
```

### 问题 4: GPU 不可用

确保安装了 NVIDIA Container Toolkit：
```bash
nvidia-smi
docker run --rm nvidia/cuda:11.0-base nvidia-smi
```
