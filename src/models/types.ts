// ─── Block Types ───────────────────────────────────────────────────────────────
export type BlockTypeBehavior =
  | 'terrain'
  | 'hazard'
  | 'collectible'
  | 'liquid'
  | 'enemy'
  | 'action'
  | 'powerup'
  | 'story';

export interface BlockType {
  id: BlockTypeBehavior;
  name: string;
  color: string; // Primary UI color for this block type
  lightColor: string; // Lighter variant for palette
  description: string;
  icon: string; // Emoji icon
}

// ─── Tile Art ──────────────────────────────────────────────────────────────────
export const ART_SIZE = 13; // 13×13 pixel art grid (Bloxels standard)
export const ROOM_SIZE = 13; // 13×13 tiles per room

export interface TileArt {
  id: string;
  name: string;
  blockTypeId: BlockTypeBehavior;
  pixels: string[]; // ART_SIZE*ART_SIZE colors (hex or '') for each pixel
  createdAt: number;
}

// ─── World / Rooms ─────────────────────────────────────────────────────────────
export interface Room {
  id: string;
  name: string;
  cells: (string | null)[]; // ROOM_SIZE*ROOM_SIZE: TileArt id or null
}

export interface WorldMapLayout {
  rooms: Record<string, Room>;
  // 2D map grid: layout[row][col] = roomId or null
  grid: (string | null)[][];
  gridRows: number;
  gridCols: number;
  startRoomId: string | null;
  spawnCellIndex: number; // Which cell in start room is spawn (use story/checkpt tile)
}

// ─── Project ───────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  gameType: 'platformer';
  tileArts: TileArt[];
  worldMap: WorldMapLayout;
  backgroundColor: string;
  createdAt: number;
  updatedAt: number;
}

// ─── UI State ──────────────────────────────────────────────────────────────────
export type AppMode = 'home' | 'artboard' | 'worldmap' | 'gametest';

export type DrawTool = 'pen' | 'eraser' | 'fill' | 'eyedropper';

export interface UIState {
  mode: AppMode;
  selectedBlockTypeId: BlockTypeBehavior;
  selectedColor: string;
  drawTool: DrawTool;
  editingTileId: string | null;     // Which tile art is being edited
  activeRoomId: string | null;      // Which room is open in world map
  selectedTileArtId: string | null; // Which tile to paint in world map
  artPalette: string[];             // Current color palette in art editor (8 colors)
}

// ─── Runtime / Engine ──────────────────────────────────────────────────────────
export interface Vec2 {
  x: number;
  y: number;
}

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  inLiquid: boolean;
  health: number;
  maxHealth: number;
  invTimer: number;    // Invulnerability frames after taking damage
  coyoteTimer: number; // Frames after leaving ground where jump still works
  jumpBuffer: number;  // Frames where jump input is buffered
}

export interface CoinState {
  id: string;
  x: number;
  y: number;
  roomId: string;
  cellIndex: number;
  collected: boolean;
  animTime: number;
}

export interface EnemyState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  direction: 1 | -1;
  roomId: string;
  health: number;
  invTimer: number;
  patrolTimer: number;
}

export interface GameState {
  player: PlayerState;
  currentRoomId: string;
  currentRoomRow: number;
  currentRoomCol: number;
  status: 'playing' | 'won' | 'dead' | 'transition';
  coinsCollected: number;
  totalCoins: number;
  coins: CoinState[];
  enemies: EnemyState[];
  transitionTimer: number;
  transitionDir: 'left' | 'right' | 'up' | 'down' | null;
  cameraX: number;
  cameraY: number;
  time: number;
}
