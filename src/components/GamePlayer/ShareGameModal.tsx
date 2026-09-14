import React, { useEffect } from 'react';
import type { Project } from '../../models/types';
import { exportGameAsHTML, exportProjectJSON } from '../../export/exportService';
import styles from './ShareGameModal.module.css';

// "Redo att visa upp ditt spel?" — the next-step prompt for a besökare who
// built a game the free way (Blank Canvas / Handlett läge) and now
// considers it done. Two real paths, both starting from a file on their own
// device (there's no API integration with learn.trainstation.se — it's
// Trainstation's own separate platform, so this is a guided hand-off, not
// an automated upload):
//   1. Keep the file on this device (to reopen later, or send to a friend).
//   2. Take that same file to learn.trainstation.se and add it to their
//      portfolio there, so it's visible to others.
// Reachable from GamePlayer's toolbar — available whenever a game exists,
// never forced, so the besökare opens it whenever THEY feel done.
const LEARN_PORTFOLIO_URL = 'https://learn.trainstation.se';

interface ShareGameModalProps {
  project: Project;
  onClose: () => void;
}

export const ShareGameModal: React.FC<ShareGameModalProps> = ({ project, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openPortfolio = () => {
    window.open(LEARN_PORTFOLIO_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>🚀 Redo att visa upp ditt spel?</h2>
          <button className={styles.close} onClick={onClose} aria-label="Stäng" title="Stäng">✕</button>
        </div>
        <p className={styles.intro}>
          Bra jobbat! Så här kan du gå vidare med <strong>{project.name}</strong>.
        </p>

        <div className={styles.optionCard}>
          <div className={styles.optionHeader}>
            <span className={styles.optionIcon}>💾</span>
            <span className={styles.optionTitle}>Spara på din enhet</span>
          </div>
          <p className={styles.optionDesc}>
            Ladda ner en fil till din dator eller platta. Perfekt om du vill fortsätta bygga
            senare, eller skicka spelet till en kompis.
          </p>
          <div className={styles.optionActions}>
            <button className={styles.actionBtn} onClick={() => exportGameAsHTML(project)}>
              📦 Ladda ner spelbar fil
            </button>
            <button className={styles.actionBtnSecondary} onClick={() => exportProjectJSON(project)}>
              💾 Ladda ner projektfil
            </button>
          </div>
          <p className={styles.optionHint}>
            Projektfilen (.bloxels.json) går att öppna igen här i TrainCells för att fortsätta
            redigera — den spelbara filen (.html) funkar direkt i valfri webbläsare.
          </p>
        </div>

        <div className={styles.optionCard}>
          <div className={styles.optionHeader}>
            <span className={styles.optionIcon}>🌐</span>
            <span className={styles.optionTitle}>Lägg i din portfolio på learn.trainstation.se</span>
          </div>
          <p className={styles.optionDesc}>
            Vill du att andra ska kunna se och spela ditt spel? Ladda upp det i din portfolio på
            Trainstations lärplattform.
          </p>
          <ol className={styles.stepList}>
            <li>Ladda ner den spelbara filen (📦 ovan) till din enhet.</li>
            <li>Gå till <strong>learn.trainstation.se</strong> och logga in på ditt konto.</li>
            <li>Ladda upp filen i din portfolio.</li>
          </ol>
          <div className={styles.optionActions}>
            <button className={styles.actionBtn} onClick={openPortfolio}>
              🌐 Öppna learn.trainstation.se
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
