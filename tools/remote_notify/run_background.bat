@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在启动后台服务...
echo 正在查找 Python...

rem 自动查找 Python
set "PYTHON_EXE="
for /f "delims=" %%a in ('where py 2^>nul') do set "PYTHON_EXE=%%a"
if not defined PYTHON_EXE (
    for /f "delims=" %%a in ('where python 2^>nul') do set "PYTHON_EXE=%%a"
)

if not defined PYTHON_EXE (
    echo [错误] 未找到 Python，请先安装 Python
    exit /b 1
)

echo 使用 Python: %PYTHON_EXE%

rem 使用 Windows 的 start 命令以最小化窗口启动
start "" /min "%PYTHON_EXE%" -u "%~dp0mqtt_listener.py"

echo 后台服务已启动
echo 查看日志: %~dp0listener.log
echo 停止服务: taskkill /f /im python.exe /fi "WINDOWTITLE eq RemoteNotify*"
exit /b 0
