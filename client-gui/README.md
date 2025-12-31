# Deploy Receiver Client

基于 Wails 框架的 Deploy Receiver 图形化客户端，用于安全地将文件上传到 Deploy Receiver 服务器。

## 功能特性

- **文件上传** - 支持单文件/文件夹上传，拖拽上传，上传进度显示
- **服务器管理** - 多服务器配置，连接测试，默认服务器设置
- **密钥管理** - Ed25519 密钥对生成/导入，安全存储
- **历史记录** - 上传历史查看，成功/失败统计
- **文件夹监控** - 监控文件夹变化自动上传
- **定时任务** - Cron 表达式定时上传

## 技术栈

- **后端**: Go + Wails v2
- **前端**: React + TypeScript + Tailwind CSS
- **数据库**: SQLite (modernc.org/sqlite 纯 Go 实现)
- **签名算法**: Ed25519

## 环境要求

- Go 1.21+
- Node.js 18+
- Wails CLI v2

## 安装 Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## 开发模式

```bash
cd client-gui

# 安装前端依赖
cd frontend && npm install && cd ..

# 启动开发服务器（热重载）
wails dev
```

## 编译打包

```bash
cd client-gui

# 编译生产版本
wails build

# 输出文件位置
# Windows: build/bin/DeployReceiverClient.exe
# Linux:   build/bin/DeployReceiverClient
# macOS:   build/bin/DeployReceiverClient.app
```

### 跨平台编译

```bash
# Windows
wails build -platform windows/amd64

# Linux
wails build -platform linux/amd64

# macOS
wails build -platform darwin/amd64
wails build -platform darwin/arm64
```

## 项目结构

```
client-gui/
├── app.go                    # Go 后端逻辑（暴露给前端的方法）
├── main.go                   # Wails 入口
├── wails.json                # Wails 配置
├── internal/
│   ├── database/             # SQLite 数据库操作
│   ├── crypto/               # Ed25519 签名
│   └── uploader/             # HTTP 上传逻辑
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # React 路由入口
│   │   ├── style.css         # 全局样式
│   │   ├── components/
│   │   │   └── Layout.tsx    # 侧边栏布局
│   │   └── pages/
│   │       ├── Upload.tsx    # 上传页面
│   │       ├── Servers.tsx   # 服务器管理
│   │       ├── Keys.tsx      # 密钥管理
│   │       ├── History.tsx   # 历史记录
│   │       ├── Watch.tsx     # 文件夹监控
│   │       └── Schedule.tsx  # 定时任务
│   └── wailsjs/              # Wails 生成的绑定
└── build/                    # 编译输出
```

## 数据存储位置

- **Windows**: `%APPDATA%/DeployReceiverClient/data.db`
- **Linux**: `~/.config/DeployReceiverClient/data.db`
- **macOS**: `~/Library/Application Support/DeployReceiverClient/data.db`

## 使用说明

1. **添加服务器** - 在「服务器」页面添加 Deploy Receiver 服务器地址和路径标识
2. **配置密钥** - 在「密钥管理」页面生成或导入 Ed25519 私钥
3. **复制公钥** - 将公钥复制到服务器的 `config.json` 配置文件中
4. **开始上传** - 在「文件上传」页面选择文件并上传

## 许可证

MIT License
