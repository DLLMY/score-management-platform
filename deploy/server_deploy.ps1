<#
学生积分管理平台 - 服务器模式部署脚本
适用于长期运行的服务器环境
使用NSSM注册Windows服务，实现开机自动启动
#>

param(
    [string]$Action = "deploy"
)

$ErrorActionPreference = "Continue"

$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
$projectDir = (Get-Item $scriptDir).Parent.FullName
$backendDir = Join-Path $projectDir "backend"
$frontendDir = Join-Path $projectDir "frontend"
$redisDir = Join-Path $scriptDir "redis"
$nssmDir = Join-Path $scriptDir "nssm"

$green = [ConsoleColor]::Green
$red = [ConsoleColor]::Red
$yellow = [ConsoleColor]::Yellow
$blue = [ConsoleColor]::Blue

function Write-Color([string]$Message, [ConsoleColor]$Color) {
    $originalColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Host $Message
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "="*70
    Write-Color $Title $blue
    Write-Host "="*70
}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Color "[$(Get-Date -Format 'HH:mm:ss')] $Message" $blue
}

function Write-OK([string]$Message) {
    Write-Color "  ✓ $Message" $green
}

function Write-Error([string]$Message) {
    Write-Color "  ✗ $Message" $red
}

function Write-Warn([string]$Message) {
    Write-Color "  ⚠ $Message" $yellow
}

function Test-Command([string]$Command) {
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Find-Python {
    Write-Step "检测Python环境..."
    $pythonPaths = @("python", "py", "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe")
    foreach ($path in $pythonPaths) {
        try {
            $result = & $path --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-OK "找到Python: $path"
                Write-OK "版本: $result"
                return $path
            }
        }
        catch {
            continue
        }
    }
    Write-Error "未找到Python！"
    Write-Host "请先安装Python 3.10+，或运行 'deploy.ps1' 安装依赖"
    Read-Host "按 Enter 退出..."
    exit 1
}

function Find-Node {
    Write-Step "检测Node.js环境..."
    if (Test-Command "node") {
        $version = & node --version
        Write-OK "Node.js版本: $version"
        return $true
    }
    Write-Error "未找到Node.js！"
    Write-Host "请先安装Node.js 16+，或运行 'deploy.ps1' 安装依赖"
    Read-Host "按 Enter 退出..."
    exit 1
}

function Install-Python-Dependencies($pythonExe) {
    Write-Step "安装Python依赖..."
    Push-Location $backendDir
    try {
        & $pythonExe -m pip install -r requirements.txt --quiet
        & $pythonExe -m pip install -r requirements-ml.txt --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Python依赖安装完成"
        }
        else {
            Write-Warn "部分Python依赖安装失败"
        }
    }
    catch {
        Write-Warn "Python依赖安装失败: $_"
    }
    finally {
        Pop-Location
    }
}

function Install-Node-Dependencies {
    Write-Step "安装前端依赖..."
    Push-Location $frontendDir
    try {
        npm install --legacy-peer-deps --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "前端依赖安装完成"
        }
        else {
            Write-Warn "部分前端依赖安装失败"
        }
    }
    catch {
        Write-Warn "前端依赖安装失败: $_"
    }
    finally {
        Pop-Location
    }
}

function Build-Frontend {
    Write-Step "构建前端生产版本..."
    Push-Location $frontendDir
    try {
        npm run build --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "前端构建完成"
        }
        else {
            Write-Error "前端构建失败"
            Read-Host "按 Enter 退出..."
            exit 1
        }
    }
    catch {
        Write-Error "前端构建失败: $_"
        Read-Host "按 Enter 退出..."
        exit 1
    }
    finally {
        Pop-Location
    }
}

function Download-NSSM {
    Write-Step "检查NSSM服务管理器..."
    $nssmExe = Join-Path $nssmDir "nssm.exe"
    
    if (Test-Path $nssmExe) {
        Write-OK "NSSM已存在"
        return $nssmExe
    }
    
    Write-Warn "NSSM不存在，正在下载..."
    New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
    
    $url = "https://nssm.cc/release/nssm-2.24.zip"
    $zipPath = Join-Path $nssmDir "nssm.zip"
    
    try {
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
        Expand-Archive -Path $zipPath -DestinationPath $nssmDir -Force
        Remove-Item $zipPath -Force
        
        $nssmExe = Join-Path $nssmDir "win64\nssm.exe"
        if (Test-Path $nssmExe) {
            Copy-Item $nssmExe (Join-Path $nssmDir "nssm.exe") -Force
            $nssmExe = Join-Path $nssmDir "nssm.exe"
        }
        
        Write-OK "NSSM下载完成"
        return $nssmExe
    }
    catch {
        Write-Error "NSSM下载失败: $_"
        Read-Host "按 Enter 退出..."
        exit 1
    }
}

function Stop-Service-If-Exists([string]$ServiceName) {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Step "停止服务: $ServiceName"
        try {
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
        catch {
            Write-Warn "停止服务失败: $_"
        }
    }
}

