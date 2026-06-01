@echo off
chcp 65001 >nul
title Deploy System
color 0A

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..
set BACKEND_DIR=%PROJECT_DIR%\backend
set FRONTEND_DIR=%PROJECT_DIR%\frontend

cls
echo ============================================================
echo           Student Score Management Platform
echo                    Deploy System
echo ============================================================
echo.
echo Auto install:
echo   - Python packages (Flask, SQLAlchemy, Redis client)
echo   - Node.js packages (React, Tailwind, Lucide)
echo   - SQLite (built-in)
echo   - Config files (.env)
echo.
echo Require pre-install:
echo   - Python 3.10+
echo   - Node.js 16+
echo.
echo Optional:
echo   - Redis Server (for better performance)
echo ============================================================

echo.
echo [Step 1/6] Checking Python environment...
py --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found!
    echo Please install Python 3.10+ and add to PATH
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo OK: Python installed

echo.
echo [Step 2/6] Checking Node.js environment...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo Please install Node.js 16+ and add to PATH
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo OK: Node.js installed

echo.
echo [Step 3/6] Installing Python dependencies...
cd /d "%BACKEND_DIR%"
py -m pip install -r requirements.txt --quiet
echo OK: Python dependencies installed

echo.
echo [Step 4/6] Installing Node.js dependencies...
cd /d "%FRONTEND_DIR%"
call npm install --legacy-peer-deps --quiet
echo OK: Node.js dependencies installed

echo.
echo [Step 5/6] Creating configuration...
cd /d "%BACKEND_DIR%"
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
    )
)
if not exist "instance" mkdir instance
echo OK: Configuration created

echo.
echo [Step 6/6] Starting services...
echo Cleaning ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

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
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:5000
echo API Docs: http://localhost:5000/apidocs
echo ============================================================
echo Login Information:
echo Username: admin
echo Password: admin123
echo ============================================================
echo Service windows are open.
echo This window will close in 10 seconds...
timeout /t 10 /nobreak >nul