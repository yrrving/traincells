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
  tool: 'paint' | 'erase' | 'fill';
}

const RoomCanvas: React.FC<RoomCanvasProps> = ({
  roomId,
  selectedTileId,
  tool,
}) => {
  const { project, placeCell, fillCells } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastIdx = useRef(-1);

  const room = project?.worldMap.rooms[roomId];

  // Pre-render all tile arts
  const tileCache = useMemo(() => {
    const cache: Record<string, HTMLCanvasElement> = {};
    if (!project) return cache;
    for (const tile of project.tileArts) {
      cache[tile.id] = prerenderTile(tile, ROOM_CELL_PX);
    }
    return cache;
  }, [project?.tileArts]);

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
  }, [room, tileCache, project?.backgroundColor]);

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
    },
    [tool, selectedTileId, roomId, placeCell]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const idx = getCellIndex(e.clientX, e.clientY);
    if (idx === null) return;
    if (tool === 'fill') {
      const tileId = tool === 'fill' ? selectedTileId : null;
      fillCells(roomId, idx, tileId);
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

// ── WorldMap (main) ───────────────────────────────────────────────────────────
type ViewMode = 'map' | 'room';
type RoomTool = 'paint' | 'erase' | 'fill';

export const WorldMap: React.FC = () => {
  const { project, ui, setActiveRoom, setSelectedTileArt, setStartRoom } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [roomTool, setRoomTool] = useState<RoomTool>('paint');
  const [isEraseMode, setIsEraseMode] = useState(false);

  const tileArts = project?.tileArts ?? [];
  const activeRoom = ui.activeRoomId
    ? project?.worldMap.rooms[ui.activeRoomId] ?? null
    : null;
  const isStartRoom = ui.activeRoomId === project?.worldMap.startRoomId;

  const handleOpenRoom = (roomId: string) => {
    setActiveRoom(roomId);
    setViewMode('room');
  };

  const effectiveTool: RoomTool = isEraseMode ? 'erase' : roomTool;
  const effectiveTileId = isEraseMode ? null : ui.selectedTileArtId;

  return (
    <div className={styles.worldmap}>
      {/* ── Left: Tile Palette ── */}
      <div className={styles.palettePanel}>
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
          <div className={styles.viewBtns}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'map' ? styles.active : ''}`}
              onClick={() => setViewMode('map')}
            >
              🗺️ Karta
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'room' ? styles.active : ''}`}
              onClick={() => setViewMode('room')}
              disabled={!activeRoom}
              style={{ opacity: activeRoom ? 1 : 0.4 }}
            >
              ✏️ Rum
            </button>
          </div>

          {viewMode === 'room' && activeRoom && (
            <>
              <span className={styles.roomName}>{activeRoom.name}</span>
              {isStartRoom && <span className={styles.startBadge}>⭐ Startrum</span>}
              {!isStartRoom && ui.activeRoomId && (
                <button
                  className={styles.setStartBtn}
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
            </>
          )}

          {viewMode === 'room' && (
            <div className={styles.toolGroup}>
              <button
                className={`${styles.toolBtn} ${roomTool === 'paint' && !isEraseMode ? styles.active : ''}`}
                onClick={() => { setRoomTool('paint'); setIsEraseMode(false); }}
              >
                ✏️ Rita
              </button>
              <button
                className={`${styles.toolBtn} ${roomTool === 'fill' && !isEraseMode ? styles.active : ''}`}
                onClick={() => { setRoomTool('fill'); setIsEraseMode(false); }}
              >
                🪣 Fyll
              </button>
              <button
                className={`${styles.toolBtn} ${isEraseMode ? styles.active : ''}`}
                onClick={() => setIsEraseMode((v) => !v)}
              >
                ⬜ Radera
              </button>
            </div>
          )}
        </div>

        {/* Map or Room view */}
        {viewMode === 'map' ? (
          <MapView onOpenRoom={handleOpenRoom} />
        ) : (
          <div className={styles.roomView}>
            {activeRoom && ui.activeRoomId ? (
              <RoomCanvas
                roomId={ui.activeRoomId}
                selectedTileId={effectiveTileId}
                tool={effectiveTool}
              />
            ) : (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
                <p>Välj ett rum från kartvyn för att redigera det.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
