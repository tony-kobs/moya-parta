'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/navigation/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { HomeworkCard } from '@/components/learning/HomeworkCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { teacherApi } from '@/services/api';
import { useUiStore } from '@/store/uiStore';
import { SUBJECT_LABELS, type Subject } from '@/types';
import styles from './tasks.module.css';

type Tab = 'homework' | 'tests' | 'review';

const homeworkSchema = z.object({
  title: z.string().min(1, 'Напиши назву завдання'),
  description: z.string().min(1, 'Додай короткий опис'),
  subject: z.enum(['math', 'ukrainian', 'reading', 'science', 'art', 'other']),
  dueDate: z.string().min(1),
  xpReward: z.coerce.number().min(5).max(100),
  linkedQuizId: z.string().optional(),
});

type HomeworkForm = z.infer<typeof homeworkSchema>;

const quizSchema = z.object({
  title: z.string().min(1, 'Напиши назву тесту'),
  subject: z.enum(['math', 'ukrainian', 'reading', 'science', 'art', 'other']),
  xpReward: z.coerce.number().min(5).max(100),
  q1: z.string().min(1),
  o1a: z.string().min(1),
  o1b: z.string().min(1),
  correct1: z.coerce.number().min(0).max(1),
  q2: z.string().min(1),
  o2a: z.string().min(1),
  o2b: z.string().min(1),
  correct2: z.coerce.number().min(0).max(1),
});

type QuizForm = z.infer<typeof quizSchema>;

export default function TeacherTasksPage() {
  return (
    <AppShell title="Завдання" allowedRoles={['teacher']}>
      <TasksContent />
    </AppShell>
  );
}

