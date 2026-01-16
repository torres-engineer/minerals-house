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

  const playerImg = new Image();
  const frameW = 48;
  const frameH = 48;
  const frameCount = 8;
  const spriteScale = 1;
  const defaultStance = 5

  // number of rows in the sheet (you said you have two frames stacked vertically)
  const frameRows = 2;
  // which row is currently selected (0 = top, 1 = bottom). Can toggle with Space.
  let currentRow = 0;

  const frameAngles = [270, 315, 0, 45, 90, 135, 180, 225];

  playerImg.src = "./source/pixil-frame-2Frame.png";
  playerImg.onload = () => {};

  // separate stationary image (shown only when not moving)
  const stationaryImg = new Image();
  stationaryImg.src = "./source/pixil-frame-stationary.png"; // put your stationary image here
  stationaryImg.onload = () => {};


  const floorImg = new Image();
  floorImg.src = "./source/layers/chao.png";

  const wallsImg = new Image();
  wallsImg.src = "./source/layers/paredes.png";

  const objectsImg = new Image();
  objectsImg.src = "./source/layers/objetos.png";

  // animation timing: automatically cycle rows while moving
  const animInterval = 180; // ms between row swaps
  let animTimer = 0;
  let lastTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

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

  function render(now) {
    // 1. Limpar Ecrã
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
    const world = getWorld(mem, world_ptr);

    // 2. Desenhar Chão (Estático)
    if (floorImg.complete) {
      ctx.drawImage(floorImg, screenToWorldX(0), screenToWorldY(0));
    }

    // --- INÍCIO DO SISTEMA DE Y-SORT ---
    // Criamos uma lista ÚNICA para guardar tudo o que precisa de ser ordenado por profundidade
    // (Paredes, Objetos e Player) para que interajam corretamente uns com os outros.
    let renderList = [];

    // 3. Processar Paredes e Objetos
    for (let i = 0; i < world.width; ++i) {
      for (let j = 0; j < world.height; ++j) {
        const wX = i * world.scale;
        const wY = j * world.scale;
        const z = wY + world.scale;

        // Adicionar parede
        renderList.push({
            type: 'layer_part',
            img: wallsImg,
            x: wX, y: wY, w: world.scale, h: world.scale,
            z: z
        });

        // Adicionar objeto
        renderList.push({
            type: 'layer_part',
            img: objectsImg,
            x: wX, y: wY, w: world.scale, h: world.scale,
            z: z
        });
      }
    }

    // 4. Processar Player (Cálculos de animação)
    const playerData = getPlayer(mem, state);
    const dx = playerData.dest[0] - playerData.pos[0];
    const dy = playerData.dest[1] - playerData.pos[1];

    function angleToFrameIndex(angleRad) {
      let deg = (angleRad * 180 / Math.PI + 360) % 360;
      let best = 0;
      let bestDiff = 360;
      for (let i = 0; i < frameAngles.length; ++i) {
        let diff = Math.abs(((deg - frameAngles[i] + 540) % 360) - 180);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      return best;
    }

    const moving = Math.hypot(dx, dy) > 0.5;

    // Animation timing update
    const tNow = (typeof now !== 'undefined') ? now : ((typeof performance !== 'undefined') ? performance.now() : Date.now());
    const dt = Math.max(0, tNow - lastTime);
    lastTime = tNow;

    if (moving) {
      animTimer += dt;
      if (animTimer >= animInterval) {
        animTimer = animTimer % animInterval;
        currentRow = (currentRow + 1) % frameRows;
      }
    } else {
      animTimer = 0;
      currentRow = 0;
    }

    // Preparar dados do Player
    if (playerImg && playerImg.complete && playerImg.naturalWidth >= frameW) {
        // Valores default (para animação normal)
        let imgToDraw = playerImg;
        let ang = Math.atan2(dy, dx);
        let idx = angleToFrameIndex(ang);
        
        // Source coords
        let sx = idx * frameW;
        let sy = currentRow * frameH;
        let sW = frameW;
        let sH = frameH;

        // Destination coords base
        let drawW = frameW * spriteScale;
        let drawH = frameH * spriteScale;

        // Lógica da imagem estacionária (Idle)
        if (!moving && stationaryImg && stationaryImg.complete) {
            imgToDraw = stationaryImg;
            sW = stationaryImg.naturalWidth || drawW;
            sH = stationaryImg.naturalHeight || drawH;
            sx = 0; 
            sy = 0;
            // Recalcula tamanho de desenho se a imagem parada tiver tamanho diferente
            drawW = sW * spriteScale; 
            drawH = sH * spriteScale;
        }

        // Posição de desenho no ecrã
        const dxCanvas = screenToWorldX(pos[0]) - drawW / 2;
        const dyCanvas = screenToWorldY(pos[1]) - drawH / 2;

        // Adicionar Player à lista de renderização
        renderList.push({
            type: 'player',
            img: imgToDraw,
            sx: sx, sy: sy, sW: sW, sH: sH,
            dx: dxCanvas, dy: dyCanvas, dW: drawW, dH: drawH,
            z: pos[1] + (drawH / 2)
        });

    } else {
        // Fallback
        renderList.push({
            type: 'fallback_circle',
            x: screenToWorldX(pos[0]),
            y: screenToWorldY(pos[1]),
            z: pos[1]
        });
    }

    // 5. RENDERIZAÇÃO POR CAMADAS (Y-SORT ÚNICO)
    // Ordenamos tudo junto para garantir que o player interage corretamente com paredes E objetos
    renderList.sort((a, b) => a.z - b.z);

    for (const item of renderList) {
        if (item.type === 'layer_part') {
            if (item.img && item.img.complete) {
                ctx.drawImage(
                    item.img,
                    item.x, item.y, item.w, item.h,
                    screenToWorldX(item.x), screenToWorldY(item.y), item.w, item.h
                );
            }
        } 
        else if (item.type === 'player') {
            ctx.drawImage(
                item.img,
                item.sx, item.sy, item.sW, item.sH,
                item.dx, item.dy, item.dW, item.dH
            );
        }
        else if (item.type === 'fallback_circle') {
            ctx.fillStyle = "darkblue";
            ctx.beginPath();
            ctx.arc(item.x, item.y, 24, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // --- FIM DO SISTEMA DE RENDERIZAÇÃO ---


    // 7. Debug Overlays (Linhas, pontos de debug)
    // Estes desenhamos sempre por último para ficarem "on top" da UI
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
    ctx.moveTo(screenToWorldX(player.pos[0]), screenToWorldY(player.pos[1]));
    ctx.lineTo(screenToWorldX(player.dest[0]), screenToWorldY(player.dest[1]));
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
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
