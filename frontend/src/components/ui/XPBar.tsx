import styles from './XPBar.module.css';
import { ProgressBar } from './ProgressBar';

interface XPBarProps {
  level: number;
  xp: number;
  xpToNextLevel: number;
  inverted?: boolean;
}

export function XPBar({ level, xp, xpToNextLevel, inverted = false }: XPBarProps) {
  return (
    <div className={`${styles.wrap} ${inverted ? styles.inverted : ''}`}>
      <div className={styles.meta}>
        <span className={styles.level}>Рівень {level}</span>
        <span className={styles.xp}>
          {xp} / {xpToNextLevel} XP
        </span>
      </div>
      <ProgressBar
        value={xp}
        max={xpToNextLevel}
        tone="warm"
        onDark={inverted}
      />
    </div>
  );
}
