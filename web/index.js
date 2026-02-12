"use strict";

const PLAYER_POS_OFFSET = 0;
const PLAYER_DEST_OFFSET = PLAYER_POS_OFFSET + 8;
const WORLD_WIDTH_OFFSET = 0;
const WORLD_HEIGHT_OFFSET = 4;
const WORLD_WORLD_OFFSET = 8;
const WORLD_WORLD_SIZE_OFFSET = WORLD_WORLD_OFFSET + 4;
const WORLD_SCALE_OFFSET = 16;
const WORLD_SPAWN_OFFSET = 20;

const I18N = window.TRANSLATIONS || window.I18N || { pt: {}, en: {} };

let currentLanguage = "pt";
let currentLevel = 1;
const MAX_LEVELS = 2; // We currently have 2 levels
let gameStarted = false;
let gameBooting = false;

let quizQuestions = [];
let currentQuestion = 0;
let score = 0;

let audioCtx = null;
const audioSettings = { master: 1, music: 1, sfx: 1, muted: false };

const sounds = {
  bgm: { url: "./data/audio/bgm.mp3", buffer: null, source: null, gainNode: null, loop: true, baseVolume: 0.05, channel: "music" },
  footstep: { url: "./data/audio/footstep.mp3", buffer: null, minInterval: 350, lastPlay: 0, baseVolume: 0.2, channel: "sfx" },
  click: { url: "./data/audio/click.mp3", buffer: null, baseVolume: 0.4, channel: "sfx" },
  collect: { url: "./data/audio/collect.mp3", buffer: null, baseVolume: 0.5, channel: "sfx" },
  correct: { url: "./data/audio/correct.mp3", buffer: null, baseVolume: 0.5, channel: "sfx" },
  wrong: { url: "./data/audio/wrong.mp3", buffer: null, baseVolume: 0.5, channel: "sfx" }
};

const mineralIcons = {
  ferro: "./source/minerals/ferro.png",
  iron: "./source/minerals/ferro.png",
  cobre: "./source/minerals/cobre.png",
  copper: "./source/minerals/cobre.png",
  ouro: "./source/minerals/ouro.png",
  gold: "./source/minerals/ouro.png",
  silicio: "./source/minerals/silicio.png",
  silicon: "./source/minerals/silicio.png",
  litio: "./source/minerals/litio.png",
  lithium: "./source/minerals/litio.png",
  cromio: "./source/minerals/cromio.png",
  chromium: "./source/minerals/cromio.png",
  niquel: "./source/minerals/niquel.png",
  nickel: "./source/minerals/niquel.png",
  mica: "./source/minerals/mica.png",
  zinco: "./source/minerals/zinco.png",
  zinc: "./source/minerals/zinco.png",
  neodimio: "./source/minerals/neodimio.png",
  neodymium: "./source/minerals/neodimio.png",
  "terras raras": "./source/minerals/terrasRaras.png",
  "rare earth elements": "./source/minerals/terrasRaras.png",

  // New Map 2 Minerals
  magnesio: "./source/minerals/magnesio.png",
  magnesium: "./source/minerals/magnesio.png",
  calcite: "./source/minerals/calcite.png",
  pigmentos: "./source/minerals/pigmentos.png",
  pigments: "./source/minerals/pigmentos.png",
  "pigmentos (oxido de ferro)": "./source/minerals/pigmentos.png",
  "pigments (iron oxide)": "./source/minerals/pigmentos.png",
  ardosia: "./source/minerals/ardosia.png",
  slate: "./source/minerals/ardosia.png",
  "gesso (gipsita)": "./source/minerals/gesso.png",
  gypsum: "./source/minerals/gesso.png",
  "vidro (silica)": "./source/minerals/vidro.png",
  "glass (silica)": "./source/minerals/vidro.png",
  aluminio: "./source/minerals/aluminio.png",
  aluminum: "./source/minerals/aluminio.png",
  "ferro (aco)": "./source/minerals/ferro.png",
  "iron (steel)": "./source/minerals/ferro.png",
  prata: "./source/minerals/prata.png",
  silver: "./source/minerals/prata.png",
  default: "./source/minerals/generic.png"
};

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function t(key, vars) {
  const bundle = I18N[currentLanguage] || I18N.en;
  let text = bundle[key] || I18N.en[key] || key;
  if (vars) {
    for (const [varKey, varValue] of Object.entries(vars)) {
      text = text.replaceAll(`{${varKey}}`, String(varValue));
    }
  }
  return text;
}

