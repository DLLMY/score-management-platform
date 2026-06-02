<#
Student Score Management Platform - Deploy System v2.1
PowerShell version for better compatibility
#>

param(
    [string]$Action = "deploy"
)

$ErrorActionPreference = "Stop"

# 设置路径
$scriptDir = $PSScriptRoot
$projectDir = (Get-Item $scriptDir).Parent.FullName
$backendDir = Join-Path $projectDir "backend"
$frontendDir = Join-Path $projectDir "frontend"
$redisDir = Join-Path $projectDir "redis"
$ngrokDir = Join-Path $scriptDir "ngrok"
$downloadScript = Join-Path $scriptDir "download_deps.py"
$checkScript = Join-Path $scriptDir "check_deploy.py"

# 颜色定义
$green = [ConsoleColor]::Green
$red = [ConsoleColor]::Red
$yellow = [ConsoleColor]::Yellow
$blue = [ConsoleColor]::Blue
$gray = [ConsoleColor]::Gray

function Write-Color([string]$Message, [ConsoleColor]$Color) {
    $originalColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Host $Message
    $Host.UI.RawUI.ForegroundColor = $originalColor
}

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "="*60
    Write-Host $Title
    Write-Host "="*60
}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Color "[$(Get-Date -Format 'HH:mm:ss')] $Message" $blue
}

function Write-OK([string]$Message) {
    Write-Color "  OK: $Message" $green
}

function Write-Error([string]$Message) {
    Write-Color "  ERROR: $Message" $red
}

function Write-Warn([string]$Message) {
    Write-Color "  WARN: $Message" $yellow
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
    Write-Step "Detecting Python environment..."
    
    $pythonPaths = @(
        "python",
        "py",
        "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\python.exe",
        "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python313\python.exe"
    )
    
    foreach ($path in $pythonPaths) {
        try {
            $result = & $path --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-OK "Found Python: $path"
                Write-OK "Python version: $result"
                return $path
            }
        }
        catch {
            continue
        }
    }
    
    Write-Error "Python not found!"
    Write-Host "Please install Python 3.10+ from https://www.python.org/downloads/"
    Read-Host "Press Enter to exit..."
    exit 1
}

function Find-Node {
    Write-Step "Checking Node.js environment..."
    
    if (Test-Command "node") {
        $version = & node --version
        Write-OK "Node.js version: $version"
        return $true
    }
    
    Write-Error "Node.js not found!"
    Write-Host "Please install Node.js 16+ and add to PATH"
    Read-Host "Press Enter to exit..."
    exit 1
}

