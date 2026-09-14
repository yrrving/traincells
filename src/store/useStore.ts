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
  AnimationName,
  CharacterDefinition,
  CharacterAnimation,
  AnimationFrame,
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

function makeEmptyFrame(): AnimationFrame {
  return { id: uuid(), pixels: Array(ART_SIZE * ART_SIZE).fill('') };
}

function makeAnim(name: AnimationName, frameCount: number, fps: number): CharacterAnimation {
  return { name, frames: Array.from({ length: frameCount }, makeEmptyFrame), fps };
}

export function makeDefaultCharacter(): CharacterDefinition {
  return {
    id: uuid(),
    animations: {
      idle: makeAnim('idle', 2, 4),
      walk: makeAnim('walk', 4, 8),
      jump: makeAnim('jump', 1, 6),
      fall: makeAnim('fall', 1, 6),
      hurt: makeAnim('hurt', 1, 8),
    },
  };
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
    playerCharacter: null,
    backgroundColor: '#1e1b4b',
    moveSpeed: 1.0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Store ─────────────────────────────────────────────────────────────────────
interface Store {
  project: Project | null;
  ui: UIState;
  savedProjects: { id: string; name: string; updatedAt: number }[];
  undoStack: { tileArts: TileArt[]; character: CharacterDefinition | null }[];
  redoStack: { tileArts: TileArt[]; character: CharacterDefinition | null }[];
  // True once the current project has been edited since it was created/
  // loaded/last saved. Nothing is auto-saved into "Sparade spel" anymore —
  // a project only lands there when the besökare deliberately saves it (or
  // is asked to, when leaving with unsaved changes), so the list doesn't
  // silently fill up with half-finished attempts.
  hasUnsavedChanges: boolean;

  // Project lifecycle
  createProject: (name: string) => void;
  loadProjectById: (id: string) => void;
  saveCurrentProject: (name?: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  importProjectFromJSON: (json: string, options?: { skipSave?: boolean }) => void;

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
  setSpawnCell: (cellIndex: number) => void;

  // Character
  initPlayerCharacter: () => void;
  clearPlayerCharacter: () => void;
  updateCharacterFrame: (animName: AnimationName, frameIndex: number, pixelIndex: number, color: string) => void;
  fillCharacterFrame: (animName: AnimationName, frameIndex: number, startPixel: number, color: string) => void;
  addAnimationFrame: (animName: AnimationName) => void;
  deleteAnimationFrame: (animName: AnimationName, frameIndex: number) => void;
  duplicateAnimationFrame: (animName: AnimationName, frameIndex: number) => void;
  flipCharacterFrame: (animName: AnimationName, frameIndex: number) => void;
  copyFrameToAnimation: (fromAnim: AnimationName, frameIndex: number, toAnim: AnimationName) => void;
  setAnimationFps: (animName: AnimationName, fps: number) => void;

  setMoveSpeed: (speed: number) => void;

  // UI
  setMode: (mode: AppMode) => void;
  setSelectedTileArt: (id: string | null) => void;
  setSelectedColor: (color: string) => void;
  setSelectedBlockType: (id: BlockTypeBehavior) => void;
  setDrawTool: (tool: DrawTool) => void;
  updatePaletteColor: (index: number, color: string) => void;
  setOnboardingHint: (hint: UIState['onboardingHint']) => void;
  setOnboardingStage: (stage: UIState['onboardingStage']) => void;
  setSuperFlow: (flow: UIState['superFlow']) => void;

  // Undo/Redo
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

const STORAGE_KEY = 'traincells_projects';
const CURRENT_KEY = 'traincells_current';
// Pre-rename key names (2026-09-14) — the app used to be called
// "ClaudeBloxels" and its localStorage keys said so, which is exactly the
// kind of leftover branding leak that shouldn't be visible anywhere in the
// product. Migrated below so besökare with existing saved games don't lose
// their "Sparade spel" list the first time they open the renamed version.
const LEGACY_STORAGE_KEY = 'claudebloxels_projects';

function loadSavedList(): { id: string; name: string; updatedAt: number }[] {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return JSON.parse(current);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      // One-time migration: copy forward under the new key, then drop the
      // old one so it doesn't linger indefinitely.
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return JSON.parse(legacy);
    }
    return [];
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
  hasUnsavedChanges: false,
  ui: {
    mode: 'home',
    selectedBlockTypeId: 'terrain',
    selectedColor: '#22c55e',
    drawTool: 'pen',
    editingTileId: null,
    activeRoomId: null,
    selectedTileArtId: null,
    artPalette: getDefaultArtPalette(),
    onboardingHint: null,
    onboardingStage: 0,
    superFlow: null,
  },

  // ── Project lifecycle ──
  createProject: (name) => {
    // Not saved yet — only lands in "Sparade spel" once the besökare
    // deliberately saves it (see saveCurrentProject / Nav's leave-prompt).
    const project = makeDefaultProject(name);
    set({
      project,
      undoStack: [],
      redoStack: [],
      hasUnsavedChanges: false,
      ui: {
        mode: 'artboard',
        selectedBlockTypeId: 'terrain',
        selectedColor: '#22c55e',
        drawTool: 'pen',
        editingTileId: null,
        activeRoomId: project.worldMap.startRoomId,
        selectedTileArtId: null,
        artPalette: getDefaultArtPalette(),
        onboardingHint: null,
        onboardingStage: 0,
        superFlow: null,
      },
    });
  },

  loadProjectById: (id) => {
    try {
      const raw = localStorage.getItem(`project_${id}`);
      if (!raw) return;
      const project: Project = JSON.parse(raw);
      project.playerCharacter = project.playerCharacter ?? null;
      set({
        project,
        undoStack: [],
        redoStack: [],
        hasUnsavedChanges: false,
        ui: {
          mode: 'worldmap',
          selectedBlockTypeId: 'terrain',
          selectedColor: '#22c55e',
          drawTool: 'pen',
          editingTileId: null,
          activeRoomId: project.worldMap.startRoomId,
          selectedTileArtId: null,
          artPalette: getDefaultArtPalette(),
          onboardingHint: null,
          onboardingStage: 0,
          superFlow: null,
        },
      });
      localStorage.setItem(CURRENT_KEY, id);
    } catch {
      // corrupted data
    }
  },

  saveCurrentProject: (name) => {
    const { project } = get();
    if (!project) return;
    const updated = { ...project, name: name?.trim() || project.name, updatedAt: Date.now() };
    saveToStorage(updated);
    set({ project: updated, savedProjects: loadSavedList(), hasUnsavedChanges: false });
  },

  renameProject: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { project } = get();
    if (project?.id === id) {
      // Renaming the currently open project — update both the live project
      // and, only if it was already saved before, its stored copy too.
      const updated = { ...project, name: trimmed };
      set({ project: updated });
      const wasSaved = loadSavedList().some((p) => p.id === id);
      if (wasSaved) {
        saveToStorage({ ...updated, updatedAt: Date.now() });
        set({ savedProjects: loadSavedList() });
      }
      return;
    }
    // Renaming a different saved project from the Hem-list.
    try {
      const raw = localStorage.getItem(`project_${id}`);
      if (!raw) return;
      const stored: Project = JSON.parse(raw);
      stored.name = trimmed;
      stored.updatedAt = Date.now();
      saveToStorage(stored);
      set({ savedProjects: loadSavedList() });
    } catch {
      // corrupted data
    }
  },

  deleteProject: (id) => {
    localStorage.removeItem(`project_${id}`);
    const list = loadSavedList().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    const { project } = get();
    if (project?.id === id) {
      set({ project: null, savedProjects: list, hasUnsavedChanges: false, ui: { ...get().ui, mode: 'home' } });
    } else {
      set({ savedProjects: list });
    }
  },

  // Not saved yet (see createProject) — the besökare explicitly opening a
  // .traincells.json file is the one exception that still saves immediately,
  // since importing IS the deliberate "this is mine, keep it" action; the
  // starter-game import used by Handlett läge passes skipSave so trying the
  // demo doesn't itself clutter "Sparade spel".
  importProjectFromJSON: (json, options) => {
    try {
      const project: Project = JSON.parse(json);
      project.id = uuid(); // new id to avoid conflict
      project.updatedAt = Date.now();
      if (!options?.skipSave) saveToStorage(project);
      set({
        project,
        savedProjects: loadSavedList(),
        undoStack: [],
        redoStack: [],
        hasUnsavedChanges: false,
        ui: { ...get().ui, mode: 'worldmap', activeRoomId: project.worldMap.startRoomId, onboardingHint: null, onboardingStage: 0, superFlow: null },
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

  setSpawnCell: (cellIndex) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        worldMap: { ...project.worldMap, spawnCellIndex: cellIndex },
      },
    });
  },

  setMoveSpeed: (speed) => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, moveSpeed: speed } });
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
  setOnboardingHint: (hint) => set({ ui: { ...get().ui, onboardingHint: hint } }),
  setOnboardingStage: (stage) => set({ ui: { ...get().ui, onboardingStage: stage } }),
  setSuperFlow: (flow) => set({ ui: { ...get().ui, superFlow: flow } }),

  // ── Character ──
  initPlayerCharacter: () => {
    const { project } = get();
    if (!project || project.playerCharacter) return;
    set({ project: { ...project, playerCharacter: makeDefaultCharacter() } });
  },

  clearPlayerCharacter: () => {
    const { project } = get();
    if (!project) return;
    set({ project: { ...project, playerCharacter: null } });
  },

  updateCharacterFrame: (animName, frameIndex, pixelIndex, color) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    const frames = anim.frames.map((f, i) =>
      i === frameIndex
        ? { ...f, pixels: f.pixels.map((p, pi) => (pi === pixelIndex ? color : p)) }
        : f
    );
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  fillCharacterFrame: (animName, frameIndex, startPixel, color) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    const frame = anim.frames[frameIndex];
    if (!frame) return;
    const target = frame.pixels[startPixel] ?? '';
    const newPixels = floodFill(frame.pixels, startPixel, target, color, ART_SIZE);
    const frames = anim.frames.map((f, i) => (i === frameIndex ? { ...f, pixels: newPixels } : f));
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  addAnimationFrame: (animName) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    if (anim.frames.length >= 8) return;
    const frames = [...anim.frames, makeEmptyFrame()];
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  deleteAnimationFrame: (animName, frameIndex) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    if (anim.frames.length <= 1) return;
    const frames = anim.frames.filter((_, i) => i !== frameIndex);
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  duplicateAnimationFrame: (animName, frameIndex) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    if (anim.frames.length >= 8) return;
    const orig = anim.frames[frameIndex];
    const copy = { ...orig, id: uuid(), pixels: [...orig.pixels] };
    const frames = [...anim.frames.slice(0, frameIndex + 1), copy, ...anim.frames.slice(frameIndex + 1)];
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  flipCharacterFrame: (animName, frameIndex) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    const frame = anim.frames[frameIndex];
    if (!frame) return;
    const flipped = [...frame.pixels];
    for (let row = 0; row < ART_SIZE; row++) {
      for (let col = 0; col < Math.floor(ART_SIZE / 2); col++) {
        const a = row * ART_SIZE + col;
        const b = row * ART_SIZE + (ART_SIZE - 1 - col);
        [flipped[a], flipped[b]] = [flipped[b], flipped[a]];
      }
    }
    const frames = anim.frames.map((f, i) => i === frameIndex ? { ...f, pixels: flipped } : f);
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  copyFrameToAnimation: (fromAnim, frameIndex, toAnim) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const srcFrame = project.playerCharacter.animations[fromAnim]?.frames[frameIndex];
    if (!srcFrame) return;
    const destAnim = project.playerCharacter.animations[toAnim];
    if (destAnim.frames.length >= 8) return;
    const newFrame = { id: uuid(), pixels: [...srcFrame.pixels] };
    const frames = [...destAnim.frames, newFrame];
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [toAnim]: { ...destAnim, frames } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  setAnimationFps: (animName, fps) => {
    const { project } = get();
    if (!project?.playerCharacter) return;
    const anim = project.playerCharacter.animations[animName];
    const ch = { ...project.playerCharacter, animations: { ...project.playerCharacter.animations, [animName]: { ...anim, fps } } };
    set({ project: { ...project, playerCharacter: ch } });
  },

  // ── Undo/Redo ──
  pushUndo: () => {
    const { project, undoStack } = get();
    if (!project) return;
    set({
      undoStack: [...undoStack.slice(-20), { tileArts: project.tileArts, character: project.playerCharacter ?? null }],
      redoStack: [],
    });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: { ...project, tileArts: prev.tileArts, playerCharacter: prev.character },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { tileArts: project.tileArts, character: project.playerCharacter ?? null }],
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (!project || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: { ...project, tileArts: next.tileArts, playerCharacter: next.character },
      undoStack: [...undoStack, { tileArts: project.tileArts, character: project.playerCharacter ?? null }],
      redoStack: redoStack.slice(0, -1),
    });
  },
}));

