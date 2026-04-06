import type { Project, TileArt, BlockTypeBehavior } from '../models/types';
import { ART_SIZE, ROOM_SIZE } from '../models/types';
import { BLOCK_TYPE_MAP } from '../data/blockTypes';

// ── Constants ─────────────────────────────────────────────────────────────────
export const TILE_SIZE = 48;
const ROOM_PX = ROOM_SIZE * TILE_SIZE; // 624

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
const PLAYER_W = 28;
const PLAYER_H = 42;
const ENEMY_W = 34;
const ENEMY_H = 42;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

interface Player extends Entity {
  health: number;
  maxHealth: number;
  invTimer: number;
  coyoteTimer: number;
  jumpBuffer: number;
  inLiquid: boolean;
  dead: boolean;
}

interface Coin {
  id: string;
  roomId: string;
  cellIdx: number;
  x: number;
  y: number;
  collected: boolean;
  bobTime: number;
}

interface Enemy extends Entity {
  id: string;
  roomId: string;
  health: number;
  invTimer: number;
  dir: 1 | -1;
  patrolDelay: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean; // true for one frame only
}

export interface GameState {
  player: Player;
  coins: Coin[];
  enemies: Enemy[];
  currentRoomId: string;
  roomRow: number;
  roomCol: number;
  coinsCollected: number;
  status: 'playing' | 'won' | 'dead';
  statusTimer: number;
  time: number;
  flashAlpha: number; // 0-1 screen flash for damage
  flashColor: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Get all cells in a room with a given behavior type
function getCellsWithBehavior(
  project: Project,
  roomId: string,
  behavior: BlockTypeBehavior
): Array<{ idx: number; row: number; col: number; x: number; y: number }> {
  const room = project.worldMap.rooms[roomId];
  if (!room) return [];
  const result = [];
  for (let i = 0; i < room.cells.length; i++) {
    const tileId = room.cells[i];
    if (!tileId) continue;
    const tile = project.tileArts.find((t) => t.id === tileId);
    if (!tile || tile.blockTypeId !== behavior) continue;
    const row = Math.floor(i / ROOM_SIZE);
    const col = i % ROOM_SIZE;
    result.push({ idx: i, row, col, x: col * TILE_SIZE, y: row * TILE_SIZE });
  }
  return result;
}

// Resolve AABB collision against a list of solid grid cells (two-pass)
function resolveSolids(
  entity: Entity,
  solidCells: Array<{ x: number; y: number }>
) {
  // Horizontal pass
  entity.x += entity.vx;
  for (const c of solidCells) {
    if (!overlaps(entity, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })) continue;
    const dx = (entity.x + entity.w / 2) - (c.x + TILE_SIZE / 2);
    entity.x = dx > 0 ? c.x + TILE_SIZE : c.x - entity.w;
    entity.vx = 0;
  }

  // Vertical pass
  entity.y += entity.vy;
  entity.onGround = false;
  for (const c of solidCells) {
    if (!overlaps(entity, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })) continue;
    const dy = (entity.y + entity.h / 2) - (c.y + TILE_SIZE / 2);
    if (dy < 0) {
      // Hit ceiling from below
      entity.y = c.y + TILE_SIZE;
      entity.vy = Math.max(0, entity.vy);
    } else {
      // Land on top
      entity.y = c.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    }
  }
}

