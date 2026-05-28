# 生产环境部署脚本
param(
    [string]$TargetPath = "C:\production\class-manger-integral"
)

Write-Host "=== 班级积分管理系统 - 生产部署 ===" -ForegroundColor Cyan
Write-Host ""

# 创建目标目录
if (-not (Test-Path $TargetPath)) {
    Write-Host "创建目标目录: $TargetPath" -ForegroundColor Green
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
}

# 停止现有服务
Write-Host "停止现有服务..." -ForegroundColor Yellow
$processes = @("python", "node")
foreach ($proc in $processes) {
    Get-Process -Name $proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# 备份当前版本
$backupPath = "$TargetPath\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (Test-Path "$TargetPath\backend") {
    Write-Host "备份当前版本到: $backupPath" -ForegroundColor Yellow
    Copy-Item -Path $TargetPath -Destination $backupPath -Recurse -ErrorAction SilentlyContinue
}

# 复制最新代码
Write-Host "复制最新代码..." -ForegroundColor Green
$sourcePath = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
Copy-Item -Path "$sourcePath\backend" -Destination "$TargetPath\" -Recurse -Force
Copy-Item -Path "$sourcePath\frontend" -Destination "$TargetPath\" -Recurse -Force
Copy-Item -Path "$sourcePath\deploy" -Destination "$TargetPath\" -Recurse -Force

# 复制 .env.example 为 .env
if (-not (Test-Path "$TargetPath\backend\.env")) {
    Write-Host "创建环境配置文件..." -ForegroundColor Yellow
    Copy-Item -Path "$TargetPath\backend\.env.example" -Destination "$TargetPath\backend\.env"
    Write-Host "请手动编辑: $TargetPath\backend\.env" -ForegroundColor Yellow
}

if (-not (Test-Path "$TargetPath\frontend\.env")) {
    Copy-Item -Path "$TargetPath\frontend\.env.example" -Destination "$TargetPath\frontend\.env"
}

# 安装后端依赖
Write-Host "安装后端依赖..." -ForegroundColor Green
Push-Location "$TargetPath\backend"
pip install -r requirements.txt
Pop-Location

# 构建前端
Write-Host "构建前端..." -ForegroundColor Green
Push-Location "$TargetPath\frontend"
npm ci
npm run build
Pop-Location

# 启动服务
Write-Host ""
Write-Host "=== 启动服务 ===" -ForegroundColor Cyan
Write-Host "1. 后端服务 (端口 5000)" -ForegroundColor White
Write-Host "2. 前端服务 (端口 3000)" -ForegroundColor White
Write-Host ""

Write-Host "部署完成！请根据需要启动服务。" -ForegroundColor Green
