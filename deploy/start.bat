@echo off
chcp 65001 >nul
title 学生积分管理平台 - 服务启动器

set "SCRIPT_DIR=%~dp0"

echo.
echo ================================================
echo       学生积分管理平台 - 一键启动
echo ================================================
echo.

cd /d "%SCRIPT_DIR%"

echo [1/2] 检查Python环境...
py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Python未安装或未添加到PATH
    echo.
    echo 请先安装Python 3.10+ 并添加到PATH
    pause
    exit /b 1
)
echo ✓ Python环境正常

echo.
echo [2/2] 启动服务管理器...
py "%SCRIPT_DIR%service_manager.py"

if %errorlevel% neq 0 (
    echo.
    echo 服务启动失败，尝试手动启动...
    echo.
    echo 请按以下步骤手动启动：
    echo 1. cd ..\backend ^&^& py app.py
    echo 2. cd ..\frontend ^&^& npm start
    echo 3. cd ngrok ^&^& ngrok http 3000
    echo.
)

pause
