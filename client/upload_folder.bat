@echo off
chcp 65001 >nul

if "%~1"=="" (
    echo Usage: upload_folder.bat folder_path path_key [server_addr] [private_key]
    echo.
    echo Example:
    echo   upload_folder.bat D:\dist web
    echo   upload_folder.bat D:\dist web http://192.168.1.100:8022
    echo   upload_folder.bat D:\dist web http://192.168.1.100:8022 your_private_key
    echo.
    echo Params:
    echo   folder_path  - Local folder to upload
    echo   path_key     - Server configured path key, e.g. web, api
    echo   server_addr  - Optional, default http://localhost:8022
    echo   private_key  - Optional, required if server auth is enabled
    exit /b 1
)

set FOLDER=%~1
set PATHKEY=%~2
set SERVER=%~3
set PRIVATEKEY=%~4

if "%SERVER%"=="" set SERVER=http://localhost:8022

if "%PRIVATEKEY%"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload_folder.ps1" -Folder "%FOLDER%" -PathKey "%PATHKEY%" -Server "%SERVER%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0upload_folder.ps1" -Folder "%FOLDER%" -PathKey "%PATHKEY%" -Server "%SERVER%" -PrivateKey "%PRIVATEKEY%"
)
