'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/navigation/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { teacherApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { formatEventRange } from '@/lib/format';
import styles from './teacher.module.css';

const classSchema = z.object({
  name: z.string().min(1, 'Напиши назву класу'),
});

type ClassForm = z.infer<typeof classSchema>;

export default function TeacherPage() {
  return (
    <AppShell title="Сьогодні" allowedRoles={['teacher']}>
      <TeacherDashboard />
    </AppShell>
  );
}

function TeacherDashboard() {
  const showToast = useUiStore((state) => state.showToast);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: teacherApi.getDashboard,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: '3-Б' },
  });

  const createClassMutation = useMutation({
    mutationFn: (values: ClassForm) => teacherApi.createClass(values),
    onSuccess: async (classRoom) => {
      await refreshUser();
      void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      showToast(`Клас ${classRoom.name} створено! Код: ${classRoom.inviteCode}`);
    },
    onError: (err) => {
      showToast(
        err instanceof Error ? err.message : 'Не вдалося створити клас',
        'error',
      );
    },
  });

  if (isLoading) {
    return <LoadingState label="Готуємо кабінет..." />;
  }

  if (!data) {
    return <EmptyState title="Щось пішло не так" description="Спробуй ще раз." />;
  }

  if (!data.hasClass) {
    return (
      <Card className={styles.hero}>
        <div>
          <p className={styles.kicker}>Перший крок</p>
          <h1>Створи свій клас</h1>
          <p>Після цього зʼявиться код і посилання для учнів.</p>
        </div>
        <form
          className={styles.createForm}
          onSubmit={handleSubmit((values) => createClassMutation.mutate(values))}
        >
          <label>
            Назва класу
            <input placeholder="3-Б" {...register('name')} />
          </label>
          {errors.name ? <em>{errors.name.message}</em> : null}
          <Button type="submit" disabled={createClassMutation.isPending}>
            Створити клас
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <Card className={styles.hero}>
        <div>
          <p className={styles.kicker}>Клас {data.className}</p>
          <h1>Доброго ранку, {data.greetingName}!</h1>
        </div>
        <div className={styles.actions}>
          <Link href="/teacher/invite">
            <Button variant="secondary">Код для учнів</Button>
          </Link>
          <Link href="/teacher/tasks">
            <Button>Створити завдання</Button>
          </Link>
          <Link href="/teacher/events">
            <Button variant="secondary">Події класу</Button>
          </Link>
        </div>
      </Card>

      <div className={styles.stats}>
        <Card>
          <strong>{data.today.newWorks}</strong>
          <span>нові роботи</span>
        </Card>
        <Card>
          <strong>{data.today.doneTasks}</strong>
          <span>виконаних сьогодні</span>
        </Card>
        <Card>
          <strong>{data.today.activeQuest}</strong>
          <span>активний квест</span>
        </Card>
        <Card>
          <strong>{data.today.pendingPosts}</strong>
          <span>на модерації</span>
        </Card>
      </div>

      {data.today.nextEventTitle ? (
        <Card>
          <Badge tone="primary">Подія</Badge>
          <h2>{data.today.nextEventTitle}</h2>
          <p>
            {data.today.nextEventDate
              ? formatEventRange(
                  data.today.nextEventDate,
                  data.today.nextEventEndsAt ?? data.today.nextEventDate,
                )
              : 'Незабаром'}
          </p>
        </Card>
      ) : null}

      {data.goal ? (
        <Card>
          <h2>Прогрес класу</h2>
          <p>{data.goal.title}</p>
          <ProgressBar
            value={data.goal.current}
            max={data.goal.target}
            label={`${data.goal.current} / ${data.goal.target} XP`}
            tone="secondary"
          />
        </Card>
      ) : null}

      <section className={styles.split}>
        <Card>
          <h2>Роботи на перевірку</h2>
          {data.checkingWorks.length === 0 ? (
            <EmptyState title="Все перевірено" description="Нових робіт немає." />
          ) : (
            <div className={styles.list}>
              {data.checkingWorks.map((work) => (
                <div key={work.id} className={styles.work}>
                  <div>
                    <strong>{work.studentName}</strong>
                    <p>{work.homeworkTitle}</p>
                    {work.answer ? (
                      <p className={styles.answerPreview}>{work.answer}</p>
                    ) : null}
                  </div>
                  <Link href="/teacher/tasks">
                    <Button size="md">Перевірити</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2>Останні публікації</h2>
          {data.recentPosts.length === 0 ? (
            <EmptyState title="Поки тихо" description="Клас ще не публікував." />
          ) : (
            <div className={styles.list}>
              {data.recentPosts.map((post) => (
                <div key={post.id} className={styles.work}>
                  <div>
                    <strong>{post.authorName}</strong>
                    <p>{post.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
