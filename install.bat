@echo off
REM Turnbull MCP Installer — Windows Launcher
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 pause