function getMineralIcon(mineralName) {
  return mineralIcons[normalizeText(mineralName)] || mineralIcons.default;
}

async function initAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    return;
  }
  try {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextCtor();
    for (const sound of Object.values(sounds)) {
      try {
        const response = await fetch(sound.url);
        sound.buffer = await audioCtx.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        console.warn("Failed to load sound", sound.url, error);
      }
    }
  } catch (error) {
    console.warn("Audio is not available", error);
  }
}

function resolveSoundVolume(sound) {
  if (!sound || audioSettings.muted) return 0;
  const channelGain = sound.channel === "music" ? audioSettings.music : audioSettings.sfx;
  return sound.baseVolume * audioSettings.master * channelGain;
}

function applyAudioMix() {
  if (sounds.bgm.gainNode) sounds.bgm.gainNode.gain.value = resolveSoundVolume(sounds.bgm);
}

function playSound(name) {
  const sound = sounds[name];
  if (!audioCtx || !sound || !sound.buffer) return;

  if (sound.minInterval) {
    const now = Date.now();
    if (now - sound.lastPlay < sound.minInterval) return;
    sound.lastPlay = now;
  }

  if (name === "bgm" && sound.source) return;

  const source = audioCtx.createBufferSource();
  source.buffer = sound.buffer;
  source.loop = Boolean(sound.loop);

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = resolveSoundVolume(sound);

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start(0);

  if (name === "bgm") {
    sound.source = source;
    sound.gainNode = gainNode;
    source.onended = () => {
      if (sounds.bgm.source === source) {
        sounds.bgm.source = null;
        sounds.bgm.gainNode = null;
      }
    };
  }
}
function updateVolumeReadout(inputId, valueId, targetField) {
  const input = document.getElementById(inputId);
  const value = document.getElementById(valueId);
  audioSettings[targetField] = Number(input.value) / 100;
  value.textContent = `${input.value}%`;
  applyAudioMix();
}

function applyStaticTranslations() {
  const map = [
    ["start-kicker", "startKicker"],
    ["start-title", "startTitle"],
    ["start-subtitle", "startSubtitle"],
    ["language-label", "languageLabel"],
    ["settings-title", "settingsTitle"],
    ["master-volume-label", "masterVolume"],
    ["music-volume-label", "musicVolume"],
    ["sfx-volume-label", "sfxVolume"],
    ["mute-audio-label", "muteAll"],
    ["restart-game-btn", "restartGame"],
    ["close-settings-btn", "close"]
  ];

  for (const [id, key] of map) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  const startBtn = document.getElementById("start-game-btn");
  if (startBtn && !gameBooting) startBtn.textContent = t("startButton");

  const settingsBtn = document.getElementById("settings-button");
  if (settingsBtn) {
    settingsBtn.setAttribute("aria-label", t("settingsOpenAria"));
    settingsBtn.setAttribute("title", t("settingsButton"));
  }
}

function selectLanguage(language) {
  currentLanguage = language === "en" ? "en" : "pt";
  for (const button of document.querySelectorAll(".lang-btn")) {
    button.classList.toggle("active", button.dataset.lang === currentLanguage);
  }
  applyStaticTranslations();
}

function setupStartMenu() {
  for (const button of document.querySelectorAll(".lang-btn")) {
    button.addEventListener("click", () => {
      selectLanguage(button.dataset.lang);
      playSound("click");
    });
  }

  const startButton = document.getElementById("start-game-btn");
  startButton.addEventListener("click", async () => {
    if (gameBooting || gameStarted) return;

    gameBooting = true;
    startButton.disabled = true;
    startButton.textContent = t("startLoading");

    try {
      await initAudio();
      playSound("click");
      await initGame(currentLanguage);
      playSound("bgm");
      gameStarted = true;
      document.getElementById("start-menu").classList.add("hidden");
      document.getElementById("settings-button").classList.remove("hidden");
    } catch (error) {
      console.error(error);
      const subtitle = document.getElementById("start-subtitle");
      if (subtitle) subtitle.textContent = `${t("startSubtitle")} (${String(error)})`;
      startButton.disabled = false;
      startButton.textContent = t("startButton");
      gameBooting = false;
      return;
    }

    gameBooting = false;
  });
}

