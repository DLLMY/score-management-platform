@echo off
setlocal

cd /d "%~dp0"

echo.
echo ==============================================
echo     远程通知接收端 - 卸载脚本
echo ==============================================
echo.

rem 检查管理员权限
fltmc >nul 2>&1 || (
    echo 需要管理员权限，请右键以管理员身份运行此脚本
    pause
    exit /b 1
)

set "SERVICE_NAME=RemoteNotifyListener"
set "NSSM_EXE=nssm.exe"

rem ========== 1. 停止并删除服务 ==========
echo [1/2] 停止并删除Windows服务...

if exist "%NSSM_EXE%" (
    "%NSSM_EXE%" stop "%SERVICE_NAME%" >nul 2>&1
    "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm >nul 2>&1
    echo OK: 服务已删除
) else (
    echo WARNING: NSSM不存在，尝试通过sc命令删除
    sc stop "%SERVICE_NAME%" >nul 2>&1
    sc delete "%SERVICE_NAME%" >nul 2>&1
    echo OK: 服务已删除
)

rem ========== 2. 删除开机自启动快捷方式 ==========
echo.
echo [2/2] 删除开机自启动...

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
del "%STARTUP_FOLDER%\RemoteNotifyListener.lnk" >nul 2>&1
echo OK: 开机自启动已删除

rem ========== 完成 ==========
echo.
echo ==============================================
echo           卸载完成！
echo ==============================================
echo.
echo 已完成以下操作：
echo 1. Windows服务已停止并删除
echo 2. 开机自启动已删除
echo.
echo 注意：Python和依赖包未删除，如果需要请手动卸载
echo.
pause