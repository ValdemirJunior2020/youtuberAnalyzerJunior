@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title YouTuber Analyzer Junior - Installer

echo ============================================================
echo  YouTuber Analyzer Junior - Smart Installer
echo ============================================================
echo.

set "NEED_REFRESH=0"

where node >nul 2>nul
if errorlevel 1 (
  echo [MISSING] Node.js
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Node.js is required and winget was not found.
    echo Install Node.js LTS, then run INSTALL.bat again.
    pause
    exit /b 1
  )
  echo [INSTALL] Installing Node.js LTS...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  set "NEED_REFRESH=1"
) else (
  echo [OK] Node.js found
)

if "%NEED_REFRESH%"=="1" (
  echo.
  echo Node.js was installed. Close this window and run INSTALL.bat again.
  pause
  exit /b 0
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found even though Node.js exists.
  pause
  exit /b 1
) else (
  echo [OK] npm found
)

where ollama >nul 2>nul
if errorlevel 1 (
  echo [MISSING] Ollama
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [WARN] winget not available. Install Ollama manually later.
  ) else (
    echo [INSTALL] Installing Ollama...
    winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
  )
) else (
  echo [OK] Ollama found
)

set "CHROME_FOUND=0"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"

if "%CHROME_FOUND%"=="1" (
  echo [OK] Google Chrome found
) else (
  echo [INFO] Google Chrome not found. Playwright Chromium will be used.
)

echo.
echo Checking Node packages...
if not exist "node_modules" (
  echo [INSTALL] node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 goto :fail
) else (
  call npm ls --depth=0 >nul 2>nul
  if errorlevel 1 (
    echo [REPAIR] Missing or mismatched packages detected. Running npm install...
    call npm install
    if errorlevel 1 goto :fail
  ) else (
    echo [OK] Node packages are already installed
  )
)

if "%CHROME_FOUND%"=="0" (
  if exist "%LocalAppData%\ms-playwright" (
    echo [OK] Playwright browser cache found
  ) else (
    echo [INSTALL] Installing Playwright Chromium...
    call npx playwright install chromium
    if errorlevel 1 goto :fail
  )
)

if not exist "data" mkdir data

echo.
where ollama >nul 2>nul
if errorlevel 1 (
  echo [WARN] Ollama is not available yet. The dashboard will still run,
  echo        but AI analysis needs Ollama installed and running.
) else (
  echo [OK] Ollama ready. Installed models:
  ollama list
)

echo.
echo ============================================================
echo  INSTALL COMPLETE
echo ============================================================
echo Run START.bat to launch the analyzer.
pause
exit /b 0

:fail
echo.
echo [ERROR] Installation failed. Review the message above.
pause
exit /b 1
