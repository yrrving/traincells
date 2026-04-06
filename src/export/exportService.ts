import type { Project } from '../models/types';
import { ART_SIZE, ROOM_SIZE } from '../models/types';

// Generates a completely self-contained, playable HTML file
export function exportGameAsHTML(project: Project): void {
  const html = buildStandaloneHTML(project);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildStandaloneHTML(project: Project): string {
  const projectJSON = JSON.stringify(project);

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>${escapeHtml(project.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f0e17;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui, sans-serif;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    h1 { color: #a5b4fc; font-size: 1.2rem; margin-bottom: 12px; }
    #game {
      image-rendering: pixelated;
      max-width: 100vw;
      max-height: 80vh;
      border-radius: 6px;
    }
    #controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: min(624px, 100vw);
      padding: 12px 16px;
      gap: 16px;
      margin-top: 4px;
    }
    .dpad { display: flex; gap: 8px; }
    .btn {
      width: 60px; height: 60px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem;
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active { background: rgba(255,255,255,0.25); transform: scale(0.93); }
    .jump-btn {
      width: 70px; height: 70px;
      background: rgba(99,102,241,0.2);
      border-color: rgba(99,102,241,0.5);
      font-size: 1.5rem;
    }
    .jump-btn:active { background: rgba(99,102,241,0.4); }
    #hint {
      font-size: 0.75rem;
      color: rgba(255,255,255,0.25);
      margin-top: 6px;
      text-align: center;
    }
    @media (hover: hover) and (pointer: fine) {
      #controls { display: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(project.name)}</h1>
  <canvas id="game" width="624" height="624"></canvas>
  <div id="controls">
    <div class="dpad">
      <button class="btn" id="btnLeft">◀</button>
      <button class="btn" id="btnRight">▶</button>
    </div>
    <button class="btn jump-btn" id="btnJump">▲</button>
  </div>
  <div id="hint">← → = röra sig &nbsp;|&nbsp; Mellanslag / W / ↑ = hoppa &nbsp;|&nbsp; R = starta om</div>

  <script>
  (function() {
    const PROJECT = ${projectJSON};
    ${RUNTIME_JS}
    startGame(PROJECT, document.getElementById('game'));
  })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Self-contained runtime (no external deps) ─────────────────────────────────
const RUNTIME_JS = `
const ART_SIZE = ${ART_SIZE};
const ROOM_SIZE = ${ROOM_SIZE};
const TILE_SIZE = 48;
const ROOM_PX = ROOM_SIZE * TILE_SIZE;
const GRAVITY = 0.48;
const MAX_FALL = 14;
const MOVE_SPEED = 3.6;
const JUMP_V = -11.5;
const LIQUID_GRAVITY = 0.1;
const LIQUID_MAX_FALL = 2.5;
const LIQUID_JUMP_V = -7;
const BOUNCE_V = -14;
const COYOTE_FRAMES = 7;
const JUMP_BUFFER_FRAMES = 9;
const INV_FRAMES = 80;
const PW = 28, PH = 42;
const EW = 34, EH = 42;

const BLOCK_COLORS = {
  terrain:'#22c55e', hazard:'#ef4444', collectible:'#eab308',
  liquid:'#3b82f6', enemy:'#a855f7', action:'#f97316',
  powerup:'#ec4899', story:'#f1f5f9'
};

function overlaps(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function getCells(project, roomId, behavior) {
  const room = project.worldMap.rooms[roomId];
  if (!room) return [];
  const result = [];
  for (let i = 0; i < room.cells.length; i++) {
    const tileId = room.cells[i];
    if (!tileId) continue;
    const tile = project.tileArts.find(t => t.id === tileId);
    if (!tile || tile.blockTypeId !== behavior) continue;
    const row = Math.floor(i / ROOM_SIZE);
    const col = i % ROOM_SIZE;
    result.push({ idx: i, row, col, x: col*TILE_SIZE, y: row*TILE_SIZE });
  }
  return result;
}

function resolveSolids(entity, solidCells) {
  entity.x += entity.vx;
  for (const c of solidCells) {
    if (!overlaps(entity, { x:c.x, y:c.y, w:TILE_SIZE, h:TILE_SIZE })) continue;
    const dx = (entity.x + entity.w/2) - (c.x + TILE_SIZE/2);
    entity.x = dx > 0 ? c.x + TILE_SIZE : c.x - entity.w;
    entity.vx = 0;
  }
  entity.y += entity.vy;
  entity.onGround = false;
  for (const c of solidCells) {
    if (!overlaps(entity, { x:c.x, y:c.y, w:TILE_SIZE, h:TILE_SIZE })) continue;
    const dy = (entity.y + entity.h/2) - (c.y + TILE_SIZE/2);
    if (dy < 0) {
      entity.y = c.y + TILE_SIZE;
      entity.vy = Math.max(0, entity.vy);
    } else {
      entity.y = c.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    }
  }
}

function buildTileCache(tileArts, size) {
  const cache = {};
  for (const tile of tileArts) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const px = size / ART_SIZE;
    for (let y = 0; y < ART_SIZE; y++) {
      for (let x = 0; x < ART_SIZE; x++) {
        ctx.fillStyle = (x+y)%2===0 ? '#2a2848' : '#1e1c38';
        ctx.fillRect(x*px, y*px, px, px);
      }
    }
    for (let i = 0; i < tile.pixels.length; i++) {
      const col = tile.pixels[i];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect((i % ART_SIZE)*px, Math.floor(i/ART_SIZE)*px, px, px);
    }
    cache[tile.id] = c;
  }
  return cache;
}

function initState(project) {
  const startRoomId = project.worldMap.startRoomId;
  let roomRow = 0, roomCol = 0;
  outer: for (let r = 0; r < project.worldMap.gridRows; r++) {
    for (let c = 0; c < project.worldMap.gridCols; c++) {
      if (project.worldMap.grid[r]?.[c] === startRoomId) { roomRow=r; roomCol=c; break outer; }
    }
  }
  const storyTiles = getCells(project, startRoomId, 'story');
  let spawnX = TILE_SIZE, spawnY = (ROOM_SIZE-2)*TILE_SIZE;
  if (storyTiles.length > 0) {
    spawnX = storyTiles[0].x + TILE_SIZE/2 - PW/2;
    spawnY = storyTiles[0].y - PH;
  }
  const coins = [];
  const enemies = [];
  for (const [roomId] of Object.entries(project.worldMap.rooms)) {
    getCells(project, roomId, 'collectible').forEach((c, i) => {
      coins.push({ id: 'c_'+roomId+'_'+i, roomId, cellIdx: c.idx, x: c.x+TILE_SIZE/2-10, y: c.y+TILE_SIZE/2-10, collected: false, bobTime: Math.random()*Math.PI*2 });
    });
    getCells(project, roomId, 'enemy').forEach((c, i) => {
      enemies.push({ id: 'e_'+roomId+'_'+i, roomId, x: c.x+TILE_SIZE/2-EW/2, y: c.y+TILE_SIZE/2-EH/2, w: EW, h: EH, vx: 1.5, vy: 0, onGround: false, health: 1, invTimer: 0, dir: 1 });
    });
  }
  return {
    player: { x: spawnX, y: spawnY, w: PW, h: PH, vx: 0, vy: 0, onGround: false, inLiquid: false, health: 3, maxHealth: 3, invTimer: 0, coyoteTimer: 0, jumpBuffer: 0 },
    coins, enemies,
    currentRoomId: startRoomId || '',
    roomRow, roomCol,
    coinsCollected: 0,
    status: 'playing',
    statusTimer: 0,
    flashAlpha: 0,
    flashColor: '#ff0000',
    time: 0
  };
}

function startGame(project, canvas) {
  const ctx = canvas.getContext('2d');
  const tileCache = buildTileCache(project.tileArts, TILE_SIZE);
  let state = initState(project);

  const input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

  // Keyboard
  document.addEventListener('keydown', e => {
    if (['ArrowLeft','a','A'].includes(e.key)) input.left = true;
    if (['ArrowRight','d','D'].includes(e.key)) input.right = true;
    if (['ArrowUp','w','W',' '].includes(e.key)) {
      if (!input.jumpHeld) input.jumpPressed = true;
      input.jumpHeld = true;
      e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') state = initState(project);
  });
  document.addEventListener('keyup', e => {
    if (['ArrowLeft','a','A'].includes(e.key)) input.left = false;
    if (['ArrowRight','d','D'].includes(e.key)) input.right = false;
    if (['ArrowUp','w','W',' '].includes(e.key)) input.jumpHeld = false;
  });

  // Touch buttons
  function bindBtn(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); onPress(); });
    el.addEventListener('pointerup', e => { e.preventDefault(); onRelease(); });
    el.addEventListener('pointerleave', e => { e.preventDefault(); onRelease(); });
  }
  bindBtn('btnLeft', () => { input.left = true; }, () => { input.left = false; });
  bindBtn('btnRight', () => { input.right = true; }, () => { input.right = false; });
  bindBtn('btnJump', () => {
    if (!input.jumpHeld) input.jumpPressed = true;
    input.jumpHeld = true;
  }, () => { input.jumpHeld = false; });

  function update() {
    if (state.status !== 'playing') { state = { ...state, statusTimer: state.statusTimer+1 }; return; }
    const p = { ...state.player };
    const roomId = state.currentRoomId;
    state = { ...state, time: state.time+1 };

    const solidCells = [...getCells(project, roomId, 'terrain'), ...getCells(project, roomId, 'action')];
    const liquidCells = getCells(project, roomId, 'liquid');
    p.inLiquid = liquidCells.some(c => overlaps(p, {x:c.x,y:c.y,w:TILE_SIZE,h:TILE_SIZE}));

    const accel = 0.8, friction = p.onGround ? 0.7 : 0.85;
    if (input.left) p.vx = Math.max(p.vx-accel, -MOVE_SPEED);
    else if (input.right) p.vx = Math.min(p.vx+accel, MOVE_SPEED);
    else p.vx *= friction;

    if (p.inLiquid) { p.vy += LIQUID_GRAVITY; p.vy = Math.min(p.vy, LIQUID_MAX_FALL); }
    else { p.vy += GRAVITY; p.vy = Math.min(p.vy, MAX_FALL); }

    if (p.onGround) p.coyoteTimer = COYOTE_FRAMES;
    else if (p.coyoteTimer > 0) p.coyoteTimer--;

    if (input.jumpPressed) p.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (p.jumpBuffer > 0) p.jumpBuffer--;

    if (p.jumpBuffer > 0 && (p.coyoteTimer > 0 || p.inLiquid)) {
      p.vy = p.inLiquid ? LIQUID_JUMP_V : JUMP_V;
      p.coyoteTimer = 0; p.jumpBuffer = 0; p.onGround = false;
    }
    input.jumpPressed = false;

    resolveSolids(p, solidCells);

    let newRoomId = roomId, newRoomRow = state.roomRow, newRoomCol = state.roomCol;
    if (p.x + p.w < 0) {
      const id = project.worldMap.grid[state.roomRow]?.[state.roomCol-1] ?? null;
      if (id && project.worldMap.rooms[id]) { newRoomId=id; newRoomCol=state.roomCol-1; p.x=ROOM_PX-p.w-4; }
      else { p.x=0; p.vx=0; }
    } else if (p.x > ROOM_PX) {
      const id = project.worldMap.grid[state.roomRow]?.[state.roomCol+1] ?? null;
      if (id && project.worldMap.rooms[id]) { newRoomId=id; newRoomCol=state.roomCol+1; p.x=4; }
      else { p.x=ROOM_PX-p.w; p.vx=0; }
    } else if (p.y + p.h < 0) {
      const id = project.worldMap.grid[state.roomRow-1]?.[state.roomCol] ?? null;
      if (id && project.worldMap.rooms[id]) { newRoomId=id; newRoomRow=state.roomRow-1; p.y=ROOM_PX-p.h-4; }
      else { p.y=0; p.vy=0; }
    } else if (p.y > ROOM_PX) {
      p.health = Math.max(0, p.health-1);
      if (p.health <= 0) { state = {...state, player:{...p}, status:'dead', statusTimer:0}; return; }
      const st = getCells(project, roomId, 'story');
      if (st.length>0) { p.x=st[0].x+TILE_SIZE/2-PW/2; p.y=st[0].y-PH; }
      else { p.x=TILE_SIZE; p.y=TILE_SIZE; }
      p.vy=0; p.vx=0; p.invTimer=INV_FRAMES;
    }

    if (p.invTimer <= 0) {
      for (const c of getCells(project, newRoomId, 'hazard')) {
        if (overlaps(p, {x:c.x,y:c.y,w:TILE_SIZE,h:TILE_SIZE})) {
          p.health = Math.max(0, p.health-1);
          p.invTimer = INV_FRAMES; p.vy = JUMP_V*0.6;
          if (p.health <= 0) { state={...state,player:{...p},status:'dead',statusTimer:0}; return; }
          break;
        }
      }
    }

    for (const c of getCells(project, newRoomId, 'action')) {
      if (overlaps(p,{x:c.x,y:c.y,w:TILE_SIZE,h:TILE_SIZE}) && p.vy>0 && p.y+p.h>c.y && p.y+p.h<c.y+TILE_SIZE/2) {
        p.vy=BOUNCE_V; break;
      }
    }

    if (p.invTimer <= 0) {
      for (const c of getCells(project, newRoomId, 'powerup')) {
        if (overlaps(p, {x:c.x,y:c.y,w:TILE_SIZE,h:TILE_SIZE})) {
          p.health = Math.min(p.maxHealth, p.health+1); break;
        }
      }
    }

    const goals = getCells(project, newRoomId, 'story');
    for (const c of goals) {
      if (c.row < ROOM_SIZE-2 && overlaps(p, {x:c.x,y:c.y,w:TILE_SIZE,h:TILE_SIZE})) {
        state = {...state, player:p, currentRoomId:newRoomId, roomRow:newRoomRow, roomCol:newRoomCol, status:'won', statusTimer:0, flashAlpha:1, flashColor:'#22c55e'};
        return;
      }
    }

    if (p.invTimer > 0) p.invTimer--;

    const updatedCoins = state.coins.map(coin => {
      if (coin.collected || coin.roomId !== newRoomId) return {...coin, bobTime:coin.bobTime+0.05};
      if (overlaps(p, {x:coin.x,y:coin.y,w:20,h:20})) return {...coin, collected:true};
      return {...coin, bobTime:coin.bobTime+0.05};
    });
    const newCollected = updatedCoins.filter(c=>c.collected).length;

    const updatedEnemies = state.enemies.map(enemy => {
      if (enemy.roomId !== newRoomId) return enemy;
      const e = {...enemy};
      if (e.invTimer>0) e.invTimer--;
      e.vy += GRAVITY*0.8; e.vy = Math.min(e.vy, MAX_FALL);
      e.vx = e.dir*1.5;
      resolveSolids(e, getCells(project, newRoomId, 'terrain'));
      if (e.x<=0||e.x+e.w>=ROOM_PX) { e.dir = e.dir===1?-1:1; }
      if (p.invTimer<=0 && overlaps(p, e)) {
        if (p.vy>0 && p.y+p.h < e.y+e.h*0.4) { e.health=0; p.vy=JUMP_V*0.5; }
        else { p.health=Math.max(0,p.health-1); p.invTimer=INV_FRAMES; p.vy=JUMP_V*0.4; p.vx=p.x<e.x+e.w/2?-3:3; }
      }
      return e;
    }).filter(e=>e.health>0);

    state = {
      ...state,
      player: p,
      coins: updatedCoins,
      enemies: updatedEnemies,
      currentRoomId: newRoomId,
      roomRow: newRoomRow,
      roomCol: newRoomCol,
      coinsCollected: newCollected,
      flashAlpha: Math.max(0, state.flashAlpha-0.05)
    };
  }

  function render() {
    const { player:p, currentRoomId, coins, enemies, status, statusTimer, flashAlpha, flashColor } = state;
    const room = project.worldMap.rooms[currentRoomId];
    ctx.fillStyle = project.backgroundColor;
    ctx.fillRect(0, 0, ROOM_PX, ROOM_PX);
    if (!room) return;

    for (let i=0; i<room.cells.length; i++) {
      const tileId = room.cells[i];
      if (!tileId) continue;
      const col=i%ROOM_SIZE, row=Math.floor(i/ROOM_SIZE);
      if (tileCache[tileId]) ctx.drawImage(tileCache[tileId], col*TILE_SIZE, row*TILE_SIZE, TILE_SIZE, TILE_SIZE);
      else {
        const tile = project.tileArts.find(t=>t.id===tileId);
        if (tile) { ctx.fillStyle=BLOCK_COLORS[tile.blockTypeId]||'#888'; ctx.fillRect(col*TILE_SIZE,row*TILE_SIZE,TILE_SIZE,TILE_SIZE); }
      }
    }

    for (const coin of coins) {
      if (coin.collected || coin.roomId !== currentRoomId) continue;
      const by = Math.sin(coin.bobTime)*4;
      ctx.fillStyle='#fbbf24'; ctx.shadowColor='#fbbf24'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(coin.x+10,coin.y+10+by,9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fde047'; ctx.shadowBlur=0;
      ctx.beginPath(); ctx.arc(coin.x+7,coin.y+7+by,3.5,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }

    for (const enemy of enemies) {
      if (enemy.roomId !== currentRoomId) continue;
      if (enemy.invTimer>0 && Math.floor(enemy.invTimer/4)%2===0) continue;
      ctx.fillStyle='#c084fc'; ctx.fillRect(enemy.x,enemy.y,enemy.w,enemy.h);
      ctx.fillStyle='#fff';
      const ex = enemy.dir===1 ? enemy.x+enemy.w*0.6 : enemy.x+enemy.w*0.2;
      ctx.fillRect(ex, enemy.y+enemy.h*0.2, 8,8);
      ctx.fillStyle='#000'; ctx.fillRect(ex+2, enemy.y+enemy.h*0.2+2,4,4);
    }

    if (!(p.invTimer>0&&Math.floor(p.invTimer/4)%2===0)) {
      ctx.fillStyle=p.inLiquid?'#60a5fa':'#4f46e5';
      ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='#fff';
      ctx.fillRect(p.x+p.w*0.6,p.y+p.h*0.18,9,9);
      ctx.fillRect(p.x+p.w*0.1,p.y+p.h*0.18,9,9);
      ctx.fillStyle='#1e1b4b';
      ctx.fillRect(p.x+p.w*0.6+2,p.y+p.h*0.18+2,5,5);
      ctx.fillRect(p.x+p.w*0.1+2,p.y+p.h*0.18+2,5,5);
      ctx.fillStyle='#fff';
      ctx.fillRect(p.x+p.w*0.2,p.y+p.h*0.55,p.w*0.6,3);
    }

    ctx.fillStyle='#fbbf24'; ctx.font='bold 18px system-ui';
    ctx.fillText('🪙 '+state.coinsCollected, 10, 28);
    for (let i=0; i<p.maxHealth; i++) {
      ctx.font='18px system-ui';
      ctx.fillText(i<p.health?'❤️':'🖤', ROOM_PX-24-i*26, 28);
    }

    if (flashAlpha>0) {
      ctx.globalAlpha=flashAlpha*0.5; ctx.fillStyle=flashColor;
      ctx.fillRect(0,0,ROOM_PX,ROOM_PX); ctx.globalAlpha=1;
    }

    if (status==='won') {
      ctx.fillStyle='rgba(0,0,0,'+Math.min(0.7,statusTimer/30)+')';
      ctx.fillRect(0,0,ROOM_PX,ROOM_PX);
      ctx.fillStyle='#22c55e'; ctx.textAlign='center'; ctx.font='bold 48px system-ui';
      ctx.fillText('🎉 Du vann!', ROOM_PX/2, ROOM_PX/2);
      ctx.font='bold 20px system-ui'; ctx.fillStyle='#86efac';
      ctx.fillText('Tryck R för att spela igen', ROOM_PX/2, ROOM_PX/2+50);
      ctx.textAlign='left';
    }
    if (status==='dead') {
      ctx.fillStyle='rgba(0,0,0,'+Math.min(0.75,statusTimer/30)+')';
      ctx.fillRect(0,0,ROOM_PX,ROOM_PX);
      ctx.fillStyle='#ef4444'; ctx.textAlign='center'; ctx.font='bold 48px system-ui';
      ctx.fillText('💀 Game Over', ROOM_PX/2, ROOM_PX/2);
      ctx.font='bold 20px system-ui'; ctx.fillStyle='#fca5a5';
      ctx.fillText('Tryck R för att försöka igen', ROOM_PX/2, ROOM_PX/2+50);
      ctx.textAlign='left';
    }
  }

  document.addEventListener('keydown', e => { if ((e.key==='r'||e.key==='R') && (state.status==='won'||state.status==='dead')) state=initState(project); });

  function loop() { update(); render(); requestAnimationFrame(loop); }
  loop();
}
`;
