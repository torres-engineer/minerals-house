@echo off
setlocal enabledelayedexpansion

for /f "delims=" %%i in ('odin.exe root') do set "ODIN_PATH=%%i"
copy "%ODIN_PATH%\core\sys\wasm\js\odin.js" "web\odin.js"

rmdir /s /q web\worlds
xcopy /E /I worlds web\worlds

(
echo [
for /D %%D in (worlds\*) do echo ^"%%~nxD^",
) > temp.json
powershell -Command "(Get-Content temp.json) -replace ',]$', ']'" > web\worlds.json
del temp.json

call odin.exe build . -target:js_wasm32 -out:web\index.wasm
