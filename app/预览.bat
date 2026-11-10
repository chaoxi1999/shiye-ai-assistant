@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 拾页 · 本地预览
start "" http://127.0.0.1:5180
py -3 -m http.server 5180 --bind 127.0.0.1
