import React from 'react';
import { useStore } from '../../store/useStore';
import type { AppMode } from '../../models/types';
import { exportGameAsHTML } from '../../export/exportService';
import styles from './Nav.module.css';

interface TabDef {
  id: AppMode;
  label: string;
  icon: string;
  requiresProject: boolean;
}

const TABS: TabDef[] = [
  { id: 'home', label: 'Hem', icon: '🏠', requiresProject: false },
  { id: 'artboard', label: 'Rita', icon: '🎨', requiresProject: true },
  { id: 'worldmap', label: 'Karta', icon: '🗺️', requiresProject: true },
  { id: 'gametest', label: 'Spela', icon: '▶️', requiresProject: true },
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
        Claude<span>Bloxels</span>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={[
              styles.tab,
              ui.mode === tab.id ? styles.active : '',
              tab.requiresProject && !project ? styles.disabled : '',
            ].join(' ')}
            onClick={() => (!tab.requiresProject || project) && setMode(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
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
          {ui.mode !== 'gametest' && (
            <button
              className={`${styles.btn} ${styles.btnPlay}`}
              onClick={() => setMode('gametest')}
            >
              ▶ Spela
            </button>
          )}
        </div>
      )}
    </nav>
  );
};
