"use strict";

const PLAYER_POS_OFFSET = 0;

(async () => {
    const mem = new odin.WasmMemoryInterface();
    const log = document.getElementById("console");
    await odin.runWasm("index.wasm", log, null, mem);
    const exports = mem.exports;

    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");

    exports.init(canvas.width, canvas.height);
    const state = exports.getState();

    let camera = {
        target: mem.loadF32Array(state + PLAYER_POS_OFFSET, 2),
        offset: [canvas.width / 2, canvas.height / 2],
        rotation: 0,
        zoom: 1
    };

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousedown", (e) => {
        const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
        if (e.button === 2) {
            const worldX = pos[0] + (e.offsetX - camera.offset[0]);
            const worldY = pos[1] + (e.offsetY - camera.offset[1]);

            showInfo({ coords: [worldX, worldY] });

            exports.player_click(worldX, worldY);
        }

        camera.target = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
    });

    function screenToWorldX(x) {
        return x - (camera.target[0] - camera.offset[0]);
    }
    function screenToWorldY(y) {
        return y - (camera.target[1] - camera.offset[1]);
    }

    function render() {
        ctx.fillStyle = "#fefefe";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);

        const gradient = ctx.createRadialGradient(
            screenToWorldX(canvas.width / 2), screenToWorldY(canvas.height / 2),
            0,
            screenToWorldX(canvas.width / 2), screenToWorldY(canvas.height / 2),
            canvas.height / 3
        );
        gradient.addColorStop(0, "green");
        gradient.addColorStop(1, "skyblue");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenToWorldX(canvas.width / 2), screenToWorldY(canvas.height / 2), canvas.height / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "darkblue";
        ctx.beginPath();
        ctx.arc(
            screenToWorldX(pos[0]),
            screenToWorldY(pos[1]),
            32,
            0,
            Math.PI * 2
        );
        ctx.fill();

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
})();

function showInfo(info) {
    const gameSection = document.querySelector("main>section:has(#game)");

    const infoSection = document.createElement("section");
    const sectionHeader = document.createElement("h2");
    sectionHeader.innerText = "Information";
    const article = document.createElement("article");
    const articleHeader = document.createElement("h2");
    articleHeader.innerText = "Object name";
    const paragraph = document.createElement("p");
    paragraph.innerText = JSON.stringify(info);
    infoSection.append(sectionHeader, article);
    article.append(articleHeader, paragraph);

    gameSection.nextSibling.remove();
    gameSection.insertAdjacentElement("afterend", infoSection);
}
