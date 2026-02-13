#!/bin/bash

set -xe

odin_js=$(odin root)/core/sys/wasm/js/odin.js
cp "$odin_js" web/odin.js

rm -rf web/worlds
cp -r worlds web/worlds

find worlds/ -mindepth 1 -maxdepth 1 -type d -printf '"%f",' | \
    sed 's/,$/]/' | \
    sed 's/^/[/' > web/worlds.json

odin build . -target:js_wasm32 -out:web/index.wasm