function TasksContent() {
  const [tab, setTab] = useState<Tab>('homework');
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: teacherApi.getDashboard,
  });

  const templatesQuery = useQuery({
    queryKey: ['quiz-templates'],
    queryFn: () => teacherApi.getQuizTemplates(),
  });

  const quizzesQuery = useQuery({
    queryKey: ['teacher-quizzes'],
    queryFn: teacherApi.getQuizzes,
  });

  const homeworkForm = useForm<HomeworkForm>({
    resolver: zodResolver(homeworkSchema),
    defaultValues: {
      subject: 'math',
      xpReward: 20,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      linkedQuizId: '',
    },
  });

  const quizForm = useForm<QuizForm>({
    resolver: zodResolver(quizSchema),
    defaultValues: {
      subject: 'math',
      xpReward: 25,
      correct1: 0,
      correct2: 0,
    },
  });

  const createHomework = useMutation({
    mutationFn: (values: HomeworkForm) =>
      teacherApi.createHomework({
        ...values,
        dueDate: new Date(values.dueDate).toISOString(),
        linkedQuizId: values.linkedQuizId || undefined,
      }),
    onSuccess: () => {
      homeworkForm.reset({
        subject: 'math',
        xpReward: 20,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        linkedQuizId: '',
        title: '',
        description: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      showToast('Завдання додано для класу');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Помилка', 'error');
    },
  });

  const deleteHomework = useMutation({
    mutationFn: teacherApi.deleteHomework,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      showToast('Завдання видалено');
    },
  });

  const assignTemplate = useMutation({
    mutationFn: teacherApi.assignQuizFromTemplate,
    onSuccess: (quiz) => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-quizzes'] });
      showToast(`Тест «${quiz.title}» додано класу`);
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Помилка', 'error');
    },
  });

  const createQuiz = useMutation({
    mutationFn: (values: QuizForm) =>
      teacherApi.createQuiz({
        title: values.title,
        subject: values.subject,
        xpReward: values.xpReward,
        questions: [
          {
            text: values.q1,
            options: [values.o1a, values.o1b],
            correctIndex: values.correct1,
          },
          {
            text: values.q2,
            options: [values.o2a, values.o2b],
            correctIndex: values.correct2,
          },
        ],
      }),
    onSuccess: () => {
      quizForm.reset({
        subject: 'math',
        xpReward: 25,
        correct1: 0,
        correct2: 0,
        title: '',
        q1: '',
        o1a: '',
        o1b: '',
        q2: '',
        o2a: '',
        o2b: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher-quizzes'] });
      showToast('Власний тест створено');
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: teacherApi.deleteQuiz,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-quizzes'] });
      showToast('Тест видалено');
    },
  });

  const review = useMutation({
    mutationFn: ({
      id,
      decision,
      comment,
    }: {
      id: string;
      decision: 'accept' | 'revise' | 'redo_test';
      comment: string;
    }) => teacherApi.reviewSubmission(id, { decision, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      showToast('Рішення збережено');
    },
  });

  const templatesBySubject = useMemo(() => {
    const list = templatesQuery.data ?? [];
    return list.reduce<Record<string, typeof list>>((acc, item) => {
      (acc[item.subject] ??= []).push(item);
      return acc;
    }, {});
  }, [templatesQuery.data]);

  if (dashboardQuery.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {(
          [
            ['homework', 'Завдання'],
            ['tests', 'Тести'],
            ['review', 'Перевірка'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'review' && dashboardQuery.data?.checkingWorks.length
              ? ` (${dashboardQuery.data.checkingWorks.length})`
              : ''}
          </button>
        ))}
      </div>

      {tab === 'homework' ? (
        <>
          <Card>
            <h2>Створити завдання</h2>
            <form
              className={styles.form}
              onSubmit={homeworkForm.handleSubmit((values) =>
                createHomework.mutate(values),
              )}
            >
              <input placeholder="Назва" {...homeworkForm.register('title')} />
              {homeworkForm.formState.errors.title ? (
                <em>{homeworkForm.formState.errors.title.message}</em>
              ) : null}
              <textarea
                placeholder="Опис"
                rows={3}
                {...homeworkForm.register('description')}
              />
              <select {...homeworkForm.register('subject')}>
                <option value="math">Математика</option>
                <option value="ukrainian">Українська мова</option>
                <option value="reading">Читання</option>
                <option value="science">Я досліджую світ</option>
                <option value="art">Мистецтво</option>
                <option value="other">Інше</option>
              </select>
              <input type="date" {...homeworkForm.register('dueDate')} />
              <input type="number" {...homeworkForm.register('xpReward')} />
              <label className={styles.label}>
                Повʼязати тест (необовʼязково)
                <select {...homeworkForm.register('linkedQuizId')}>
                  <option value="">Без тесту</option>
                  {(quizzesQuery.data ?? []).map((quiz) => (
                    <option key={quiz.id} value={quiz.id}>
                      {quiz.title}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" fullWidth disabled={createHomework.isPending}>
                Додати завдання
              </Button>
            </form>
          </Card>

          <section className={styles.list}>
            <h2>Завдання класу</h2>
            {(dashboardQuery.data?.homeworks.length ?? 0) === 0 ? (
              <EmptyState
                title="Поки порожньо"
                description="Створи перше завдання для класу."
              />
            ) : (
              dashboardQuery.data?.homeworks.map((homework) => (
                <div key={homework.id} className={styles.itemRow}>
                  <HomeworkCard homework={homework} />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (confirm('Видалити це завдання?')) {
                        deleteHomework.mutate(homework.id);
                      }
                    }}
                  >
                    Видалити
                  </Button>
                </div>
              ))
            )}
          </section>
        </>
      ) : null}

      {tab === 'tests' ? (
        <>
          <Card>
            <h2>База готових тестів</h2>
            <p className={styles.hint}>
              Обери тест із бази (наприклад математика) і одразу додай класу.
            </p>
            <div className={styles.bank}>
              {Object.entries(templatesBySubject).map(([subject, items]) => (
                <div key={subject} className={styles.bankGroup}>
                  <h3>{SUBJECT_LABELS[subject as Subject] ?? subject}</h3>
                  {items.map((tpl) => (
                    <div key={tpl.id} className={styles.bankItem}>
                      <div>
                        <strong>{tpl.title}</strong>
                        <p>
                          {tpl.description} · {tpl.questions.length} пит. · +
                          {tpl.xpReward} XP
                        </p>
                      </div>
                      <Button
                        size="md"
                        disabled={assignTemplate.isPending}
                        onClick={() => assignTemplate.mutate(tpl.id)}
                      >
                        Додати класу
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2>Створити свій тест</h2>
            <form
              className={styles.form}
              onSubmit={quizForm.handleSubmit((values) =>
                createQuiz.mutate(values),
              )}
            >
              <input placeholder="Назва тесту" {...quizForm.register('title')} />
              <select {...quizForm.register('subject')}>
                <option value="math">Математика</option>
                <option value="ukrainian">Українська мова</option>
                <option value="reading">Читання</option>
                <option value="science">Я досліджую світ</option>
                <option value="art">Мистецтво</option>
                <option value="other">Інше</option>
              </select>
              <input type="number" {...quizForm.register('xpReward')} />
              <fieldset className={styles.fieldset}>
                <legend>Питання 1</legend>
                <input placeholder="Текст питання" {...quizForm.register('q1')} />
                <input placeholder="Варіант A" {...quizForm.register('o1a')} />
                <input placeholder="Варіант B" {...quizForm.register('o1b')} />
                <select {...quizForm.register('correct1')}>
                  <option value={0}>Правильна: A</option>
                  <option value={1}>Правильна: B</option>
                </select>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend>Питання 2</legend>
                <input placeholder="Текст питання" {...quizForm.register('q2')} />
                <input placeholder="Варіант A" {...quizForm.register('o2a')} />
                <input placeholder="Варіант B" {...quizForm.register('o2b')} />
                <select {...quizForm.register('correct2')}>
                  <option value={0}>Правильна: A</option>
                  <option value={1}>Правильна: B</option>
                </select>
              </fieldset>
              <Button type="submit" fullWidth disabled={createQuiz.isPending}>
                Створити тест
              </Button>
            </form>
          </Card>

          <section className={styles.list}>
            <h2>Тести класу</h2>
            {(quizzesQuery.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Тестів ще немає"
                description="Додай з бази або створи свій."
              />
            ) : (
              quizzesQuery.data?.map((quiz) => (
                <Card key={quiz.id} className={styles.quizCard}>
                  <div>
                    <Badge tone="primary">
                      {SUBJECT_LABELS[quiz.subject] ?? quiz.subject}
                    </Badge>
                    <h3>{quiz.title}</h3>
                    <p>
                      {quiz.questions.length} питань · +{quiz.xpReward} XP
                      {quiz.templateId ? ' · з бази' : ' · свій'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (confirm('Видалити цей тест?')) {
                        deleteQuiz.mutate(quiz.id);
                      }
                    }}
                  >
                    Видалити
                  </Button>
                </Card>
              ))
            )}
          </section>
        </>
      ) : null}

      {tab === 'review' ? (
        <section className={styles.list}>
          <h2>Роботи учнів</h2>
          {(dashboardQuery.data?.checkingWorks.length ?? 0) === 0 ? (
            <EmptyState
              title="Все перевірено"
              description="Нових робіт на перевірку немає."
            />
          ) : (
            dashboardQuery.data?.checkingWorks.map((work) => (
              <ReviewCard
                key={work.id}
                work={work}
                busy={review.isPending}
                onReview={(decision, comment) =>
                  review.mutate({ id: work.id, decision, comment })
                }
              />
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

function ReviewCard({
  work,
  busy,
  onReview,
}: {
  work: {
    id: string;
    studentName?: string;
    homeworkTitle?: string;
    answer?: string;
    linkedQuizId?: string;
  };
  busy: boolean;
  onReview: (
    decision: 'accept' | 'revise' | 'redo_test',
    comment: string,
  ) => void;
}) {
  const [comment, setComment] = useState('');

  return (
    <Card className={styles.reviewCard}>
      <div>
        <strong>{work.studentName}</strong>
        <p className={styles.hint}>{work.homeworkTitle}</p>
      </div>
      {work.answer ? (
        <blockquote className={styles.answer}>{work.answer}</blockquote>
      ) : (
        <p className={styles.hint}>Учень ще не написав відповідь текстом.</p>
      )}
      <label className={styles.label}>
        Коментар для учня
        <textarea
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Напиши коротко, що добре і що доробити"
        />
      </label>
      <div className={styles.reviewActions}>
        <Button
          disabled={busy}
          onClick={() => onReview('accept', comment)}
        >
          Прийняти
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => onReview('revise', comment)}
        >
          На доопрацювання
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !work.linkedQuizId}
          onClick={() => onReview('redo_test', comment)}
          title={
            work.linkedQuizId
              ? undefined
              : 'Спочатку повʼяжи завдання з тестом'
          }
        >
          Переробити тест
        </Button>
      </div>
    </Card>
  );
}
