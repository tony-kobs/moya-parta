import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  tone?: 'primary' | 'secondary' | 'warm';
}

export function ProgressBar({
  value,
  max,
  label,
  tone = 'primary',
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));

  return (
    <div className={styles.wrap}>
      {label ? <div className={styles.label}>{label}</div> : null}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Прогрес'}
      >
        <div
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
