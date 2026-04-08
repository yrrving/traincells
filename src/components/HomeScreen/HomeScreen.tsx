import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { BLOCK_TYPES } from '../../data/blockTypes';
import styles from './HomeScreen.module.css';

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: '🧍',
    title: 'Karaktär',
    desc: 'Rita din egen spelfigur pixel för pixel. Skapa animationer för stillastående, gång, hopp, fall och skada. Din figur används automatiskt när du spelar.',
  },
  {
    step: 2,
    icon: '🎨',
    title: 'Brickor',
    desc: 'Rita grafik för dina spelblock. Varje blocktyp har en roll: mark att stå på, plattformar, fiender, collectibles, vatten och mer. Dessa brickor bygger upp dina banor.',
  },
  {
    step: 3,
    icon: '🗺️',
    title: 'Bana',
    desc: 'Bygg din spelvärd rum för rum. Placera ut brickor på ett rutnät och koppla ihop rummen med varandra. Spelaren kan röra sig mellan rum via pilar.',
  },
  {
    step: 4,
    icon: '▶️',
    title: 'Spela',
    desc: 'Testa ditt spel direkt i webbläsaren! Spring, hoppa och utforska det du byggt. Klicka på "Exportera spel" för att ladda ner en HTML-fil — den fungerar offline och går att spela på telefon och surfplatta.',
  },
];

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
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHelp(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp]);

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
        <h1 className={styles.heroTitle}>TrainCells</h1>
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
        <button className={styles.helpBtn} onClick={() => setShowHelp(true)}>
          ❓ Så funkar det
        </button>
      </div>

      {showHelp && (
        <div className={styles.modalBackdrop} onClick={() => setShowHelp(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Så funkar TrainCells</h2>
              <button className={styles.modalClose} onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <p className={styles.modalIntro}>
              Skapa ett komplett spel i fyra steg — ingen kodkunskap behövs.
            </p>
            <div className={styles.stepList}>
              {HOW_IT_WORKS.map((s) => (
                <div key={s.step} className={styles.stepCard}>
                  <div className={styles.stepBadge}>{s.step}</div>
                  <div className={styles.stepIcon}>{s.icon}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepTitle}>{s.title}</div>
                    <div className={styles.stepDesc}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalTip}>
              💡 Tips: Använd "💾 Projekt" för att spara och fortsätta jobba med ditt spel. Använd "📦 Exportera spel" för att få en HTML-fil du kan dela med vänner — den funkar direkt i webbläsaren utan installation.
            </div>
          </div>
        </div>
      )}

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
