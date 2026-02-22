@echo off
echo ========================================
echo Starting LMS Servers
echo ========================================
echo.
echo This will start BOTH servers you need:
echo 1. Bank Server (port 3001)
echo 2. LMS Server - In-Memory Mode (port 3000)
echo.
echo No database installation required!
echo.
pause
echo.
echo Starting Bank Server...
start "Bank Server" cmd /k "cd backend && npm run bank"
timeout /t 2 /nobreak >nul
echo.
echo Starting LMS Server...
start "LMS Server" cmd /k "cd backend && npm start"
echo.
echo ========================================
echo Servers are starting in separate windows!
echo ========================================
echo.
echo Next: Open index.html in your browser
echo Default login: org@lms.com / org123
echo.
pause
