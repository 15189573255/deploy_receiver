@echo off
chcp 65001 >nul
echo ========================================
echo   卸载 Deploy Receiver Windows 服务
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

set "SERVICE_NAME=DeployReceiver"

:: 检查服务是否存在
sc query %SERVICE_NAME% >nul 2>&1
if %errorlevel% neq 0 (
    echo [提示] 服务不存在或已被删除
    pause
    exit /b 0
)

:: 停止服务
echo [1/2] 停止服务...
sc stop %SERVICE_NAME% >nul 2>&1
timeout /t 3 >nul

:: 删除服务
echo [2/2] 删除服务...
sc delete %SERVICE_NAME%
if %errorlevel% neq 0 (
    echo [错误] 服务删除失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo   服务已成功卸载!
echo ========================================
echo.
pause
