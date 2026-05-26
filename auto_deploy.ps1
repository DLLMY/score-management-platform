
<#
.SYNOPSIS
积分管理平台自动部署脚本

.DESCRIPTION
定时检查 Git 仓库更新，自动拉取代码、构建前端、重启后端服务

.NOTES
- 需要配置 SSH 密钥避免密码输入
- 需要提前安装 Node.js、Python、PM2
- 需要配置正确的项目路径
#>

# ========== 配置区域 ==========
$PROJECT_PATH = "C:\Projects\score-management"
$BRANCH = "main"
$LOG_FILE = "C:\Projects\deploy.log"
$ERROR_LOG_FILE = "C:\Projects\deploy_error.log"
$LOCK_FILE = "C:\Projects\deploy.lock"
$PM2_APP_NAME = "score-backend"
$WEBHOOK_URL = $null
# ========== 配置结束 ==========

$logDir = Split-Path $LOG_FILE
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

function Write-Log {
    param(
        [string]$Message,
        [string]$LogFile = $LOG_FILE
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

function Send-Alert {
    param(
        [string]$Message
    )
    if ($WEBHOOK_URL) {
        try {
            $body = @{
                msgtype = "text"
                text = @{
                    content = "部署告警: $Message"
                }
            } | ConvertTo-Json
            Invoke-RestMethod -Uri $WEBHOOK_URL -Method Post -Body $body -ContentType "application/json"
        }
        catch {
            Write-Log "发送告警失败: $_" $ERROR_LOG_FILE
        }
    }
}

if (Test-Path $LOCK_FILE) {
    Write-Log "检测到正在运行的部署进程，退出"
    exit 0
}

try {
    New-Item -Path $LOCK_FILE -ItemType File -Force | Out-Null
}
catch {
    Write-Log "创建锁文件失败: $_" $ERROR_LOG_FILE
    exit 1
}

trap {
    if (Test-Path $LOCK_FILE) {
        Remove-Item $LOCK_FILE -Force -ErrorAction SilentlyContinue
    }
    Write-Log "部署异常终止: $_" $ERROR_LOG_FILE
    Send-Alert "部署异常终止: $_"
    exit 1
}

try {
    Write-Log "=== 开始自动部署 ==="
    
    Set-Location $PROJECT_PATH -ErrorAction Stop
    
    Write-Log "获取远程 commit..."
    $remoteHash = git ls-remote origin $BRANCH | Select-Object -First 1 | ForEach-Object { $_.Split()[0] }
    
    Write-Log "获取本地 commit..."
    $localHash = git rev-parse HEAD
    
    Write-Log "远程 commit: $remoteHash"
    Write-Log "本地 commit: $localHash"
    
    if ($remoteHash -eq $localHash) {
        Write-Log "无新代码，部署结束"
        Remove-Item $LOCK_FILE -Force
        exit 0
    }
    
    Write-Log "发现新代码，开始拉取..."
    
    git pull origin $BRANCH
    if ($LASTEXITCODE -ne 0) {
        throw "git pull 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "代码拉取成功"
    
    Write-Log "开始前端构建..."
    Set-Location "$PROJECT_PATH\frontend"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "前端构建成功"
    
    Write-Log "重启后端服务..."
    pm2 restart $PM2_APP_NAME
    if ($LASTEXITCODE -ne 0) {
        throw "pm2 restart 失败，退出码: $LASTEXITCODE"
    }
    Write-Log "后端服务重启成功"
    
    Write-Log "=== 部署完成 ==="
}
catch {
    Write-Log "部署失败: $_" $ERROR_LOG_FILE
    Send-Alert "部署失败: $_"
    throw
}
finally {
    if (Test-Path $LOCK_FILE) {
        Remove-Item $LOCK_FILE -Force -ErrorAction SilentlyContinue
    }
}
