@echo off
chcp 65001 >nul 2>&1
title 学生积分管理平台 - 停止所有服务

echo ============================================================
echo           学生积分管理平台 - 停止所有服务
echo ============================================================
echo.

echo [STEP 1] 正在停止所有服务...
echo.

:: 停止端口5000上的进程（后端）
echo [INFO] 停止后端服务 (端口: 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] 已停止进程 PID: %%a
)

:: 停止端口3000上的进程（前端）
echo [INFO] 停止前端服务 (端口: 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] 已停止进程 PID: %%a
)

:: 停止端口6379上的进程（Redis）
echo [INFO] 停止Redis服务 (端口: 6379)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":6379 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] 已停止进程 PID: %%a
)

:: 停止端口4040上的进程（ngrok）
echo [INFO] 停止ngrok服务 (端口: 4040)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4040 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] 已停止进程 PID: %%a
)

:: 通过窗口标题停止进程
echo [INFO] 通过窗口标题停止进程...
taskkill /FI "WINDOWTITLE eq Backend Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend Dev*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Redis Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Ngrok Tunnel*" /F >nul 2>&1

echo.
echo [STEP 2] 验证服务停止状态...
echo.

:: 验证端口是否已释放
set "all_stopped=1"

netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 端口 5000 仍被占用
    set "all_stopped=0"
) else (
    echo [OK] 端口 5000 已释放
)

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 端口 3000 仍被占用
    set "all_stopped=0"
) else (
    echo [OK] 端口 3000 已释放
)

netstat -ano | findstr ":6379 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 端口 6379 仍被占用
    set "all_stopped=0"
) else (
    echo [OK] 端口 6379 已释放
)

netstat -ano | findstr ":4040 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARN] 端口 4040 仍被占用
    set "all_stopped=0"
) else (
    echo [OK] 端口 4040 已释放
)

echo.
echo ============================================================
if "%all_stopped%"=="1" (
    echo [OK] 所有服务已成功停止
) else (
    echo [WARN] 部分服务可能未完全停止，请手动检查
    echo [INFO] 可尝试重启电脑或手动关闭相关进程
)
echo ============================================================
echo.

pause