import React, { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { BLOCK_TYPES } from '../../data/blockTypes';
import styles from './HomeScreen.module.css';

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts));
}

export const HomeScreen: React.FC = () => {
  const { savedProjects, createProject, loadProjectById, deleteProject, importProjectFromJSON } =
    useStore();
  const [name, setName] = useState('Mitt spel');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const n = name.trim() || 'Mitt spel';
    createProject(n);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importProjectFromJSON(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className={styles.home}>
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>ClaudeBloxels</h1>
        <p className={styles.heroSub}>
          Bygg ditt eget spel! Rita brickor, bygg banor och testa ditt spel — allt utan kod.
        </p>
        <div className={styles.blocks}>
          {BLOCK_TYPES.map((bt) => (
            <div
              key={bt.id}
              className={styles.block}
              style={{ background: bt.color }}
              title={bt.name}
            />
          ))}
        </div>
      </div>

      <div className={styles.newProjectArea}>
        <div className={styles.newProjectCard}>
          <h2>🆕 Nytt projekt</h2>
          <div className={styles.inputRow}>
            <input
              className={styles.nameInput}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Namnge ditt spel..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              maxLength={40}
            />
            <button className={styles.createBtn} onClick={handleCreate}>
              Skapa ✨
            </button>
          </div>
          <button className={styles.importBtn} onClick={() => fileRef.current?.click()}>
            📂 Öppna befintligt projekt (.json)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>

      <div className={styles.savedSection}>
        <h2>Sparade spel</h2>
        {savedProjects.length === 0 ? (
          <div className={styles.empty}>
            Inga sparade spel ännu. Skapa ditt första projekt!
          </div>
        ) : (
          <div className={styles.savedList}>
            {savedProjects.map((sp) => (
              <div
                key={sp.id}
                className={styles.savedItem}
                onClick={() => loadProjectById(sp.id)}
              >
                <span className={styles.savedIcon}>🎮</span>
                <div className={styles.savedInfo}>
                  <div className={styles.savedName}>{sp.name}</div>
                  <div className={styles.savedDate}>{formatDate(sp.updatedAt)}</div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Ta bort "${sp.name}"?`)) deleteProject(sp.id);
                  }}
                  title="Ta bort"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
