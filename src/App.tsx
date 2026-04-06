import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Nav } from './components/Nav/Nav';
import { HomeScreen } from './components/HomeScreen/HomeScreen';
import { ArtBoard } from './components/ArtBoard/ArtBoard';
import { WorldMap } from './components/WorldMap/WorldMap';
import { GamePlayer } from './components/GamePlayer/GamePlayer';
import { exportGameAsHTML } from './export/exportService';
import styles from './App.module.css';

export const App: React.FC = () => {
  const { ui, project, saveCurrentProject } = useStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      // Ctrl+S = save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentProject();
      }
      // Ctrl+E = export game
      if ((e.ctrlKey || e.metaKey) && e.key === 'e' && project) {
        e.preventDefault();
        exportGameAsHTML(project);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project, saveCurrentProject]);

  return (
    <div className={styles.app}>
      <Nav />
      <main className={styles.main}>
        {ui.mode === 'home' && <HomeScreen />}
        {ui.mode === 'artboard' && <ArtBoard />}
        {ui.mode === 'worldmap' && <WorldMap />}
        {ui.mode === 'gametest' && <GamePlayer />}
      </main>
    </div>
  );
};
