import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useStore } from '../../store/useStore';
import { BLOCK_TYPES } from '../../data/blockTypes';
import { ART_SIZE, ROOM_SIZE } from '../../models/types';
import type { TileArt } from '../../models/types';
import styles from './WorldMap.module.css';

const ROOM_CELL_PX = 44; // pixel size per tile cell in room editor
const ROOM_CANVAS_PX = ROOM_SIZE * ROOM_CELL_PX; // 13 * 44 = 572

// Pre-render a TileArt to an HTMLCanvasElement at given size
function prerenderTile(tile: TileArt, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const px = size / ART_SIZE;
  // checkerboard bg
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
  return c;
}

// ── Room Canvas ───────────────────────────────────────────────────────────────
interface RoomCanvasProps {
  roomId: string;
  selectedTileId: string | null; // null = erase
  tool: 'paint' | 'erase' | 'fill' | 'spawn';
  spawnCellIndex?: number | null;
  onSpawn?: (cellIndex: number) => void;
  onOnboardingPlaceTile?: () => void;
}

const RoomCanvas: React.FC<RoomCanvasProps> = ({
  roomId,
  selectedTileId,
  tool,
  spawnCellIndex,
  onSpawn,
  onOnboardingPlaceTile,
}) => {
  const { project, ui, placeCell, fillCells, setOnboardingHint } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastIdx = useRef(-1);

  const room = project?.worldMap.rooms[roomId];

  // Pre-render all tile arts
  const tileArts = project?.tileArts;
  const tileCache = useMemo(() => {
    const cache: Record<string, HTMLCanvasElement> = {};
    if (!tileArts) return cache;
    for (const tile of tileArts) {
      cache[tile.id] = prerenderTile(tile, ROOM_CELL_PX);
    }
    return cache;
  }, [tileArts]);

  // Draw room
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = project?.backgroundColor ?? '#1e1b4b';
    ctx.fillRect(0, 0, ROOM_CANVAS_PX, ROOM_CANVAS_PX);

    // Tiles
    for (let row = 0; row < ROOM_SIZE; row++) {
      for (let col = 0; col < ROOM_SIZE; col++) {
        const tileId = room.cells[row * ROOM_SIZE + col];
        if (tileId && tileCache[tileId]) {
          ctx.drawImage(tileCache[tileId], col * ROOM_CELL_PX, row * ROOM_CELL_PX);
        }
      }
    }

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= ROOM_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * ROOM_CELL_PX, 0);
      ctx.lineTo(i * ROOM_CELL_PX, ROOM_CANVAS_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * ROOM_CELL_PX);
      ctx.lineTo(ROOM_CANVAS_PX, i * ROOM_CELL_PX);
      ctx.stroke();
    }

    // Spawn marker
    if (spawnCellIndex != null) {
      const spawnRow = Math.floor(spawnCellIndex / ROOM_SIZE);
      const spawnCol = spawnCellIndex % ROOM_SIZE;
      const sx = spawnCol * ROOM_CELL_PX;
      const sy = spawnRow * ROOM_CELL_PX;
      // Highlight cell
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fillRect(sx, sy, ROOM_CELL_PX, ROOM_CELL_PX);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, ROOM_CELL_PX - 2, ROOM_CELL_PX - 2);
      // Flag icon
      ctx.font = `${ROOM_CELL_PX * 0.6}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚩', sx + ROOM_CELL_PX / 2, sy + ROOM_CELL_PX / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }, [room, tileCache, project?.backgroundColor, spawnCellIndex]);

  const getCellIndex = useCallback(
    (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = ROOM_CANVAS_PX / rect.width;
      const scaleY = ROOM_CANVAS_PX / rect.height;
      const col = Math.floor(((clientX - rect.left) * scaleX) / ROOM_CELL_PX);
      const row = Math.floor(((clientY - rect.top) * scaleY) / ROOM_CELL_PX);
      if (col < 0 || col >= ROOM_SIZE || row < 0 || row >= ROOM_SIZE) return null;
      return row * ROOM_SIZE + col;
    },
    []
  );

  const paintCell = useCallback(
    (cellIdx: number) => {
      if (cellIdx === lastIdx.current) return;
      lastIdx.current = cellIdx;
      const tileId = tool === 'erase' ? null : selectedTileId;
      placeCell(roomId, cellIdx, tileId);
      if (ui.onboardingHint === 'place-tile') {
        setOnboardingHint('return-to-game-3');
        // The room view up to now was only a *derived* override (see
        // WorldMap's effectiveViewMode) — commit it to real state here so
        // the view doesn't snap back to the map overview the instant the
        // hint changes away from 'place-tile'.
        onOnboardingPlaceTile?.();
      }
    },
    [tool, selectedTileId, roomId, placeCell, ui.onboardingHint, setOnboardingHint, onOnboardingPlaceTile]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = getCellIndex(e.clientX, e.clientY);
    if (idx === null) return;
    if (tool === 'spawn') {
      onSpawn?.(idx);
      return;
    }
    if (tool === 'fill') {
      fillCells(roomId, idx, selectedTileId);
      return;
    }
    isDrawing.current = true;
    lastIdx.current = -1;
    paintCell(idx);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    const idx = getCellIndex(e.clientX, e.clientY);
    if (idx !== null) paintCell(idx);
  };

  const stopDraw = () => {
    isDrawing.current = false;
    lastIdx.current = -1;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const idx = getCellIndex(t.clientX, t.clientY);
    if (idx === null) return;
    if (tool === 'spawn') {
      onSpawn?.(idx);
      return;
    }
    if (tool === 'fill') {
      fillCells(roomId, idx, selectedTileId);
      return;
    }
    isDrawing.current = true;
    lastIdx.current = -1;
    paintCell(idx);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const t = e.touches[0];
    const idx = getCellIndex(t.clientX, t.clientY);
    if (idx !== null) paintCell(idx);
  };

  if (!room) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.roomCanvas} draw-canvas`}
      width={ROOM_CANVAS_PX}
      height={ROOM_CANVAS_PX}
      style={{ width: Math.min(ROOM_CANVAS_PX, window.innerHeight - 160) }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDraw}
      onMouseLeave={stopDraw}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={stopDraw}
    />
  );
};

