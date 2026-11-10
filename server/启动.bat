@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 拾页 · 任务 API
py -3 app.py --port 8000
pause
