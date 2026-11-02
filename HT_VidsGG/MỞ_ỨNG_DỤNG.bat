@echo off
title Vids Studio - AI Video Creation
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "C:\Program Files\nodejs\node.exe" (
    start "" "C:\Program Files\nodejs\node.exe" "node_modules\electron\cli.js" .
) else (
    start "" node "node_modules\electron\cli.js" .
)
