import { create } from 'zustand';
import { uuid } from '../utils/uuid';
import type {
  Project,
  TileArt,
  Room,
  WorldMapLayout,
  UIState,
  AppMode,
  DrawTool,
  BlockTypeBehavior,
} from '../models/types';
import { ART_SIZE, ROOM_SIZE } from '../models/types';
import { getDefaultArtPalette } from '../data/blockTypes';

// ─── Flood Fill ───────────────────────────────────────────────────────────────
function floodFill(
  pixels: string[],
  startIdx: number,
  targetColor: string,
  fillColor: string,
  size: number
): string[] {
  if (targetColor === fillColor) return pixels;
  const next = [...pixels];
  const stack = [startIdx];
  const visited = new Set<number>();
  while (stack.length) {
    const idx = stack.pop()!;
    if (visited.has(idx)) continue;
    if (next[idx] !== targetColor) continue;
    visited.add(idx);
    next[idx] = fillColor;
    const r = Math.floor(idx / size);
    const c = idx % size;
    if (c > 0) stack.push(idx - 1);
    if (c < size - 1) stack.push(idx + 1);
    if (r > 0) stack.push(idx - size);
    if (r < size - 1) stack.push(idx + size);
  }
  return next;
}

function floodFillRoom(
  cells: (string | null)[],
  startIdx: number,
  targetId: string | null,
  fillId: string | null,
  size: number
): (string | null)[] {
  if (targetId === fillId) return cells;
  const next = [...cells];
  const stack = [startIdx];
  const visited = new Set<number>();
  while (stack.length) {
    const idx = stack.pop()!;
    if (visited.has(idx)) continue;
    if (next[idx] !== targetId) continue;
    visited.add(idx);
    next[idx] = fillId;
    const r = Math.floor(idx / size);
    const c = idx % size;
    if (c > 0) stack.push(idx - 1);
    if (c < size - 1) stack.push(idx + 1);
    if (r > 0) stack.push(idx - size);
    if (r < size - 1) stack.push(idx + size);
  }
  return next;
}

// ─── Default Data Factories ───────────────────────────────────────────────────
function makeEmptyTilePixels(): string[] {
  return Array(ART_SIZE * ART_SIZE).fill('');
}

function makeEmptyRoomCells(): (string | null)[] {
  return Array(ROOM_SIZE * ROOM_SIZE).fill(null);
}

