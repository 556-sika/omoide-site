@echo off
chcp 65001 > nul
echo ✨ おもいでサイトを起動しています...
cd /d "%~dp0"
start "" "http://localhost:3000"
node server.js
pause
