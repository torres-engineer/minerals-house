@echo off
setlocal enabledelayedexpansion

for /f "delims=" %%i in ('odin.exe root') do set "ODIN_PATH=%%i"
copy "%ODIN_PATH%\core\sys\wasm\js\odin.js" "web\odin.js"

call odin.exe build . -target:js_wasm32 -out:web\index.wasm

rem ln -sf worlds web/worlds → mklink /D (delete first if exists)
if exist "web\worlds" rmdir "web\worlds"
mklink /D "web\worlds" "worlds"
