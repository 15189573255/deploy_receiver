@echo off
chcp 65001 >nul

if "%~1"=="" (
    echo 用法: upload_folder.bat 文件夹路径 路径标识 [服务器地址] [私钥]
    echo.
    echo 示例:
    echo   upload_folder.bat D:\dist web
    echo   upload_folder.bat D:\dist web http://192.168.1.100:8022
    echo   upload_folder.bat D:\dist web http://192.168.1.100:8022 你的私钥
    echo.
    echo 参数:
    echo   文件夹路径  - 要上传的本地文件夹
    echo   路径标识    - 服务器配置的路径key (如 web, api)
    echo   服务器地址  - 可选，默认 http://localhost:8022
    echo   私钥        - 可选，如果服务器开启了安全认证则必填
    exit /b 1
)

set FOLDER=%~1
set PATHKEY=%~2
set SERVER=%~3
set PRIVATEKEY=%~4

if "%SERVER%"=="" set SERVER=http://localhost:8022

if "%PRIVATEKEY%"=="" (
    powershell -ExecutionPolicy Bypass -File "%~dp0upload_folder.ps1" -Folder "%FOLDER%" -PathKey "%PATHKEY%" -Server "%SERVER%"
) else (
    powershell -ExecutionPolicy Bypass -File "%~dp0upload_folder.ps1" -Folder "%FOLDER%" -PathKey "%PATHKEY%" -Server "%SERVER%" -PrivateKey "%PRIVATEKEY%"
)
