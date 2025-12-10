# Deploy Receiver v3.0

安全的部署文件接收器，使用 **Ed25519 非对称签名**，用于接收 Jenkins 等 CI/CD 工具推送的部署文件。

## 安全架构

```
┌─────────────────┐                    ┌─────────────────┐
│     本机        │                    │    云服务器      │
│  (Jenkins)      │                    │                 │
│                 │                    │                 │
│  私钥 🔐        │ ── 签名请求 ──→    │   公钥 🔓        │
│  (绝不泄露)     │                    │  (只能验证)      │
└─────────────────┘                    └─────────────────┘

即使服务器被入侵，攻击者拿到公钥也无法伪造上传请求！
```

## 安全特性

| 特性 | 说明 |
|------|------|
| **Ed25519 非对称签名** | 私钥只在客户端，服务器只存公钥 |
| **时间戳防重放** | 请求5分钟内有效，过期自动拒绝 |
| **随机 Nonce** | 每次请求唯一，防止签名复用 |
| **路径遍历防护** | 多层检查，防止 `../` 攻击 |
| **ZIP Slip 防护** | 解压时检查路径安全 |
| **可选 IP 白名单** | 额外的 IP 过滤层 |

## 快速开始

### 第一步：编译 (在任意机器上)

```bash
# 确保已安装 Go (https://go.dev/dl/)
build.bat
```

### 第二步：生成密钥对 (在本机运行)

```bash
deploy_receiver.exe -genkey
```

输出示例：
```
============================================================
  Ed25519 密钥对已生成 (非对称加密)
============================================================

【公钥】- 放到云服务器的 config.json 中:
a1b2c3d4e5f6...（64位十六进制）

【私钥】- 只保存在你的本机! 绝对不要泄露!
9876fedc...（128位十六进制）

============================================================
```

### 第三步：配置云服务器

1. 将 `deploy_receiver.exe` 上传到云服务器
2. 首次运行会生成 `config.json`
3. 编辑 `config.json`，填入**公钥**：

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
    "public_key": "a1b2c3d4e5f6...这里填公钥...",
    "timestamp_limit": 300,
    "allowed_ips": []
  }
}
```

4. 安装为 Windows 服务：
```bash
install_service.bat
```

### 第四步：本机配置客户端

```bash
# 安装 Python 依赖
pip install cryptography

# 上传文件
python client/deploy.py dist.zip web --extract \
  --server http://云服务器IP:8022 \
  --key "9876fedc...这里填私钥..."
```

## 配置说明

### 服务器配置 (config.json)

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | int | 8022 | 监听端口 |
| `paths` | object | - | 路径映射，key 为标识，value 为目录 |
| `log_dir` | string | "logs" | 日志目录 |
| `max_upload_mb` | int | 500 | 最大上传大小 (MB) |
| `security.enabled` | bool | false | 是否启用安全认证 |
| `security.public_key` | string | - | Ed25519 公钥 (64位十六进制) |
| `security.timestamp_limit` | int | 300 | 时间戳有效期 (秒) |
| `security.allowed_ips` | array | [] | IP 白名单，空则不限制 |

### 多路径配置示例

```json
{
  "paths": {
    "web-frontend": "C:\\deploy\\web\\frontend",
    "web-admin": "C:\\deploy\\web\\admin",
    "api-main": "C:\\deploy\\api\\main",
    "api-gateway": "C:\\deploy\\api\\gateway"
  }
}
```

## 命令行选项

```
deploy_receiver.exe [选项]

选项:
  -c, --console   控制台模式运行 (调试用)
  -genkey         生成 Ed25519 密钥对
  -h, --help      显示帮助信息
  -v, --version   显示版本信息

无参数: 系统托盘模式运行
```

## 运行模式

| 模式 | 命令 | 说明 |
|------|------|------|
| **托盘模式** | `deploy_receiver.exe` | 系统托盘运行，推荐日常使用 |
| **控制台模式** | `deploy_receiver.exe -c` | 显示实时日志，调试用 |
| **服务模式** | `install_service.bat` | Windows 服务，生产环境推荐 |

## API 接口

### 上传文件

```
POST /upload/{path_key}/{filename}[?extract=true]
```

**请求头：**
```
X-Timestamp: Unix时间戳 (秒)
X-Nonce: 随机字符串 (32位十六进制)
X-Signature: Ed25519签名 (128位十六进制)
Content-Type: application/octet-stream
```

**签名算法：**
```
message = timestamp + nonce + url_path
signature = Ed25519.sign(message, private_key)
```

**响应示例：**
```json
{
  "status": "ok",
  "path": "C:\\deploy\\web\\dist.zip",
  "size": 1234567,
  "path_key": "web",
  "filename": "dist.zip",
  "extracted": true,
  "extract_dir": "C:\\deploy\\web\\dist"
}
```

### 健康检查

```
GET /health
返回: {"status": "ok"}
```

### 服务信息

```
GET /
返回: {"service": "Deploy Receiver", "version": "3.0.0", ...}
```

## 客户端脚本

### Python (推荐，跨平台)

```bash
# 安装依赖
pip install cryptography

# 基本用法
python deploy.py <文件> <路径标识> [选项]

# 示例
python deploy.py dist.zip web --extract
python deploy.py app.jar api -s http://server:8022 -k 私钥
```

**环境变量方式：**
```bash
export DEPLOY_SERVER="http://server:8022"
export DEPLOY_PRIVATE_KEY="你的私钥"
python deploy.py dist.zip web --extract
```

### Bash (Linux/Mac/Jenkins)

```bash
# 设置环境变量
export DEPLOY_SERVER="http://server:8022"
export DEPLOY_PRIVATE_KEY="你的私钥"

