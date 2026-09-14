import React from 'react';
import { useStore, goHomeWithSavePrompt } from '../../store/useStore';
import type { AppMode } from '../../models/types';
import { exportGameAsHTML, exportProjectJSON } from '../../export/exportService';
import styles from './Nav.module.css';

interface StepDef {
  id: AppMode;
  label: string;
  icon: string;
  step: number;
  tooltip: string;
}

const STEPS: StepDef[] = [
  { id: 'character', label: 'Karaktär', icon: '🧍', step: 1, tooltip: 'Rita din spelfigur med animationer' },
  { id: 'artboard',  label: 'Brickor',  icon: '🎨', step: 2, tooltip: 'Skapa mark, fiender, föremål m.m.' },
  { id: 'worldmap',  label: 'Bana',     icon: '🗺️', step: 3, tooltip: 'Bygg din bana av rum och brickor' },
  { id: 'gametest',  label: 'Spela',    icon: '▶️', step: 4, tooltip: 'Testa och spela ditt spel' },
];

// Maps each "return-to-game*" hint to the onboarding stage it completes —
// see models/types.ts UIState.onboardingStage for what each number unlocks.
const RETURN_HINT_STAGE: Record<string, 0 | 1 | 2 | 3> = {
  'return-to-game': 1,
  'return-to-game-2': 2,
  'return-to-game-3': 3,
};

export const Nav: React.FC = () => {
  const { project, ui, setMode, setOnboardingHint, setOnboardingStage, setSuperFlow, saveCurrentProject, undo, redo, undoStack, redoStack } = useStore();

  const handleSave = () => {
    saveCurrentProject();
  };

  const handleExport = () => {
    if (!project) return;
    exportProjectJSON(project);
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        Train<span>Cells</span>
      </div>

      {/* Hem — standalone */}
      <button
        className={[styles.tab, ui.mode === 'home' ? styles.active : ''].join(' ')}
        onClick={goHomeWithSavePrompt}
        title="Startsida"
      >
        <span className={styles.tabIcon}>🏠</span>
        <span className={styles.tabLabel}>Hem</span>
      </button>

      {/* Separator + steg */}
      <div className={styles.stepsSeparator}>
        <span className={styles.stepsSeparatorLine} />
        <span className={styles.stepsSeparatorLabel}>Skapa ditt spel</span>
        <span className={styles.stepsSeparatorLine} />
      </div>

      <div className={styles.steps}>
        {STEPS.map((step) => {
          const locked = !project;
          const isActive = ui.mode === step.id;
          // Final step of each guided "prova ändra något" mini-chapter (see
          // CharacterEditor / ArtBoard / WorldMap): once the besökare has
          // made their change, point at the real "Spela" tab instead of a
          // separate, temporary button — same tab they'll use every time
          // afterwards to test anything they change.
          const completedStage = RETURN_HINT_STAGE[ui.onboardingHint ?? ''];
          const superDone = ui.superFlow?.step === 'done';
          const isPointerTarget = step.id === 'gametest' && (completedStage !== undefined || superDone);
          // Super handlett läge is deliberately linear (see UIState.superFlow
          // in models/types.ts) — grey out every other step tab while a step
          // is active so there's only ever one place that looks pressable.
          // The tab for whatever screen the step is actually happening on
          // stays normal (isActive), and "Spela" lights up instead once the
          // flow reaches 'done'.
          const superLocked = !!ui.superFlow && !isActive && !isPointerTarget;
          return (
            <button
              key={step.id}
              className={[
                styles.stepTab,
                isActive ? styles.stepActive : '',
                (locked || superLocked) ? styles.disabled : '',
                isPointerTarget ? styles.stepTabHighlight : '',
              ].join(' ')}
              onClick={() => {
                if (locked || superLocked) return;
                setMode(step.id);
                if (completedStage !== undefined) {
                  setOnboardingHint(null);
                  setOnboardingStage(completedStage);
                }
                if (superDone) setSuperFlow(null);
              }}
              title={step.tooltip}
            >
              {isPointerTarget && (
                <div className={styles.stepPointerArrow}>
                  <span>Testa här!</span>
                  <span className={styles.stepPointerArrowIcon}>⬆️</span>
                </div>
              )}
              <span className={[styles.stepNum, isActive ? styles.stepNumActive : ''].join(' ')}>
                {step.step}
              </span>
              <span className={styles.tabIcon}>{step.icon}</span>
              <span className={styles.tabLabel}>{step.label}</span>
            </button>
          );
        })}
      </div>

      {project && (
        <div className={styles.actions}>
          <button
            className={styles.btn}
            onClick={undo}
            disabled={undoStack.length === 0}
            title="Ångra (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            className={styles.btn}
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Gör om (Ctrl+Y)"
          >
            ↪
          </button>
          <button className={styles.btn} onClick={handleExport} title="Exportera projekt-JSON">
            💾 Projekt
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => exportGameAsHTML(project!)}
            title="Exportera som spelbart webbspel (Ctrl+E)"
          >
            📦 Exportera spel
          </button>
          <button className={styles.btn} onClick={handleSave} title="Spara (Ctrl+S)">
            💾 Spara
          </button>
        </div>
      )}
    </nav>
  );
};
