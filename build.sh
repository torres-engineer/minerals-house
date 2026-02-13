#!/bin/bash

set -xe

odin_js=$(odin root)/core/sys/wasm/js/odin.js
cp "$odin_js" web/odin.js

rm -rf web/worlds
cp -r worlds web/worlds

jq -n --rawfile dirs <(ls worlds | jq -R -s -c 'split("\n")[:-1]') > web/worlds.json
printf '["%s"' "$(ls worlds)" | sed 's# #"," #g' | sed 's#,$#]#g' > web/worlds.json

odin build . -target:js_wasm32 -out:web/index.wasm
