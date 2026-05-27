# De novo 双靶点抑制剂设计平台

基于 [REINVENT4](https://github.com/MolecularAI/Reinvent) + [DockStream](https://github.com/MolecularAI/DockStream) + [AutoDock Vina](https://vina.scripps.edu/) / Vina-GPU 的 AI 驱动双靶点分子生成 Web 平台。面向无计算机背景的药物化学研究人员，提供向导式操作界面和 3D 蛋白-配体可视化。

## 工作流

```
用户上传靶点 PDBQT → 配置结合位点 → 选择评分组件 → 提交任务
    ↓
REINVENT4 RL 采样分子 → DockStream 调用 Vina 对接 → 评分反馈
    ↓
查看结果：分子列表、对接打分、3D 蛋白-配体构象
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Ant Design 5 + NGL Viewer |
| 后端 | Python FastAPI + SQLAlchemy 2.0 + Celery + Redis |
| 数据库 | PostgreSQL 16 |
| 容器 | Docker + NVIDIA Container Toolkit |
| 分子工具 | REINVENT4 + DockStream + AutoDock Vina / Vina-GPU |

## 快速开始

### 环境要求

- Python 3.12+, Node.js 22+, PostgreSQL 16+, Redis (Windows: Memurai)
- Docker Desktop + `reinvent4-tools:1.0.0` 镜像

### 安装运行

```bash
git clone https://github.com/DZLang27/de-novo-dual-target-platform.git
cd de-novo-dual-target-platform

# 后端
cd backend
cp ../.env.example .env          # 编辑 .env 填写数据库密码
pip install -r requirements.txt
python init_db.py
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &

# Celery Worker
celery -A app.workers.celery_app worker --loglevel=info --concurrency=1 --queues=gpu --pool=solo &

# 前端
cd ../frontend
npm install
npm run dev
```

打开 http://127.0.0.1:5173

### Docker 部署

```bash
docker compose up -d
```

## 文档

- [部署文档](docs/部署文档.md)
- [使用文档](docs/使用文档.md)

## 项目结构

```
plantform/
├── backend/                    # FastAPI 后端
│   └── app/
│       ├── api/v1/             # REST + WebSocket 端点
│       ├── models/             # SQLAlchemy ORM
│       ├── schemas/            # Pydantic 校验
│       ├── services/           # TOML/JSON 配置生成
│       └── workers/            # Celery 任务 + GPU 锁
├── frontend/                   # React SPA
│   └── src/
│       ├── pages/              # 页面组件
│       ├── components/         # NGL 3D 查看器等
│       └── api/                # Axios 客户端
├── nginx/                      # 生产环境代理配置
├── docs/                       # 文档
└── docker-compose.yml          # 容器编排
```
