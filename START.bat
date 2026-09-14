@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title YouTuber Analyzer Junior

echo ============================================================
echo  YouTuber Analyzer Junior
 echo Dashboard: http://127.0.0.1:5173
 echo Backend  : http://127.0.0.1:8788
 echo YouTube API: NOT USED
 echo AI: Ollama local
 echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Run INSTALL.bat first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] Packages are missing. Run INSTALL.bat first.
  pause
  exit /b 1
)

call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Some packages are missing or broken. Run INSTALL.bat again.
  pause
  exit /b 1
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo [WARN] Ollama not found. Channel scanning will work, but AI analysis will not.
) else (
  echo [OK] Ollama found
)

if not exist "data" mkdir data

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://127.0.0.1:5173"
call npm start
