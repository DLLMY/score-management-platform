@echo off
chcp 65001 >nul
title 学生积分管理平台 - 手动启动 (备用)

echo.
echo ================================================
echo       学生积分管理平台 - 手动启动
echo ================================================
echo.
echo ⚠  这是备用方案，如果 start.bat 失败请用这个
echo.
echo 💡 注意：每个服务需要一个单独的窗口
echo.
pause

echo.
echo ================================================
echo 第1步：启动后端服务
echo ================================================
echo.
echo 正在打开后端窗口...
start "后端服务 - 学生积分管理平台" cmd /k "cd /d %~dp0..\backend && py app.py"

echo.
echo 等待后端启动中...
timeout /t 8 /nobreak >nul

echo.
echo ================================================
echo 第2步：启动前端服务
echo ================================================
echo.
echo 正在打开前端窗口...
start "前端服务 - 学生积分管理平台" cmd /k "cd /d %~dp0..\frontend && npm start"

echo.
echo 等待前端启动中...
timeout /t 15 /nobreak >nul

echo.
echo ================================================
echo 第3步：启动ngrok (可选，用于外网访问)
echo ================================================
echo.
echo 是否启动ngrok？(Y/N)
set /p START_NGROK=
if /i "%START_NGROK%"=="Y" (
    echo.
    echo 正在打开ngrok窗口...
    start "ngrok - 内网穿透" cmd /k "cd /d %~dp0ngrok && ngrok http 3000"
)

echo.
echo ================================================
echo 所有服务已启动！
echo ================================================
echo.
echo 📱 本地访问:  http://localhost:3000
echo 🔗 外网访问:  查看 ngrok 窗口或 http://localhost:4040
echo 🔐 登录信息:  admin / admin123
echo.
echo ================================================
echo.
echo 💡 提示：如果关闭此窗口，其他窗口不会关闭
echo.
echo 如果需要停止服务，请运行: stop.bat
echo.
pause
