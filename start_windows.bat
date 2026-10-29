@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  where py >nul 2>nul
  if not errorlevel 1 (
    py -3 -m venv .venv
  ) else (
    python -m venv .venv
  )
  if errorlevel 1 (echo Failed to create Python environment. Install Python 3.11+ & pause & exit /b 1)
)
echo Installing Python dependencies (first launch may take a moment)...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (pause & exit /b 1)
if not exist ".local_secret" (
  ".venv\Scripts\python.exe" -c "import secrets; print(secrets.token_urlsafe(48))" > ".local_secret"
)
for /f "usebackq delims=" %%a in (".local_secret") do set "JWT_SECRET=%%a"
echo.
echo Open http://localhost:8000 in your browser.
echo API documentation: http://localhost:8000/docs
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
