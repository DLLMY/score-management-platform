<#
.SYNOPSIS
    单服务启动器（由 schtasks 以系统任务方式拉起，脱离交互会话）。
    用法: powershell -File svc_launcher.ps1 <backend|worker|beat|frontend>
    说明:
      - 用 PSScriptRoot 正确解析中文项目路径。
      - 使用 UseShellExecute=$true 直接继承父环境块（规避 Start-Process 的 Path/PATH 大小写撞键），
        且不把 stdout 重定向到管道（Windows 上 Python 往管道写会抛 OSError 22 导致进程崩溃）。
      - worker/beat 通过 celery 自身的 --logfile 写日志文件；backend/frontend 不重定向，靠端口/API 核验。
      - 末尾 while 循环保持本启动器存活，使系统任务保持 Running 且子服务随本会话持续存在。
#>
param([string]$svc = "backend")
$ErrorActionPreference = "Continue"

$base     = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\")).Path
$backend  = Join-Path $base "apps\backend"
$frontend = Join-Path $base "apps\frontend"
$logs     = Join-Path $base "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$venvPy  = Join-Path $backend ".venv\Scripts\python.exe"
$nodeExe = "C:\Users\53527\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
$npmExe  = "C:\Users\53527\.workbuddy\binaries\node\versions\22.22.2-3\npm.cmd"

switch ($svc) {
    "backend"  { $exe = $venvPy;  $args = "run.py --env development --host 127.0.0.1 --port 5000"; $wd = $backend }
    "worker"   { $exe = $venvPy;  $args = "-m celery -A celery_app worker -P solo -Q default,notification,mqtt,export --loglevel=info --logfile=$((Join-Path $logs 'celery_worker.log'))"; $wd = $backend }
    "beat"     { $exe = $venvPy;  $args = "-m celery -A celery_app beat --loglevel=info --logfile=$((Join-Path $logs 'celery_beat.log'))"; $wd = $backend }
    "frontend" { $exe = $npmExe;  $args = "run dev:vite"; $wd = $frontend }
    default    { Write-Output "unknown svc: $svc"; exit 1 }
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $exe
$psi.Arguments = $args
$psi.WorkingDirectory = $wd
$psi.UseShellExecute = $true
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null
Write-Output ("[{0}] started PID={1} cwd={2}" -f $svc, $proc.Id, $wd)

# 长驻：保持系统任务 Running，子服务持续运行
while ($true) { Start-Sleep -Seconds 60 }
