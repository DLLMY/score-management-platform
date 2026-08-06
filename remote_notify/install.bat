@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "LOG_FILE=%~dp0install.log"
echo ============================================== > "%LOG_FILE%"
echo     Remote Notify Listener - Installer >> "%LOG_FILE%"
echo     Time: %date% %time% >> "%LOG_FILE%"
echo ============================================== >> "%LOG_FILE%"

echo.
echo ==============================================
echo   Remote Notify Listener - Auto Installer
echo ==============================================
echo Detailed log: %LOG_FILE%
echo.

:: Check admin rights
fltmc >nul 2>&1
if not !errorlevel! == 0 (
    echo [*] Requesting administrator privileges...
    powershell -Command "Start-Process cmd.exe -ArgumentList '/c cd /d \"%~dp0\" ^&^& \"%~f0\"' -Verb RunAs"
    exit /b
)

set "PYTHON_URL=https://www.python.org/ftp/python/3.11.4/python-3.11.4-amd64.exe"
set "PYTHON_EXE=python-3.11.4-amd64.exe"
set "PYTHON_INSTALL_DIR=C:\Python311"
set "NSSM_URL=https://nssm.cc/release/nssm-2.24.zip"
set "NSSM_EXE=%~dp0nssm.exe"
set "SERVICE_NAME=RemoteNotifyListener"
set "FOUND_PYTHON="

echo [1/5] Checking Python installation...
echo [1/5] Checking Python installation... >> "%LOG_FILE%"

:: Auto detect Python
for /f "delims=" %%a in ('where py 2^>nul') do (
    set "FOUND_PYTHON=%%a"
    goto :python_found
)
for /f "delims=" %%a in ('where python 2^>nul') do (
    set "FOUND_PYTHON=%%a"
    goto :python_found
)

:python_found
if defined FOUND_PYTHON (
    echo [OK] Found Python: !FOUND_PYTHON!
    echo [OK] Found Python: !FOUND_PYTHON! >> "%LOG_FILE%"
    
    :: Resolve py.exe to actual python.exe
    if /i "!FOUND_PYTHON:~-6!"=="py.exe" (
        for /f "delims=" %%a in ('!FOUND_PYTHON! -c "import sys; print(sys.executable)"') do (
            set "FOUND_PYTHON=%%a"
        )
        echo [OK] Resolved: !FOUND_PYTHON!
        echo [OK] Resolved: !FOUND_PYTHON! >> "%LOG_FILE%"
    )
    
    set "PYTHON_INSTALL_DIR=!FOUND_PYTHON:\python.exe=!"
) else (
    echo [*] Python not found, installing Python 3.11.4...
    echo [*] Python not found, installing... >> "%LOG_FILE%"
    
    if exist "%PYTHON_INSTALL_DIR%\python.exe" (
        echo [OK] Python already installed
        echo [OK] Python already installed >> "%LOG_FILE%"
    ) else (
        echo [*] Downloading Python...
        echo [*] Downloading Python... >> "%LOG_FILE%"
        powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%PYTHON_URL%', '%PYTHON_EXE%')"
        
        if exist "%PYTHON_EXE%" (
            echo [*] Installing Python...
            echo [*] Installing Python... >> "%LOG_FILE%"
            start /wait "" "%PYTHON_EXE%" /quiet InstallAllUsers=1 TargetDir=%PYTHON_INSTALL_DIR% PrependPath=1
            del "%PYTHON_EXE%"
        )
        
        if not exist "%PYTHON_INSTALL_DIR%\python.exe" (
            echo [ERROR] Python installation failed
            echo [ERROR] Python installation failed >> "%LOG_FILE%"
            goto :error
        )
    )
)

echo [2/5] Installing dependencies...
echo [2/5] Installing dependencies... >> "%LOG_FILE%"

"%PYTHON_INSTALL_DIR%\python.exe" -m pip install --upgrade pip --quiet >> "%LOG_FILE%" 2>&1
"%PYTHON_INSTALL_DIR%\python.exe" -m pip install paho-mqtt==1.6.1 pyttsx3==2.90 --quiet >> "%LOG_FILE%" 2>&1

if !errorlevel! == 0 (
    echo [OK] Dependencies installed
    echo [OK] Dependencies installed >> "%LOG_FILE%"
) else (
    echo [ERROR] Failed to install dependencies
    echo [ERROR] Failed to install dependencies >> "%LOG_FILE%"
    goto :error
)

echo [3/5] Preparing NSSM...
echo [3/5] Preparing NSSM... >> "%LOG_FILE%"

