@echo off
echo ========================================================
echo Starting Smart Hospital Information System + ML Service
echo ========================================================
echo.

echo Starting ML FastAPI Microservice on port 8000...
start "ML DDI Microservice (Port 8000)" cmd /k "ml\venv\Scripts\python.exe -m uvicorn ml_service.app:app --host 127.0.0.1 --port 8000"

timeout /t 2 >nul

echo Starting Express Hospital Information System on port 5000...
start "Hospital Information System (Port 5000)" cmd /k "node server\src\server.js"

echo.
echo ========================================================
echo Both services are starting in separate windows!
echo Open your browser to: http://localhost:5000
echo ========================================================
