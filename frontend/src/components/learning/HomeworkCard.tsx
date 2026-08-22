import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SUBJECT_ICONS, SUBJECT_LABELS, type Homework } from '@/types';
import { formatDate } from '@/lib/format';
import styles from './HomeworkCard.module.css';

interface HomeworkCardProps {
  homework: Homework;
  onAction?: () => void;
  actionLabel?: string;
}

const statusMap = {
  new: { label: 'Нове', tone: 'primary' as const },
  done: { label: 'Виконано', tone: 'success' as const },
  checking: { label: 'Перевіряється', tone: 'warning' as const },
  reviewed: { label: 'Прийнято', tone: 'secondary' as const },
  revise: { label: 'Доробити', tone: 'warning' as const },
};

export function HomeworkCard({
  homework,
  onAction,
  actionLabel = 'Виконати',
}: HomeworkCardProps) {
  const status = statusMap[homework.status ?? 'new'];

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <div className={styles.subject}>
          <span aria-hidden="true">{SUBJECT_ICONS[homework.subject]}</span>
          <span>{SUBJECT_LABELS[homework.subject]}</span>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <h3 className={styles.title}>{homework.title}</h3>
      <p className={styles.description}>{homework.description}</p>

      {homework.teacherComment ? (
        <p className={styles.comment}>
          Коментар учителя: {homework.teacherComment}
        </p>
      ) : null}

      <div className={styles.meta}>
        <span>{formatDate(homework.dueDate)}</span>
        <span className={styles.xp}>+{homework.xpReward} XP</span>
      </div>

      {onAction &&
      (homework.status === 'new' ||
        homework.status === 'revise' ||
        !homework.status) ? (
        <Button onClick={onAction} fullWidth>
          {homework.status === 'revise' ? 'Доробити' : actionLabel}
        </Button>
      ) : null}
    </article>
  );
}