// ── Initialization ────────────────────────────────────────────────────────────
export function initGameState(project: Project): GameState {
  const startRoomId = project.worldMap.startRoomId;
  const room = startRoomId ? project.worldMap.rooms[startRoomId] : null;

  // Find room position in grid
  let roomRow = 0;
  let roomCol = 0;
  outer: for (let r = 0; r < project.worldMap.gridRows; r++) {
    for (let c = 0; c < project.worldMap.gridCols; c++) {
      if (project.worldMap.grid[r]?.[c] === startRoomId) {
        roomRow = r;
        roomCol = c;
        break outer;
      }
    }
  }

  // Find spawn position (first "story" tile or fallback to bottom-left)
  let spawnX = TILE_SIZE;
  let spawnY = (ROOM_SIZE - 2) * TILE_SIZE;

  if (room) {
    const storyTiles = getCellsWithBehavior(project, startRoomId!, 'story');
    if (storyTiles.length > 0) {
      spawnX = storyTiles[0].x + TILE_SIZE / 2 - PLAYER_W / 2;
      spawnY = storyTiles[0].y - PLAYER_H;
    }
  }

  // Build coins list from all rooms
  const coins: Coin[] = [];
  for (const [roomId] of Object.entries(project.worldMap.rooms)) {
    const collectibles = getCellsWithBehavior(project, roomId, 'collectible');
    for (const c of collectibles) {
      coins.push({
        id: `coin_${roomId}_${c.idx}`,
        roomId,
        cellIdx: c.idx,
        x: c.x + TILE_SIZE / 2 - 10,
        y: c.y + TILE_SIZE / 2 - 10,
        collected: false,
        bobTime: Math.random() * Math.PI * 2,
      });
    }
  }

  // Build enemies from all rooms
  const enemies: Enemy[] = [];
  for (const [roomId] of Object.entries(project.worldMap.rooms)) {
    const enemyCells = getCellsWithBehavior(project, roomId, 'enemy');
    for (const c of enemyCells) {
      enemies.push({
        id: `enemy_${roomId}_${c.idx}`,
        roomId,
        x: c.x + TILE_SIZE / 2 - ENEMY_W / 2,
        y: c.y + TILE_SIZE / 2 - ENEMY_H / 2,
        w: ENEMY_W,
        h: ENEMY_H,
        vx: 1.5,
        vy: 0,
        onGround: false,
        health: 1,
        invTimer: 0,
        dir: 1,
        patrolDelay: 0,
      });
    }
  }

  const player: Player = {
    x: spawnX,
    y: spawnY,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    inLiquid: false,
    health: 3,
    maxHealth: 3,
    invTimer: 0,
    coyoteTimer: 0,
    jumpBuffer: 0,
    dead: false,
  };

  return {
    player,
    coins,
    enemies,
    currentRoomId: startRoomId ?? '',
    roomRow,
    roomCol,
    coinsCollected: 0,
    status: 'playing',
    statusTimer: 0,
    time: 0,
    flashAlpha: 0,
    flashColor: '#ff0000',
  };
}

