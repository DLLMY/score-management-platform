@echo off
chcp 65001 >nul
echo ========================================
echo   Redis 服务启动脚本
echo ========================================
echo.

setlocal enabledelayedexpansion

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%."
set "REDIS_DIR=%PROJECT_DIR%\redis"
set "REDIS_EXE=%REDIS_DIR%\redis-server.exe"

REM 检查Redis是否已在运行
netstat -ano | findstr ":6379" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo Redis服务已在运行
    goto :eof
)

echo 正在启动Redis服务...
echo.

REM 检查Redis是否在项目目录中
if exist "%REDIS_EXE%" (
    REM 使用项目目录中的Redis
    start "" "%REDIS_EXE%" --port 6379
) else (
    REM 尝试使用系统安装的Redis
    if exist "C:\Redis\redis-server.exe" (
        start "" "C:\Redis\redis-server.exe" --port 6379
    ) else (
        echo ERROR: Redis未找到！
        echo 请确保Redis已安装或已通过一键部署脚本下载
        pause
        goto :eof
    )
)

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
