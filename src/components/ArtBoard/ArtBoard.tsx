import React, { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { BLOCK_TYPES, ART_EXTRA_COLORS } from '../../data/blockTypes';
import { ART_SIZE } from '../../models/types';
import type { BlockTypeBehavior, DrawTool } from '../../models/types';
import { PixelCanvas } from './PixelCanvas';
import styles from './ArtBoard.module.css';

const TOOLS: { id: DrawTool; icon: string; label: string }[] = [
  { id: 'pen', icon: '✏️', label: 'Rita' },
  { id: 'eraser', icon: '⬜', label: 'Radera' },
  { id: 'fill', icon: '🪣', label: 'Fyll' },
  { id: 'eyedropper', icon: '💉', label: 'Välj färg' },
];

export const ArtBoard: React.FC = () => {
  const {
    project,
    ui,
    createTileArt,
    setEditingTile,
    updatePixel,
    fillPixels,
    deleteTileArt,
    duplicateTileArt,
    renameTileArt,
    setTileBlockType,
    setSelectedColor,
    setSelectedBlockType,
    setDrawTool,
    pushUndo,
  } = useStore();

  const colorPickerRef = useRef<HTMLInputElement>(null);

  const tileArts = project?.tileArts ?? [];
  const editingTile = tileArts.find((t) => t.id === ui.editingTileId) ?? null;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleNewTile = () => {
    const name = `Bricka ${tileArts.length + 1}`;
    createTileArt(name, ui.selectedBlockTypeId);
  };

  const handleDraw = useCallback(
    (index: number, color: string) => {
      if (!editingTile) return;
      if (editingTile.pixels[index] === color) return;
      pushUndo();
      updatePixel(editingTile.id, index, color);
    },
    [editingTile, updatePixel, pushUndo]
  );

  const handleFill = useCallback(
    (index: number, color: string) => {
      if (!editingTile) return;
      pushUndo();
      fillPixels(editingTile.id, index, color);
    },
    [editingTile, fillPixels, pushUndo]
  );

  const handleEyedropper = useCallback(
    (color: string) => {
      setSelectedColor(color);
      setDrawTool('pen');
    },
    [setSelectedColor, setDrawTool]
  );

  const handleClear = () => {
    if (!editingTile) return;
    if (!confirm('Rensa hela brickan?')) return;
    pushUndo();
    for (let i = 0; i < ART_SIZE * ART_SIZE; i++) {
      updatePixel(editingTile.id, i, '');
    }
  };

  const handleBlockTypeClick = (id: BlockTypeBehavior) => {
    const bt = BLOCK_TYPES.find((b) => b.id === id)!;
    setSelectedBlockType(id);
    setSelectedColor(bt.color);
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        useStore.getState().undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        useStore.getState().redo();
      } else if (e.key === 'p' || e.key === 'b') {
        setDrawTool('pen');
      } else if (e.key === 'e') {
        setDrawTool('eraser');
      } else if (e.key === 'f') {
        setDrawTool('fill');
      } else if (e.key === 'i') {
        setDrawTool('eyedropper');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDrawTool]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.artboard}>
      {/* ── Left: Tile Library ── */}
      <div className={styles.tilePanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Brickor</span>
          <button className={styles.addBtn} onClick={handleNewTile} title="Ny bricka">
            +
          </button>
        </div>

        <div className={styles.tileList}>
          {tileArts.length === 0 && (
            <div className={styles.emptyTiles}>
              Tryck på + för att skapa din första bricka!
            </div>
          )}
          {tileArts.map((tile) => {
            const bt = BLOCK_TYPES.find((b) => b.id === tile.blockTypeId)!;
            return (
              <div
                key={tile.id}
                className={`${styles.tileItem} ${tile.id === ui.editingTileId ? styles.selected : ''}`}
                onClick={() => setEditingTile(tile.id)}
              >
                <canvas
                  className={styles.tileThumb}
                  width={ART_SIZE}
                  height={ART_SIZE}
                  ref={(el) => {
                    if (!el) return;
                    const ctx = el.getContext('2d')!;
                    // Draw checkerboard
                    for (let y = 0; y < ART_SIZE; y++) {
                      for (let x = 0; x < ART_SIZE; x++) {
                        ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2848' : '#1e1c38';
                        ctx.fillRect(x, y, 1, 1);
                      }
                    }
                    // Draw pixels
                    for (let i = 0; i < tile.pixels.length; i++) {
                      const c = tile.pixels[i];
                      if (!c) continue;
                      ctx.fillStyle = c;
                      ctx.fillRect(i % ART_SIZE, Math.floor(i / ART_SIZE), 1, 1);
                    }
                  }}
                />
                <div className={styles.tileInfo}>
                  <div className={styles.tileName}>{tile.name}</div>
                  <div className={styles.tileType} style={{ color: bt.color }}>
                    {bt.icon} {bt.name}
                  </div>
                </div>
                <button
                  className={styles.tileDel}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Ta bort "${tile.name}"?`)) deleteTileArt(tile.id);
                  }}
                  title="Ta bort"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center: Canvas ── */}
      <div className={styles.canvasPanel}>
        {!editingTile ? (
          <div className={styles.noTile}>
            <div className={styles.noTileIcon}>🎨</div>
            <div className={styles.noTileText}>
              Välj eller skapa en bricka för att börja rita!
            </div>
            <button
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
              onClick={handleNewTile}
            >
              + Ny bricka
            </button>
          </div>
        ) : (
          <>
            {/* Tile name + type header */}
            <div className={styles.tileHeader}>
              <div
                className={styles.typeIndicator}
                style={{ background: BLOCK_TYPES.find((b) => b.id === editingTile.blockTypeId)?.color }}
              />
              <input
                className={styles.tileNameInput}
                value={editingTile.name}
                onChange={(e) => renameTileArt(editingTile.id, e.target.value)}
                maxLength={30}
              />
              <select
                className={styles.blockTypeSelect}
                value={editingTile.blockTypeId}
                onChange={(e) => setTileBlockType(editingTile.id, e.target.value as BlockTypeBehavior)}
              >
                {BLOCK_TYPES.map((bt) => (
                  <option key={bt.id} value={bt.id}>
                    {bt.icon} {bt.name}
                  </option>
                ))}
              </select>
              <button
                className={styles.actionBtn}
                onClick={() => duplicateTileArt(editingTile.id)}
                title="Kopiera bricka"
              >
                📋
              </button>
            </div>

            {/* Canvas */}
            <div className={styles.canvasArea}>
              <div className={styles.canvasWrap}>
                <PixelCanvas
                  pixels={editingTile.pixels}
                  tool={ui.drawTool}
                  selectedColor={ui.selectedColor}
                  onDraw={handleDraw}
                  onFill={handleFill}
                  onEyedropper={handleEyedropper}
                />
              </div>
            </div>

            {/* Tools */}
            <div className={styles.toolRow}>
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  className={`${styles.toolBtn} ${ui.drawTool === t.id ? styles.active : ''}`}
                  onClick={() => setDrawTool(t.id)}
                  title={t.label}
                >
                  <span>{t.icon}</span>
                  <span className={styles.toolLabel}>{t.label}</span>
                </button>
              ))}
              <div className={styles.separator} />
              <button className={styles.actionBtn} onClick={handleClear}>
                🗑 Rensa
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Right: Color Palette ── */}
      <div className={styles.colorPanel}>
        {/* Current color */}
        <div>
          <div className={styles.colorSectionTitle}>Vald färg</div>
          <div className={styles.currentColor}>
            <div
              className={styles.currentSwatch}
              style={{ background: ui.selectedColor || 'transparent' }}
            />
            <label className={styles.colorPickerLabel}>
              Välj annan
              <input
                ref={colorPickerRef}
                type="color"
                className={styles.colorPickerInput}
                value={ui.selectedColor || '#ffffff'}
                onChange={(e) => setSelectedColor(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Block type colors */}
        <div>
          <div className={styles.colorSectionTitle}>Blocktyper</div>
          <div className={styles.blockTypeGrid}>
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.id}
                className={`${styles.blockTypeBtn} ${ui.selectedBlockTypeId === bt.id ? styles.selected : ''}`}
                onClick={() => handleBlockTypeClick(bt.id)}
                title={bt.description}
              >
                <div className={styles.blockTypeSwatch} style={{ background: bt.color }} />
                <span className={styles.blockTypeName}>{bt.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Extra art colors */}
        <div>
          <div className={styles.colorSectionTitle}>Färger</div>
          <div className={styles.paletteGrid}>
            {[...BLOCK_TYPES.map((b) => b.lightColor), ...ART_EXTRA_COLORS].map((color, i) => (
              <div
                key={i}
                className={`${styles.colorSwatch} ${ui.selectedColor === color ? styles.selected : ''}`}
                style={{ background: color }}
                onClick={() => setSelectedColor(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
