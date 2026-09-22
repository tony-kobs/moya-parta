'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppShell } from '@/components/navigation/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PostCard } from '@/components/posts/PostCard';
import { teacherApi } from '@/services/api';
import { useUiStore } from '@/store/uiStore';
import type { LessonSlot, Post } from '@/types';
import styles from './moderation.module.css';

type Tab = 'board' | 'schedule';

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];

const postSchema = z.object({
  text: z.string().min(1, 'Напиши текст'),
  imageEmoji: z.string().optional(),
});

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().min(1).max(5),
  period: z.coerce.number().min(1).max(10),
  startsAtTime: z.string().min(1),
  endsAtTime: z.string().min(1),
  subject: z.string().min(1, 'Напиши предмет'),
  room: z.string().optional(),
});

type PostForm = z.infer<typeof postSchema>;
type SlotForm = z.infer<typeof slotSchema>;

export default function ModerationPage() {
  return (
    <AppShell title="Дошка класу" allowedRoles={['teacher']}>
      <BoardAdminContent />
    </AppShell>
  );
}

function BoardAdminContent() {
  const [tab, setTab] = useState<Tab>('board');

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist" aria-label="Розділи дошки">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'board'}
          className={`${styles.tab} ${tab === 'board' ? styles.tabActive : ''}`}
          onClick={() => setTab('board')}
        >
          Дошка
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'schedule'}
          className={`${styles.tab} ${tab === 'schedule' ? styles.tabActive : ''}`}
          onClick={() => setTab('schedule')}
        >
          Розклад уроків
        </button>
      </div>
      {tab === 'board' ? <BoardTab /> : <ScheduleTab />}
    </div>
  );
}

function BoardTab() {
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['teacher-board-posts'],
    queryFn: teacherApi.getBoardPosts,
  });

  const form = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: { text: '', imageEmoji: '📌' },
  });

  const editForm = useForm<PostForm>({
    resolver: zodResolver(postSchema),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['teacher-board-posts'] });
    void queryClient.invalidateQueries({ queryKey: ['class'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (values: PostForm) =>
      teacherApi.createBoardPost({
        text: values.text,
        imageEmoji: values.imageEmoji || '📌',
        category: 'оголошення',
      }),
    onSuccess: () => {
      form.reset({ text: '', imageEmoji: '📌' });
      invalidate();
      showToast('Опубліковано на дошці');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Помилка', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof teacherApi.updateBoardPost>[1];
    }) => teacherApi.updateBoardPost(id, payload),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      showToast('Збережено');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: teacherApi.deleteBoardPost,
    onSuccess: () => {
      invalidate();
      showToast('Видалено');
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  const list = posts ?? [];

  return (
    <>
      <p className={styles.lead}>
        На дошці класу публікуєш лише ти. Учні бачать пости й можуть реагувати.
      </p>

      <Card className={styles.compose}>
        <h2>Новий пост</h2>
        <form
          className={styles.form}
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <textarea rows={3} placeholder="Що важливо для класу…" {...form.register('text')} />
          <div className={styles.row}>
            <input
              type="text"
              aria-label="Емодзі"
              maxLength={4}
              {...form.register('imageEmoji')}
            />
            <Button type="submit" disabled={createMutation.isPending}>
              Опублікувати
            </Button>
          </div>
        </form>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title="Дошка ще порожня"
          description="Опублікуй перше повідомлення для класу."
        />
      ) : (
        list.map((post) => (
          <BoardPostItem
            key={post.id}
            post={post}
            editing={editingId === post.id}
            editForm={editForm}
            onStartEdit={() => {
              setEditingId(post.id);
              editForm.reset({
                text: post.text,
                imageEmoji: post.imageEmoji ?? '📌',
              });
            }}
            onCancelEdit={() => setEditingId(null)}
            onSave={(values) =>
              updateMutation.mutate({
                id: post.id,
                payload: { text: values.text, imageEmoji: values.imageEmoji },
              })
            }
            onPin={() =>
              updateMutation.mutate({
                id: post.id,
                payload: { pinned: !post.pinned },
              })
            }
            onHide={() =>
              updateMutation.mutate({
                id: post.id,
                payload: { status: post.status === 'hidden' ? 'published' : 'hidden' },
              })
            }
            onDelete={() => deleteMutation.mutate(post.id)}
          />
        ))
      )}
    </>
  );
}

