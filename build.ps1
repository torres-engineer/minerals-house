$odin_js = (odin root) + "/core/sys/wasm/js/odin.js"
Copy-Item $odin_js "web/odin.js"

odin build . -target:js_wasm32 -out:web/index.wasm

# ln -sf worlds web/worlds → Remove-Item + New-Item SymbolicLink
if (Test-Path "web/worlds") { Remove-Item "web/worlds" -Force }
New-Item -ItemType SymbolicLink -Path "web/worlds" -Target "worlds" | Out-Null
