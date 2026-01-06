# Deploy Receiver v1.0

Windows 服务器轻量级文件部署工具，基于 HTTP + Ed25519 签名验证。

## 项目背景

在 Windows 服务器环境中部署应用时，常见方案都有各自的痛点：

| 方案 | 问题 |
|------|------|
| SSH/SCP | Windows 默认不支持，需额外安装 OpenSSH Server |
| FTP/SFTP | 需安装配置 FTP 服务，明文传输不安全 |
| 远程桌面 | 手动操作，无法自动化，不适合 CI/CD |
| 共享文件夹 | 安全隐患大，不适合公网环境 |

**Deploy Receiver** 的解决思路：

- 服务端是一个轻量 HTTP 服务，单文件运行，无需安装额外组件
- 使用 Ed25519 非对称签名保证安全，私钥留在本地，公钥放服务器
- 提供 Python/Bash/PowerShell 客户端脚本，方便集成 Jenkins 等 CI/CD
- 附带 GUI 客户端，支持拖拽上传、服务器管理、定时任务

## 安全机制

```
┌─────────────────┐                    ┌─────────────────┐
│   本机 (Jenkins) │                    │    云服务器      │
│                 │                    │                 │
│   私钥 [保密]    │ ── 签名请求 ──→    │   公钥 [公开]    │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
```

| 技术 | 说明 |
|------|------|
| Ed25519 签名 | 椭圆曲线数字签名，私钥仅在客户端 |
| 时间戳验证 | 请求 5 分钟内有效，防重放攻击 |
| 随机 Nonce | 每次请求唯一标识，防签名复用 |
| 路径检查 | 阻止 `../` 遍历攻击和 ZIP Slip |

即使服务器被入侵，攻击者拿到公钥也无法伪造上传请求。

## 快速开始

### 1. 编译

```bash
# 需要 Go 1.24+
go build -ldflags="-s -w -H=windowsgui" -o deploy_receiver.exe

# 或使用脚本
build.bat
```

### 2. 生成密钥对

```bash
deploy_receiver.exe -genkey
```

输出：
```
【公钥】放到服务器 config.json:
a1b2c3d4...（64 位十六进制）

【私钥】保存在本地，绝不上传:
9876fedc...（128 位十六进制）
```

### 3. 配置服务端

首次运行自动生成 `config.json`，编辑填入公钥：

```json
{
  "port": 8022,
  "paths": {
    "web": "C:\\deploy\\web",
    "api": "C:\\deploy\\api"
  },
  "log_dir": "logs",
  "max_upload_mb": 500,
  "security": {
    "enabled": true,
    "public_key": "a1b2c3d4...填入公钥...",
    "timestamp_limit": 300,
    "allowed_ips": []
  }
}
```

### 4. 启动服务

```bash
# 控制台模式（调试）
deploy_receiver.exe -c

# 托盘模式（日常）
deploy_receiver.exe

# 安装为 Windows 服务（生产）
install_service.bat
```

### 5. 上传文件

```bash
# Python 客户端
pip install cryptography
python client/deploy.py dist.zip web --extract \
  --server http://服务器IP:8022 \
  --key "私钥"
```

## 配置说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | int | 8022 | 监听端口 |
| `paths` | object | - | 路径映射，key 为标识，value 为目录 |
| `log_dir` | string | "logs" | 日志目录 |
| `max_upload_mb` | int | 500 | 最大上传大小 (MB) |
| `security.enabled` | bool | false | 是否启用签名验证 |
| `security.public_key` | string | - | Ed25519 公钥 |
| `security.timestamp_limit` | int | 300 | 时间戳有效期 (秒) |
| `security.allowed_ips` | array | [] | IP 白名单，空则不限制 |

## 运行模式

| 模式 | 命令 | 说明 |
|------|------|------|
| 托盘模式 | `deploy_receiver.exe` | 系统托盘运行 |
| 服务模式 | `deploy_receiver.exe -s` | 静默后台，适合 Windows 服务 |
| 控制台模式 | `deploy_receiver.exe -c` | 显示实时日志，调试用 |

```bash
# 服务管理
sc query DeployReceiver    # 查看状态
sc stop DeployReceiver     # 停止
sc start DeployReceiver    # 启动
uninstall_service.bat      # 卸载
```

## API 接口

### 上传文件

```
POST /upload/{path_key}/{filename}[?extract=true]
```

