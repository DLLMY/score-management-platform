@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Request admin privileges if not running as admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [.] Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================
echo    Create Scheduled Task - Auto Start
echo ========================================
echo.

set "VBS_PATH=%~dp0run_silent.vbs"
set "TASK_NAME=RemoteNotifyListener"

if not exist "%VBS_PATH%" (
    echo [ERROR] run_silent.vbs not found!
    echo Expected: %VBS_PATH%
    pause
    exit /b 1
)

echo [1] Task Name: %TASK_NAME%
echo [2] Script: %VBS_PATH%
echo.

rem Delete existing task if exists
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% == 0 (
    echo [.] Removing existing task...
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
)

echo [3] Creating new task...
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%VBS_PATH%\"" /sc onlogon /rl highest /f >nul 2>&1

if %errorlevel% == 0 (
    echo.
    echo [OK] Task created successfully!
    echo.
    echo ========================================
    echo    Configuration Summary
echo ========================================
    echo Task Name: %TASK_NAME%
    echo Trigger: On user logon
echo Run As: Highest privileges
echo Script: %VBS_PATH%
    echo.
    echo The listener will auto-start when you login.
    echo.
    echo To manage the task:
    echo   View: schtasks /query /tn "%TASK_NAME%"
    echo   Delete: schtasks /delete /tn "%TASK_NAME%" /f
    echo   Run now: schtasks /run /tn "%TASK_NAME%"
) else (
    echo [ERROR] Failed to create task.
)

echo.
pause
