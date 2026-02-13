$odin_js = (odin root) + "/core/sys/wasm/js/odin.js"
Copy-Item $odin_js "web/odin.js"

Remove-Item -Recurse -Force web/worlds -ErrorAction SilentlyContinue
Copy-Item -Recurse worlds web/worlds

# Generate worlds.json (equivalent to find)
$worlds = Get-ChildItem worlds -Directory | ForEach-Object { $_.Name }
$json = "[$($worlds | ForEach-Object { "`"$_`"," } | Join-String -Separator '')]"
$json = $json.TrimEnd(',') + ']'
$json | Out-File -Encoding utf8 web/worlds.json

odin build . -target:js_wasm32 -out:web/index.wasm
