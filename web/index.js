"use strict";

const PLAYER_POS_OFFSET = 0;
const PLAYER_DEST_OFFSET = PLAYER_POS_OFFSET + 8;
const WORLD_WIDTH_OFFSET = 0;
const WORLD_HEIGHT_OFFSET = 4;
const WORLD_WORLD_OFFSET = 8;
const WORLD_WORLD_SIZE_OFFSET = WORLD_WORLD_OFFSET + 4;
const WORLD_SCALE_OFFSET = 16;
const WORLD_SPAWN_OFFSET = 20;

(async () => {
  const mem = new odin.WasmMemoryInterface();
  const log = document.getElementById("console");
  await odin.runWasm("index.wasm", log, null, mem);
  const exports = mem.exports;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  exports.init(canvas.width, canvas.height);
  const state = exports.getState();
  const world_ptr = exports.getWorld();

  let camera = {
    target: mem.loadF32Array(state + PLAYER_POS_OFFSET, 2),
    offset: [canvas.width / 2, canvas.height / 2],
    rotation: 0,
    zoom: 1,
  };

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
    if (e.button === 2) {
      const worldX = pos[0] + (e.offsetX - camera.offset[0]);
      const worldY = pos[1] + (e.offsetY - camera.offset[1]);

      showInfo({ coords: [worldX, worldY], pos });

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
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);

    const world = getWorld(mem, world_ptr);

    for (let i = 0; i < world.width; ++i) {
      for (let j = 0; j < world.height; ++j) {
        ctx.fillStyle = world.world[j * world.width + i] == 1
          ? "white"
          : "black";
        ctx.beginPath();
        ctx.rect(
          screenToWorldX(i * world.scale),
          screenToWorldY(j * world.scale),
          world.scale,
          world.scale,
        );
        ctx.fill();
      }
    }

    ctx.fillStyle = "darkblue";
    ctx.beginPath();
    ctx.arc(
      screenToWorldX(pos[0]),
      screenToWorldY(pos[1]),
      24,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(
      screenToWorldX(pos[0]),
      screenToWorldY(pos[1]),
      1,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.fillStyle = "green";
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height / 2,
      1,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    const player = getPlayer(mem, state)

    ctx.beginPath();

    // place the cursor from the point the line should be started 
    ctx.moveTo(screenToWorldX(player.pos[0]), screenToWorldY(player.pos[1]));

    // draw a line from current cursor position to the provided x,y coordinate
    ctx.lineTo(screenToWorldX(player.dest[0]), screenToWorldY(player.dest[1]));

    // set strokecolor
    ctx.strokeStyle = "red";

    // set lineWidht 
    ctx.lineWidth = 3;

    // add stroke to the line 
    ctx.stroke();

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

function getPlayer(mem, ptr) {
  const pos = mem.loadF32Array(ptr + PLAYER_POS_OFFSET, 2);
  const dest = mem.loadF32Array(ptr + PLAYER_DEST_OFFSET, 2);

  return {
    pos, dest
  };
}

function getWorld(mem, ptr) {
  const width = mem.loadU32(ptr + WORLD_WIDTH_OFFSET);
  const height = mem.loadU32(ptr + WORLD_HEIGHT_OFFSET);

  return {
    width,
    height,
    world: mem.loadU32Array(
      mem.loadU32(ptr + WORLD_WORLD_OFFSET),
      mem.loadU32(ptr + WORLD_WORLD_SIZE_OFFSET),
    ),
    scale: mem.loadU32(ptr + WORLD_SCALE_OFFSET),
    spawn: {
      x: mem.loadF32(ptr + WORLD_SPAWN_OFFSET),
      y: mem.loadF32(ptr + WORLD_SPAWN_OFFSET + 4),
    },
  };
}