// ── Map View ───────────────────────────────────────────────────────────────────
interface MapViewProps {
  onOpenRoom: (roomId: string) => void;
}

const MapView: React.FC<MapViewProps> = ({ onOpenRoom }) => {
  const { project, ui, createRoom, deleteRoom } = useStore();
  if (!project) return null;

  const { grid, gridRows, gridCols, startRoomId, rooms } = project.worldMap;

  return (
    <div className={styles.mapView}>
      <div
        className={styles.mapGrid}
        style={{ gridTemplateColumns: `repeat(${gridCols}, 80px)` }}
      >
        {Array.from({ length: gridRows }, (_, row) =>
          Array.from({ length: gridCols }, (_, col) => {
            const roomId = grid[row]?.[col] ?? null;
            const room = roomId ? rooms[roomId] : null;
            const isStart = roomId === startRoomId;
            const isActive = roomId === ui.activeRoomId;

            return (
              <div
                key={`${row}-${col}`}
                className={[
                  styles.mapCell,
                  room ? styles.hasRoom : '',
                  isStart ? styles.isStart : '',
                  isActive ? styles.isActive : '',
                ].join(' ')}
                onClick={() => {
                  if (room) {
                    onOpenRoom(roomId!);
                  } else {
                    createRoom(row, col);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (room && roomId) {
                    if (confirm(`Ta bort "${room.name}"?`)) deleteRoom(roomId);
                  }
                }}
              >
                {room ? (
                  <>
                    <RoomMiniPreview room={room} tileArts={project.tileArts} />
                    {isStart && <span className={styles.mapCellBadge}>START</span>}
                    <span className={styles.mapCellName}>{room.name}</span>
                  </>
                ) : (
                  <div className={styles.mapCellAdd}>+</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Tiny room preview for the map cells
const RoomMiniPreview: React.FC<{ room: { cells: (string | null)[] }; tileArts: TileArt[] }> = ({
  room,
  tileArts,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileMap = useMemo(
    () => Object.fromEntries(tileArts.map((t) => [t.id, t])),
    [tileArts]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, ROOM_SIZE, ROOM_SIZE);
    for (let i = 0; i < room.cells.length; i++) {
      const tileId = room.cells[i];
      if (!tileId) continue;
      const tile = tileMap[tileId];
      if (!tile) continue;
      // Use block type color as fallback for mini preview
      const bt = BLOCK_TYPES.find((b) => b.id === tile.blockTypeId);
      ctx.fillStyle = bt?.color ?? '#fff';
      ctx.fillRect(i % ROOM_SIZE, Math.floor(i / ROOM_SIZE), 1, 1);
    }
  }, [room, tileMap]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.mapCellPreview}
      width={ROOM_SIZE}
      height={ROOM_SIZE}
    />
  );
};

// ── Helper: find room position in grid ────────────────────────────────────────
function findRoomPos(
  grid: (string | null)[][],
  roomId: string
): { row: number; col: number } | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (grid[r][c] === roomId) return { row: r, col: c };
    }
  }
  return null;
}

// ── WorldMap (main) ───────────────────────────────────────────────────────────
type ViewMode = 'map' | 'room';
type RoomTool = 'paint' | 'erase' | 'fill' | 'spawn';

export const WorldMap: React.FC = () => {
  const { project, ui, setActiveRoom, setSelectedTileArt, setStartRoom, setSpawnCell, setOnboardingHint, setSuperFlow, setSelectedBlockType, setMode } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [roomTool, setRoomTool] = useState<RoomTool>('paint');
  const [isEraseMode, setIsEraseMode] = useState(false);

  const tileArts = project?.tileArts ?? [];
  const activeRoom = ui.activeRoomId
    ? project?.worldMap.rooms[ui.activeRoomId] ?? null
    : null;
  const isStartRoom = ui.activeRoomId === project?.worldMap.startRoomId;

  const superStep = ui.superFlow?.step;
  const superInRoomStep = superStep === 'floor-place' || superStep === 'place';

  // Chapter 3 of the guided "prova ändra något" flow (see GamePlayer), and
  // Super handlett läge's floor/mynt/fiende placement steps: derive room
  // view instead of the room-grid overview (which they've never seen and
  // shouldn't need to interpret yet), rather than forcing it via setState.
  const effectiveViewMode: ViewMode =
    (ui.onboardingHint === 'place-tile' || superInRoomStep) && activeRoom ? 'room' : viewMode;

  const superOther = ui.superFlow?.remaining[0] ?? null;
  const superOtherLabel = superOther === 'collectible' ? 'mynt' : 'en fiende';

  const superAdvancePlace = () => {
    // Commit the derived room view to real state — otherwise the moment the
    // step changes away from 'floor-place'/'place', effectiveViewMode's
    // override stops applying and the view would snap back to the map
    // overview (same class of bug fixed for the lighter Handlett läge).
    setViewMode('room');
    const flow = ui.superFlow!;
    if (flow.step === 'floor-place') {
      setSuperFlow({ step: 'choice', drawing: null, remaining: flow.remaining });
      return;
    }
    // step === 'place'
    if (flow.remaining.length > 0) {
      setSuperFlow({ step: 'ask-other', drawing: null, remaining: flow.remaining });
    } else {
      setSuperFlow({ step: 'done', drawing: null, remaining: [] });
    }
  };

  const superChoose = (type: 'collectible' | 'enemy') => {
    const flow = ui.superFlow!;
    setSelectedBlockType(type);
    setSuperFlow({ step: 'draw', drawing: type, remaining: flow.remaining.filter((r) => r !== type) });
    setMode('artboard');
  };

  const handleOpenRoom = (roomId: string) => {
    setActiveRoom(roomId);
    setViewMode('room');
  };

  // Adjacent rooms for navigation arrows
  const grid = project?.worldMap.grid ?? [];
  const rooms = project?.worldMap.rooms ?? ({} as Record<string, import('../../models/types').Room>);
  const activePos = ui.activeRoomId ? findRoomPos(grid, ui.activeRoomId) : null;
  const adjacentRooms = {
    up:    activePos ? (grid[activePos.row - 1]?.[activePos.col] ?? null) : null,
    down:  activePos ? (grid[activePos.row + 1]?.[activePos.col] ?? null) : null,
    left:  activePos ? (grid[activePos.row]?.[activePos.col - 1] ?? null) : null,
    right: activePos ? (grid[activePos.row]?.[activePos.col + 1] ?? null) : null,
  };

  const effectiveTool: RoomTool = isEraseMode ? 'erase' : roomTool;
  const effectiveTileId = isEraseMode ? null : ui.selectedTileArtId;
  const spawnCellIndex = isStartRoom ? (project?.worldMap.spawnCellIndex ?? null) : null;

  const handleSpawnCell = (cellIndex: number) => {
    setSpawnCell(cellIndex);
    setRoomTool('paint');
    setIsEraseMode(false);
  };

  return (
    <div className={styles.editorWrapper}>
      {ui.onboardingHint === 'place-tile' && (
        <div className={styles.onboardingBanner}>
          <span>Steg 1 av 1 — Klicka på en tom ruta för att lägga en stjärna</span>
          <button
            className={styles.onboardingClose}
            onClick={() => setOnboardingHint(null)}
            aria-label="Stäng"
            title="Stäng"
          >
            ✕
          </button>
        </div>
      )}
      {ui.onboardingHint === 'return-to-game-3' && (
        <div className={`${styles.onboardingBanner} ${styles.onboardingBannerDone}`}>
          <span>Klart — testa din nya bana</span>
          <button
            className={styles.onboardingClose}
            onClick={() => setOnboardingHint(null)}
            aria-label="Stäng"
            title="Stäng"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Super handlett läge ── */}
      {superStep === 'floor-place' && (
        <div className={styles.onboardingBanner}>
          <span>Placera golvet på banan — klicka "Klar" när du är nöjd!</span>
          <button className={styles.superContinueBtn} onClick={superAdvancePlace}>
            ✅ Klar, gå vidare →
          </button>
        </div>
      )}
      {superStep === 'place' && (
        <div className={styles.onboardingBanner}>
          <span>
            Placera {ui.superFlow?.drawing === 'collectible' ? 'ditt mynt' : 'din fiende'} på banan
            — klicka "Klar" när du är nöjd!
          </span>
          <button className={styles.superContinueBtn} onClick={superAdvancePlace}>
            ✅ Klar, gå vidare →
          </button>
        </div>
      )}
      {superStep === 'choice' && (
        <div className={`${styles.onboardingBanner} ${styles.onboardingBannerDone}`}>
          <span>Bra jobbat med golvet! Vill du lägga till mynt eller en fiende?</span>
          <div className={styles.superChoiceActions}>
            <button className={styles.superContinueBtn} onClick={() => superChoose('collectible')}>
              🪙 Lägg till mynt
            </button>
            <button className={styles.superContinueBtn} onClick={() => superChoose('enemy')}>
              👾 Lägg till en fiende
            </button>
          </div>
        </div>
      )}
      {superStep === 'ask-other' && superOther && (
        <div className={`${styles.onboardingBanner} ${styles.onboardingBannerDone}`}>
          <span>Bra jobbat! Vill du också lägga till {superOtherLabel}?</span>
          <div className={styles.superChoiceActions}>
            <button
              className={styles.superContinueBtn}
              onClick={() => superChoose(superOther)}
            >
              Ja, lägg till {superOtherLabel}
            </button>
            <button
              className={styles.superContinueBtn}
              onClick={() => setSuperFlow({ step: 'done', drawing: null, remaining: [] })}
            >
              Nej, jag är klar
            </button>
          </div>
        </div>
      )}
      {superStep === 'done' && (
        <div className={`${styles.onboardingBanner} ${styles.onboardingBannerDone}`}>
          <span>🎉 Nu har du byggt ett helt spel! Testa det med ▶ Spela högst upp.</span>
        </div>
      )}

    <div className={styles.worldmap}>
      {/* ── Left: Tile Palette ── */}
      {/* Super handlett läge pre-selects the right tile before landing here
          (see ArtBoard's superContinue / WorldMap's superChoose) — greyed
          out so switching tiles mid-step doesn't read as an option. */}
      <div className={`${styles.palettePanel} ${superInRoomStep ? styles.superDim : ''}`}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Brickor</span>
        </div>
        <div className={styles.paletteList}>
          {tileArts.length === 0 && (
            <div className={styles.noPalette}>
              Skapa brickor i Rita-fliken först!
            </div>
          )}
          {/* Erase option */}
          <div
            className={`${styles.eraseBtn} ${isEraseMode ? styles.selected : ''}`}
            onClick={() => {
              setIsEraseMode(true);
              setSelectedTileArt(null);
            }}
          >
            ⬜ Radera
          </div>
          {tileArts.map((tile) => {
            const bt = BLOCK_TYPES.find((b) => b.id === tile.blockTypeId);
            return (
              <div
                key={tile.id}
                className={`${styles.paletteItem} ${
                  !isEraseMode && ui.selectedTileArtId === tile.id ? styles.selected : ''
                }`}
                onClick={() => {
                  setIsEraseMode(false);
                  setSelectedTileArt(tile.id);
                }}
              >
                <canvas
                  className={styles.paletteThumb}
                  width={ART_SIZE}
                  height={ART_SIZE}
                  ref={(el) => {
                    if (!el) return;
                    const ctx = el.getContext('2d')!;
                    for (let y = 0; y < ART_SIZE; y++) {
                      for (let x = 0; x < ART_SIZE; x++) {
                        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2848' : '#1e1c38';
                        ctx.fillRect(x, y, 1, 1);
                      }
                    }
                    for (let i = 0; i < tile.pixels.length; i++) {
                      const c = tile.pixels[i];
                      if (!c) continue;
                      ctx.fillStyle = c;
                      ctx.fillRect(i % ART_SIZE, Math.floor(i / ART_SIZE), 1, 1);
                    }
                  }}
                />
                <span
                  className={styles.paletteName}
                  style={{ color: bt?.color ?? 'inherit' }}
                >
                  {tile.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center ── */}
      <div className={styles.mainArea}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={`${styles.viewBtns} ${superInRoomStep ? styles.superDim : ''}`}>
            <button
              className={`${styles.viewBtn} ${effectiveViewMode === 'map' ? styles.active : ''}`}
              onClick={() => setViewMode('map')}
            >
              🗺️ Karta
            </button>
            <button
              className={`${styles.viewBtn} ${effectiveViewMode === 'room' ? styles.active : ''}`}
              onClick={() => setViewMode('room')}
              disabled={!activeRoom}
              style={{ opacity: activeRoom ? 1 : 0.4 }}
            >
              ✏️ Rum
            </button>
          </div>

          {effectiveViewMode === 'room' && activeRoom && (
            <>
              <span className={styles.roomName}>{activeRoom.name}</span>
              {isStartRoom && <span className={styles.startBadge}>⭐ Startrum</span>}
              {!isStartRoom && ui.activeRoomId && (
                <button
                  className={`${styles.setStartBtn} ${superInRoomStep ? styles.superDim : ''}`}
                  onClick={() =>
                    setStartRoom(
                      ui.activeRoomId!,
                      project!.worldMap.spawnCellIndex
                    )
                  }
                >
                  Sätt som start
                </button>
              )}

              {/* Room navigation arrows */}
              <div className={`${styles.roomNavBtns} ${superInRoomStep ? styles.superDim : ''}`}>
                <button
                  className={styles.roomNavBtn}
                  disabled={!adjacentRooms.up}
                  onClick={() => adjacentRooms.up && handleOpenRoom(adjacentRooms.up)}
                  title={adjacentRooms.up ? `Gå upp: ${rooms[adjacentRooms.up]?.name}` : 'Inget rum ovanför'}
                >
                  ▲
                </button>
                <button
                  className={styles.roomNavBtn}
                  disabled={!adjacentRooms.left}
                  onClick={() => adjacentRooms.left && handleOpenRoom(adjacentRooms.left)}
                  title={adjacentRooms.left ? `Gå vänster: ${rooms[adjacentRooms.left]?.name}` : 'Inget rum till vänster'}
                >
                  ◀
                </button>
                <button
                  className={styles.roomNavBtn}
                  disabled={!adjacentRooms.right}
                  onClick={() => adjacentRooms.right && handleOpenRoom(adjacentRooms.right)}
                  title={adjacentRooms.right ? `Gå höger: ${rooms[adjacentRooms.right]?.name}` : 'Inget rum till höger'}
                >
                  ▶
                </button>
                <button
                  className={styles.roomNavBtn}
                  disabled={!adjacentRooms.down}
                  onClick={() => adjacentRooms.down && handleOpenRoom(adjacentRooms.down)}
                  title={adjacentRooms.down ? `Gå ner: ${rooms[adjacentRooms.down]?.name}` : 'Inget rum nedanför'}
                >
                  ▼
                </button>
              </div>
            </>
          )}

          {effectiveViewMode === 'room' && (
            <div className={styles.toolGroup}>
              <button
                className={`${styles.toolBtn} ${roomTool === 'paint' && !isEraseMode ? styles.active : ''}`}
                onClick={() => { setRoomTool('paint'); setIsEraseMode(false); }}
              >
                ✏️ Rita
              </button>
              {/* Fyll/Radera/Startpos aren't part of the Super handlett läge
                  script (only "rita ut" is) — greyed out during that step so
                  they don't read as extra things to try first. */}
              <button
                className={`${styles.toolBtn} ${roomTool === 'fill' && !isEraseMode ? styles.active : ''} ${superInRoomStep ? styles.superDim : ''}`}
                onClick={() => { setRoomTool('fill'); setIsEraseMode(false); }}
              >
                🪣 Fyll
              </button>
              <button
                className={`${styles.toolBtn} ${isEraseMode ? styles.active : ''} ${superInRoomStep ? styles.superDim : ''}`}
                onClick={() => setIsEraseMode((v) => !v)}
              >
                ⬜ Radera
              </button>
              {isStartRoom && (
                <button
                  className={`${styles.toolBtn} ${styles.spawnToolBtn} ${roomTool === 'spawn' && !isEraseMode ? styles.active : ''} ${superInRoomStep ? styles.superDim : ''}`}
                  onClick={() => { setRoomTool('spawn'); setIsEraseMode(false); }}
                  title="Klicka en cell för att sätta startposition"
                >
                  🚩 Startpos
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map or Room view */}
        {effectiveViewMode === 'map' ? (
          <MapView onOpenRoom={handleOpenRoom} />
        ) : (
          <div className={styles.roomView}>
            {activeRoom && ui.activeRoomId ? (
              <div className={styles.roomNavGrid}>
                <div className={`${styles.navUp} ${superInRoomStep ? styles.superDim : ''}`}>
                  <NavArrowBtn dir="up" roomId={adjacentRooms.up} roomName={adjacentRooms.up ? rooms[adjacentRooms.up]?.name : undefined} onNavigate={handleOpenRoom} />
                </div>
                <div className={`${styles.navLeft} ${superInRoomStep ? styles.superDim : ''}`}>
                  <NavArrowBtn dir="left" roomId={adjacentRooms.left} roomName={adjacentRooms.left ? rooms[adjacentRooms.left]?.name : undefined} onNavigate={handleOpenRoom} />
                </div>
                <div className={`${styles.navCanvas} ${(ui.onboardingHint === 'place-tile' || superInRoomStep) ? styles.navCanvasHighlight : ''}`}>
                  {(ui.onboardingHint === 'place-tile' || superInRoomStep) && (
                    <div className={styles.pointerArrowAnchorTop}>
                      <div className={styles.pointerArrow}>
                        <span className={styles.pointerArrowIcon}>⬇️</span>
                        <span>Klicka här!</span>
                      </div>
                    </div>
                  )}
                  <RoomCanvas
                    roomId={ui.activeRoomId}
                    selectedTileId={effectiveTileId}
                    tool={effectiveTool}
                    spawnCellIndex={spawnCellIndex}
                    onSpawn={handleSpawnCell}
                    onOnboardingPlaceTile={() => setViewMode('room')}
                  />
                </div>
                <div className={`${styles.navRight} ${superInRoomStep ? styles.superDim : ''}`}>
                  <NavArrowBtn dir="right" roomId={adjacentRooms.right} roomName={adjacentRooms.right ? rooms[adjacentRooms.right]?.name : undefined} onNavigate={handleOpenRoom} />
                </div>
                <div className={`${styles.navDown} ${superInRoomStep ? styles.superDim : ''}`}>
                  <NavArrowBtn dir="down" roomId={adjacentRooms.down} roomName={adjacentRooms.down ? rooms[adjacentRooms.down]?.name : undefined} onNavigate={handleOpenRoom} />
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
                <p>Välj ett rum från kartvyn för att redigera det.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

// ── Nav arrow button ───────────────────────────────────────────────────────────
const ARROW_ICONS = { up: '▲', down: '▼', left: '◀', right: '▶' };
const DIR_LABEL   = { up: 'upp', down: 'ner', left: 'vänster', right: 'höger' };

interface NavArrowBtnProps {
  roomId: string | null;
  roomName: string | undefined;
  dir: 'up' | 'down' | 'left' | 'right';
  onNavigate: (roomId: string) => void;
}

const NavArrowBtn: React.FC<NavArrowBtnProps> = ({ roomId, roomName, dir, onNavigate }) => {
  const isHoriz = dir === 'up' || dir === 'down';
  const active = !!roomId;

  const handleClick = () => {
    if (roomId) onNavigate(roomId);
  };

  return (
    <button
      className={[
        styles.navArrowBtn,
        isHoriz ? styles.navArrowHoriz : styles.navArrowVert,
        !active ? styles.navArrowEmpty : '',
      ].join(' ')}
      onClick={handleClick}
      title={active ? `Gå ${DIR_LABEL[dir]}: ${roomName ?? ''}` : 'Inget rum här'}
    >
      <span className={styles.navArrowIcon}>{ARROW_ICONS[dir]}</span>
      {active && <span className={styles.navArrowName}>{roomName ?? ''}</span>}
    </button>
  );
};