function Remove-Service-If-Exists([string]$ServiceName) {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        Write-Step "删除服务: $ServiceName"
        try {
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            sc.exe delete $ServiceName
            Write-OK "服务已删除"
        }
        catch {
            Write-Warn "删除服务失败: $_"
        }
    }
}

function Register-Redis-Service($nssmExe) {
    Write-Step "注册Redis服务..."
    $redisExe = Join-Path $redisDir "redis-server.exe"
    $redisConfig = Join-Path $redisDir "redis.windows.conf"
    
    if (-not (Test-Path $redisExe)) {
        Write-Warn "Redis未找到，跳过服务注册"
        return
    }
    
    Remove-Service-If-Exists "StudentScore-Redis"
    
    & $nssmExe install "StudentScore-Redis" $redisExe
    & $nssmExe set "StudentScore-Redis" AppDirectory $redisDir
    & $nssmExe set "StudentScore-Redis" AppParameters $redisConfig
    & $nssmExe set "StudentScore-Redis" DisplayName "学生积分管理平台 - Redis"
    & $nssmExe set "StudentScore-Redis" Description "学生积分管理平台缓存服务"
    & $nssmExe set "StudentScore-Redis" Start SERVICE_AUTO_START
    & $nssmExe set "StudentScore-Redis" AppStdout (Join-Path $scriptDir "logs\redis_stdout.log")
    & $nssmExe set "StudentScore-Redis" AppStderr (Join-Path $scriptDir "logs\redis_stderr.log")
    
    Start-Service "StudentScore-Redis"
    Start-Sleep -Seconds 3
    
    $service = Get-Service "StudentScore-Redis" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-OK "Redis服务注册并启动成功"
    }
    else {
        Write-Warn "Redis服务启动可能失败，请手动检查"
    }
}

function Register-Backend-Service($nssmExe, $pythonExe) {
    Write-Step "注册后端服务..."
    Remove-Service-If-Exists "StudentScore-Backend"
    
    $runScript = Join-Path $backendDir "startup\run.py"
    $logDir = Join-Path $scriptDir "logs"
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    
    & $nssmExe install "StudentScore-Backend" $pythonExe
    & $nssmExe set "StudentScore-Backend" AppDirectory $backendDir
    & $nssmExe set "StudentScore-Backend" AppParameters "-c `"import sys; sys.path.insert(0, '.'); from startup.run import main; main()`""
    & $nssmExe set "StudentScore-Backend" DisplayName "学生积分管理平台 - 后端"
    & $nssmExe set "StudentScore-Backend" Description "学生积分管理平台后端API服务"
    & $nssmExe set "StudentScore-Backend" Start SERVICE_AUTO_START
    & $nssmExe set "StudentScore-Backend" AppStdout (Join-Path $logDir "backend_stdout.log")
    & $nssmExe set "StudentScore-Backend" AppStderr (Join-Path $logDir "backend_stderr.log")
    & $nssmExe set "StudentScore-Backend" AppEnvironmentExtra "ENV=production"
    
    Start-Service "StudentScore-Backend"
    Start-Sleep -Seconds 8
    
    $service = Get-Service "StudentScore-Backend" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-OK "后端服务注册并启动成功"
    }
    else {
        Write-Warn "后端服务启动可能失败，请手动检查"
    }
}

function Register-Frontend-Service($nssmExe, $pythonExe) {
    Write-Step "注册前端静态服务..."
    Remove-Service-If-Exists "StudentScore-Frontend"
    
    $buildDir = Join-Path $frontendDir "build"
    $logDir = Join-Path $scriptDir "logs"
    
    & $nssmExe install "StudentScore-Frontend" $pythonExe
    & $nssmExe set "StudentScore-Frontend" AppDirectory $frontendDir
    & $nssmExe set "StudentScore-Frontend" AppParameters "-m http.server 3000"
    & $nssmExe set "StudentScore-Frontend" DisplayName "学生积分管理平台 - 前端"
    & $nssmExe set "StudentScore-Frontend" Description "学生积分管理平台前端静态服务"
    & $nssmExe set "StudentScore-Frontend" Start SERVICE_AUTO_START
    & $nssmExe set "StudentScore-Frontend" AppStdout (Join-Path $logDir "frontend_stdout.log")
    & $nssmExe set "StudentScore-Frontend" AppStderr (Join-Path $logDir "frontend_stderr.log")
    
    Start-Service "StudentScore-Frontend"
    Start-Sleep -Seconds 5
    
    $service = Get-Service "StudentScore-Frontend" -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq "Running") {
        Write-OK "前端服务注册并启动成功"
    }
    else {
        Write-Warn "前端服务启动可能失败，请手动检查"
    }
}

function Configure-Firewall {
    Write-Step "配置防火墙规则..."
    $ports = @(5000, 3000)
    foreach ($port in $ports) {
        try {
            $rule = Get-NetFirewallRule -DisplayName "StudentScore-Port-$port" -ErrorAction SilentlyContinue
            if (-not $rule) {
                New-NetFirewallRule -DisplayName "StudentScore-Port-$port" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow
                Write-OK "防火墙规则已添加: 端口 $port"
            }
            else {
                Write-OK "防火墙规则已存在: 端口 $port"
            }
        }
        catch {
            Write-Warn "防火墙配置失败: $_"
        }
    }
}

function Create-Configuration {
    Write-Step "创建配置文件..."
    Push-Location $backendDir
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env" -Force
            Write-OK "已创建后端 .env 配置"
        }
    }
    if (-not (Test-Path "instance")) {
        New-Item -ItemType Directory -Name "instance" | Out-Null
    }
    Write-OK "后端配置就绪"
    Pop-Location
    
    Push-Location $frontendDir
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env" -Force
            Write-OK "已创建前端 .env 配置"
        }
    }
    Write-OK "前端配置就绪"
    Pop-Location
}

function Cleanup-Services {
    Write-Step "清理现有服务..."
    $services = @("StudentScore-Backend", "StudentScore-Frontend", "StudentScore-Redis")
    foreach ($service in $services) {
        Remove-Service-If-Exists $service
    }
    
    $ports = @(5000, 3000, 6379)
    foreach ($port in $ports) {
        $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
            }
            catch { }
        }
    }
    Write-OK "清理完成"
}

function Show-Deployment-Complete {
    Write-Section "服务器模式部署完成！"
    Write-Host ""
    
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -ne "127.0.0.1" 
    } | Select-Object -ExpandProperty IPAddress
    
    Write-Host "服务状态:"
    Write-Host "──────────"
    
    $services = @(
        @{Name="StudentScore-Redis"; Display="Redis缓存服务"},
        @{Name="StudentScore-Backend"; Display="后端API服务"},
        @{Name="StudentScore-Frontend"; Display="前端静态服务"}
    )
    
    foreach ($s in $services) {
        $service = Get-Service $s.Name -ErrorAction SilentlyContinue
        if ($service) {
            if ($service.Status -eq "Running") {
                Write-Color "  ✓ $($s.Display): 运行中" $green
            }
            else {
                Write-Color "  ✗ $($s.Display): $($service.Status)" $red
            }
        }
        else {
            Write-Color "  ⚠ $($s.Display): 未安装" $yellow
        }
    }
    
    Write-Host ""
    Write-Host "访问地址:"
    Write-Host "──────────"
    
    if ($ipAddresses) {
        foreach ($ip in $ipAddresses) {
            Write-Color "  前端: http://$ip`:3000" $green
            Write-Color "  后端API: http://$ip`:5000" $green
        }
        Write-Host ""
    }
    
    Write-Color "  本地访问: http://localhost:3000" $green
    Write-Host ""
    
    Write-Host "管理信息:"
    Write-Host "──────────"
    Write-Host "  登录账号: admin"
    Write-Host "  登录密码: 123456"
    Write-Host ""
    Write-Host "  服务管理命令:"
    Write-Host "    查看状态: sc query StudentScore-*"
    Write-Host "    停止服务: sc stop StudentScore-Backend"
    Write-Host "    启动服务: sc start StudentScore-Backend"
    Write-Host ""
    Write-Host "  日志位置: $scriptDir\logs\"
    Write-Host ""
    
    Write-Host "正在打开前端页面..."
    Start-Process "http://localhost:3000"
}

