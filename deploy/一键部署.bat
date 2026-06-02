@echo off
chcp 65001 >nul
title Student Score Management Platform - Deploy System

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%deploy.ps1"

echo ============================================================
echo          Student Score Management Platform
echo                   Deploy System v2.1
echo ============================================================
echo.

if not exist "%PS_SCRIPT%" (
    echo [ERROR] PowerShell script not found!
    echo Looking for: %PS_SCRIPT%
    echo.
    pause
    exit /b 1
)

echo [INFO] Found deployment script: %PS_SCRIPT%
echo [INFO] Starting deployment process...
echo.

powershell.exe -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

echo.
echo ============================================================
echo                   Deployment Completed
echo ============================================================
echo.
echo If you encounter any issues, please check the error messages above.
echo.
pause