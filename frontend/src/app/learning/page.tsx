'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/navigation/AppShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { HomeworkCard } from '@/components/learning/HomeworkCard';
import { QuestCard } from '@/components/quests/QuestCard';
import { studentApi } from '@/services/api';
import { SUBJECT_ICONS, SUBJECT_LABELS, type Subject } from '@/types';
import { useUiStore } from '@/store/uiStore';
import styles from './learning.module.css';

export default function LearningPage() {
  return (
    <AppShell title="Моє навчання" allowedRoles={['student']}>
      <LearningContent />
    </AppShell>
  );
}

function LearningContent() {
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['learning'],
    queryFn: studentApi.getLearning,
  });

  const questMutation = useMutation({
    mutationFn: (id: string) => studentApi.advanceQuest(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['learning'] });
      void queryClient.invalidateQueries({ queryKey: ['desk'] });
      showToast(result.message);
    },
  });

  if (isLoading) {
    return <LoadingState label="Готуємо навчання..." />;
  }

  if (isError || !data) {
    return <EmptyState title="Щось пішло не так" description="Спробуй ще раз." />;
  }

  const today = data.homework.filter((item) => item.bucket === 'today');
  const waiting = data.homework.filter((item) => item.bucket === 'waiting');
  const later = data.homework.filter((item) => item.bucket === 'later');

  return (
    <div className={styles.page}>
      <section>
        <h2>Сьогоднішні завдання</h2>
        <div className={styles.grid}>
          {today.length === 0 ? (
            <EmptyState
              title="Сьогодні все спокійно 🌿"
              description="Нових завдань поки немає."
            />
          ) : (
            today.map((homework) => (
              <HomeworkCard
                key={homework.id}
                homework={homework}
                onAction={() => {
                  window.location.href = `/learning/homework/${homework.id}`;
                }}
              />
            ))
          )}
        </div>
      </section>

      {waiting.length > 0 ? (
        <section>
          <h2>Це завдання ще чекає на тебе</h2>
          <div className={styles.grid}>
            {waiting.map((homework) => (
              <HomeworkCard
                key={homework.id}
                homework={homework}
                onAction={() => {
                  window.location.href = `/learning/homework/${homework.id}`;
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2>Майбутні завдання</h2>
        <div className={styles.grid}>
          {later.length === 0 ? (
            <EmptyState title="Поки тихо" description="Нових завдань попереду немає." />
          ) : (
            later.map((homework) => (
              <HomeworkCard
                key={homework.id}
                homework={homework}
                onAction={() => {
                  window.location.href = `/learning/homework/${homework.id}`;
                }}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2>Тести</h2>
        <div className={styles.grid}>
          {data.quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <div className={styles.quizHead}>
                <span aria-hidden="true">
                  {SUBJECT_ICONS[quiz.subject as Subject] ?? '📘'}
                </span>
                <div>
                  <h3>{quiz.title}</h3>
                  <p>
                    {SUBJECT_LABELS[quiz.subject as Subject] ?? 'Предмет'} · +
                    {quiz.xpReward} XP
                  </p>
                </div>
              </div>
              <Link href={`/learning/quiz/${quiz.id}`}>
                <Button fullWidth>Почати</Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2>Квести</h2>
        <div className={styles.stack}>
          {data.quests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onContinue={() => questMutation.mutate(quest.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Що я пропустив?</h2>
        <div className={styles.grid}>
          {data.materials
            .filter((item) => item.missedLesson)
            .map((material) => (
              <Card key={material.id}>
                <h3>{material.title}</h3>
                <p>{material.summary}</p>
                <ol className={styles.missedList}>
                  <li>Що проходили</li>
                  <li>Коротке пояснення</li>
                  <li>Матеріали</li>
                  <li>Міні-тест</li>
                  <li>Домашнє завдання</li>
                </ol>
                <p className={styles.placeholder}>
                  Відеоурок зʼявиться пізніше. Поки можна повторити коротко.
                </p>
              </Card>
            ))}
        </div>
      </section>
    </div>
  );
}