# 上传
./deploy.sh dist.zip web --extract
```

### PowerShell (Windows)

```powershell
.\deploy.ps1 -File "dist.zip" -PathKey "web" -Extract `
  -Server "http://server:8022" `
  -PrivateKey "你的私钥"
```

## Jenkins 集成

### Jenkinsfile 示例

```groovy
pipeline {
    agent any

    environment {
        DEPLOY_SERVER = 'http://192.168.1.100:8022'
        // 使用 Jenkins Credentials 存储私钥
        DEPLOY_PRIVATE_KEY = credentials('deploy-private-key')
    }

    stages {
        stage('Build') {
            steps {
                sh 'npm run build'
                sh 'cd dist && zip -r ../dist.zip .'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    pip install cryptography -q
                    python3 deploy.py dist.zip web --extract \
                        --server $DEPLOY_SERVER \
                        --key $DEPLOY_PRIVATE_KEY
                '''
            }
        }
    }
}
```

### 多环境部署

```groovy
pipeline {
    parameters {
        choice(name: 'ENV', choices: ['dev', 'test', 'prod'])
    }

    stages {
        stage('Deploy') {
            steps {
                script {
                    def servers = [
                        'dev': 'http://192.168.1.100:8022',
                        'test': 'http://192.168.1.101:8022',
                        'prod': 'http://192.168.1.102:8022'
                    ]
                    sh """
                        python3 deploy.py dist.zip web --extract \
                            --server ${servers[params.ENV]} \
                            --key \$DEPLOY_PRIVATE_KEY
                    """
                }
            }
        }
    }
}
```

## 项目结构

```
deploy_receiver/
├── main.go                    # 主程序源码
├── go.mod / go.sum            # Go 依赖
├── build.bat                  # 编译脚本
├── config.json.example        # 配置示例
├── config_advanced.json.example # 高级配置示例
├── install_service.bat        # 安装 Windows 服务
├── uninstall_service.bat      # 卸载服务
├── test_upload.bat            # 测试脚本
├── README.md                  # 说明文档
└── client/                    # 客户端脚本
    ├── deploy.py              # Python 版 (推荐)
    ├── deploy.sh              # Bash 版
    └── deploy.ps1             # PowerShell 版
```

编译后：
```
├── deploy_receiver.exe        # 可执行文件 (~6.5MB)
├── config.json                # 配置文件 (首次运行生成)
├── keys.txt                   # 密钥文件 (genkey生成，用后删除)
└── logs/                      # 日志目录
    └── deploy_2024-12-10.log
```

## 日志管理

日志文件存放在 `logs/` 目录，按日期自动分割。

### 日志格式

```
[2024-12-10 15:30:45] [INFO] 服务已启动，端口: 8022
[2024-12-10 15:31:20] [INFO] [192.168.1.50] 已保存: dist.zip (1234567 bytes)
[2024-12-10 15:32:10] [WARN] 认证失败 [10.0.0.5]: 签名验证失败
[2024-12-10 15:33:00] [ERROR] 保存失败: permission denied
```

### 实时查看日志 (Windows 服务模式)

```powershell
# 实时滚动查看最新日志
Get-Content "C:\path\to\deploy_receiver\logs\deploy_*.log" -Wait -Tail 30

# 查看指定日期
Get-Content "C:\path\to\deploy_receiver\logs\deploy_2024-12-10.log" -Tail 50
```

### 搜索日志

```powershell
# 搜索错误
Select-String -Path "logs\*.log" -Pattern "ERROR"

# 搜索认证失败
Select-String -Path "logs\*.log" -Pattern "认证失败"

# 搜索特定IP
Select-String -Path "logs\*.log" -Pattern "192.168.1.50"
```

### 创建日志查看快捷方式

创建 `查看日志.bat`：
```batch
@echo off
powershell -Command "Get-Content 'logs\deploy_*.log' -Wait -Tail 30"
```

## 安全建议

### 1. 私钥保护

- **绝不**将私钥上传到服务器
- **绝不**将私钥提交到 Git
- 使用 Jenkins Credentials 或环境变量管理私钥
- 定期更换密钥对

### 2. 网络安全

- 使用 HTTPS (前置 Nginx 反向代理)
- 配置防火墙只允许 Jenkins 服务器访问
- 可选：配置 `allowed_ips` 白名单

### 3. 日志监控

- 定期检查 `logs/` 目录
- 监控认证失败次数
- 设置告警规则

## 常见问题

### Q: 如何更换密钥？

```bash
# 1. 生成新密钥对
deploy_receiver.exe -genkey

# 2. 更新服务器 config.json 中的 public_key
# 3. 更新客户端脚本中的私钥
# 4. 重启服务
```

### Q: 时间戳验证失败？

确保客户端和服务器时间同步，误差不超过 `timestamp_limit` 秒（默认300秒）。

```bash
# Windows 同步时间
w32tm /resync
```

### Q: 上传大文件失败？

修改 `config.json` 中的 `max_upload_mb` 值。

### Q: 如何查看实时日志？

```powershell
# PowerShell
Get-Content logs\deploy_*.log -Wait -Tail 20

# 或使用控制台模式
deploy_receiver.exe -c
```

### Q: 支持 HTTPS 吗？

当前版本使用 HTTP。建议在前面加 Nginx 反向代理配置 SSL：

```nginx
server {
    listen 443 ssl;
    server_name deploy.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8022;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 许可证

MIT License