if exist "%NSSM_EXE%" (
    echo [OK] NSSM already exists
) else (
    echo [*] Downloading NSSM...
    echo [*] Downloading NSSM... >> "%LOG_FILE%"
    powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%NSSM_URL%', '%~dp0nssm.zip')"
    
    if exist "%~dp0nssm.zip" (
        powershell -Command "Expand-Archive -Path '%~dp0nssm.zip' -DestinationPath '%~dp0' -Force"
        copy "%~dp0nssm-2.24\win64\nssm.exe" "%NSSM_EXE%" >nul
        rmdir /s /q "%~dp0nssm-2.24" 2>nul
        del "%~dp0nssm.zip" 2>nul
        echo [OK] NSSM downloaded
        echo [OK] NSSM downloaded >> "%LOG_FILE%"
    ) else (
        echo [WARNING] NSSM download failed, using sc command
        echo [WARNING] NSSM download failed >> "%LOG_FILE%"
        set "NSSM_EXE="
    )
)

echo [4/5] Creating Windows service...
echo [4/5] Creating Windows service... >> "%LOG_FILE%"

sc stop "%SERVICE_NAME%" >nul 2>&1
sc delete "%SERVICE_NAME%" >nul 2>&1

if not defined NSSM_EXE (
    echo [*] Using sc command...
    sc create "%SERVICE_NAME%" binPath= "%PYTHON_INSTALL_DIR%\python.exe -u \"%~dp0mqtt_listener.py\"" start= auto DisplayName= "Remote Notify Listener" >nul 2>&1
    sc description "%SERVICE_NAME%" "Remote notification listener with TTS and popup support" >nul 2>&1
    sc config "%SERVICE_NAME%" obj= ".\%USERNAME%" password= "" >nul 2>&1
    sc start "%SERVICE_NAME%" >nul 2>&1
) else (
    "%NSSM_EXE%" install "%SERVICE_NAME%" "%PYTHON_INSTALL_DIR%\python.exe"
    "%NSSM_EXE%" set "%SERVICE_NAME%" AppParameters "-u ""%~dp0mqtt_listener.py"""
    "%NSSM_EXE%" set "%SERVICE_NAME%" AppDirectory "%~dp0"
    "%NSSM_EXE%" set "%SERVICE_NAME%" DisplayName "Remote Notify Listener"
    "%NSSM_EXE%" set "%SERVICE_NAME%" Description "Remote notification listener with TTS and popup"
    "%NSSM_EXE%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START
    "%NSSM_EXE%" set "%SERVICE_NAME%" AppStdout "%~dp0service.log"
    "%NSSM_EXE%" set "%SERVICE_NAME%" AppStderr "%~dp0service.log"
    "%NSSM_EXE%" start "%SERVICE_NAME%"
)

echo [OK] Service created
echo [OK] Service created >> "%LOG_FILE%"

echo [5/5] Creating startup scripts...
echo [5/5] Creating startup scripts... >> "%LOG_FILE%"

(
echo @echo off
echo cd /d "%%~dp0"
echo "%PYTHON_INSTALL_DIR%\python.exe" -u mqtt_listener.py
) > "%~dp0run_listener.bat"

(
echo @echo off
echo cd /d "%%~dp0"
echo start /min "" "%PYTHON_INSTALL_DIR%\python.exe" -u mqtt_listener.py
) > "%~dp0run_listener_minimized.bat"

echo [OK] Scripts created
echo [OK] Scripts created >> "%LOG_FILE%"

echo.
echo [*] Waiting for service to start...
timeout /t 3 /nobreak >nul

sc query "%SERVICE_NAME%" | find "RUNNING" >nul 2>&1
if !errorlevel! == 0 (
    echo [OK] Service is running
    echo [OK] Service is running >> "%LOG_FILE%"
) else (
    echo [*] Service starting in background...
    echo [*] Service starting in background... >> "%LOG_FILE%"
)

echo.
echo ==============================================
echo     Installation Complete!
echo ==============================================
echo.
echo [OK] Python detected/installed
echo [OK] Dependencies installed
echo [OK] Windows service created
echo [OK] Startup scripts created
echo.
echo Service: %SERVICE_NAME%
echo Log file: %~dp0service.log
echo Client ID will appear in service.log when connected
echo.
echo Service will auto-start on system boot.
echo.
pause
exit /b 0

:error
echo.
echo ==============================================
echo     Installation Failed!
echo ==============================================
echo Check install.log for details.
echo.
pause
exit /b 1
