# =============================================================================
# 1. 基础镜像 (请务必确认你的驱动支持 CUDA 12.8)
# =============================================================================
FROM nvidia/cuda:12.8.0-cudnn-devel-ubuntu22.04 AS builder

# =============================================================================
# 2. 设置环境变量
# =============================================================================
ENV DEBIAN_FRONTEND=noninteractive
ENV ENV_BASE=/opt/conda_envs

# =============================================================================
# 3. 安装系统基础依赖
# =============================================================================
RUN apt-get update && apt-get install -y \
    wget curl git vim libxrender1 libsm6 libxext6 libgl1-mesa-glx\
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# 4. 部署 Vina-GPU 及其依赖
# =============================================================================
# 将整个 Vina-GPU 目录复制到 /opt
COPY Vina-GPU/ /opt/Vina-GPU/
# 复制手动准备的 Boost 动态库
COPY libs/ /usr/local/lib/
# 更新链接器缓存，确保能链接到Boost库
RUN ldconfig
# 确保可执行文件有执行权限 (请按你的实际可执行文件名修改)
RUN chmod +x /opt/Vina-GPU/Vina-GPU

# =============================================================================
# 5. 创建 Vina-GPU 的 Wrapper 脚本 (双保险)
# =============================================================================
RUN echo '#!/bin/bash' > /usr/local/bin/Vina-GPU && \
    echo 'cd /opt/Vina-GPU' >> /usr/local/bin/Vina-GPU && \
    echo 'exec /opt/Vina-GPU/Vina-GPU "$@"' >> /usr/local/bin/Vina-GPU && \
    chmod +x /usr/local/bin/Vina-GPU

# =============================================================================
# 6. 解压 Conda 环境
# =============================================================================
RUN mkdir -p $ENV_BASE

# 解压后必须运行 conda-unpack 修复路径 (REINVENT4 环境)
COPY reinvent4_env.tar.gz $ENV_BASE/
RUN mkdir -p $ENV_BASE/reinvent4_env && \
    tar -xzf $ENV_BASE/reinvent4_env.tar.gz -C $ENV_BASE/reinvent4_env && \
    rm $ENV_BASE/reinvent4_env.tar.gz && \
    PATH=$ENV_BASE/reinvent4_env/bin:$PATH $ENV_BASE/reinvent4_env/bin/conda-unpack

# 解压后必须运行 conda-unpack 修复路径 (DockStream 环境)
COPY DockStream_env.tar.gz $ENV_BASE/
RUN mkdir -p $ENV_BASE/dockstream_env && \
    tar -xzf $ENV_BASE/DockStream_env.tar.gz -C $ENV_BASE/dockstream_env && \
    rm $ENV_BASE/DockStream_env.tar.gz && \
    PATH=$ENV_BASE/dockstream_env/bin:$PATH $ENV_BASE/dockstream_env/bin/conda-unpack

# =============================================================================
# 7. 复制源代码
# =============================================================================
WORKDIR /app
COPY REINVENT4/  /app/REINVENT4/
COPY DockStream/ /app/DockStream/

# =============================================================================
# 8. 创建环境激活脚本 (临时切换 PATH)
# =============================================================================
RUN echo '#!/bin/bash' > /usr/local/bin/run_reinvent && \
    echo 'export PATH="'$ENV_BASE'/reinvent4_env/bin:$PATH"' >> /usr/local/bin/run_reinvent && \
    echo 'exec "$@"' >> /usr/local/bin/run_reinvent && \
    chmod +x /usr/local/bin/run_reinvent

RUN echo '#!/bin/bash' > /usr/local/bin/run_dockstream && \
    echo 'export PATH="'$ENV_BASE'/dockstream_env/bin:$PATH"' >> /usr/local/bin/run_dockstream && \
    echo 'exec "$@"' >> /usr/local/bin/run_dockstream && \
    chmod +x /usr/local/bin/run_dockstream

# =============================================================================
# 9. 设置默认命令
# =============================================================================
CMD ["/bin/bash"]