function Pre-Flight-Check($pythonExe) {
    Write-Step "Running deployment pre-check..."
    
    if (-not (Test-Path $checkScript)) {
        Write-Warn "Pre-check script not found, skipping..."
        return
    }
    
    try {
        Write-Host "Executing: $pythonExe `"$checkScript`""
        & $pythonExe "$checkScript" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Pre-check returned non-zero exit code, but continuing deployment..."
            return
        }
        Write-OK "All pre-flight checks passed"
    }
    catch {
        Write-Warn "Pre-check failed with error: $_"
        Write-Warn "Continuing deployment..."
    }
}

function Download-Dependencies($pythonExe) {
    Write-Step "Checking and downloading dependencies..."
    
    $needDownload = $false
    
    if (-not (Test-Path (Join-Path $redisDir "redis-server.exe"))) {
        Write-Warn "Redis not found, will download..."
        $needDownload = $true
    }
    else {
        Write-OK "Redis already installed"
    }
    
    if (-not (Test-Path (Join-Path $ngrokDir "ngrok.exe"))) {
        Write-Warn "ngrok not found, will download..."
        $needDownload = $true
    }
    else {
        Write-OK "ngrok already installed"
    }
    
    if ($needDownload) {
        Write-Host "Starting download script..."
        try {
            & $pythonExe $downloadScript
            if ($LASTEXITCODE -ne 0) {
                Write-Warn "Some dependencies may have failed to download properly"
            }
            else {
                Write-OK "Dependencies downloaded successfully"
            }
        }
        catch {
            Write-Warn "Download script failed: $_"
        }
    }
}

function Install-Python-Dependencies($pythonExe) {
    Write-Step "Installing Python dependencies..."
    
    Push-Location $backendDir
    try {
        & $pythonExe -m pip install -r requirements.txt --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Python dependencies installed"
        }
        else {
            Write-Warn "Some Python dependencies may have failed to install"
        }
    }
    catch {
        Write-Warn "Python dependency installation failed: $_"
    }
    finally {
        Pop-Location
    }
}

function Install-Node-Dependencies {
    Write-Step "Installing Node.js dependencies..."
    
    Push-Location $frontendDir
    try {
        npm install --legacy-peer-deps --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Node.js dependencies installed"
        }
        else {
            Write-Warn "Some Node.js dependencies may have failed to install"
        }
    }
    catch {
        Write-Warn "Node.js dependency installation failed: $_"
    }
    finally {
        Pop-Location
    }
}

function Create-Configuration {
    Write-Step "Creating configuration..."
    
    # Backend configuration
    Push-Location $backendDir
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env" -Force
            Write-OK "Created backend .env from example"
        }
    }
    if (-not (Test-Path "instance")) {
        New-Item -ItemType Directory -Name "instance" | Out-Null
    }
    Write-OK "Backend configuration ready"
    Pop-Location
    
    # Frontend configuration
    Push-Location $frontendDir
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env" -Force
            Write-OK "Created frontend .env from example"
        }
    }
    Write-OK "Frontend configuration ready"
    Pop-Location
}

function Cleanup-Services {
    Write-Step "Cleaning existing services..."
    Write-Host "Killing existing processes on required ports..."
    
    $ports = @(5000, 3000, 3001, 6379, 4040)
    
    foreach ($port in $ports) {
        $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
            }
            catch {
                # Ignore errors
            }
        }
    }
    
    # Kill ngrok
    $ngrokProc = Get-Process "ngrok" -ErrorAction SilentlyContinue
    if ($ngrokProc) {
        $ngrokProc | Stop-Process -Force
        Start-Sleep -Seconds 1
    }
    
    Write-OK "Cleanup completed"
}

function Start-Redis {
    $redisExe = Join-Path $redisDir "redis-server.exe"
    if (Test-Path $redisExe) {
        Write-Step "Starting Redis server..."
        Start-Process -FilePath $redisExe -ArgumentList "--bind 127.0.0.1 --port 6379" -WorkingDirectory $redisDir -WindowStyle Normal
        Start-Sleep -Seconds 2
        Write-OK "Redis server started"
    }
    else {
        Write-Warn "Redis not found, using in-memory storage"
    }
}

function Start-Backend($pythonExe) {
    Write-Step "Starting backend service..."
    Push-Location $backendDir
    Start-Process -FilePath $pythonExe -ArgumentList "run.py --env development" -WorkingDirectory $backendDir -WindowStyle Normal
    Pop-Location
    Start-Sleep -Seconds 5
}

function Start-Frontend {
    Write-Step "Starting frontend service..."
    Push-Location $frontendDir
    Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory $frontendDir -WindowStyle Normal
    Pop-Location
    Start-Sleep -Seconds 10
}

function Start-Proxy {
    Write-Step "Starting proxy server..."
    Push-Location $frontendDir
    $env:BACKEND_URL = "http://localhost:5000"
    $env:FRONTEND_URL = "http://localhost:3000"
    Start-Process -FilePath "node" -ArgumentList "proxy-server.js" -WorkingDirectory $frontendDir -WindowStyle Normal
    Pop-Location
    Start-Sleep -Seconds 2
    Write-OK "Proxy server started"
}

function Configure-Ngrok {
    $ngrokExe = Join-Path $ngrokDir "ngrok.exe"
    
    if (-not (Test-Path $ngrokExe)) {
        return
    }
    
    Write-Section "ngrok Public Access Setup"
    Write-Host ""
    Write-Host "Do you want to configure ngrok for public access?"
    Write-Host ""
    Write-Host "  1. Yes - Configure ngrok authtoken now"
    Write-Host "  2. No  - Skip (configure manually later)"
    Write-Host "  3. Start ngrok tunnel directly (if already configured)"
    Write-Host ""
    
    $choice = Read-Host "Enter your choice (1/2/3)"
    
    if ($choice -eq "1") {
        Write-Section "Please enter your ngrok authtoken"
        Write-Host ""
        Write-Host "Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken"
        Write-Host ""
        
        $authtoken = Read-Host "Enter authtoken"
        
        if ($authtoken) {
            Write-Host ""
            Write-Host "Configuring ngrok authtoken..."
            & $ngrokExe config add-authtoken $authtoken
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "Configuring ngrok proxy tunnel..."
                & $ngrokExe config add-tunnel proxy --proto http --addr 3001 --host-header localhost:3001
                
                Write-Section "Authtoken and tunnel configured successfully!"
                Write-Host ""
                
                $startTunnel = Read-Host "Do you want to start ngrok tunnel now? (Y/N)"
                
                if ($startTunnel -eq "Y" -or $startTunnel -eq "y") {
                    Start-Ngrok $ngrokExe
                }
            }
            else {
                Write-Error "Failed to configure authtoken. Please check your token and try again."
            }
        }
        else {
            Write-Warn "No authtoken entered. Skipping ngrok configuration."
        }
    }
    elseif ($choice -eq "3") {
        Start-Ngrok $ngrokExe
    }
}

function Start-Ngrok($ngrokExe) {
    Write-Host ""
    Write-Host "Checking for existing ngrok process..."
    $ngrokProc = Get-Process "ngrok" -ErrorAction SilentlyContinue
    if ($ngrokProc) {
        Write-Host "Stopping existing ngrok process..."
        $ngrokProc | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
    
    Write-Host "Starting ngrok tunnel..."
    Start-Process -FilePath $ngrokExe -ArgumentList "start --config=$ngrokDir\ngrok.yml proxy" -WorkingDirectory $ngrokDir -WindowStyle Normal
    Start-Sleep -Seconds 3
    
    Write-Host ""
    Write-Host "Getting public URL..."
    try {
        $response = Invoke-RestMethod "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
        if ($response) {
            $publicUrl = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -ExpandProperty public_url -First 1
            if ($publicUrl) {
                Write-Section "ngrok Public URL:"
                Write-Color "  $publicUrl" $green
                Write-Host "You can access the system from anywhere using this URL."
            }
            else {
                Write-Warn "ngrok URL not available yet, check the ngrok window for the public URL."
            }
        }
        else {
            Write-Warn "ngrok URL not available yet, check the ngrok window for the public URL."
        }
    }
    catch {
        Write-Warn "ngrok URL not available yet, check the ngrok window for the public URL."
    }
}

function Show-Deployment-Complete {
    Write-Section "DEPLOYMENT COMPLETED!"
    Write-Host ""
    Write-Host "Local Access:"
    Write-Color "  Frontend: http://localhost:3000" $green
    Write-Color "  Backend API: http://localhost:5000" $green
    Write-Color "  API Docs: http://localhost:5000/apidocs" $green
    Write-Color "  Redis: localhost:6379" $green
    Write-Color "  Proxy: http://localhost:3001" $green
    Write-Host ""
    Write-Host "Login Information:"
    Write-Color "  Username: admin" $green
    Write-Color "  Password: 123456" $green
    Write-Host ""
    Write-Host "Opening frontend in default browser..."
    Start-Process "http://localhost:3000"
    Start-Sleep -Seconds 2
}

# Main script
Write-Section "Student Score Management Platform - Deploy System v2.1"
Write-Host ""
Write-Host "Auto install:"
Write-Host "  - Python packages (Flask, SQLAlchemy, Redis client)"
Write-Host "  - Node.js packages (React, Tailwind, Lucide)"
Write-Host "  - SQLite (built-in)"
Write-Host "  - Config files (.env)"
Write-Host "  - Redis Server (auto-download if missing)"
Write-Host "  - ngrok (auto-download if missing)"
Write-Host ""
Write-Host "Require pre-install:"
Write-Host "  - Python 3.10+"
Write-Host "  - Node.js 16+"
Write-Host ""
Write-Host "Optional:"
Write-Host "  - Redis Server (will be auto-downloaded if not found)"

$pythonExe = Find-Python
$null = Find-Node
Pre-Flight-Check $pythonExe
Download-Dependencies $pythonExe
Install-Python-Dependencies $pythonExe
Install-Node-Dependencies
Create-Configuration
Cleanup-Services
Start-Redis
Start-Backend $pythonExe
Start-Frontend
Start-Proxy
Show-Deployment-Complete
Configure-Ngrok

Write-Section "Service windows are open."
Write-Host "This window will close in 15 seconds..."
Start-Sleep -Seconds 15