function setupSettingsMenu() {
  const settingsButton = document.getElementById("settings-button");
  const settingsModal = document.getElementById("settings-modal");
  const settingsCloseBtn = document.getElementById("settings-close-btn");
  const closeSettingsBtn = document.getElementById("close-settings-btn");
  const restartBtn = document.getElementById("restart-game-btn");

  const closeSettings = () => settingsModal.classList.add("hidden");

  settingsButton.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
    playSound("click");
  });

  settingsCloseBtn.addEventListener("click", () => {
    playSound("click");
    closeSettings();
  });

  closeSettingsBtn.addEventListener("click", () => {
    playSound("click");
    closeSettings();
  });

  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) closeSettings();
  });

  document.getElementById("master-volume").addEventListener("input", () => {
    updateVolumeReadout("master-volume", "master-volume-value", "master");
  });
  document.getElementById("music-volume").addEventListener("input", () => {
    updateVolumeReadout("music-volume", "music-volume-value", "music");
  });
  document.getElementById("sfx-volume").addEventListener("input", () => {
    updateVolumeReadout("sfx-volume", "sfx-volume-value", "sfx");
  });

  document.getElementById("mute-audio").addEventListener("change", (event) => {
    audioSettings.muted = Boolean(event.target.checked);
    applyAudioMix();
  });

  restartBtn.addEventListener("click", () => {
    playSound("click");
    if (window.confirm(t("restartConfirm"))) window.location.reload();
  });
}

function getDataPaths(language, level) {
  const folderName = `items_map${level}`;
  const langSuffix = language === "en" ? ".en" : "";

  // Structure:
  // web/data/items_map1/items.json
  // web/data/items_map1/items.en.json

  const baseItems = `./data/${folderName}/items${langSuffix}.json`;
  const baseAppliances = `./data/${folderName}/appliances${langSuffix}.json`;

  return {
    items: baseItems,
    appliances: baseAppliances
  };
}

