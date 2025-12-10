@echo off
chcp 65001 >nul
echo ========================================
echo   安装 Deploy Receiver 为 Windows 服务
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 需要管理员权限！
    echo 请右键点击此脚本，选择"以管理员身份运行"
    pause
    exit /b 1
)

:: 获取当前目录
set "CURRENT_DIR=%~dp0"
set "EXE_PATH=%CURRENT_DIR%deploy_receiver.exe"

:: 检查 exe 是否存在
if not exist "%EXE_PATH%" (
    echo [错误] 未找到 deploy_receiver.exe
    echo 请先运行 build.bat 编译程序
    pause
    exit /b 1
)

:: 服务名称
set "SERVICE_NAME=DeployReceiver"
set "DISPLAY_NAME=Deploy Receiver Service"
set "DESCRIPTION=接收Jenkins部署文件的HTTP服务"

:: 检查服务是否已存在
sc query %SERVICE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [警告] 服务已存在，正在停止并删除...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 2 >nul
    sc delete %SERVICE_NAME%
    timeout /t 2 >nul
)

:: 使用 sc 创建服务
echo [1/3] 创建服务...
sc create %SERVICE_NAME% binPath= "\"%EXE_PATH%\" -service" start= auto DisplayName= "%DISPLAY_NAME%"
if %errorlevel% neq 0 (
    echo [错误] 服务创建失败
    pause
    exit /b 1
)

:: 设置服务描述
echo [2/3] 配置服务...
sc description %SERVICE_NAME% "%DESCRIPTION%"

:: 启动服务
echo [3/3] 启动服务...
sc start %SERVICE_NAME%
if %errorlevel% neq 0 (
    echo [警告] 服务启动失败，可能需要手动启动
    echo 请在服务管理器中检查服务状态
)

echo.
echo ========================================
echo   服务安装完成!
echo.
echo   服务名称: %SERVICE_NAME%
echo   状态: 已启动（自动启动）
echo.
echo   管理命令:
echo   - 停止服务: sc stop %SERVICE_NAME%
echo   - 启动服务: sc start %SERVICE_NAME%
echo   - 删除服务: sc delete %SERVICE_NAME%
echo   - 查看状态: sc query %SERVICE_NAME%
echo ========================================
echo.
pause
