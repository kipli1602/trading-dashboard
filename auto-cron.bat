@echo off
REM Auto-cron: Connect Windscribe HK + run bot cycle + sync to Vercel
cd /d C:\Users\TUF\Desktop\crypto-bot-dashboard

REM Check if dev server running
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq Next.js" 2>NUL | find /I "node.exe" > NUL
if errorlevel 1 (
    start "" "C:\Program Files\nodejs\node.exe" node_modules/next/dist/bin/next dev
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
