@echo off
chcp 65001 >nul
echo.
echo ================================================
echo         NGROK 内网穿透启动脚本
echo ================================================
echo.

cd "%~dp0"

echo [1/2] 检查配置文件...
if exist ngrok.yml (
    echo ✓ 配置文件存在
    echo.
    echo [2/2] 使用配置文件启动...
    ngrok.exe start --config ngrok.yml --all
) else (
    echo ✗ 配置文件不存在，使用默认方式启动...
    echo.
    ngrok.exe http 3000
)

echo.
echo ================================================
echo 提示：访问 http://localhost:4040 查看管理面板
echo ================================================
pause