async function loadGameData(language, level) {
  const paths = getDataPaths(language, level);
  try {
    const [itemsData, appliancesData] = await Promise.all([
      fetch(paths.items).then((r) => r.json()),
      fetch(paths.appliances).then((r) => r.json())
    ]);
    return { items: itemsData.items || [], appliances: appliancesData.appliances || [] };
  } catch (error) {
    if (language !== "pt") return loadGameData("pt", level);
    throw error;
  }
}
async function initGame(language, level = 1) {
  const mem = new odin.WasmMemoryInterface();
  const log = document.getElementById("console");
  await odin.runWasm("index.wasm", log, null, mem);
  const exports = mem.exports;

  const { items, appliances } = await loadGameData(language, level);
  window.quizAppliances = appliances;

  function getAppliance(name) {
    return appliances.find((entry) => entry.name === name);
  }

  function findItemNear(worldX, worldY, maxDist = 60) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const dist = Math.hypot(worldX - item.x, worldY - item.y);
      if (dist <= (item.radius || maxDist)) return { item, index: i + 1 };
    }
    return null;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const playerImg = new Image();
  const stationaryImg = new Image();
  const floorImg = new Image();
  const wallsImg = new Image();
  const objectsImg = new Image();
  const itemsImg = new Image();

  playerImg.src = "./source/pixil-frame-2Frame.png";
  stationaryImg.src = "./source/pixil-frame-stationary.png";

  const layerFolder = `layers_mapa${level}`;
  floorImg.src = `./source/layers/${layerFolder}/chao.png`;
  wallsImg.src = `./source/layers/${layerFolder}/paredes.png`;
  objectsImg.src = `./source/layers/${layerFolder}/objetos.png`;
  itemsImg.src = `./source/layers/${layerFolder}/items.png`;

  const frameW = 48;
  const frameH = 48;
  const frameRows = 2;
  const spriteScale = 1;
  const frameAngles = [270, 315, 0, 45, 90, 135, 180, 225];

  let currentRow = 0;
  let animTimer = 0;
  const animInterval = 180;
  let lastTime = (typeof performance !== "undefined") ? performance.now() : Date.now();

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  exports.init(canvas.width, canvas.height, level);
  const state = exports.getState();
  const worldPtr = exports.getWorld();

  const camera = {
    target: mem.loadF32Array(state + PLAYER_POS_OFFSET, 2),
    offset: [canvas.width / 2, canvas.height / 2],
    rotation: 0,
    zoom: 1
  };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.offset = [canvas.width / 2, canvas.height / 2];
  }

  function screenToWorldX(x) {
    return x - (camera.target[0] - camera.offset[0]);
  }

  function screenToWorldY(y) {
    return y - (camera.target[1] - camera.offset[1]);
  }

  function angleToFrameIndex(angleRad) {
    const deg = (angleRad * 180 / Math.PI + 360) % 360;
    let best = 0;
    let bestDiff = 360;
    for (let i = 0; i < frameAngles.length; i += 1) {
      const diff = Math.abs(((deg - frameAngles[i] + 540) % 360) - 180);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }

  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("mousedown", (event) => {
    if (!gameStarted) return;
    event.preventDefault();

    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
    const worldX = camera.target[0] + (event.offsetX - camera.offset[0]);
    const worldY = camera.target[1] + (event.offsetY - camera.offset[1]);

    if (event.button === 0) {
      const exitPos = exports.get_exit_pos();
      const exitX = mem.loadF32(exitPos);
      const exitY = mem.loadF32(exitPos + 4);
      // Check if click is within the exit rectangle
      // Level 1: 2 blocks wide. Level 2: 3 blocks wide.
      const exitBlocks = currentLevel === 2 ? 3 : 2;
      const exitWidth = exitBlocks * 48;

      const isClickOnExit = (
        worldX >= exitX - 24 && worldX <= exitX - 24 + exitWidth &&
        worldY >= exitY - 24 && worldY <= exitY + 24
      );

      if (isClickOnExit) {
        if (exports.is_near_exit(100)) {
          showQuizEvent({
            items,
            appliances,
            foundCount: exports.get_found_items_count(),
            totalItems: items.filter((entry) => entry.appliance !== null).length
          });
          playSound("click");
          return;
        }
        exports.player_click(exitX, exitY);
        return;
      }

      const found = findItemNear(worldX, worldY);
      if (found) {
        const playerDistToItem = Math.hypot(pos[0] - found.item.x, pos[1] - found.item.y);
        if (playerDistToItem <= 120) {
          const isNewFind = exports.add_found_item(found.index);
          const appliance = found.item.appliance ? getAppliance(found.item.appliance) : null;
          showItemDiscovery({ item: found.item, appliance, isNew: isNewFind, playerPos: pos });
          playSound("click");
        } else {
          exports.player_click(found.item.x, found.item.y);
        }
        return;
      }

      exports.player_click(worldX, worldY);
    }

    camera.target = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
  });

  let lastMouseX = 0;
  let lastMouseY = 0;
  canvas.addEventListener("mousemove", (event) => {
    lastMouseX = event.offsetX;
    lastMouseY = event.offsetY;
  });

  function render(now) {
    const tNow = (typeof now !== "undefined") ? now : ((typeof performance !== "undefined") ? performance.now() : Date.now());
    const deltaTime = (tNow - lastTime) / 1000;
    lastTime = tNow;

    exports.step(deltaTime);

    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
    const world = getWorld(mem, worldPtr);

    if (floorImg.complete) {
      ctx.drawImage(floorImg, screenToWorldX(0), screenToWorldY(0));
    }

    const renderList = [];
    for (let i = 0; i < world.width; i += 1) {
      for (let j = 0; j < world.height; j += 1) {
        const wX = i * world.scale;
        const wY = j * world.scale;
        const z = wY + world.scale;
        renderList.push({ type: "layer_part", img: wallsImg, x: wX, y: wY, w: world.scale, h: world.scale, z });
        renderList.push({ type: "layer_part", img: objectsImg, x: wX, y: wY, w: world.scale, h: world.scale, z });
        renderList.push({ type: "layer_part", img: itemsImg, x: wX, y: wY, w: world.scale, h: world.scale, z });
      }
    }

    const playerData = getPlayer(mem, state);
    const dx = playerData.dest[0] - playerData.pos[0];
    const dy = playerData.dest[1] - playerData.pos[1];
    const moving = Math.hypot(dx, dy) > 0.5;

    const animDeltaMs = deltaTime * 1000;
    if (moving) {
      animTimer += animDeltaMs;
      if (animTimer >= animInterval) {
        animTimer %= animInterval;
        currentRow = (currentRow + 1) % frameRows;
        playSound("footstep");
      }
    } else {
      animTimer = 0;
      currentRow = 0;
    }
    if (playerImg.complete && playerImg.naturalWidth >= frameW) {
      let imgToDraw = playerImg;
      const ang = Math.atan2(dy, dx);
      const idx = angleToFrameIndex(ang);

      let sx = idx * frameW;
      let sy = currentRow * frameH;
      let sW = frameW;
      let sH = frameH;

      let drawW = frameW * spriteScale;
      let drawH = frameH * spriteScale;

      if (!moving && stationaryImg.complete) {
        imgToDraw = stationaryImg;
        sW = stationaryImg.naturalWidth || drawW;
        sH = stationaryImg.naturalHeight || drawH;
        sx = 0;
        sy = 0;
        drawW = sW * spriteScale;
        drawH = sH * spriteScale;
      }

      const dxCanvas = screenToWorldX(pos[0]) - drawW / 2;
      const dyCanvas = screenToWorldY(pos[1]) - drawH / 2;

      renderList.push({
        type: "player",
        img: imgToDraw,
        sx,
        sy,
        sW,
        sH,
        dx: dxCanvas,
        dy: dyCanvas,
        dW: drawW,
        dH: drawH,
        z: pos[1] + drawH / 2
      });
    } else {
      renderList.push({ type: "fallback_circle", x: screenToWorldX(pos[0]), y: screenToWorldY(pos[1]), z: pos[1] });
    }

    renderList.sort((a, b) => a.z - b.z);

    for (const entry of renderList) {
      if (entry.type === "layer_part") {
        if (entry.img && entry.img.complete) {
          ctx.drawImage(
            entry.img,
            entry.x,
            entry.y,
            entry.w,
            entry.h,
            screenToWorldX(entry.x),
            screenToWorldY(entry.y),
            entry.w + 1,
            entry.h + 1
          );
        }
      } else if (entry.type === "player") {
        ctx.drawImage(entry.img, entry.sx, entry.sy, entry.sW, entry.sH, entry.dx, entry.dy, entry.dW, entry.dH);
      } else if (entry.type === "fallback_circle") {
        ctx.fillStyle = "darkblue";
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const worldMouseX = camera.target[0] + (lastMouseX - camera.offset[0]);
    const worldMouseY = camera.target[1] + (lastMouseY - camera.offset[1]);
    const foundNearMouse = findItemNear(worldMouseX, worldMouseY);

    if (itemsImg.complete) {
      const pulseTime = Date.now() / 1000;
      const pulseFactor = (Math.sin(pulseTime * 3) + 1) / 2;
      const pulseAlpha = 0.1 + pulseFactor * 0.15;

      if (!window.highlightCanvas) {
        window.highlightCanvas = document.createElement("canvas");
        window.highlightCanvas.width = 256;
        window.highlightCanvas.height = 256;
      }
      const hCtx = window.highlightCanvas.getContext("2d");

      items.forEach((item, index) => {
        const r = item.radius || 40;
        const size = r * 2.5;
        const halfSize = size / 2;
        const sX = item.x - halfSize;
        const sY = item.y - halfSize;

        const isHovered = Boolean(foundNearMouse && foundNearMouse.item === item);
        const isFound = exports.has_found_item(index + 1);

        if (isFound && !isHovered) return;

        let fillStyle;
        let shadowBlur;

        if (isHovered) {
          fillStyle = "rgba(255, 215, 0, 0.25)";
          shadowBlur = 15;
        } else {
          fillStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
          shadowBlur = 5;
        }

        hCtx.clearRect(0, 0, size, size);
        hCtx.drawImage(itemsImg, sX, sY, size, size, 0, 0, size, size);
        hCtx.globalCompositeOperation = "source-in";
        hCtx.fillStyle = fillStyle;
        hCtx.fillRect(0, 0, size, size);
        hCtx.globalCompositeOperation = "source-over";

        ctx.save();
        ctx.shadowColor = "rgba(255, 215, 0, 1)";
        ctx.shadowBlur = shadowBlur;
        ctx.drawImage(window.highlightCanvas, 0, 0, size, size, screenToWorldX(sX), screenToWorldY(sY), size, size);
        ctx.restore();
      });
    }

    if (foundNearMouse) {
      const item = foundNearMouse.item;
      const label = item.appliance || item.customName || t("itemFallback");

      ctx.save();
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";

      const labelX = screenToWorldX(item.x);
      const labelY = screenToWorldY(item.y) - (item.radius || 40) - 15;
      const textW = ctx.measureText(label).width;

      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(labelX - textW / 2 - 5, labelY - 15, textW + 10, 20, 5);
      } else {
        ctx.rect(labelX - textW / 2 - 5, labelY - 15, textW + 10, 20);
      }
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.shadowBlur = 0;
      ctx.fillText(label, labelX, labelY);
      ctx.restore();
    }

    const exitPos = exports.get_exit_pos();
    const exitX = mem.loadF32(exitPos);
    const exitY = mem.loadF32(exitPos + 4);

    const exitPulseTime = Date.now() / 1000;
    const exitPulseFactor = (Math.sin(exitPulseTime * 2) + 1) / 2;
    const exitPulseAlpha = 0.15 + exitPulseFactor * 0.25;

    const exitBlocks = currentLevel === 2 ? 3 : 2;
    const exitWidth = exitBlocks * 48;

    const isHoveringExit = (
      worldMouseX >= exitX - 24 && worldMouseX <= exitX - 24 + exitWidth &&
      worldMouseY >= exitY - 24 && worldMouseY <= exitY + 24
    );

    ctx.save();
    const exitSize = 48;
    const exitScreenX = screenToWorldX(exitX);
    const exitScreenY = screenToWorldY(exitY);

    if (isHoveringExit) {
      ctx.fillStyle = "rgba(0, 191, 255, 0.3)";
      ctx.shadowColor = "rgba(0, 191, 255, 1)";
      ctx.shadowBlur = 20;
    } else {
      ctx.fillStyle = `rgba(0, 191, 255, ${exitPulseAlpha})`;
      ctx.shadowColor = "rgba(0, 191, 255, 0.8)";
      ctx.shadowBlur = 10;
    }

    ctx.fillRect(exitScreenX - exitSize / 2, exitScreenY - exitSize / 2, exitBlocks * exitSize, exitSize);
    ctx.restore();

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
function generateProgressGems(total, answered) {
  let gems = "";
  for (let i = 0; i < total; i += 1) {
    gems += i < answered
      ? '<span class="gem-filled">&#9670;</span>'
      : '<span class="gem-empty">&#9671;</span>';
  }
  return `<div class="quiz-progress">${gems}</div>`;
}

function createConfetti(container) {
  const colors = ["#e17055", "#f39c12", "#d4a754", "#27ae60", "#b87333"];
  for (let i = 0; i < 20; i += 1) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1500);
  }
}

function showQuizEvent(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  if (info.foundCount < info.totalItems) {
    modalBody.innerHTML = `
      <h2>${t("exitTitle")}</h2>
      <div style="text-align: center; margin: 20px 0;">
        <p style="font-size: 14px; color: #f39c12;">${t("notAllItems")}</p>
        <p style="margin: 16px 0;">
          <strong style="color: #e17055; font-size: 18px;">${info.foundCount}</strong>
          <span style="color: #a0998f;"> / </span>
          <strong style="color: #27ae60; font-size: 18px;">${info.totalItems}</strong>
        </p>
        <p>${t("quizPrompt")}</p>
      </div>
      <div class="quiz-buttons">
        <button onclick="playSound('click'); startQuiz()" class="quiz-btn">${t("startQuiz")}</button>
        <button onclick="playSound('click'); closeModal()" class="quiz-btn secondary">${t("continueExploring")}</button>
      </div>
    `;
    modal.classList.remove("hidden");
    return;
  }

  startQuiz();
}

function startQuiz() {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  quizQuestions = generateQuizQuestions();
  currentQuestion = 0;
  score = 0;

  if (quizQuestions.length === 0) {
    modalBody.innerHTML = `
      <h2>${t("noQuestionsTitle")}</h2>
      <p style="text-align: center;">${t("noQuestionsBody")}</p>
      <div class="quiz-buttons">
        <button onclick="playSound('click'); closeModal()" class="quiz-btn">${t("back")}</button>
      </div>
    `;
    modal.classList.remove("hidden");
    return;
  }

  showQuestion();
}

function generateQuizQuestions() {
  const questions = [];
  const appliances = window.quizAppliances || [];

  const allMinerals = new Set();
  appliances.forEach((appliance) => {
    appliance.minerals.forEach((mineral) => allMinerals.add(mineral.name));
  });
  const mineralsList = Array.from(allMinerals);

  appliances.forEach((appliance) => {
    if (!appliance.minerals || appliance.minerals.length === 0) return;

    const correct = appliance.minerals[Math.floor(Math.random() * appliance.minerals.length)];
    const wrong = mineralsList
      .filter((name) => !appliance.minerals.some((entry) => entry.name === name))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (wrong.length < 3) return;

    questions.push({
      question: t("questionTemplate", { appliance: appliance.name }),
      options: [correct.name, ...wrong].sort(() => Math.random() - 0.5),
      correct: correct.name,
      explanation: t("usedFor", { mineral: correct.name, use: correct.use })
    });
  });

  return questions.sort(() => Math.random() - 0.5);
}

function showQuestion() {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  if (currentQuestion >= quizQuestions.length) {
    showQuizResults();
    return;
  }

  const q = quizQuestions[currentQuestion];
  let html = `
    <h2>${t("questionOf", { current: currentQuestion + 1, total: quizQuestions.length })}</h2>
    ${generateProgressGems(quizQuestions.length, score)}
    <p class="quiz-question">${q.question}</p>
    <div class="quiz-options">
  `;

  q.options.forEach((opt) => {
    const encoded = encodeURIComponent(opt);
    const iconSrc = getMineralIcon(opt);
    html += `<button onclick="playSound('click'); answerQuestion(decodeURIComponent('${encoded}'))" class="quiz-option">
      <img src="${iconSrc}" class="mineral-btn-icon" alt="">
      ${opt}
    </button>`;
  });

  html += `</div>
    <p class="quiz-score">${t("scoreLine", { score, remaining: quizQuestions.length - currentQuestion })}</p>
  `;

  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
}
function answerQuestion(answer) {
  const q = quizQuestions[currentQuestion];
  const modalBody = document.getElementById("modal-body");

  const isCorrect = answer === q.correct;
  if (isCorrect) {
    score += 1;
    playSound("correct");
  } else {
    playSound("wrong");
  }

  modalBody.innerHTML = `
    <h2>${isCorrect ? t("correct") : t("incorrect")}</h2>
    <div class="${isCorrect ? "correct-feedback" : "wrong-feedback"}" style="text-align: center; padding: 16px;">
      <p style="font-size: 14px; line-height: 1.8;">${q.explanation}</p>
    </div>
    <div class="quiz-buttons">
      <button onclick="playSound('click'); nextQuestion()" class="quiz-btn">${currentQuestion < quizQuestions.length - 1 ? t("next") : t("seeResult")
    }</button>
    </div>
  `;

  const feedbackDiv = modalBody.querySelector(".correct-feedback, .wrong-feedback");
  if (feedbackDiv) feedbackDiv.classList.add(isCorrect ? "correct-answer" : "wrong-answer");

  if (isCorrect) {
    const container = document.createElement("div");
    container.className = "confetti-container";
    modalBody.appendChild(container);
    createConfetti(container);
  }
}

function nextQuestion() {
  currentQuestion += 1;
  showQuestion();
}

function showQuizResults() {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");
  const percentage = Math.round((score / quizQuestions.length) * 100);

  let message = "";
  let stars = "";
  if (percentage === 100) {
    message = t("perfectMsg");
    stars = "***";
  } else if (percentage >= 70) {
    message = t("greatMsg");
    stars = "**";
  } else if (percentage >= 50) {
    message = t("okMsg");
    stars = "*";
  } else {
    message = t("keepMsg");
  }

  const passed = percentage >= 50;

  let resultHTML = `
    <h2>${t("missionComplete")}</h2>
    <div style="text-align: center; padding: 20px;">
      <p class="quiz-final-score">${score} / ${quizQuestions.length}</p>
      <p style="font-size: 12px; color: #e17055; margin: 8px 0;">(${percentage}%)</p>
      ${stars ? `<p style="font-size: 24px; margin: 12px 0;">${stars}</p>` : ""}
      <p style="margin-top: 16px;">${message}</p>
    </div>
    <div class="quiz-buttons">
  `;

  if (passed && currentLevel < MAX_LEVELS) {
    resultHTML += `<button onclick="playSound('click'); loadNextLevel()" class="quiz-btn next-level">${t("nextLevel") || "Next Level"}</button>`;
  }

  resultHTML += `
      <button onclick="playSound('click'); startQuiz()" class="quiz-btn">${t("playAgain")}</button>
      <button onclick="playSound('click'); closeModal()" class="quiz-btn secondary">${t("close")}</button>
    </div>
  `;

  modalBody.innerHTML = resultHTML;

  if (passed) {
    const container = document.createElement("div");
    container.className = "confetti-container";
    modalBody.appendChild(container);
    createConfetti(container);
    playSound("collect");
  }
}

window.loadNextLevel = async function () {
  const modal = document.getElementById("item-modal");
  modal.classList.add("hidden");

  currentLevel++;
  gameStarted = false;

  document.getElementById("start-menu").classList.remove("hidden");

  // Reload the game with the new level
  try {
    await initGame(currentLanguage, currentLevel);
    gameStarted = true;
    document.getElementById("start-menu").classList.add("hidden");
  } catch (e) {
    console.error(e);
    // Fallback to reload if something breaks
    window.location.reload();
  }
};

function showItemDiscovery(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");
  const itemName = info.item.customName || info.item.appliance || info.item.id;

  let html = `
    <h2>${info.isNew ? t("newDiscovery") : itemName}</h2>
  `;

  if (info.isNew) {
    html += `
      <div class="discovery-header" style="justify-content: center;">
        <span class="discovery-title" style="font-size: 24px;">${itemName}</span>
        <span class="discovery-new-badge">${t("newBadge")}</span>
      </div>
    `;
    playSound("collect");
  }

  if (info.appliance) {
    html += `<p class="category-badge">${t("categoryPrefix")}: ${info.appliance.category}</p>`;
    html += `<h3>${t("mineralsUsed")}</h3><ul>`;

    for (const mineral of info.appliance.minerals) {
      const iconSrc = getMineralIcon(mineral.name);
      html += `
        <li class="mineral-card">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div class="mineral-icon-frame">
              <img src="${iconSrc}" class="mineral-icon-large" alt="${mineral.name}">
            </div>
            <div style="flex: 1;">
              <strong class="mineral-name">${mineral.name}</strong>
              <span class="mineral-use">${mineral.use}</span>
              <em class="mineral-origin">${t("originPrefix")}: ${mineral.origin}</em>
            </div>
          </div>
        </li>
      `;
    }
    html += "</ul>";
  } else if (info.item.customInfo) {
    html += `<p>${info.item.customInfo}</p>`;
  }

  html += `
    <div class="quiz-buttons">
      <button onclick="playSound('click'); closeModal()" class="quiz-btn continue-btn">${t("continueBtn")}</button>
    </div>
  `;

  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("item-modal").classList.add("hidden");
}

function getPlayer(mem, ptr) {
  return {
    pos: mem.loadF32Array(ptr + PLAYER_POS_OFFSET, 2),
    dest: mem.loadF32Array(ptr + PLAYER_DEST_OFFSET, 2)
  };
}

function getWorld(mem, ptr) {
  const width = mem.loadU32(ptr + WORLD_WIDTH_OFFSET);
  const height = mem.loadU32(ptr + WORLD_HEIGHT_OFFSET);

  return {
    width,
    height,
    world: mem.loadU32Array(mem.loadU32(ptr + WORLD_WORLD_OFFSET), mem.loadU32(ptr + WORLD_WORLD_SIZE_OFFSET)),
    scale: mem.loadU32(ptr + WORLD_SCALE_OFFSET),
    spawn: {
      x: mem.loadF32(ptr + WORLD_SPAWN_OFFSET),
      y: mem.loadF32(ptr + WORLD_SPAWN_OFFSET + 4)
    }
  };
}

window.playSound = playSound;
window.startQuiz = startQuiz;
window.nextQuestion = nextQuestion;
window.answerQuestion = answerQuestion;
window.closeModal = closeModal;
window.showQuizEvent = showQuizEvent;
window.showItemDiscovery = showItemDiscovery;

document.addEventListener("DOMContentLoaded", () => {
  setupStartMenu();
  setupSettingsMenu();
  selectLanguage(currentLanguage);
  updateVolumeReadout("master-volume", "master-volume-value", "master");
  updateVolumeReadout("music-volume", "music-volume-value", "music");
  updateVolumeReadout("sfx-volume", "sfx-volume-value", "sfx");
});
