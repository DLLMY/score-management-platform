@echo off
chcp 65001 >nul
title Student Score Management Platform - Deploy System
color 0A

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "REDIS_DIR=%PROJECT_DIR%\redis"
set "NGROK_DIR=%SCRIPT_DIR%ngrok"
set "DOWNLOAD_SCRIPT=%SCRIPT_DIR%download_deps.py"

cls
echo ============================================================
echo           Student Score Management Platform
echo                    Deploy System v2.0
echo ============================================================
echo.
echo Auto install:
echo   - Python packages (Flask, SQLAlchemy, Redis client)
echo   - Node.js packages (React, Tailwind, Lucide)
echo   - SQLite (built-in)
echo   - Config files (.env)
echo   - Redis Server (auto-download if missing)
echo   - ngrok (auto-download if missing)
echo.
echo Require pre-install:
echo   - Python 3.10+
echo   - Node.js 16+
echo.
echo Optional:
echo   - Redis Server (will be auto-downloaded if not found)
echo ============================================================

echo.
echo [Step 1/8] Checking Python environment...
py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.10+ and add to PATH
    timeout /t 10 /nobreak >nul
    exit /b 1
)
for /f "tokens=2" %%a in ('py --version 2^>^&1') do set "PY_VER=%%a"
echo OK: Python %PY_VER% installed

echo.
echo [Step 2/8] Checking Node.js environment...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js 16+ and add to PATH
    timeout /t 10 /nobreak >nul
    exit /b 1
)
for /f "tokens=1" %%a in ('node --version 2^>^&1') do set "NODE_VER=%%a"
echo OK: Node.js %NODE_VER% installed

echo.
echo [Step 3/8] Checking and downloading dependencies...
set "NEED_DOWNLOAD=N"

if not exist "%REDIS_DIR%\redis-server.exe" (
    echo INFO: Redis not found, will download...
    set "NEED_DOWNLOAD=Y"
) else (
    echo OK: Redis already installed
)

if not exist "%NGROK_DIR%\ngrok.exe" (
    echo INFO: ngrok not found, will download...
    set "NEED_DOWNLOAD=Y"
) else (
    echo OK: ngrok already installed
)

if /i "%NEED_DOWNLOAD%"=="Y" (
    echo Starting download script...
    py "%DOWNLOAD_SCRIPT%"
    if %errorlevel% neq 0 (
        echo WARN: Some dependencies may not have been downloaded properly
    )
)

echo.
echo [Step 4/8] Installing Python dependencies...
cd /d "%BACKEND_DIR%"
py -m pip install -r requirements.txt --quiet
if %errorlevel% equ 0 (
    echo OK: Python dependencies installed
) else (
    echo WARN: Some Python dependencies may have failed to install
)

echo.
echo [Step 5/8] Installing Node.js dependencies...
cd /d "%FRONTEND_DIR%"
call npm install --legacy-peer-deps --quiet
if %errorlevel% equ 0 (
    echo OK: Node.js dependencies installed
) else (
    echo WARN: Some Node.js dependencies may have failed to install
)

echo.
echo [Step 6/8] Creating configuration...
cd /d "%BACKEND_DIR%"
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo Created .env from example
    )
)
if not exist "instance" mkdir instance
echo OK: Configuration created

echo.
echo [Step 7/8] Cleaning existing services...
echo Killing existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :6379 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
echo OK: Cleanup completed

echo.
echo [Step 8/8] Starting services...

if exist "%REDIS_DIR%\redis-server.exe" (
    echo Starting Redis server...
    start "Redis Server" cmd /k "cd /d ""%REDIS_DIR%"" && redis-server.exe --bind 127.0.0.1 --port 6379"
    timeout /t 2 /nobreak >nul
    echo OK: Redis server started
) else (
    echo WARN: Redis not found, using in-memory storage
)

echo Starting backend service...
start "Backend Service" cmd /k "cd /d ""%BACKEND_DIR%"" && py run.py --env development"
timeout /t 5 /nobreak >nul

echo Starting frontend service...
start "Frontend Service" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm start"
timeout /t 3 /nobreak >nul

cls
echo ============================================================
echo DEPLOYMENT COMPLETED!
echo ============================================================
echo Local Access:
echo   Frontend: http://localhost:3000
echo   Backend API: http://localhost:5000
echo   API Docs: http://localhost:5000/apidocs
echo   Redis: localhost:6379
echo ============================================================
echo Public Access (via ngrok):
echo   Run: deploy\ngrok\ngrok.exe http 3001
echo ============================================================
echo Login Information:
echo   Username: admin
echo   Password: admin123
echo ============================================================
echo Service windows are open.
echo This window will close in 15 seconds...
timeout /t 15 /nobreak >nul
