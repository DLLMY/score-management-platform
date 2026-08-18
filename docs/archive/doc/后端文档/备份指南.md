# 数据库备份脚本

## 功能
自动备份SQLite数据库到 `backups` 目录

## 使用方法

### 手动备份
```powershell
# 在backend目录下执行
python backup_db.py
```

### 自动备份（建议）
可以设置Windows任务计划程序，每天自动执行备份

## 备份文件
备份文件保存在 `backend/backups/` 目录下，文件名格式：
```
score_management_backup_YYYYMMDD_HHMMSS.db
```

## 恢复数据
如果需要恢复数据：
1. 停止后端服务
2. 将备份文件复制到 `instance/score_management.db`
3. 重启后端服务