// Shared by every "go back to Hem" button (Nav's own tab, GamePlayer's
// end-of-onboarding "Fortsätt bygga fritt") — nothing auto-saves into
// "Sparade spel" anymore, so leaving with unsaved changes is the one moment
// to ask, rather than letting work silently vanish or piling up
// half-finished entries on every attempt.
export function goHomeWithSavePrompt() {
  const { project, hasUnsavedChanges, saveCurrentProject, setMode } = useStore.getState();
  if (project && hasUnsavedChanges) {
    const wantsSave = confirm('Du har osparade ändringar. Vill du spara ditt spel innan du går till Hem?');
    if (wantsSave) {
      const name = window.prompt('Namnge ditt spel:', project.name);
      if (name === null) return; // Avbryt — stanna kvar, spara inte, gå inte hem
      saveCurrentProject(name);
    }
  }
  setMode('home');
}

// Marks hasUnsavedChanges whenever `project` changes in a way that isn't a
// fresh create/load (different id) and isn't the save action itself (which
// clears the flag in the very same set() call, so it and this update never
// disagree). This avoids threading a manual "mark dirty" call through every
// single edit action (pixel paint, cell placement, rename, fps change, …).
useStore.subscribe((state, prevState) => {
  if (
    state.project &&
    prevState.project &&
    state.project !== prevState.project &&
    state.project.id === prevState.project.id &&
    state.hasUnsavedChanges === prevState.hasUnsavedChanges &&
    !state.hasUnsavedChanges
  ) {
    useStore.setState({ hasUnsavedChanges: true });
  }
});
