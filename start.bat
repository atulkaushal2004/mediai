@echo off
title MediAI Launcher
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install the LTS version from https://nodejs.org then run this file again.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example.
    echo        Open .env, fill in OPENROUTER_API_KEY and MONGO_URI, save, then run start.bat again.
    notepad ".env"
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Installing dependencies, please wait...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set PORT=%%a

echo Starting MediAI on http://localhost:%PORT% ...
start "MediAI Server" cmd /k "node server.js"

timeout /t 4 /nobreak >nul
start "" http://localhost:%PORT%
echo.
echo MediAI is running at http://localhost:%PORT%
echo Close the "MediAI Server" window to stop it.
timeout /t 5 >nul
