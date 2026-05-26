@echo off
REM 自动备份数据库脚本
REM 使用方法：
REM 1. 右键点击此文件 -> 创建快捷方式
REM 2. 右键点击快捷方式 -> 属性
REM 3. 在"目标"后面添加： "D:\path\to\backup_db.py" backup
REM 4. 设置任务计划程序定期执行

cd /d "%~dp0"
python backup_db.py backup

echo.
echo 备份完成！按任意键退出...
pause >nul