function makeDefaultProject(name: string): Project {
  const roomId = uuid();
  const room: Room = {
    id: roomId,
    name: 'Room 1',
    cells: makeEmptyRoomCells(),
  };

  const worldMap: WorldMapLayout = {
    rooms: { [roomId]: room },
    grid: [[roomId, null, null, null, null],
           [null,   null, null, null, null],
           [null,   null, null, null, null],
           [null,   null, null, null, null],
           [null,   null, null, null, null]],
    gridRows: 5,
    gridCols: 5,
    startRoomId: roomId,
    spawnCellIndex: (ROOM_SIZE * (ROOM_SIZE - 2)) + 1, // near bottom-left
  };

  return {
    id: uuid(),
    name,
    gameType: 'platformer',
    tileArts: [],
    worldMap,
    backgroundColor: '#1e1b4b',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Store ─────────────────────────────────────────────────────────────────────
interface Store {
  project: Project | null;
  ui: UIState;
  savedProjects: { id: string; name: string; updatedAt: number }[];
  undoStack: TileArt[][];  // history of tileArts arrays for undo
  redoStack: TileArt[][];

  // Project lifecycle
  createProject: (name: string) => void;
  loadProjectById: (id: string) => void;
  saveCurrentProject: () => void;
  deleteProject: (id: string) => void;
  importProjectFromJSON: (json: string) => void;

  // Tile Arts
  createTileArt: (name: string, blockTypeId: BlockTypeBehavior) => void;
  setEditingTile: (id: string | null) => void;
  updatePixel: (tileId: string, index: number, color: string) => void;
  fillPixels: (tileId: string, startIndex: number, fillColor: string) => void;
  deleteTileArt: (id: string) => void;
  duplicateTileArt: (id: string) => void;
  renameTileArt: (id: string, name: string) => void;
  setTileBlockType: (id: string, blockTypeId: BlockTypeBehavior) => void;

  // World Map
  createRoom: (row: number, col: number) => void;
  deleteRoom: (roomId: string) => void;
  setActiveRoom: (roomId: string | null) => void;
  placeCell: (roomId: string, cellIndex: number, tileArtId: string | null) => void;
  fillCells: (roomId: string, startIndex: number, fillTileArtId: string | null) => void;
  setStartRoom: (roomId: string, spawnCellIndex: number) => void;

  // UI
  setMode: (mode: AppMode) => void;
  setSelectedTileArt: (id: string | null) => void;
  setSelectedColor: (color: string) => void;
  setSelectedBlockType: (id: BlockTypeBehavior) => void;
  setDrawTool: (tool: DrawTool) => void;
  updatePaletteColor: (index: number, color: string) => void;

  // Undo/Redo
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

const STORAGE_KEY = 'claudebloxels_projects';
const CURRENT_KEY = 'claudebloxels_current';

function loadSavedList(): { id: string; name: string; updatedAt: number }[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(project: Project) {
  try {
    localStorage.setItem(`project_${project.id}`, JSON.stringify(project));
    localStorage.setItem(CURRENT_KEY, project.id);
    const list = loadSavedList();
    const existing = list.findIndex((p) => p.id === project.id);
    const entry = { id: project.id, name: project.name, updatedAt: project.updatedAt };
    if (existing >= 0) list[existing] = entry;
    else list.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or unavailable
  }
}

export const useStore = create<Store>((set, get) => ({
  project: null,
  savedProjects: loadSavedList(),
  undoStack: [],
  redoStack: [],
  ui: {
    mode: 'home',
    selectedBlockTypeId: 'terrain',
    selectedColor: '#22c55e',
    drawTool: 'pen',
    editingTileId: null,
    activeRoomId: null,
    selectedTileArtId: null,
    artPalette: getDefaultArtPalette(),
  },

  // ── Project lifecycle ──
  createProject: (name) => {
    const project = makeDefaultProject(name);
    saveToStorage(project);
    set({
      project,
      savedProjects: loadSavedList(),
      undoStack: [],
      redoStack: [],
      ui: {
        mode: 'artboard',
        selectedBlockTypeId: 'terrain',
        selectedColor: '#22c55e',
        drawTool: 'pen',
        editingTileId: null,
        activeRoomId: project.worldMap.startRoomId,
        selectedTileArtId: null,
        artPalette: getDefaultArtPalette(),
      },
    });
  },

  loadProjectById: (id) => {
    try {
      const raw = localStorage.getItem(`project_${id}`);
      if (!raw) return;
      const project: Project = JSON.parse(raw);
      set({
        project,
        undoStack: [],
        redoStack: [],
        ui: {
          mode: 'worldmap',
          selectedBlockTypeId: 'terrain',
          selectedColor: '#22c55e',
          drawTool: 'pen',
          editingTileId: null,
          activeRoomId: project.worldMap.startRoomId,
          selectedTileArtId: null,
          artPalette: getDefaultArtPalette(),
        },
      });
      localStorage.setItem(CURRENT_KEY, id);
    } catch {
      // corrupted data
    }
  },

  saveCurrentProject: () => {
    const { project } = get();
    if (!project) return;
    const updated = { ...project, updatedAt: Date.now() };
    saveToStorage(updated);
    set({ project: updated, savedProjects: loadSavedList() });
  },

  deleteProject: (id) => {
    localStorage.removeItem(`project_${id}`);
    const list = loadSavedList().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    const { project } = get();
    if (project?.id === id) {
      set({ project: null, savedProjects: list, ui: { ...get().ui, mode: 'home' } });
    } else {
      set({ savedProjects: list });
    }
  },

  importProjectFromJSON: (json) => {
    try {
      const project: Project = JSON.parse(json);
      project.id = uuid(); // new id to avoid conflict
      project.updatedAt = Date.now();
      saveToStorage(project);
      set({
        project,
        savedProjects: loadSavedList(),
        undoStack: [],
        redoStack: [],
        ui: { ...get().ui, mode: 'worldmap', activeRoomId: project.worldMap.startRoomId },
      });
    } catch {
      alert('Ogiltig projektfil');
    }
  },

  // ── Tile Arts ──
  createTileArt: (name, blockTypeId) => {
    const { project } = get();
    if (!project) return;
    const tile: TileArt = {
      id: uuid(),
      name,
      blockTypeId,
      pixels: makeEmptyTilePixels(),
      createdAt: Date.now(),
    };
    const updated = { ...project, tileArts: [...project.tileArts, tile] };
    set({ project: updated, ui: { ...get().ui, editingTileId: tile.id } });
  },

  setEditingTile: (id) => set({ ui: { ...get().ui, editingTileId: id } }),

  updatePixel: (tileId, index, color) => {
    const { project } = get();
    if (!project) return;
    const tileArts = project.tileArts.map((t) =>
      t.id === tileId
        ? { ...t, pixels: t.pixels.map((p, i) => (i === index ? color : p)) }
        : t
    );
    set({ project: { ...project, tileArts } });
  },

  fillPixels: (tileId, startIndex, fillColor) => {
    const { project } = get();
    if (!project) return;
    const tile = project.tileArts.find((t) => t.id === tileId);
    if (!tile) return;
    const targetColor = tile.pixels[startIndex] ?? '';
    const newPixels = floodFill(tile.pixels, startIndex, targetColor, fillColor, ART_SIZE);
    const tileArts = project.tileArts.map((t) =>
      t.id === tileId ? { ...t, pixels: newPixels } : t
    );
    set({ project: { ...project, tileArts } });
  },

  deleteTileArt: (id) => {
    const { project } = get();
    if (!project) return;
    // Remove tile from all rooms too
    const rooms = Object.fromEntries(
      Object.entries(project.worldMap.rooms).map(([rid, room]) => [
        rid,
        { ...room, cells: room.cells.map((c) => (c === id ? null : c)) },
      ])
    );
    const tileArts = project.tileArts.filter((t) => t.id !== id);
    const ui = get().ui;
    set({
      project: { ...project, tileArts, worldMap: { ...project.worldMap, rooms } },
      ui: {
        ...ui,
        editingTileId: ui.editingTileId === id ? null : ui.editingTileId,
        selectedTileArtId: ui.selectedTileArtId === id ? null : ui.selectedTileArtId,
      },
    });
  },

  duplicateTileArt: (id) => {
    const { project } = get();
    if (!project) return;
    const tile = project.tileArts.find((t) => t.id === id);
    if (!tile) return;
    const copy: TileArt = { ...tile, id: uuid(), name: tile.name + ' (kopia)', createdAt: Date.now() };
    const idx = project.tileArts.findIndex((t) => t.id === id);
    const tileArts = [
      ...project.tileArts.slice(0, idx + 1),
      copy,
      ...project.tileArts.slice(idx + 1),
    ];
    set({ project: { ...project, tileArts }, ui: { ...get().ui, editingTileId: copy.id } });
  },

  renameTileArt: (id, name) => {
    const { project } = get();
    if (!project) return;
    const tileArts = project.tileArts.map((t) => (t.id === id ? { ...t, name } : t));
    set({ project: { ...project, tileArts } });
  },

  setTileBlockType: (id, blockTypeId) => {
    const { project } = get();
    if (!project) return;
    const tileArts = project.tileArts.map((t) => (t.id === id ? { ...t, blockTypeId } : t));
    set({ project: { ...project, tileArts } });
  },

  // ── World Map ──
  createRoom: (row, col) => {
    const { project } = get();
    if (!project) return;
    const room: Room = {
      id: uuid(),
      name: `Rum ${Object.keys(project.worldMap.rooms).length + 1}`,
      cells: makeEmptyRoomCells(),
    };
    const grid = project.worldMap.grid.map((r, ri) =>
      r.map((c, ci) => (ri === row && ci === col ? room.id : c))
    );
    const rooms = { ...project.worldMap.rooms, [room.id]: room };
    set({
      project: {
        ...project,
        worldMap: { ...project.worldMap, rooms, grid },
      },
      ui: { ...get().ui, activeRoomId: room.id },
    });
  },

  deleteRoom: (roomId) => {
    const { project } = get();
    if (!project) return;
    const rooms = { ...project.worldMap.rooms };
    delete rooms[roomId];
    const grid = project.worldMap.grid.map((r) => r.map((c) => (c === roomId ? null : c)));
    const startRoomId =
      project.worldMap.startRoomId === roomId
        ? (Object.keys(rooms)[0] ?? null)
        : project.worldMap.startRoomId;
    const ui = get().ui;
    set({
      project: {
        ...project,
        worldMap: { ...project.worldMap, rooms, grid, startRoomId },
      },
      ui: {
        ...ui,
        activeRoomId: ui.activeRoomId === roomId ? startRoomId : ui.activeRoomId,
      },
    });
  },

  setActiveRoom: (roomId) => set({ ui: { ...get().ui, activeRoomId: roomId } }),

  placeCell: (roomId, cellIndex, tileArtId) => {
    const { project } = get();
    if (!project) return;
    const room = project.worldMap.rooms[roomId];
    if (!room) return;
    const cells = room.cells.map((c, i) => (i === cellIndex ? tileArtId : c));
    const rooms = { ...project.worldMap.rooms, [roomId]: { ...room, cells } };
    set({ project: { ...project, worldMap: { ...project.worldMap, rooms } } });
  },

  fillCells: (roomId, startIndex, fillTileArtId) => {
    const { project } = get();
    if (!project) return;
    const room = project.worldMap.rooms[roomId];
    if (!room) return;
    const targetId = room.cells[startIndex] ?? null;
    const cells = floodFillRoom(room.cells, startIndex, targetId, fillTileArtId, ROOM_SIZE);
    const rooms = { ...project.worldMap.rooms, [roomId]: { ...room, cells } };
    set({ project: { ...project, worldMap: { ...project.worldMap, rooms } } });
  },

  setStartRoom: (roomId, spawnCellIndex) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        worldMap: { ...project.worldMap, startRoomId: roomId, spawnCellIndex },
      },
    });
  },

  // ── UI ──
  setMode: (mode) => set({ ui: { ...get().ui, mode } }),
  setSelectedTileArt: (id) => set({ ui: { ...get().ui, selectedTileArtId: id } }),
  setSelectedColor: (color) => set({ ui: { ...get().ui, selectedColor: color } }),
  setSelectedBlockType: (id) => set({ ui: { ...get().ui, selectedBlockTypeId: id } }),
  setDrawTool: (tool) => set({ ui: { ...get().ui, drawTool: tool } }),
  updatePaletteColor: (index, color) => {
    const palette = [...get().ui.artPalette];
    palette[index] = color;
    set({ ui: { ...get().ui, artPalette: palette } });
  },

  // ── Undo/Redo ──
  pushUndo: () => {
    const { project, undoStack } = get();
    if (!project) return;
    set({
      undoStack: [...undoStack.slice(-20), project.tileArts],
      redoStack: [],
    });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: { ...project, tileArts: prev },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, project.tileArts],
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: { ...project, tileArts: next },
      undoStack: [...undoStack, project.tileArts],
      redoStack: redoStack.slice(0, -1),
    });
  },
}));
