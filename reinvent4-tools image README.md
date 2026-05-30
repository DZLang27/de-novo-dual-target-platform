# reinvent4\-tools Docker 镜像使用文档

## 📌 项目简介

本项目提供**reinvent4\-tools:1\.0\.0**Docker镜像，基于官方nvidia/cuda:12\.8\.0\-cudnn\-devel\-ubuntu22\.04基础镜像构建，预装分子设计核心工具**REINVENT4**、分子对接辅助工具**DockStream**以及GPU加速版分子对接工具**Vina-GPU**运行依赖环境。

镜像无需用户手动编译源码、配置Conda环境、调试GPU适配参数和修改工具运行路径，开箱即可快速开展AI分子生成、药物分子对接等相关计算工作。

## 💻 环境要求

使用该镜像前，宿主机必须满足以下硬性环境条件，否则镜像及内置工具无法正常运行：

- **Docker**: 本镜像需要通过docker使用。

- **GPU容器驱动组件**：必须完整安装**NVIDIA Container Toolkit**，未安装则无法挂载调用宿主机GPU；

- **NVIDIA显卡驱动**：驱动兼容CUDA 12\.8及以上版本；

- **磁盘空间预留**：镜像大小约19GB，解压后整体体积约52GB，需提前预留充足磁盘存储空间，避免拉取及运行过程中空间不足失败。

## 📥 镜像拉取命令

镜像托管于阿里云公开容器镜像服务，执行以下命令即可拉取使用：

```bash
docker pull crpi-y5oaftfoxdmhqic8.cn-hangzhou.personal.cr.aliyuncs.com/zldeng27/reinvent4_tools:1.0.0
```

## 🚀 容器启动命令

启动容器必须添加**\-\-gpus all**参数实现GPU挂载，同时通过\-v参数挂载本地数据及输出目录，实现宿主机与容器文件互通，容器销毁后数据不会丢失，标准启动命令如下：

```bash
docker run --gpus all -it --rm \
  -v /your_data_path:/data \
  -v /your_output_path:/output \
  crpi-y5oaftfoxdmhqic8.cn-hangzhou.personal.cr.aliyuncs.com/zldeng27/reinvent4_tools:1.0.0
```

参数说明：**/your_data_path**替换为本地存放配置文件、受体、配体等输入文件目录；**/your_output_path**替换为本地接收工具运行输出结果的目录。

## ⚙️ 容器内工具规范使用方法

镜像内置两套相互独立的Conda运行环境，分别适配REINVENT4和DockStream工具，**无需使用conda activate命令手动激活环境**，统一通过专属前缀脚本调用即可自动匹配对应依赖环境。

### 1、环境激活前缀说明

- REINVENT4专属环境前缀：**run_reinvent**

- DockStream专属环境前缀：**run_dockstream**

也就是在原本运行命令前加上对应的前缀即可，看下方示例。

### 2、运行 REINVENT4 

```bash
run_reinvent reinvent -l /output/your_logfile.log /data/your_config.toml
```

备注：your_config.toml为用户自行配置的REINVENT4运行配置文件，需提前放入本地挂载的/data对应目录下。

### 3、运行 DockStream 

```bash
run_dockstream python /app/DockStream/docker.py -conf /data/config.json
```

备注：config.json为DockStream运行配置文件，提前存放至本地挂载/data目录，镜像已内置DockStream路径适配配置，无需手动修改代码工作目录。

### 4、运行 Vina-GPU GPU加速分子对接工具

镜像内置Vina-GPU，无需激活环境，任意工作目录下直接调用即可：

```bash
# 标准写法
Vina-GPU --receptor /data/受体文件路径 --ligand /data/配体文件路径
```

## 📂 镜像内部核心目录结构

- REINVENT4源码及运行程序：`/app/REINVENT4`

- DockStream源码及运行程序：`/app/DockStream`

- Vina\-GPU核心程序及依赖库：`/opt/Vina\-GPU`

- 两套Conda独立环境存放目录：`/opt/conda\_envs/reinvent4\_env`、`/opt/conda\_envs/dockstream\_env`

- 环境激活快捷脚本：`/usr/local/bin/run\_reinvent`、`/usr/local/bin/run\_dockstream`

- Vina\-GPU全局调用封装脚本：`/usr/local/bin/Vina\-GPU`

## ⚠️ 使用注意事项

- 所有计算输入文件、配置文件、输出结果必须通过\-v挂载本地目录读写，容器销毁后内部所有数据会自动清空，不会保留；

- 如需后台长时间运行批量计算任务，启动容器时删除\-it交互参数，添加\-d后台运行参数，通过docker logs 容器ID查看运行日志；

- 本镜像仅提供纯GPU/CPU计算运行环境，未集成任何图形可视化界面，仅支持命令行批量计算操作；

- 运行过程中如需修改工具配置，仅需编辑本地挂载目录内文件，无需进入容器内部修改任何原生文件。


