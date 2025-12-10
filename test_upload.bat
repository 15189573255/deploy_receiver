@echo off
chcp 65001 >nul
echo ========================================
echo   Deploy Receiver 上传测试
echo ========================================
echo.

:: 配置
set "SERVER=http://localhost:8022"
set "TEST_FILE=test_upload.txt"

:: 创建测试文件
echo 这是一个测试文件 > %TEST_FILE%
echo 创建时间: %date% %time% >> %TEST_FILE%
echo Hello from Deploy Receiver Test! >> %TEST_FILE%

echo [测试 1] 健康检查...
curl -s %SERVER%/health
echo.
echo.

echo [测试 2] 获取服务信息...
curl -s %SERVER%/
echo.
echo.

echo [测试 3] 上传文件到 web 路径...
curl -X POST --data-binary @%TEST_FILE% %SERVER%/upload/web/%TEST_FILE%
echo.
echo.

echo [测试 4] 上传文件到 api 路径...
curl -X POST --data-binary @%TEST_FILE% %SERVER%/upload/api/subdir/%TEST_FILE%
echo.
echo.

echo [测试 5] 测试无效路径...
curl -X POST --data-binary @%TEST_FILE% %SERVER%/upload/invalid/%TEST_FILE%
echo.
echo.

:: 清理测试文件
del %TEST_FILE% 2>nul

echo.
echo ========================================
echo   测试完成!
echo   请检查配置的目录中是否有测试文件
echo ========================================
echo.
pause
