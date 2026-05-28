# Windows 服务管理脚本
param(
    [ValidateSet("install", "start", "stop", "restart", "status", "uninstall")]
    [string]$Action = "status",
    
    [string]$ServiceName = "ClassIntegralSystem"
)

# 项目路径
$ProjectPath = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
$BackendPath = "$ProjectPath\backend"
$FrontendPath = "$ProjectPath\frontend"
$LogPath = "$ProjectPath\deploy\logs"

# 确保日志目录存在
if (-not (Test-Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
}

function Get-ServiceStatus {
    param([string]$Name)
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($service) {
        return $service.Status
    }
    return "NotInstalled"
}

function Start-Backend {
    Write-Host "启动后端服务..." -ForegroundColor Green
    $backendLog = "$LogPath\backend_$(Get-Date -Format 'yyyyMMdd').log"
    Push-Location $BackendPath
    Start-Process -FilePath "python" -ArgumentList "app.py" -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError "$LogPath\backend_error.log"
    Pop-Location
    Start-Sleep -Seconds 3
    Write-Host "后端服务已启动 (日志: $backendLog)" -ForegroundColor Cyan
}

function Start-Frontend {
    Write-Host "启动前端服务..." -ForegroundColor Green
    $frontendLog = "$LogPath\frontend_$(Get-Date -Format 'yyyyMMdd').log"
    Push-Location $FrontendPath
    Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError "$LogPath\frontend_error.log"
    Pop-Location
    Start-Sleep -Seconds 5
    Write-Host "前端服务已启动 (日志: $frontendLog)" -ForegroundColor Cyan
}

function Stop-All {
    Write-Host "停止所有服务..." -ForegroundColor Yellow
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "所有服务已停止" -ForegroundColor Red
}

switch ($Action) {
    "install" {
        Write-Host "=== 安装班级积分管理系统服务 ===" -ForegroundColor Cyan
        Stop-All
        Write-Host "服务已准备就绪，使用 'start' 命令启动" -ForegroundColor Green
    }
    "start" {
        Write-Host "=== 启动班级积分管理系统 ===" -ForegroundColor Cyan
        Stop-All
        Start-Backend
        Start-Frontend
        Write-Host ""
        Write-Host "系统已启动！" -ForegroundColor Green
        Write-Host "  - 前端: http://localhost:3000" -ForegroundColor White
        Write-Host "  - 后端: http://localhost:5000" -ForegroundColor White
        Write-Host "  - API文档: http://localhost:5000/api/docs/" -ForegroundColor White
    }
    "stop" {
        Stop-All
    }
    "restart" {
        Write-Host "=== 重启班级积分管理系统 ===" -ForegroundColor Cyan
        Stop-All
        Start-Backend
        Start-Frontend
        Write-Host "系统已重启！" -ForegroundColor Green
    }
    "status" {
        Write-Host "=== 服务状态 ===" -ForegroundColor Cyan
        $python = Get-Process -Name "python" -ErrorAction SilentlyContinue
        $node = Get-Process -Name "node" -ErrorAction SilentlyContinue
        Write-Host "后端: $(if ($python) { 'Running' } else { 'Stopped' })" -ForegroundColor $(if ($python) { 'Green' } else { 'Red' })
        Write-Host "前端: $(if ($node) { 'Running' } else { 'Stopped' })" -ForegroundColor $(if ($node) { 'Green' } else { 'Red' })
    }
    "uninstall" {
        Stop-All
        Write-Host "服务已卸载" -ForegroundColor Red
    }
}
