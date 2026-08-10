@echo off
cd /d "%~dp0"
start "Othello" cmd /k "npm install && npm run dev -- --host 0.0.0.0"
for /L %%i in (1,1,20) do (
  timeout /t 2 /nobreak >nul
  curl -I http://127.0.0.1:5173 >nul 2>&1
  if not errorlevel 1 goto opened
)
:opened
start "" http://127.0.0.1:5173/
