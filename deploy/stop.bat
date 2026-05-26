@echo off
chcp 65001 >nul
title 学生积分管理平台 - 服务停止器

set "SCRIPT_DIR=%~dp0"

echo.
echo ================================================
echo       学生积分管理平台 - 一键停止
echo ================================================
echo.

echo [1/1] 停止所有服务...
python "%SCRIPT_DIR%service_manager.py" stop

echo ✓ 所有服务已停止
pause