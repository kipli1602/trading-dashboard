@echo off
REM Auto-cron: Connect Windscribe HK + trigger bot cycle + restart server
cd /d C:\Users\TUF\Desktop\crypto-bot-dashboard

REM Check if dev server running
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq Next.js" 2>NUL | find /I "node.exe" > NUL
if errorlevel 1 (
    REM Start dev server
    start "" "C:\Program Files\nodejs\node.exe" node_modules/next/dist/bin/next dev
    timeout /t 15 > NUL
)

REM Check VPN connection
windscribe status | findstr "Connected" > NUL
if errorlevel 1 (
    echo Reconnecting Windscribe HK...
    windscribe connect HK
    timeout /t 5 > NUL
)

REM Run cron
curl.exe -s --max-time 60 "http://localhost:3000/api/bot?action=cron" >> cron-log.txt
echo [%date% %time%] Cron done >> cron-log.txt
