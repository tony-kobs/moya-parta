import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Quest } from '@/types';
import styles from './QuestCard.module.css';

interface QuestCardProps {
  quest: Quest;
  onContinue?: () => void;
}

export function QuestCard({ quest, onContinue }: QuestCardProps) {
  const step = quest.currentStep ?? 0;

  return (
    <article className={styles.card}>
      <div className={styles.illustration} aria-hidden="true">
        {quest.illustration}
      </div>
      <div className={styles.content}>
        <h3>{quest.title}</h3>
        <p>{quest.description}</p>
        <ProgressBar
          value={step}
          max={quest.totalSteps}
          label={`Крок ${step} із ${quest.totalSteps}`}
          tone="secondary"
        />
        <div className={styles.footer}>
          <span className={styles.xp}>+{quest.xpReward} XP</span>
          {onContinue && !quest.completed ? (
            <Button size="md" onClick={onContinue}>
              {step === 0 ? 'Почати' : 'Продовжити'}
            </Button>
          ) : null}
          {quest.completed ? <span className={styles.done}>Завершено</span> : null}
        </div>
      </div>
    </article>
  );
}