请求头：
```
X-Timestamp: Unix 时间戳
X-Nonce: 32 位随机十六进制
X-Signature: Ed25519 签名
Content-Type: application/octet-stream
```

签名算法：
```
message = timestamp + nonce + url_path
signature = Ed25519.sign(message, private_key)
```

### 健康检查

```
GET /health
返回: {"status": "ok"}
```

## 客户端脚本

### Python（推荐）

```bash
pip install cryptography

# 命令行参数
python client/deploy.py dist.zip web --extract \
  -s http://server:8022 -k "私钥"

# 环境变量
export DEPLOY_SERVER="http://server:8022"
export DEPLOY_PRIVATE_KEY="私钥"
python client/deploy.py dist.zip web --extract
```

### Bash

```bash
export DEPLOY_SERVER="http://server:8022"
export DEPLOY_PRIVATE_KEY="私钥"
./client/deploy.sh dist.zip web --extract
```

### PowerShell

```powershell
.\client\deploy.ps1 -File "dist.zip" -PathKey "web" -Extract `
  -Server "http://server:8022" -PrivateKey "私钥"
```

## Jenkins 集成

```groovy
pipeline {
    agent any
    environment {
        DEPLOY_SERVER = 'http://192.168.1.100:8022'
        DEPLOY_PRIVATE_KEY = credentials('deploy-private-key')
    }
    stages {
        stage('Build') {
            steps {
                sh 'npm run build && cd dist && zip -r ../dist.zip .'
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                    pip install cryptography -q
                    python3 client/deploy.py dist.zip web --extract
                '''
            }
        }
    }
}
```

## GUI 客户端

基于 Wails v2 (Go + React) 构建的图形界面客户端。

### 功能

| 功能 | 说明 |
|------|------|
| 拖拽上传 | 支持文件和文件夹，显示进度 |
| 服务器管理 | 多服务器配置、快速切换 |
| 密钥管理 | 生成、导入、加密存储 |
| 历史记录 | 上传记录、快速重传 |
| 文件监控 | 监听变化自动上传 |
| 定时任务 | Cron 表达式定时上传 |

### 编译

```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

cd client-gui
wails build
# 输出: build/bin/DeployReceiverClient.exe
```

## 项目结构

```
deploy_receiver/
├── main.go                  # 服务端入口
├── go.mod / go.sum          # Go 依赖
├── build.bat                # 编译脚本
├── install_service.bat      # 安装服务
├── uninstall_service.bat    # 卸载服务
├── config.json.example      # 配置示例
│
├── client/                  # 命令行客户端
│   ├── deploy.py            # Python 版
│   ├── deploy.sh            # Bash 版
│   ├── deploy.ps1           # PowerShell 版
│   ├── upload_folder.bat    # 文件夹上传
│   ├── upload_folder.ps1
│   └── sign/                # Go 签名工具
│       └── main.go
│
└── client-gui/              # GUI 客户端
    ├── main.go              # Wails 入口
    ├── app.go               # 后端逻辑
    ├── wails.json
    ├── internal/
    │   ├── crypto/          # Ed25519 签名
    │   ├── database/        # SQLite 存储
    │   └── uploader/        # 上传逻辑
    └── frontend/            # React 前端
        └── src/
            ├── App.tsx
            └── pages/       # 页面组件
```

## 开发指南

### 环境要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Go | 1.24+ | 服务端、GUI 后端 |
| Node.js | 18+ | GUI 前端 |
| Wails CLI | v2.x | GUI 构建 |
| Python | 3.8+ | 命令行客户端 |

### 本地开发

```bash
# 服务端
go run main.go -c

# GUI 客户端（热重载）
cd client-gui
wails dev
```

## 常见问题

**Q: 时间戳验证失败？**

确保客户端和服务器时间同步，误差不超过 5 分钟。

```bash
# Windows 同步时间
w32tm /resync
```

**Q: 如何更换密钥？**

```bash
deploy_receiver.exe -genkey   # 生成新密钥
# 更新服务器 config.json 中的 public_key
# 更新客户端使用的私钥
# 重启服务
```

**Q: 支持 HTTPS 吗？**

建议前置 Nginx 反向代理：

```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    location / {
        proxy_pass http://127.0.0.1:8022;
    }
}
```

## 许可证

本项目采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源许可证。

```
Copyright 2025 ciddwd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
