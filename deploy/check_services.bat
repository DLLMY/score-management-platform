@echo off
chcp 65001 >nul
title 学生积分管理平台 - 服务检查工具

echo.
echo ================================================
echo       学生积分管理平台 - 服务检查工具
echo ================================================
echo.

echo 正在检查服务状态...
echo.

:check_5000
netstat -ano | findstr ":5000" >nul
if %errorlevel% equ 0 (
    echo ✓ 后端服务运行中 (端口: 5000)
) else (
    echo ✗ 后端服务未运行 (端口: 5000)
)

:check_3000
netstat -ano | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo ✓ 前端服务运行中 (端口: 3000)
) else (
    echo ✗ 前端服务未运行 (端口: 3000)
)

:check_4040
netstat -ano | findstr ":4040" >nul
if %errorlevel% equ 0 (
    echo ✓ ngrok管理面板运行中 (端口: 4040)
) else (
    echo ✗ ngrok可能未运行 (端口: 4040)
)

echo.
echo ================================================
echo.
echo 💡 访问地址:
echo.
echo    本地访问:  http://localhost:3000
echo    ngrok面板: http://localhost:4040
echo.
echo ================================================
echo.
pause
