@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo    Remote Notify - Status Check
echo ========================================
echo.

echo [1] Checking process...
tasklist | findstr "pythonw.exe" >nul 2>&1
if %errorlevel% == 0 (
    echo     [OK] pythonw.exe is running
) else (
    echo     [X] pythonw.exe NOT running
)
echo.

echo [2] Checking log file...
if exist "listener.log" (
    echo     [OK] listener.log exists
    echo.
    echo     --- Last 10 lines ---
    powershell -Command "$lines = Get-Content 'listener.log'; $lines[-10..-1] | ForEach-Object { Write-Host '    ' $_ }" 2>nul
    echo     -------------------
) else (
    echo     [X] listener.log NOT found
)
echo.

echo [3] Checking MQTT connection...
findstr /i "Connected to MQTT Broker" "listener.log" >nul 2>&1
if %errorlevel% == 0 (
    echo     [OK] Connected to MQTT Broker
) else (
    echo     [.] Waiting for connection or not connected
)
echo.

echo [4] Client ID:
powershell -Command "$line = Select-String -Path 'listener.log' -Pattern 'Client ID:' | Select-Object -Last 1; if ($line) { Write-Host '    ' $line.Line } else { Write-Host '    [.] Not found yet' }" 2>nul
echo.

echo ========================================
pause
