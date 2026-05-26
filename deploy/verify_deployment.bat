@echo off
chcp 65001 >nul
title 学生积分管理平台 - 部署包验证

echo.
echo ================================================
echo       学生积分管理平台 - 部署包验证
echo ================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "VALID=1"

echo 正在检查部署包完整性...
echo.

echo [1/6] 检查部署脚本...
if exist "%SCRIPT_DIR%start.bat" (
    echo   ✓ start.bat
) else (
    echo   ✗ start.bat 缺失
    set "VALID=0"
)

if exist "%SCRIPT_DIR%install_dependencies.bat" (
    echo   ✓ install_dependencies.bat
) else (
    echo   ✗ install_dependencies.bat 缺失
    set "VALID=0"
)

if exist "%SCRIPT_DIR%service_manager.py" (
    echo   ✓ service_manager.py
) else (
    echo   ✗ service_manager.py 缺失
    set "VALID=0"
)

echo.
echo [2/6] 检查ngrok...
if exist "%SCRIPT_DIR%ngrok\ngrok.exe" (
    echo   ✓ ngrok.exe
) else (
    echo   ✗ ngrok.exe 缺失
    set "VALID=0"
)

echo.
echo [3/6] 检查后端...
if exist "%SCRIPT_DIR%..\backend\app.py" (
    echo   ✓ app.py
) else (
    echo   ✗ app.py 缺失
    set "VALID=0"
)

if exist "%SCRIPT_DIR%..\backend\requirements.txt" (
    echo   ✓ requirements.txt
) else (
    echo   ✗ requirements.txt 缺失
    set "VALID=0"
)

echo.
echo [4/6] 检查前端...
if exist "%SCRIPT_DIR%..\frontend\package.json" (
    echo   ✓ package.json
) else (
    echo   ✗ package.json 缺失
    set "VALID=0"
)

if exist "%SCRIPT_DIR%..\frontend\.env" (
    echo   ✓ .env
) else (
    echo   ✗ .env 缺失
    set "VALID=0"
)

echo.
echo [5/6] 检查文档...
if exist "%SCRIPT_DIR%README.md" (
    echo   ✓ README.md
) else (
    echo   ⚠ README.md 缺失
)

if exist "%SCRIPT_DIR%DEPLOYMENT_GUIDE.md" (
    echo   ✓ DEPLOYMENT_GUIDE.md
) else (
    echo   ⚠ DEPLOYMENT_GUIDE.md 缺失
)

echo.
echo [6/6] 检查文档...
if exist "%SCRIPT_DIR%NEW_SERVER_DEPLOYMENT.md" (
    echo   ✓ NEW_SERVER_DEPLOYMENT.md
) else (
    echo   ⚠ NEW_SERVER_DEPLOYMENT.md 缺失
)

if exist "%SCRIPT_DIR%DEPLOY_CHECKLIST.md" (
    echo   ✓ DEPLOY_CHECKLIST.md
) else (
    echo   ⚠ DEPLOY_CHECKLIST.md 缺失
)

echo.
echo ================================================
if "%VALID%"=="1" (
    echo   ✓ 部署包完整！
) else (
    echo   ✗ 部署包不完整，有文件缺失！
)
echo ================================================
echo.
echo 💡 如果部署包完整，可以开始部署！
echo.
echo   1. 运行 install_dependencies.bat 安装依赖
echo   2. 运行 start.bat 启动服务
echo.
echo 📚 详细文档请查看 NEW_SERVER_DEPLOYMENT.md
echo.
pause