// ── Update (one frame) ─────────────────────────────────────────────────────────
export function updateGame(
  state: GameState,
  input: InputState,
  project: Project
): GameState {
  if (state.status !== 'playing') {
    // Countdown for status display
    return {
      ...state,
      statusTimer: state.statusTimer + 1,
    };
  }

  const p = { ...state.player };
  const roomId = state.currentRoomId;
  const room = project.worldMap.rooms[roomId];
  if (!room) return state;

  state = { ...state, time: state.time + 1 };

  // ── Get solid tiles in current room ──
  const solidCells = [...getCellsWithBehavior(project, roomId, 'terrain'),
                      ...getCellsWithBehavior(project, roomId, 'action')];

  // ── Liquid check ──
  const liquidCells = getCellsWithBehavior(project, roomId, 'liquid');
  p.inLiquid = liquidCells.some((c) =>
    overlaps(p, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })
  );

  // ── Physics ──
  // Horizontal input
  const accel = 0.8;
  const friction = p.onGround ? 0.7 : 0.85;
  if (input.left) p.vx = Math.max(p.vx - accel, -MOVE_SPEED);
  else if (input.right) p.vx = Math.min(p.vx + accel, MOVE_SPEED);
  else p.vx *= friction;

  // Gravity
  if (p.inLiquid) {
    p.vy += LIQUID_GRAVITY;
    p.vy = Math.min(p.vy, LIQUID_MAX_FALL);
  } else {
    p.vy += GRAVITY;
    p.vy = Math.min(p.vy, MAX_FALL);
  }

  // Coyote time
  if (p.onGround) p.coyoteTimer = COYOTE_FRAMES;
  else if (p.coyoteTimer > 0) p.coyoteTimer--;

  // Jump buffer
  if (input.jumpPressed) p.jumpBuffer = JUMP_BUFFER_FRAMES;
  else if (p.jumpBuffer > 0) p.jumpBuffer--;

  // Jump
  if (p.jumpBuffer > 0 && (p.coyoteTimer > 0 || p.inLiquid)) {
    p.vy = p.inLiquid ? LIQUID_JUMP_V : JUMP_V;
    p.coyoteTimer = 0;
    p.jumpBuffer = 0;
    p.onGround = false;
  }

  // Resolve solid tile collisions
  resolveSolids(p, solidCells);

  // ── Room Transition ──
  let newRoomId = roomId;
  let newRoomRow = state.roomRow;
  let newRoomCol = state.roomCol;

  if (p.x + p.w < 0) {
    const leftCol = state.roomCol - 1;
    const leftId = project.worldMap.grid[state.roomRow]?.[leftCol] ?? null;
    if (leftId && project.worldMap.rooms[leftId]) {
      newRoomId = leftId;
      newRoomCol = leftCol;
      p.x = ROOM_PX - p.w - 4;
    } else {
      p.x = 0;
      p.vx = 0;
    }
  } else if (p.x > ROOM_PX) {
    const rightCol = state.roomCol + 1;
    const rightId = project.worldMap.grid[state.roomRow]?.[rightCol] ?? null;
    if (rightId && project.worldMap.rooms[rightId]) {
      newRoomId = rightId;
      newRoomCol = rightCol;
      p.x = 4;
    } else {
      p.x = ROOM_PX - p.w;
      p.vx = 0;
    }
  } else if (p.y + p.h < 0) {
    const upRow = state.roomRow - 1;
    const upId = project.worldMap.grid[upRow]?.[state.roomCol] ?? null;
    if (upId && project.worldMap.rooms[upId]) {
      newRoomId = upId;
      newRoomRow = upRow;
      p.y = ROOM_PX - p.h - 4;
    } else {
      p.y = 0;
      p.vy = 0;
    }
  } else if (p.y > ROOM_PX) {
    // Fell out of bottom
    p.health = Math.max(0, p.health - 1);
    if (p.health <= 0) {
      return { ...state, player: { ...p, dead: true }, status: 'dead', statusTimer: 0, flashAlpha: 1, flashColor: '#000' };
    }
    // Respawn at start of room
    const storyTiles = getCellsWithBehavior(project, roomId, 'story');
    if (storyTiles.length > 0) {
      p.x = storyTiles[0].x + TILE_SIZE / 2 - PLAYER_W / 2;
      p.y = storyTiles[0].y - PLAYER_H;
    } else {
      p.x = TILE_SIZE;
      p.y = TILE_SIZE;
    }
    p.vy = 0;
    p.vx = 0;
    p.invTimer = INV_FRAMES;
  }

  // ── Special tile overlaps ──

  // Hazards
  if (p.invTimer <= 0) {
    const hazards = getCellsWithBehavior(project, newRoomId, 'hazard');
    for (const c of hazards) {
      if (overlaps(p, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })) {
        p.health = Math.max(0, p.health - 1);
        p.invTimer = INV_FRAMES;
        p.vy = JUMP_V * 0.6; // bounce away
        if (p.health <= 0) {
          return {
            ...state,
            player: { ...p, dead: true },
            currentRoomId: newRoomId,
            roomRow: newRoomRow,
            roomCol: newRoomCol,
            status: 'dead',
            statusTimer: 0,
            flashAlpha: 1,
            flashColor: '#ff0000',
          };
        }
        break;
      }
    }
  }

  // Bounce pads
  const bounceCells = getCellsWithBehavior(project, newRoomId, 'action');
  for (const c of bounceCells) {
    if (
      overlaps(p, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE }) &&
      p.vy > 0 &&
      p.y + p.h > c.y &&
      p.y + p.h < c.y + TILE_SIZE / 2
    ) {
      p.vy = BOUNCE_V;
      break;
    }
  }

  // Powerups
  if (p.invTimer <= 0) {
    const powerups = getCellsWithBehavior(project, newRoomId, 'powerup');
    for (const c of powerups) {
      if (overlaps(p, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })) {
        p.health = Math.min(p.maxHealth, p.health + 1);
        break;
      }
    }
  }

  // Goal (win)
  const goalCells = getCellsWithBehavior(project, newRoomId, 'story');
  // Story cells that are NOT the spawn (first story cell might be spawn)
  // Check last story cell as goal, or any story cell at row < ROOM_SIZE - 1
  for (const c of goalCells) {
    if (c.row < ROOM_SIZE - 2 && overlaps(p, { x: c.x, y: c.y, w: TILE_SIZE, h: TILE_SIZE })) {
      return {
        ...state,
        player: p,
        currentRoomId: newRoomId,
        roomRow: newRoomRow,
        roomCol: newRoomCol,
        status: 'won',
        statusTimer: 0,
        flashAlpha: 1,
        flashColor: '#22c55e',
      };
    }
  }

  // Invulnerability countdown
  if (p.invTimer > 0) p.invTimer--;

  // ── Coins ──
  const updatedCoins = state.coins.map((coin) => {
    if (coin.collected || coin.roomId !== newRoomId) return { ...coin, bobTime: coin.bobTime + 0.05 };
    const coinBox = { x: coin.x, y: coin.y, w: 20, h: 20 };
    if (overlaps(p, coinBox)) {
      return { ...coin, collected: true };
    }
    return { ...coin, bobTime: coin.bobTime + 0.05 };
  });
  const newCoins = updatedCoins.filter((c) => c.roomId !== newRoomId || !c.collected).length;
  const oldCoins = state.coins.filter((c) => c.roomId !== newRoomId || !c.collected).length;
  const coinsCollected = state.coinsCollected + (oldCoins - newCoins);

  // ── Enemies ──
  const updatedEnemies = state.enemies.map((enemy) => {
    if (enemy.roomId !== newRoomId) return enemy;

    const e = { ...enemy };
    if (e.invTimer > 0) e.invTimer--;
    if (e.patrolDelay > 0) { e.patrolDelay--; return e; }

    // Apply gravity to enemy
    e.vy += GRAVITY * 0.8;
    e.vy = Math.min(e.vy, MAX_FALL);
    e.vx = e.dir * 1.5;

    const eSolids = [...getCellsWithBehavior(project, newRoomId, 'terrain')];
    resolveSolids(e, eSolids);

    // Turn at room edges
    if (e.x <= 0 || e.x + e.w >= ROOM_PX) {
      e.dir = e.dir === 1 ? -1 : 1;
      e.vx = e.dir * 1.5;
    }

    // Player-enemy collision
    if (p.invTimer <= 0 && overlaps(p, e)) {
      // If player is falling onto enemy from above -> stomp
      if (p.vy > 0 && p.y + p.h < e.y + e.h * 0.4) {
        e.health = 0; // kill enemy
        p.vy = JUMP_V * 0.5;
      } else {
        p.health = Math.max(0, p.health - 1);
        p.invTimer = INV_FRAMES;
        p.vy = JUMP_V * 0.4;
        p.vx = p.x < e.x + e.w / 2 ? -3 : 3;
      }
    }

    return e;
  }).filter((e) => e.health > 0);

  // Screen flash decay
  const flashAlpha = Math.max(0, state.flashAlpha - 0.05);

  return {
    ...state,
    player: p,
    coins: updatedCoins,
    enemies: updatedEnemies,
    currentRoomId: newRoomId,
    roomRow: newRoomRow,
    roomCol: newRoomCol,
    coinsCollected,
    flashAlpha,
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────────

// Pre-render all tile arts to HTMLCanvasElements
export function buildTileCache(
  tileArts: TileArt[],
  size: number
): Record<string, HTMLCanvasElement> {
  const cache: Record<string, HTMLCanvasElement> = {};
  for (const tile of tileArts) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const px = size / ART_SIZE;
    // Checkerboard
    for (let y = 0; y < ART_SIZE; y++) {
      for (let x = 0; x < ART_SIZE; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2848' : '#1e1c38';
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
    for (let i = 0; i < tile.pixels.length; i++) {
      const col = tile.pixels[i];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect((i % ART_SIZE) * px, Math.floor(i / ART_SIZE) * px, px, px);
    }
    cache[tile.id] = c;
  }
  return cache;
}

export function renderGame(
  state: GameState,
  project: Project,
  ctx: CanvasRenderingContext2D,
  tileCache: Record<string, HTMLCanvasElement>,
  viewW: number,
  viewH: number
) {
  const { player: p, currentRoomId, coins, enemies, status, statusTimer } = state;
  const room = project.worldMap.rooms[currentRoomId];

  // Background
  ctx.fillStyle = project.backgroundColor;
  ctx.fillRect(0, 0, viewW, viewH);

  if (!room) return;

  // Scale to fit room in viewport (maintain aspect ratio)
  const scale = Math.min(viewW / ROOM_PX, viewH / ROOM_PX);
  const offsetX = (viewW - ROOM_PX * scale) / 2;
  const offsetY = (viewH - ROOM_PX * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Draw tiles
  for (let i = 0; i < room.cells.length; i++) {
    const tileId = room.cells[i];
    if (!tileId) continue;
    const col = i % ROOM_SIZE;
    const row = Math.floor(i / ROOM_SIZE);
    const cached = tileCache[tileId];
    if (cached) {
      ctx.drawImage(cached, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    } else {
      // Fallback: colored rectangle based on block type
      const tile = project.tileArts.find((t) => t.id === tileId);
      if (tile) {
        const bt = BLOCK_TYPE_MAP[tile.blockTypeId];
        ctx.fillStyle = bt?.color ?? '#888';
        ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw coins (not yet collected in current room)
  ctx.save();
  for (const coin of coins) {
    if (coin.collected || coin.roomId !== currentRoomId) continue;
    const bobY = Math.sin(coin.bobTime) * 4;
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(coin.x + 10, coin.y + 10 + bobY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(coin.x + 7, coin.y + 7 + bobY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // Draw enemies
  for (const enemy of enemies) {
    if (enemy.roomId !== currentRoomId) continue;
    const flash = enemy.invTimer > 0 && Math.floor(enemy.invTimer / 4) % 2 === 0;
    if (!flash) {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
      // Eyes
      ctx.fillStyle = '#fff';
      const eyeX = enemy.dir === 1 ? enemy.x + enemy.w * 0.6 : enemy.x + enemy.w * 0.2;
      ctx.fillRect(eyeX, enemy.y + enemy.h * 0.2, 8, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(eyeX + 2, enemy.y + enemy.h * 0.2 + 2, 4, 4);
    }
  }

  // Draw player
  const pFlash = p.invTimer > 0 && Math.floor(p.invTimer / 4) % 2 === 0;
  if (!pFlash) {
    // Body
    ctx.fillStyle = p.inLiquid ? '#60a5fa' : '#4f46e5';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + p.w * 0.6, p.y + p.h * 0.18, 9, 9);
    ctx.fillRect(p.x + p.w * 0.1, p.y + p.h * 0.18, 9, 9);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(p.x + p.w * 0.6 + 2, p.y + p.h * 0.18 + 2, 5, 5);
    ctx.fillRect(p.x + p.w * 0.1 + 2, p.y + p.h * 0.18 + 2, 5, 5);
    // Smile
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + p.w * 0.2, p.y + p.h * 0.55, p.w * 0.6, 3);
  }

  ctx.restore();

  // ── HUD (drawn at screen coords, not world coords) ──

  // Coins
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`🪙 ${state.coinsCollected}`, 16, 30);

  // Health hearts
  const heartX = viewW - 24;
  for (let i = 0; i < p.maxHealth; i++) {
    ctx.font = '20px system-ui';
    ctx.fillText(i < p.health ? '❤️' : '🖤', heartX - i * 28, 30);
  }

  // Screen flash
  if (state.flashAlpha > 0) {
    ctx.globalAlpha = state.flashAlpha * 0.5;
    ctx.fillStyle = state.flashColor;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalAlpha = 1;
  }

  // Status overlays
  if (status === 'won') {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, statusTimer / 30)})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('🎉 Du vann!', viewW / 2, viewH / 2);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.fillText('Tryck R för att spela igen', viewW / 2, viewH / 2 + 50);
    ctx.textAlign = 'left';
  }

  if (status === 'dead') {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.75, statusTimer / 30)})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('💀 Game Over', viewW / 2, viewH / 2);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('Tryck R för att försöka igen', viewW / 2, viewH / 2 + 50);
    ctx.textAlign = 'left';
  }
}
