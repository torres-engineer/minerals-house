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

  // Load item and appliance data
  const itemsData = await fetch("./data/items.json").then(r => r.json());
  const appliancesData = await fetch("./data/appliances.json").then(r => r.json());
  const items = itemsData.items;
  const appliances = appliancesData.appliances;

  // Make appliances available for quiz
  window.quizAppliances = appliances;

  // Helper to find appliance by name
  function getAppliance(name) {
    return appliances.find(a => a.name === name);
  }

  // Helper to find item near a world position
  function findItemNear(worldX, worldY, maxDist = 60) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const dist = Math.hypot(worldX - item.x, worldY - item.y);
      if (dist <= (item.radius || maxDist)) {
        return { item, index: i + 1 }; // index+1 because 0 means "no item" in Odin
      }
    }
    return null;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Make canvas fullscreen
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.offset = [canvas.width / 2, canvas.height / 2];
  }

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
  playerImg.onload = () => { };

  // separate stationary image (shown only when not moving)
  const stationaryImg = new Image();
  stationaryImg.src = "./source/pixil-frame-stationary.png"; // put your stationary image here
  stationaryImg.onload = () => { };


  const floorImg = new Image();
  floorImg.src = "./source/layers/chao.png";

  const wallsImg = new Image();
  wallsImg.src = "./source/layers/paredes.png";

  const objectsImg = new Image();
  objectsImg.src = "./source/layers/objetos.png";

  const itemsImg = new Image();
  itemsImg.src = "./source/layers/items.png";

  // animation timing: automatically cycle rows while moving
  const animInterval = 180; // ms between row swaps
  let animTimer = 0;
  let lastTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

  // Initialize canvas size before init
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  exports.init(canvas.width, canvas.height);
  const state = exports.getState();
  const world_ptr = exports.getWorld();

  let camera = {
    target: mem.loadF32Array(state + PLAYER_POS_OFFSET, 2),
    offset: [canvas.width / 2, canvas.height / 2],
    rotation: 0,
    zoom: 1,
  };

  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const pos = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);

    // Convert screen click to world coordinates using camera's actual position
    // The camera.target is the world position at the center of the screen
    // camera.offset is the screen center (canvas.width/2, canvas.height/2)
    const worldX = camera.target[0] + (e.offsetX - camera.offset[0]);
    const worldY = camera.target[1] + (e.offsetY - camera.offset[1]);

    // Left-click (button 0) - Interact with items and exit
    if (e.button === 0) {
      // Check if click is near the exit and player is close enough
      const exitPos = exports.get_exit_pos();
      const exitX = mem.loadF32(exitPos);
      const exitY = mem.loadF32(exitPos + 4);

      const clickDistToExit = Math.hypot(worldX - exitX, worldY - exitY);
      const isNearExit = exports.is_near_exit(100); // Player within 100px of exit

      if (clickDistToExit < 80 && isNearExit) {
        // Trigger quiz event!
        showQuizEvent({
          items,
          appliances,
          foundCount: exports.get_found_items_count(),
          totalItems: items.filter(i => i.appliance !== null).length
        });
        return;
      }

      // Check if click is near an item
      const found = findItemNear(worldX, worldY);
      if (found) {
        const playerDistToItem = Math.hypot(pos[0] - found.item.x, pos[1] - found.item.y);
        if (playerDistToItem <= 120) { // Player must be close enough
          // Add to found items
          const isNewFind = exports.add_found_item(found.index);

          // Get appliance info if available
          const appliance = found.item.appliance ? getAppliance(found.item.appliance) : null;

          showItemDiscovery({
            item: found.item,
            appliance: appliance,
            isNew: isNewFind,
            playerPos: pos
          });
          return;
        }
      }
    }

    // Right-click (button 2) - Move player
    if (e.button === 2) {
      exports.player_click(worldX, worldY);
    }

    camera.target = mem.loadF32Array(state + PLAYER_POS_OFFSET, 2);
  });

  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener("mousemove", (e) => {
    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;
  });

  function screenToWorldX(x) {
    return x - (camera.target[0] - camera.offset[0]);
  }
  function screenToWorldY(y) {
    return y - (camera.target[1] - camera.offset[1]);
  }

  function render(now) {
    // Calculate delta time
    const tNow = (typeof now !== 'undefined') ? now : ((typeof performance !== 'undefined') ? performance.now() : Date.now());
    const deltaTime = (tNow - lastTime) / 1000; // Convert to seconds
    lastTime = tNow;

    // Update game state
    exports.step(deltaTime);

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

        // Adicionar item
        renderList.push({
          type: 'layer_part',
          img: itemsImg,
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

    // Animation timing update (using deltaTime from render start)
    const animDeltaMs = deltaTime * 1000;

    if (moving) {
      animTimer += animDeltaMs;
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


    // 5.5. Item Hint Pulse (Blinking Silhouette)
    // We calculate mouse position first to know if we are hovering something
    const worldMouseX = camera.target[0] + (lastMouseX - camera.offset[0]);
    const worldMouseY = camera.target[1] + (lastMouseY - camera.offset[1]);

    const foundNearMouse = findItemNear(worldMouseX, worldMouseY);

    // Altera o cursor se estiver sobre um item
    canvas.style.cursor = foundNearMouse ? "pointer" : "default";

    if (itemsImg.complete) {
      const time = Date.now() / 1000;
      const pulseFactor = (Math.sin(time * 3) + 1) / 2; // 0 to 1
      const pulseAlpha = 0.1 + (pulseFactor * 0.15); // 0.1 to 0.35 opacity (Reduced intensity)

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

        // Coordinates in the source image (assuming 1:1 map correlation for now)
        // If image is huge, this picks the sprite at the item's location
        const sX = item.x - halfSize;
        const sY = item.y - halfSize;

        const isHovered = (foundNearMouse && foundNearMouse.item === item);
        const isFound = exports.has_found_item(index + 1);

        // Logic:
        // - If Hovered: Show solid highlight (ignores isFound)
        // - If Found BUT NOT Hovered: Show NOTHING
        // - If Not Found AND Not Hovered: Show Pulse

        if (isFound && !isHovered) {
          return;
        }

        // Colors
        let fillStyle;
        let shadowBlur;

        if (isHovered) {
          fillStyle = "rgba(255, 215, 0, 0.25)";
          shadowBlur = 15;
        } else {
          // Pulse logic (only reaches here if !isFound)
          fillStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
          shadowBlur = 5;
        }

        // 1. Clear temp canvas
        hCtx.clearRect(0, 0, size, size);

        // 2. Draw sprite to temp canvas
        hCtx.drawImage(itemsImg, sX, sY, size, size, 0, 0, size, size);

        // 3. Composite "source-in" to fill the sprite shape with color
        hCtx.globalCompositeOperation = "source-in";
        hCtx.fillStyle = fillStyle;
        hCtx.fillRect(0, 0, size, size);

        // Reset composite
        hCtx.globalCompositeOperation = "source-over";

        // 4. Draw the colored silhouette to main canvas
        ctx.save();
        ctx.shadowColor = "rgba(255, 215, 0, 1)";
        ctx.shadowBlur = shadowBlur;

        ctx.drawImage(
          window.highlightCanvas,
          0, 0, size, size,
          screenToWorldX(sX), screenToWorldY(sY), size, size
        );
        ctx.restore();
      });
    }

    // 6. Tooltip (Label only)
    if (foundNearMouse) {
      const item = foundNearMouse.item;
      const label = item.appliance || item.customName || "Item";

      ctx.save();
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";

      const labelX = screenToWorldX(item.x);
      const labelY = screenToWorldY(item.y) - (item.radius || 40) - 15;

      const textMetrics = ctx.measureText(label);
      const textW = textMetrics.width;

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

// Quiz state
let quizQuestions = [];
let currentQuestion = 0;
let score = 0;

// Mineral icon mapping
const mineralIcons = {
  'Ferro': './source/minerals/ferro.png',
  'Cobre': './source/minerals/cobre.png',
  'Ouro': './source/minerals/ouro.png',
  'Silício': './source/minerals/silicio.png',
  'Alumínio': './source/minerals/aluminio.png',
  'Lítio': './source/minerals/litio.png',
  'default': './source/minerals/generic.png'
};

// Mineral emoji fallbacks
const mineralEmojis = {
  'Ferro': '🔩',
  'Cobre': '🔶',
  'Ouro': '✨',
  'Silício': '💎',
  'Alumínio': '⬜',
  'Lítio': '💜',
  'Cobalto': '🔵',
  'Prata': '🥈',
  'Níquel': '⚙️',
  'Crómio': '🔧',
  'Zinco': '🔘',
  'Neodímio': '🧲',
  'Índio': '🟣',
  'Mica': '📄',
  'default': '💎'
};

function getMineralIcon(mineralName) {
  return mineralIcons[mineralName] || mineralIcons['default'];
}

function getMineralEmoji(mineralName) {
  return mineralEmojis[mineralName] || mineralEmojis['default'];
}

// Generate progress gems HTML
function generateProgressGems(current, total, answered) {
  let gems = '';
  for (let i = 0; i < total; i++) {
    if (i < answered) {
      gems += '<span class="gem-filled">💎</span>';
    } else {
      gems += '<span class="gem-empty">◇</span>';
    }
  }
  return `<div class="quiz-progress">${gems}</div>`;
}

// Create confetti effect
function createConfetti(container) {
  const colors = ['#e17055', '#f39c12', '#d4a754', '#27ae60', '#b87333'];
  for (let i = 0; i < 20; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1500);
  }
}

function showQuizEvent(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  // Check if all items are found
  if (info.foundCount < info.totalItems) {
    // Not all items found - ask if they want to continue
    let html = `
      <h2>⛏️ Saída da Mina</h2>
      <div style="text-align: center; margin: 20px 0;">
        <p style="font-size: 10px; color: #f39c12;">Ainda não encontraste todos os itens!</p>
        <p style="margin: 16px 0;">
          <span style="font-size: 24px;">📦</span><br>
          <strong style="color: #e17055; font-size: 14px;">${info.foundCount}</strong>
          <span style="color: #a0998f;"> / </span>
          <strong style="color: #27ae60; font-size: 14px;">${info.totalItems}</strong>
        </p>
        <p>Queres testar os teus conhecimentos?</p>
      </div>
      <div class="quiz-buttons">
        <button onclick="startQuiz()" class="quiz-btn">⛏️ Iniciar Questionário</button>
        <button onclick="closeModal()" class="quiz-btn secondary">🔙 Continuar a Explorar</button>
      </div>
    `;
    modalBody.innerHTML = html;
    modal.classList.remove("hidden");
  } else {
    // All items found - start quiz directly
    startQuiz();
  }
}

function startQuiz() {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  // Generate quiz questions from found items
  quizQuestions = generateQuizQuestions();
  currentQuestion = 0;
  score = 0;

  if (quizQuestions.length === 0) {
    modalBody.innerHTML = `
      <h2>⚠️ Sem Questões</h2>
      <p style="text-align: center;">Não há questões disponíveis.<br>Descobre mais itens primeiro!</p>
      <div class="quiz-buttons">
        <button onclick="closeModal()" class="quiz-btn">🔙 Voltar</button>
      </div>
    `;
    modal.classList.remove("hidden");
    return;
  }

  showQuestion();
}

function generateQuizQuestions() {
  const questions = [];

  // Get all unique minerals from all appliances
  const allMinerals = new Set();
  window.quizAppliances.forEach(app => {
    app.minerals.forEach(m => allMinerals.add(m.name));
  });
  const mineralsList = Array.from(allMinerals);

  // Generate a question for each appliance
  window.quizAppliances.forEach(appliance => {
    const correctMineral = appliance.minerals[Math.floor(Math.random() * appliance.minerals.length)];

    // Get wrong answers
    const wrongMinerals = mineralsList
      .filter(m => !appliance.minerals.some(am => am.name === m))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    if (wrongMinerals.length >= 3) {
      const options = [correctMineral.name, ...wrongMinerals].sort(() => Math.random() - 0.5);

      questions.push({
        question: `Qual destes minerais está presente no/na ${appliance.name}?`,
        options: options,
        correct: correctMineral.name,
        explanation: `O ${correctMineral.name} é usado para: ${correctMineral.use}`
      });
    }
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
    <h2>⛏️ Pergunta ${currentQuestion + 1} de ${quizQuestions.length}</h2>
    ${generateProgressGems(currentQuestion, quizQuestions.length, score)}
    <p class="quiz-question">${q.question}</p>
    <div class="quiz-options">
  `;

  q.options.forEach((opt) => {
    const emoji = getMineralEmoji(opt);
    html += `<button onclick="answerQuestion('${opt.replace(/'/g, "\\'")}')" class="quiz-option">${emoji} ${opt}</button>`;
  });

  html += `</div>
    <p class="quiz-score">⛏️ Pontos: ${score} | ❓ Restantes: ${quizQuestions.length - currentQuestion}</p>
  `;

  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
}

function answerQuestion(answer) {
  const q = quizQuestions[currentQuestion];
  const modalBody = document.getElementById("modal-body");

  const isCorrect = answer === q.correct;
  if (isCorrect) score++;

  let html = `
    <h2>${isCorrect ? "✅ Correto!" : "❌ Incorreto!"}</h2>
    <div class="${isCorrect ? 'correct-feedback' : 'wrong-feedback'}" style="text-align: center; padding: 16px;">
      <p style="font-size: 9px; line-height: 1.8;">${q.explanation}</p>
      ${isCorrect ? '<p style="font-size: 24px; margin-top: 12px;">🎉</p>' : '<p style="font-size: 24px; margin-top: 12px;">💪</p>'}
    </div>
    <div class="quiz-buttons">
      <button onclick="nextQuestion()" class="quiz-btn">${currentQuestion < quizQuestions.length - 1 ? '➡️ Próxima' : '🏁 Ver Resultado'}</button>
    </div>
  `;

  modalBody.innerHTML = html;

  // Add animation class
  const feedbackDiv = modalBody.querySelector('.correct-feedback, .wrong-feedback');
  if (feedbackDiv) {
    feedbackDiv.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
  }

  // Confetti for correct answers
  if (isCorrect) {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    modalBody.appendChild(container);
    createConfetti(container);
  }
}

function nextQuestion() {
  currentQuestion++;
  showQuestion();
}

function showQuizResults() {
  const modalBody = document.getElementById("modal-body");

  const percentage = Math.round((score / quizQuestions.length) * 100);
  let message = "";
  let emoji = "";
  let stars = "";

  if (percentage === 100) {
    message = "Perfeito! És um mestre dos minerais!";
    emoji = "🏆";
    stars = "⭐⭐⭐";
  } else if (percentage >= 70) {
    message = "Muito bom! Conheces bem os minerais.";
    emoji = "🥈";
    stars = "⭐⭐";
  } else if (percentage >= 50) {
    message = "Nada mal! Podes fazer melhor.";
    emoji = "🥉";
    stars = "⭐";
  } else {
    message = "Continua a explorar e aprende mais!";
    emoji = "📚";
    stars = "";
  }

  let html = `
    <h2>🎉 Missão Completa!</h2>
    <div style="text-align: center; padding: 20px;">
      <p style="font-size: 48px; margin: 16px 0;">${emoji}</p>
      <p class="quiz-final-score">${score} / ${quizQuestions.length}</p>
      <p style="font-size: 10px; color: #e17055; margin: 8px 0;">(${percentage}%)</p>
      ${stars ? `<p style="font-size: 24px; margin: 12px 0;">${stars}</p>` : ''}
      <p style="margin-top: 16px;">${message}</p>
    </div>
    <div class="quiz-buttons">
      <button onclick="startQuiz()" class="quiz-btn">🔄 Jogar Novamente</button>
      <button onclick="closeModal()" class="quiz-btn secondary">✅ Fechar</button>
    </div>
  `;

  modalBody.innerHTML = html;

  // Add confetti for good scores
  if (percentage >= 70) {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    modalBody.appendChild(container);
    createConfetti(container);
  }
}

function showItemDiscovery(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  const itemName = info.item.customName || info.item.appliance || info.item.id;

  let html = `
    <h2>${info.isNew ? '✨ Nova Descoberta!' : '📦 ' + itemName}</h2>
  `;

  if (info.isNew) {
    html += `
      <div class="discovery-header">
        <span class="discovery-icon">🔍</span>
        <span class="discovery-title">${itemName}</span>
        <span class="discovery-new-badge">NOVO!</span>
      </div>
    `;
  }

  // If it's an appliance, show mineral info
  if (info.appliance) {
    html += `<p class="category-badge">📁 ${info.appliance.category}</p>`;
    html += `<h3>⛏️ Minerais Utilizados:</h3><ul>`;

    for (const mineral of info.appliance.minerals) {
      const emoji = getMineralEmoji(mineral.name);
      const iconSrc = getMineralIcon(mineral.name);

      html += `
        <li class="mineral-card">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span class="mineral-icon">${emoji}</span>
            <div style="flex: 1;">
              <strong class="mineral-name">${mineral.name}</strong>
              <span class="mineral-use">${mineral.use}</span>
              <em class="mineral-origin">📍 ${mineral.origin}</em>
            </div>
          </div>
        </li>
      `;
    }
    html += `</ul>`;

    // Fun fact
    const funFacts = [
      `Este objeto usa ${info.appliance.minerals.length} minerais diferentes!`,
      `Os minerais viajam de todo o mundo até à tua casa!`,
      `Sem estes minerais, este objeto não existiria!`,
      `Cada mineral tem uma função especial neste objeto.`
    ];
    const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
    html += `<div class="fun-fact">${randomFact}</div>`;

  } else if (info.item.customInfo) {
    html += `<p>${info.item.customInfo}</p>`;
  }

  html += `
    <div class="quiz-buttons">
      <button onclick="closeModal()" class="quiz-btn continue-btn">👍 Fixe! Continuar</button>
    </div>
  `;

  modalBody.innerHTML = html;
  modal.classList.remove("hidden");

  console.log("ITEM DISCOVERED!", info);
}

function closeModal() {
  const modal = document.getElementById("item-modal");
  modal.classList.add("hidden");
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