function Uninstall-Server {
    Write-Section "卸载服务器部署"
    Write-Step "停止并删除所有服务..."
    
    $services = @("StudentScore-Backend", "StudentScore-Frontend", "StudentScore-Redis")
    foreach ($service in $services) {
        Remove-Service-If-Exists $service
    }
    
    Write-Step "删除防火墙规则..."
    $ports = @(5000, 3000)
    foreach ($port in $ports) {
        try {
            Remove-NetFirewallRule -DisplayName "StudentScore-Port-$port" -ErrorAction SilentlyContinue
        }
        catch { }
    }
    
    Write-OK "卸载完成！"
    Read-Host "按 Enter 退出..."
    exit 0
}

Write-Section "学生积分管理平台 - 服务器模式部署"
Write-Host ""
Write-Host "模式特点:"
Write-Host "  • 使用Windows服务管理，开机自动启动"
Write-Host "  • 前端生产构建，后端Waitress运行"
Write-Host "  • 服务异常自动重启"
Write-Host "  • 防火墙自动配置"
Write-Host ""

if ($Action -eq "uninstall") {
    Uninstall-Server
}

try {
    $pythonExe = Find-Python
    $null = Find-Node
    
    $nssmExe = Download-NSSM
    
    Create-Configuration
    Install-Python-Dependencies $pythonExe
    Install-Node-Dependencies
    Build-Frontend
    
    Cleanup-Services
    
    Register-Redis-Service $nssmExe
    Register-Backend-Service $nssmExe $pythonExe
    Register-Frontend-Service $nssmExe $pythonExe
    
    Configure-Firewall
    
    Show-Deployment-Complete
}
catch {
    Write-Error "部署失败: $_"
    Read-Host "按 Enter 退出..."
    exit 1
}

Write-Host ""
Write-Section "部署脚本执行完成"
Read-Host "按 Enter 退出..."