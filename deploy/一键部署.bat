@echo off
chcp 65001 >nul
title Student Score Management Platform - Deploy System

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%deploy.ps1"

if not exist "%PS_SCRIPT%" (
    echo ERROR: PowerShell script not found!
    pause
    exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "%PS_SCRIPT%"