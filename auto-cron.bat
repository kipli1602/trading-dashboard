@echo off
REM Auto-cron: Connect Windscribe HK + run bot cycle + sync to Vercel
REM Port 3001 (reserve 3000 for other apps)
cd /d C:\Users\TUF\Desktop\crypto-bot-dashboard

REM Kill any process using port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a > NUL 2>&1
)
timeout /t 2 > NUL

REM Check if dev server running (port 3001)
netsh interface ipv4 show excludedportprotocol tcp 3001 2>NUL | findstr "3001" > NUL
powershell "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue" 2>NUL | findstr "3001" > NUL
if errorlevel 1 (
    start "" "C:\Program Files\nodejs\node.exe" node_modules/next/dist/bin/next dev -p 3001
    timeout /t 15 > NUL
)

REM Ensure VPN connected (Hong Kong)
windscribe status | findstr "Connected" > NUL
if errorlevel 1 (
    echo Reconnecting Windscribe HK...
    windscribe connect HK
    timeout /t 5 > NUL
)

REM Run cron locally + sync result ke Vercel
node sync-cron.js >> cron-log.txt 2>&1
echo [%date% %time%] Cron+sync done >> cron-log.txt