function BoardPostItem({
  post,
  editing,
  editForm,
  onStartEdit,
  onCancelEdit,
  onSave,
  onPin,
  onHide,
  onDelete,
}: {
  post: Post;
  editing: boolean;
  editForm: ReturnType<typeof useForm<PostForm>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (values: PostForm) => void;
  onPin: () => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={styles.item}>
      {post.pinned ? <span className={styles.pinBadge}>Закріплено</span> : null}
      {post.status === 'hidden' ? (
        <span className={styles.hiddenBadge}>Приховано</span>
      ) : null}
      {editing ? (
        <Card className={styles.compose}>
          <form
            className={styles.form}
            onSubmit={editForm.handleSubmit((values) => onSave(values))}
          >
            <textarea rows={3} {...editForm.register('text')} />
            <div className={styles.row}>
              <Button type="submit">Зберегти</Button>
              <Button type="button" variant="ghost" onClick={onCancelEdit}>
                Скасувати
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <PostCard post={post} />
      )}
      <div className={styles.actions}>
        <Button size="md" variant="ghost" onClick={onPin}>
          {post.pinned ? 'Відкріпити' : 'Закріпити'}
        </Button>
        <Button size="md" variant="ghost" onClick={onStartEdit}>
          Редагувати
        </Button>
        <Button size="md" variant="ghost" onClick={onHide}>
          {post.status === 'hidden' ? 'Показати' : 'Приховати'}
        </Button>
        <Button size="md" variant="ghost" onClick={onDelete}>
          Видалити
        </Button>
      </div>
    </div>
  );
}

function ScheduleTab() {
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-schedule'],
    queryFn: teacherApi.getSchedule,
  });

  const form = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      dayOfWeek: 1,
      period: 1,
      startsAtTime: '08:30',
      endsAtTime: '09:15',
      subject: '',
      room: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: SlotForm) => teacherApi.createLessonSlot(values),
    onSuccess: () => {
      form.reset({
        dayOfWeek: 1,
        period: 1,
        startsAtTime: '08:30',
        endsAtTime: '09:15',
        subject: '',
        room: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['teacher-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['student-schedule'] });
      showToast('Урок додано');
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : 'Помилка', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: teacherApi.deleteLessonSlot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['student-schedule'] });
      showToast('Урок видалено');
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<number, LessonSlot[]>();
    for (let day = 1; day <= 5; day += 1) {
      map.set(day, []);
    }
    for (const slot of data ?? []) {
      map.get(slot.dayOfWeek)?.push(slot);
    }
    for (const slots of map.values()) {
      slots.sort((a, b) => a.period - b.period);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return <LoadingState label="Завантажуємо розклад…" />;
  }

  return (
    <>
      <p className={styles.lead}>
        Тижневий розклад Пн–Пт. Учні бачать його на сторінці класу.
      </p>

      <Card className={styles.compose}>
        <h2>Додати урок</h2>
        <form
          className={styles.slotForm}
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <label>
            День
            <select {...form.register('dayOfWeek')}>
              {DAY_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Урок №
            <input type="number" min={1} max={10} {...form.register('period')} />
          </label>
          <label>
            Початок
            <input type="time" {...form.register('startsAtTime')} />
          </label>
          <label>
            Кінець
            <input type="time" {...form.register('endsAtTime')} />
          </label>
          <label className={styles.grow}>
            Предмет
            <input type="text" {...form.register('subject')} />
          </label>
          <label>
            Кабінет
            <input type="text" {...form.register('room')} />
          </label>
          <Button type="submit" disabled={createMutation.isPending}>
            Додати
          </Button>
        </form>
      </Card>

      <div className={styles.scheduleGrid}>
        {DAY_LABELS.map((label, index) => {
          const day = index + 1;
          const slots = byDay.get(day) ?? [];
          return (
            <section key={day} className={styles.dayCol}>
              <h3>{label}</h3>
              {slots.length === 0 ? (
                <p className={styles.dayEmpty}>Порожньо</p>
              ) : (
                slots.map((slot) => (
                  <div key={slot.id} className={styles.slotCard}>
                    <strong>
                      {slot.period}. {slot.subject}
                    </strong>
                    <span>
                      {slot.startsAtTime}–{slot.endsAtTime}
                      {slot.room ? ` · ${slot.room}` : ''}
                    </span>
                    <Button
                      size="md"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(slot.id)}
                    >
                      Видалити
                    </Button>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
