@echo off
chcp 65001 >nul
echo ========================================
echo   Deploy Receiver 编译脚本
echo ========================================
echo.

:: 检查 Go 环境
where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Go 编译器，请先安装 Go
    echo 下载地址: https://go.dev/dl/
    pause
    exit /b 1
)

echo [1/3] 下载依赖...
go mod tidy
if %errorlevel% neq 0 (
    echo [错误] 依赖下载失败
    pause
    exit /b 1
)

echo.
echo [2/3] 编译程序...
:: -H windowsgui: 隐藏控制台窗口
:: -s: 去除符号表
:: -w: 去除调试信息
go build -ldflags "-H windowsgui -s -w" -o deploy_receiver.exe
if %errorlevel% neq 0 (
    echo [错误] 编译失败
    pause
    exit /b 1
)

echo.
echo [3/3] 编译完成!
echo.
echo 生成文件: deploy_receiver.exe
for %%I in (deploy_receiver.exe) do echo 文件大小: %%~zI bytes
echo.
echo ========================================
echo   使用方法:
echo   1. 双击 deploy_receiver.exe 启动（托盘模式）
echo   2. deploy_receiver.exe -c 启动（控制台模式）
echo   3. deploy_receiver.exe -h 查看帮助
echo ========================================
echo.
pause
