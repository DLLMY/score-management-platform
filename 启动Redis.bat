@echo off
chcp 65001 >nul
echo ========================================
echo   Redis 服务启动脚本
echo ========================================
echo.

REM 检查Redis是否已在运行
netstat -ano | findstr ":6379" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo Redis服务已在运行
    goto :eof
)

echo 正在启动Redis服务...
echo.

REM 启动Redis服务器
start "" "C:\Redis\redis-server.exe" --port 6379

REM 等待Redis启动
echo 等待Redis启动...
timeout /t 2 /nobreak >nul

REM 验证Redis是否启动成功
netstat -ano | findstr ":6379" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo Redis服务启动成功！
) else (
    echo Redis服务启动失败！
)

echo.
pause
