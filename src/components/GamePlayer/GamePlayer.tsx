import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  initGameState,
  updateGame,
  renderGame,
  buildTileCache,
  buildCharacterCache,
  TILE_SIZE,
} from '../../runtime/engine';
import type { GameState, InputState } from '../../runtime/engine';
import { ROOM_SIZE } from '../../models/types';
import styles from './GamePlayer.module.css';

const ROOM_PX = ROOM_SIZE * TILE_SIZE; // 624

export const GamePlayer: React.FC = () => {
  const { project, setMoveSpeed } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
  });
  const tileCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  const charCacheRef = useRef<Record<string, HTMLCanvasElement>>({});
  const rafRef = useRef<number>(0);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'dead'>('playing');

  // Touch button states for visual feedback
  const [touchLeft, setTouchLeft] = useState(false);
  const [touchRight, setTouchRight] = useState(false);
  const [touchJump, setTouchJump] = useState(false);

  const restart = useCallback(() => {
    if (!project) return;
    gameStateRef.current = initGameState(project);
    setGameStatus('playing');
  }, [project]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  const loop = useCallback(function frame() {
    if (!project || !gameStateRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update
    const input = { ...inputRef.current };
    gameStateRef.current = updateGame(gameStateRef.current, input, project);
    // jumpPressed is a one-shot flag - clear it after the update
    inputRef.current.jumpPressed = false;

    // Render
    renderGame(
      gameStateRef.current,
      project,
      ctx,
      tileCacheRef.current,
      charCacheRef.current,
      canvas.width,
      canvas.height
    );

    if (gameStateRef.current.status !== gameStatus) {
      setGameStatus(gameStateRef.current.status);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [project, gameStatus]);

  // ── Start / stop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project) return;

    // Build tile + character cache
    tileCacheRef.current = buildTileCache(project.tileArts, TILE_SIZE);
    charCacheRef.current = project.playerCharacter
      ? buildCharacterCache(project.playerCharacter, TILE_SIZE)
      : {};

    // Init game
    gameStateRef.current = initGameState(project);
    setGameStatus('playing');
  }, [project]); // Re-init when project changes; the loop effect below starts rendering

  // Restart loop after project rerender (keeps loop alive if already running)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── Keyboard input ────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) inputRef.current.left = true;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) inputRef.current.right = true;
      if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) {
        if (!inputRef.current.jumpHeld) inputRef.current.jumpPressed = true;
        inputRef.current.jumpHeld = true;
        e.preventDefault();
      }
      if (e.key === 'r' || e.key === 'R') restart();
    };
    const up = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) inputRef.current.left = false;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) inputRef.current.right = false;
      if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) inputRef.current.jumpHeld = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [restart]);

  // ── Touch handlers (prevent default to avoid scroll) ─────────────────────
  const onTouchLeft = useCallback((pressed: boolean) => {
    inputRef.current.left = pressed;
    setTouchLeft(pressed);
  }, []);

  const onTouchRight = useCallback((pressed: boolean) => {
    inputRef.current.right = pressed;
    setTouchRight(pressed);
  }, []);

  const onTouchJump = useCallback((pressed: boolean) => {
    if (pressed && !inputRef.current.jumpHeld) {
      inputRef.current.jumpPressed = true;
    }
    inputRef.current.jumpHeld = pressed;
    setTouchJump(pressed);
  }, []);

  if (!project || !project.worldMap.startRoomId) {
    return (
      <div className={styles.container}>
        <div className={styles.noProject}>
          <div className={styles.noProjectIcon}>🎮</div>
          <div>
            Skapa brickor och bygg en bana först!
            <br />
            Glöm inte att markera ett startrum.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.restartBtn} onClick={restart} title="Starta om (R)">
          🔄 Starta om
        </button>
        <div className={styles.speedBtns}>
          <span className={styles.speedLabel}>Hastighet:</span>
          {([0.6, 1.0, 1.5] as const).map((s) => (
            <button
              key={s}
              className={`${styles.speedBtn} ${(project.moveSpeed ?? 1.0) === s ? styles.speedActive : ''}`}
              onClick={() => setMoveSpeed(s)}
            >
              {s === 0.6 ? '🐢' : s === 1.0 ? '▶' : '⚡'}
            </button>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={styles.gameCanvas}
        width={ROOM_PX}
        height={ROOM_PX}
      />

      {/* Touch controls — shown on touch devices via CSS media query */}
      <div className={styles.touchControls}>
        <div className={styles.dpad}>
          <TouchButton
            icon="◀"
            pressed={touchLeft}
            className={styles.touchBtn}
            onPress={() => onTouchLeft(true)}
            onRelease={() => onTouchLeft(false)}
          />
          <TouchButton
            icon="▶"
            pressed={touchRight}
            className={styles.touchBtn}
            onPress={() => onTouchRight(true)}
            onRelease={() => onTouchRight(false)}
          />
        </div>
        <TouchButton
          icon="▲"
          pressed={touchJump}
          className={`${styles.touchBtn} ${styles.jumpBtn}`}
          onPress={() => onTouchJump(true)}
          onRelease={() => onTouchJump(false)}
        />
      </div>

      <div className={styles.hint}>
        Tangentbord: ← → hoppa med Mellanslag / W / ↑ &nbsp;|&nbsp; R = starta om
      </div>
    </div>
  );
};

// ── Reusable touch button ─────────────────────────────────────────────────────
interface TouchButtonProps {
  icon: string;
  pressed: boolean;
  className: string;
  onPress: () => void;
  onRelease: () => void;
}

const TouchButton: React.FC<TouchButtonProps> = ({
  icon,
  pressed,
  className,
  onPress,
  onRelease,
}) => {
  return (
    <button
      className={`${className} ${pressed ? styles.pressed : ''}`}
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      onPointerUp={(e) => { e.preventDefault(); onRelease(); }}
      onPointerLeave={(e) => { e.preventDefault(); onRelease(); }}
    >
      {icon}
    </button>
  );
};
