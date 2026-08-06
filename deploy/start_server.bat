@echo off
chcp 65001 >nul 2>&1
title 学生积分管理平台 - 服务器模式启动

:: 设置UTF-8环境变量
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

:: 获取脚本目录
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "REDIS_DIR=%SCRIPT_DIR%redis"
set "NGROK_DIR=%SCRIPT_DIR%ngrok"
set "LOGS_DIR=%SCRIPT_DIR%logs"

:: 创建日志目录
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

:: 查找Python路径（兼容不同安装位置）
set "PYTHON_EXE="
if exist "C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=C:\Users\53527\AppData\Local\Programs\Python\Python311\python.exe"
) else if exist "%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe"
) else if exist "C:\Python311\python.exe" (
    set "PYTHON_EXE=C:\Python311\python.exe"
) else if exist "C:\Program Files\Python311\python.exe" (
    set "PYTHON_EXE=C:\Program Files\Python311\python.exe"
) else (
    :: 尝试从PATH中获取
    for /f "tokens=*" %%i in ('where python 2^>nul') do (
        set "PYTHON_EXE=%%i"
        goto :found_python
    )
)

:found_python
if "%PYTHON_EXE%"=="" (
    echo [ERROR] 未找到Python，请先安装Python 3.11+
    echo.
    echo 请运行 install_env.ps1 安装环境依赖
    pause
    exit /b 1
)

echo ============================================================
echo           学生积分管理平台 - 服务器模式启动
echo ============================================================
echo.
echo [INFO] Python路径: %PYTHON_EXE%
echo [INFO] 项目目录: %PROJECT_DIR%
echo [INFO] 日志目录: %LOGS_DIR%
echo.

:: 检查端口占用并清理
echo [STEP 1] 检查并清理端口占用...
for %%p in (5000 3000 6379 4040) do (
    netstat -ano | findstr ":%%p " >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] 端口 %%p 已被占用，正在清理...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p "') do (
            taskkill /F /PID %%a >nul 2>&1
        )
    )
)
echo [OK] 端口清理完成
echo.

:: 启动Redis
echo [STEP 2] 启动Redis服务...
if exist "%REDIS_DIR%\redis-server.exe" (
    start "Redis Server" /min "%REDIS_DIR%\redis-server.exe" "%REDIS_DIR%\redis.windows.conf"
    timeout /t 3 /nobreak >nul
    echo [OK] Redis已启动 (端口: 6379)
) else (
    echo [WARN] Redis未安装，将使用内存存储
)
echo.

:: 启动后端服务（生产模式）
echo [STEP 3] 启动后端服务 (生产模式)...
cd /d "%BACKEND_DIR%"
start "Backend Server" /min cmd /c "chcp 65001 >nul && set PYTHONIOENCODING=utf-8 && %PYTHON_EXE% -c \"import sys; sys.path.insert(0, '.'); from startup.run import main; main()\" > \"%LOGS_DIR%\backend.log\" 2>&1"
timeout /t 8 /nobreak >nul
echo [OK] 后端服务已启动 (端口: 5000)
echo.

:: 启动前端服务（静态文件服务）
echo [STEP 4] 启动前端服务...
cd /d "%FRONTEND_DIR%"
if exist "%FRONTEND_DIR%\build" (
    :: 使用Python HTTP服务器提供静态文件
    start "Frontend Server" /min cmd /c "chcp 65001 >nul && %PYTHON_EXE% -m http.server 3000 --directory build > \"%LOGS_DIR%\frontend.log\" 2>&1"
    echo [OK] 前端静态服务已启动 (端口: 3000)
) else (
    :: 开发模式运行
    echo [INFO] 前端构建目录不存在，使用开发模式...
    start "Frontend Dev" cmd /c "chcp 65001 >nul && npm start > \"%LOGS_DIR%\frontend.log\" 2>&1"
    timeout /t 15 /nobreak >nul
    echo [OK] 前端开发服务已启动 (端口: 3000)
)
echo.

:: 启动ngrok（外网穿透）
echo [STEP 5] 启动ngrok外网穿透...
cd /d "%NGROK_DIR%"
if exist "%NGROK_DIR%\ngrok.exe" (
    if exist "%NGROK_DIR%\ngrok.yml" (
        start "Ngrok Tunnel" /min "%NGROK_DIR%\ngrok.exe" start --config "%NGROK_DIR%\ngrok.yml" proxy
    ) else (
        start "Ngrok Tunnel" /min "%NGROK_DIR%\ngrok.exe" http 3000
    )
    timeout /t 3 /nobreak >nul
    echo [OK] ngrok已启动 (管理面板: http://localhost:4040)
) else (
    echo [WARN] ngrok未安装，外网穿透功能不可用
)
echo.

:: 等待服务完全启动
echo [STEP 6] 等待服务完全启动...
timeout /t 5 /nobreak >nul

:: 验证服务状态
echo.
echo ============================================================
echo                  服务启动状态验证
echo ============================================================
echo.

:: 检查后端
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 后端服务运行正常
) else (
    echo [WARN] 后端服务可能未完全启动，请查看日志
)

:: 检查前端
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] 前端服务运行正常
) else (
    echo [WARN] 前端服务可能未完全启动，请查看日志
)

:: 检查Redis
netstat -ano | findstr ":6379 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Redis服务运行正常
) else (
    echo [WARN] Redis服务可能未完全启动
)

:: 检查ngrok
netstat -ano | findstr ":4040 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] ngrok服务运行正常
) else (
    echo [INFO] ngrok管理面板未启动（不影响本地使用）
)

echo.
echo ============================================================
echo                   启动完成！
echo ============================================================
echo.
echo   本地访问地址:  http://localhost:3000
echo   后端API地址:   http://localhost:5000
echo   ngrok管理面板: http://localhost:4040
echo.
echo   默认登录账号:  admin
echo   默认登录密码:  123456
echo.
echo   日志文件位置:  %LOGS_DIR%
echo.
echo ============================================================
echo   提示: 所有服务在后台运行，关闭此窗口不影响服务
echo   如需停止服务，请运行 stop_all.bat
echo ============================================================
echo.

:: 不自动打开浏览器（服务器模式）
echo [INFO] 服务器模式不自动打开浏览器
echo.

pause