import React from 'react';
import { useStore } from '../../store/useStore';
import type { AppMode } from '../../models/types';
import { exportGameAsHTML } from '../../export/exportService';
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

export const Nav: React.FC = () => {
  const { project, ui, setMode, saveCurrentProject, undo, redo, undoStack, redoStack } = useStore();

  const handleSave = () => {
    saveCurrentProject();
  };

  const handleExport = () => {
    if (!project) return;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '-')}.bloxels.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        Train<span>Cells</span>
      </div>

      {/* Hem — standalone */}
      <button
        className={[styles.tab, ui.mode === 'home' ? styles.active : ''].join(' ')}
        onClick={() => setMode('home')}
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
          return (
            <button
              key={step.id}
              className={[
                styles.stepTab,
                isActive ? styles.stepActive : '',
                locked ? styles.disabled : '',
              ].join(' ')}
              onClick={() => !locked && setMode(step.id)}
              title={step.tooltip}
            >
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
