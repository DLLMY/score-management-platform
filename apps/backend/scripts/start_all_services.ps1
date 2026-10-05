<#
.SYNOPSIS
    本机一键拉起「自我管理提升V2.0 管理平台」全部服务（开发环境）。
    顺序：清理旧进程 -> 重启 Redis 服务 -> 后端(不带 --with-celery) -> Celery worker -> Celery beat -> 前端 Vite。
    说明：
      - 后端故意【不带】 --with-celery，worker/beat 独立进程启动（避免 reloader 孤儿化 worker）。
      - Celery worker 已内置 fast_trace_task 关闭修复（apps/backend/celery_app.py），心跳任务可正常落库。
      - 本机环境变量同时含 Path/PATH/path 大小写重复键，Start-Process cmdlet 会撞键崩溃；
        故改用 [System.Diagnostics.Process]::Start() 直接继承父环境块（不经过会崩的字典），
        并用管道异步落盘到 logs/ 下日志文件。
      - 脚本末尾长驻（while sleep），使子服务随本后台任务持续运行、日志持续写入；
        停止本任务即同时结束子服务（开发会话内重启场景可接受）。
#>
$ErrorActionPreference = "Continue"

# 项目根目录从脚本自身位置推导，规避 .ps1 中文路径在无 BOM 时被 GBK 误读导致目录无效
$base     = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\")).Path
$backend  = Join-Path $base "apps\backend"
$frontend = Join-Path $base "apps\frontend"
$logs     = Join-Path $base "logs"
Write-Output ("base resolved -> {0}" -f $base)
New-Item -ItemType Directory -Force -Path $logs | Out-Null

$venvPy   = Join-Path $backend ".venv\Scripts\python.exe"
$nodeExe  = "C:\Users\53527\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
$redisCli = "C:\Program Files\Redis\redis-cli.exe"

# 全局收集日志写入器，避免被 GC 回收导致日志中断
$global:__writers = @()

function Stop-ByCommand($pattern) {
    Get-CimInstance Win32_Process -Filter "name = 'python.exe' OR name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $pattern } |
        ForEach-Object {
            try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output "killed PID=$($_.ProcessId) -> $($_.CommandLine)" }
            catch { Write-Output "kill failed PID=$($_.ProcessId)" }
        }
}

function Start-DetachedNet($name, $exe, $argumentList, $wd, $out) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $argumentList
    $psi.WorkingDirectory = $wd
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    $proc.Start() | Out-Null
    $pidv = $proc.Id
    $swOut = New-Object System.IO.StreamWriter($out, $false, [System.Text.Encoding]::UTF8)
    $swErr = New-Object System.IO.StreamWriter("$out.err", $false, [System.Text.Encoding]::UTF8)
    $swOut.AutoFlush = $true
    $swErr.AutoFlush = $true
    $proc.add_OutputDataReceived({ param($s,$e) if ($null -ne $e.Data) { $swOut.WriteLine($e.Data) } })
    $proc.add_ErrorDataReceived({ param($s,$e) if ($null -ne $e.Data) { $swErr.WriteLine($e.Data) } })
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()
    $global:__writers += $swOut
    $global:__writers += $swErr
    Write-Output ("{0} -> PID={1} | log={2}" -f $name, $pidv, $out)
}

Write-Output "=== [1/5] 清理旧进程 (run.py / celery / vite) ==="
Stop-ByCommand "run\.py"
Stop-ByCommand "celery"
Stop-ByCommand "vite"
Start-Sleep -Seconds 2

Write-Output "=== [2/5] 重启 Redis 缓存服务 ==="
try {
    Restart-Service redis -Force -ErrorAction Stop
    Write-Output "redis service restarted (stop+start ok)"
} catch {
    Write-Output ("redis restart skipped/failed: {0}; will verify running state" -f $_.Exception.Message)
}
Start-Sleep -Seconds 2
$ping = & $redisCli -p 6379 ping 2>$null
Write-Output ("redis ping -> {0}" -f $ping)
if ($ping -ne "PONG") {
    try {
        Start-Service redis -ErrorAction Stop
        Start-Sleep -Seconds 2
        $ping = & $redisCli -p 6379 ping 2>$null
        Write-Output ("redis start fallback ping -> {0}" -f $ping)
    } catch {
        Write-Output ("redis start fallback failed: {0}" -f $_.Exception.Message)
    }
}

Write-Output "=== [3/5] 启动后端 Flask (不带 --with-celery) ==="
Start-DetachedNet "backend"  $venvPy "run.py --env development --host 127.0.0.1 --port 5000" $backend (Join-Path $logs "backend_srv.log")

Write-Output "=== [4/5] 启动 Celery worker / beat ==="
Start-DetachedNet "worker"   $venvPy "-m celery -A celery_app worker -Q default,notification,mqtt,export -c 4 --loglevel=info --logfile=$((Join-Path $logs 'celery_worker.log'))" $backend (Join-Path $logs "celery_worker.pipe.log")
Start-DetachedNet "beat"     $venvPy "-m celery -A celery_app beat --loglevel=info --logfile=$((Join-Path $logs 'celery_beat.log'))" $backend (Join-Path $logs "celery_beat.pipe.log")

Write-Output "=== [5/5] 启动前端 Vite ==="
Start-DetachedNet "frontend" $nodeExe "node_modules/.bin/vite --port 3000 --strictPort" $frontend (Join-Path $logs "frontend.log")

Write-Output "=== 等待启动 (15s) ==="
Start-Sleep -Seconds 15
Write-Output "STARTUP_DONE"

# 长驻：保持子服务存活与日志持续写入（停止本后台任务即结束全部子服务）
Write-Output "services kept alive by this session; stopping this task stops all child services."
while ($true) { Start-Sleep -Seconds 60 }
