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
    if (e.button === 2) {
      const worldX = pos[0] + (e.offsetX - camera.offset[0]);
      const worldY = pos[1] + (e.offsetY - camera.offset[1]);

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
        return; // Don't move player when triggering quiz
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
          return; // Don't move player when discovering item
        }
      }

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

function showQuizEvent(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  // Check if all items are found
  if (info.foundCount < info.totalItems) {
    // Not all items found - ask if they want to continue
    let html = `
      <h2>🚪 Saída - Questionário</h2>
      <p>Ainda não encontraste todos os itens!</p>
      <p>Encontraste <strong>${info.foundCount}</strong> de <strong>${info.totalItems}</strong> itens.</p>
      <p>Queres iniciar o questionário mesmo assim?</p>
      <div class="quiz-buttons">
        <button onclick="startQuiz()" class="quiz-btn">Sim, iniciar questionário</button>
        <button onclick="closeModal()" class="quiz-btn secondary">Não, continuar a explorar</button>
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
      <h2>Erro</h2>
      <p>Não há questões disponíveis. Descobre mais itens primeiro!</p>
      <button onclick="closeModal()" class="quiz-btn">Fechar</button>
    `;
    modal.classList.remove("hidden");
    return;
  }

  showQuestion();
}

function generateQuizQuestions() {
  // This will be populated with actual items/appliances data
  const questions = [];

  // Get all unique minerals from all appliances
  const allMinerals = new Set();
  window.quizAppliances.forEach(app => {
    app.minerals.forEach(m => allMinerals.add(m.name));
  });
  const mineralsList = Array.from(allMinerals);

  // Generate a question for each appliance
  window.quizAppliances.forEach(appliance => {
    // Question: Which mineral is in this appliance?
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
    // Quiz finished
    showQuizResults();
    return;
  }

  const q = quizQuestions[currentQuestion];

  let html = `
    <h2>Pergunta ${currentQuestion + 1} de ${quizQuestions.length}</h2>
    <p class="quiz-question">${q.question}</p>
    <div class="quiz-options">
  `;

  q.options.forEach((opt, i) => {
    html += `<button onclick="answerQuestion('${opt.replace(/'/g, "\\'")}')" class="quiz-option">${opt}</button>`;
  });

  html += `</div>
    <p class="quiz-score">Pontuação: ${score}/${quizQuestions.length}</p>
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
    <p>${q.explanation}</p>
    <button onclick="nextQuestion()" class="quiz-btn">Próxima pergunta</button>
  `;

  modalBody.innerHTML = html;
}

function nextQuestion() {
  currentQuestion++;
  showQuestion();
}

function showQuizResults() {
  const modalBody = document.getElementById("modal-body");

  const percentage = Math.round((score / quizQuestions.length) * 100);
  let message = "";

  if (percentage === 100) {
    message = "🏆 Perfeito! Conheces muito bem os minerais!";
  } else if (percentage >= 70) {
    message = "👍 Muito bom! Tens um bom conhecimento sobre minerais.";
  } else if (percentage >= 50) {
    message = "📚 Não está mal, mas podes melhorar!";
  } else {
    message = "💪 Continua a explorar e aprende mais sobre os minerais!";
  }

  let html = `
    <h2>🎉 Questionário Completo!</h2>
    <p class="quiz-final-score">Pontuação Final: <strong>${score}/${quizQuestions.length}</strong> (${percentage}%)</p>
    <p>${message}</p>
    <div class="quiz-buttons">
      <button onclick="startQuiz()" class="quiz-btn">Jogar novamente</button>
      <button onclick="closeModal()" class="quiz-btn secondary">Fechar</button>
    </div>
  `;

  modalBody.innerHTML = html;
}

function showItemDiscovery(info) {
  const modal = document.getElementById("item-modal");
  const modalBody = document.getElementById("modal-body");

  const itemName = info.item.customName || info.item.appliance || info.item.id;

  let html = `<h2>${info.isNew ? "Nova Descoberta!" : ""} ${itemName}</h2>`;

  // If it's an appliance, show mineral info
  if (info.appliance) {
    html += `<p>Categoria: ${info.appliance.category}</p>`;
    html += `<h3>Minerais Utilizados:</h3><ul>`;

    for (const mineral of info.appliance.minerals) {
      html += `<li>
        <strong>${mineral.name}</strong><br>
        <span class="mineral-use">${mineral.use}</span><br>
        <em>Origem: ${mineral.origin}</em>
      </li>`;
    }
    html += `</ul>`;
  } else if (info.item.customInfo) {
    html += `<p>${info.item.customInfo}</p>`;
  }

  modalBody.innerHTML = html;
  modal.classList.remove("hidden");

  console.log("ITEM DISCOVERED!", info);
}

function closeModal() {
  document.getElementById("item-modal").classList.add("hidden");
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
