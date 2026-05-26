@echo off
chcp 65001 >nul
title 学生积分管理平台 - 依赖安装

echo.
echo ================================================
echo         学生积分管理平台 - 依赖安装
echo ================================================
echo.

set "DEPLOY_DIR=%~dp0"
set "BACKEND_DIR=%DEPLOY_DIR%..\backend"
set "FRONTEND_DIR=%DEPLOY_DIR%..\frontend"

echo [1/4] 检查Python环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Python未安装或未添加到PATH
    pause
    exit /b 1
)
python --version
echo ✓ Python环境正常

echo.
echo [2/4] 检查Node.js环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Node.js未安装或未添加到PATH
    pause
    exit /b 1
)
node --version
echo ✓ Node.js环境正常

echo.
echo [3/4] 安装后端依赖...
cd /d "%BACKEND_DIR%"
echo.
echo 正在安装后端依赖...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo ⚠ 安装遇到问题，尝试继续...
    echo.
)
pip install flask_restx apscheduler waitress
echo ✓ 后端依赖安装完成

echo.
echo [4/4] 安装前端依赖...
cd /d "%FRONTEND_DIR%"
echo.
echo 正在安装前端依赖...
echo (这可能需要几分钟，请耐心等待...)
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ⚠ npm install 遇到问题，尝试清除缓存...
    call npm cache clean --force
    call npm install
)
echo ✓ 前端依赖安装完成

echo.
echo ================================================
echo 依赖安装完成！
echo ================================================
echo.
echo 接下来运行 start.bat 启动服务
echo.
echo 💡 如果遇到问题，请查看 DEPLOYMENT_GUIDE.md
echo.
pause
