import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { ART_EXTRA_COLORS } from '../../data/blockTypes';
import { ART_SIZE } from '../../models/types';
import type { AnimationName, DrawTool } from '../../models/types';
import { PixelCanvas } from '../ArtBoard/PixelCanvas';
import styles from './CharacterEditor.module.css';

const ANIMS: { id: AnimationName; label: string; icon: string }[] = [
  { id: 'idle', label: 'Stilla', icon: '🧍' },
  { id: 'walk', label: 'Gå', icon: '🚶' },
  { id: 'jump', label: 'Hoppa', icon: '⬆️' },
  { id: 'fall', label: 'Falla', icon: '⬇️' },
  { id: 'hurt', label: 'Skadad', icon: '💥' },
];

const TOOLS: { id: DrawTool; icon: string; label: string }[] = [
  { id: 'pen', icon: '✏️', label: 'Rita' },
  { id: 'eraser', icon: '⬜', label: 'Radera' },
  { id: 'fill', icon: '🪣', label: 'Fyll' },
  { id: 'eyedropper', icon: '💉', label: 'Välj färg' },
];

const PREVIEW_SIZE = 78; // px — preview canvas size
const THUMB_SIZE = 40;   // px — frame thumbnail size
const THUMB_ART = ART_SIZE;

function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  pixels: string[],
  size: number
) {
  const ctx = canvas.getContext('2d')!;
  const px = size / THUMB_ART;
  ctx.clearRect(0, 0, size, size);
  // Checkerboard bg
  for (let y = 0; y < THUMB_ART; y++) {
    for (let x = 0; x < THUMB_ART; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2848' : '#1e1c38';
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  for (let i = 0; i < pixels.length; i++) {
    const col = pixels[i];
    if (!col) continue;
    ctx.fillStyle = col;
    ctx.fillRect((i % THUMB_ART) * px, Math.floor(i / THUMB_ART) * px, px, px);
  }
}

export const CharacterEditor: React.FC = () => {
  const {
    project,
    initPlayerCharacter,
    clearPlayerCharacter,
    updateCharacterFrame,
    fillCharacterFrame,
    addAnimationFrame,
    deleteAnimationFrame,
    duplicateAnimationFrame,
    flipCharacterFrame,
    copyFrameToAnimation,
    setAnimationFps,
    setSelectedColor,
    setDrawTool,
    pushUndo,
  } = useStore();

  const [selectedAnim, setSelectedAnim] = useState<AnimationName>('idle');
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [copyMenuFrame, setCopyMenuFrame] = useState<number | null>(null);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const previewRafRef = useRef<number>(0);
  const previewTimeRef = useRef(0);

  const character = project?.playerCharacter ?? null;
  const anim = character?.animations[selectedAnim];
  const frames = anim?.frames ?? [];
  const fps = anim?.fps ?? 6;
  const currentFrame = frames[selectedFrame] ?? frames[0];

  // Clamp selected frame when switching anims or deleting frames
  useEffect(() => {
    setSelectedFrame((f) => Math.min(f, Math.max(0, frames.length - 1)));
  }, [selectedAnim, frames.length]);

  // ── Animation preview loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || frames.length === 0) return;
    let running = true;
    let last = performance.now();

    const tick = (now: number) => {
      if (!running) return;
      const dt = (now - last) / 1000;
      last = now;
      previewTimeRef.current += dt;
      const fDur = 1 / Math.max(1, fps);
      const fi = Math.floor(previewTimeRef.current / fDur) % frames.length;
      renderFrameToCanvas(canvas, frames[fi].pixels, PREVIEW_SIZE);
      previewRafRef.current = requestAnimationFrame(tick);
    };
    previewRafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(previewRafRef.current);
    };
  }, [frames, fps]);

  // ── Draw handlers (must be before any early returns — Rules of Hooks) ───────
  const handleDraw = useCallback(
    (index: number, drawColor: string) => {
      if (!currentFrame) return;
      if (currentFrame.pixels[index] === drawColor) return;
      pushUndo();
      updateCharacterFrame(selectedAnim, selectedFrame, index, drawColor);
    },
    [currentFrame, selectedAnim, selectedFrame, updateCharacterFrame, pushUndo]
  );

  const handleFill = useCallback(
    (index: number, fillColor: string) => {
      pushUndo();
      fillCharacterFrame(selectedAnim, selectedFrame, index, fillColor);
    },
    [selectedAnim, selectedFrame, fillCharacterFrame, pushUndo]
  );

  const handleEyedropper = useCallback(
    (picked: string) => {
      setColor(picked);
      setSelectedColor(picked);
      setTool('pen');
      setDrawTool('pen');
    },
    [setSelectedColor, setDrawTool]
  );

  // ── Ensure character exists ─────────────────────────────────────────────────
  if (!project) return null;

  if (!character) {
    return (
      <div className={styles.editor}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧍</div>
          <p className={styles.emptyTitle}>Ingen egen karaktär</p>
          <p className={styles.emptyDesc}>
            Rita din egen spelfigur med animationer.<br />
            Den ersätter automatiskt standardfiguren när du spelar.
          </p>
          <button className={styles.createBtn} onClick={initPlayerCharacter}>
            ✏️ Skapa karaktär
          </button>
        </div>
      </div>
    );
  }

  const handleReset = () => {
    if (!confirm('Återgå till standardfiguren (blå ruta)? Din ritade karaktär tas bort.')) return;
    clearPlayerCharacter();
  };

  const handleToolChange = (t: DrawTool) => {
    setTool(t);
    setDrawTool(t);
  };

  const handleColorChange = (c: string) => {
    setColor(c);
    setSelectedColor(c);
    if (tool === 'eraser') {
      setTool('pen');
      setDrawTool('pen');
    }
  };

  const handleClearFrame = () => {
    if (!currentFrame) return;
    if (!confirm('Rensa ramen?')) return;
    pushUndo();
    for (let i = 0; i < ART_SIZE * ART_SIZE; i++) {
      updateCharacterFrame(selectedAnim, selectedFrame, i, '');
    }
  };

  const handleAddFrame = () => {
    addAnimationFrame(selectedAnim);
    setSelectedFrame(frames.length); // select the new frame
  };

  const handleDeleteFrame = (fi: number) => {
    if (frames.length <= 1) return;
    deleteAnimationFrame(selectedAnim, fi);
    setSelectedFrame(Math.min(fi, frames.length - 2));
  };

  const handleDuplicate = (fi: number) => {
    duplicateAnimationFrame(selectedAnim, fi);
    setSelectedFrame(fi + 1);
  };

  const handleFlip = () => {
    pushUndo();
    flipCharacterFrame(selectedAnim, selectedFrame);
  };

  const handleCopyTo = (toAnim: AnimationName) => {
    copyFrameToAnimation(selectedAnim, selectedFrame, toAnim);
    setCopyMenuFrame(null);
  };

  return (
    <div className={styles.editorWrapper}>
      {/* ── Status banner ── */}
      <div className={styles.statusBar}>
        <span className={styles.statusActive}>✅ Din karaktär är aktiv</span>
        <span className={styles.statusHint}>
          Allt du ritar här används direkt som spelfigur — tryck på{' '}
          <strong>▶ Spela</strong> för att testa.
        </span>
        <button className={styles.resetBtn} onClick={handleReset}>
          Återgå till standard
        </button>
      </div>

      <div className={styles.editor}>
      {/* ── Left panel: anims + frame strip ── */}
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Animationer</span>
        </div>
        <div className={styles.animList}>
          {ANIMS.map((a) => (
            <button
              key={a.id}
              className={[
                styles.animBtn,
                selectedAnim === a.id ? styles.animBtnActive : '',
              ].join(' ')}
              onClick={() => setSelectedAnim(a.id)}
            >
              <span>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        {/* FPS */}
        <div className={styles.fpsRow}>
          <span className={styles.fpsLabel}>Hastighet: {fps} fps</span>
          <input
            type="range"
            min={1}
            max={24}
            value={fps}
            className={styles.fpsSlider}
            onChange={(e) => setAnimationFps(selectedAnim, Number(e.target.value))}
          />
        </div>

        <div className={styles.divider} />

        {/* Frame strip */}
        <div className={styles.frameStripHeader}>
          <span className={styles.panelTitle}>Ramar</span>
          <button
            className={styles.addFrameBtn}
            onClick={handleAddFrame}
            disabled={frames.length >= 8}
            title="Lägg till ram"
          >
            +
          </button>
        </div>
        <div className={styles.frameStrip}>
          {frames.map((frame, fi) => (
            <FrameThumb
              key={frame.id}
              pixels={frame.pixels}
              index={fi}
              selected={fi === selectedFrame}
              showCopyMenu={copyMenuFrame === fi}
              currentAnim={selectedAnim}
              onSelect={() => setSelectedFrame(fi)}
              onDelete={() => handleDeleteFrame(fi)}
              onDuplicate={() => handleDuplicate(fi)}
              onToggleCopyMenu={() => setCopyMenuFrame(copyMenuFrame === fi ? null : fi)}
              onCopyTo={handleCopyTo}
              canDelete={frames.length > 1}
            />
          ))}
        </div>

        <div className={styles.divider} />

        {/* Preview */}
        <div className={styles.previewSection}>
          <span className={styles.panelTitle}>Förhandsvisning</span>
          <canvas
            ref={previewRef}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            className={styles.previewCanvas}
          />
        </div>
      </div>

      {/* ── Center: pixel canvas ── */}
      <div className={styles.canvasArea}>
        <div className={styles.canvasHeader}>
          <span className={styles.animLabel}>
            {ANIMS.find((a) => a.id === selectedAnim)?.icon}{' '}
            {ANIMS.find((a) => a.id === selectedAnim)?.label} — Ram {selectedFrame + 1}/{frames.length}
          </span>
          <div className={styles.canvasHeaderActions}>
            <button className={styles.actionBtn} onClick={handleFlip} title="Spegelvänd ramen horisontellt">
              ↔ Spegla
            </button>
            <button className={styles.clearBtn} onClick={handleClearFrame}>
              🗑 Rensa
            </button>
          </div>
        </div>
        <div className={styles.canvasWrap}>
          {currentFrame ? (
            <PixelCanvas
              pixels={currentFrame.pixels}
              tool={tool}
              selectedColor={color}
              onDraw={handleDraw}
              onFill={handleFill}
              onEyedropper={handleEyedropper}
            />
          ) : (
            <div className={styles.noFrame}>Välj en ram</div>
          )}
        </div>
      </div>

      {/* ── Right panel: tools + palette ── */}
      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Verktyg</span>
        </div>
        <div className={styles.toolGrid}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={[styles.toolBtn, tool === t.id ? styles.toolBtnActive : ''].join(' ')}
              title={t.label}
              onClick={() => handleToolChange(t.id)}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Aktiv färg</span>
        </div>
        <div className={styles.activeColorRow}>
          <div className={styles.activeColorSwatch} style={{ background: color }} />
          <input
            type="color"
            value={color}
            className={styles.colorInput}
            onChange={(e) => handleColorChange(e.target.value)}
          />
        </div>

        <div className={styles.divider} />

        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Palett</span>
        </div>
        <div className={styles.paletteGrid}>
          {ART_EXTRA_COLORS.map((c) => (
            <button
              key={c}
              className={[
                styles.paletteSwatch,
                color === c ? styles.paletteSwatchActive : '',
              ].join(' ')}
              style={{ background: c }}
              onClick={() => handleColorChange(c)}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
    </div>
  );
};

// ── Frame thumbnail ────────────────────────────────────────────────────────────
interface FrameThumbProps {
  pixels: string[];
  index: number;
  selected: boolean;
  canDelete: boolean;
  showCopyMenu: boolean;
  currentAnim: AnimationName;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleCopyMenu: () => void;
  onCopyTo: (anim: AnimationName) => void;
}

const FrameThumb: React.FC<FrameThumbProps> = ({
  pixels, index, selected, canDelete,
  showCopyMenu, currentAnim,
  onSelect, onDelete, onDuplicate, onToggleCopyMenu, onCopyTo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderFrameToCanvas(canvas, pixels, THUMB_SIZE);
  }, [pixels]);

  const otherAnims = ANIMS.filter((a) => a.id !== currentAnim);

  return (
    <div className={[styles.frameThumb, selected ? styles.frameThumbSelected : ''].join(' ')}>
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className={styles.thumbCanvas}
        onClick={onSelect}
        title={`Ram ${index + 1}`}
      />
      <div className={styles.thumbActions}>
        <button className={styles.thumbBtn} onClick={onDuplicate} title="Duplicera inom denna animation">⧉</button>
        <div className={styles.copyMenuWrap}>
          <button className={styles.thumbBtn} onClick={onToggleCopyMenu} title="Kopiera ram till annan animation">⇒</button>
          {showCopyMenu && (
            <div className={styles.copyMenu}>
              <span className={styles.copyMenuLabel}>Kopiera till:</span>
              {otherAnims.map((a) => (
                <button key={a.id} className={styles.copyMenuItem} onClick={() => onCopyTo(a.id)}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {canDelete && (
          <button className={styles.thumbBtn} onClick={onDelete} title="Ta bort">✕</button>
        )}
      </div>
    </div>
  );
};
