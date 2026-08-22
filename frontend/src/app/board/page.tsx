'use client';

import { useState } from 'react';
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
import { studentApi } from '@/services/api';
import { useUiStore } from '@/store/uiStore';
import styles from './board.module.css';

const schema = z.object({
  text: z.string().min(1, 'Напиши щось у публікації'),
  category: z.string().optional(),
  imageEmoji: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const emojiOptions = ['🌳', '🎨', '🐶', '📚', '🚀', '🏅', '⚽', '🌈'];

export default function BoardPage() {
  return (
    <AppShell title="Моя дошка" allowedRoles={['student']}>
      <BoardContent />
    </AppShell>
  );
}

function BoardContent() {
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const [selectedEmoji, setSelectedEmoji] = useState('🎨');

  const { data, isLoading } = useQuery({
    queryKey: ['board'],
    queryFn: studentApi.getBoard,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: '', category: 'творчість' },
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      studentApi.createPost({
        ...values,
        imageEmoji: selectedEmoji,
      }),
    onSuccess: () => {
      reset();
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      showToast('Показано класу!');
      void queryClient.invalidateQueries({ queryKey: ['class'] });
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className={styles.page}>
      <Card>
        <h2>Що нового?</h2>
        <form
          className={styles.form}
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <textarea
            placeholder="Я був у лісі з родиною..."
            rows={4}
            {...register('text')}
          />
          {errors.text ? <em>{errors.text.message}</em> : null}

          <label>
            Категорія
            <select {...register('category')}>
              <option value="творчість">Творчість</option>
              <option value="читання">Читання</option>
              <option value="пригода">Пригода</option>
              <option value="друзі">Друзі</option>
            </select>
          </label>

          <div className={styles.emojiRow}>
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.emoji} ${
                  selectedEmoji === emoji ? styles.emojiActive : ''
                }`}
                onClick={() => setSelectedEmoji(emoji)}
                aria-label={`Обрати ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <Button type="submit" fullWidth disabled={createMutation.isPending}>
            Поділитися з класом
          </Button>
        </form>
      </Card>

      <section className={styles.list}>
        <h2>Мої публікації</h2>
        {!data || data.length === 0 ? (
          <EmptyState
            title="Дошка ще порожня"
            description="Можеш стати першим, хто щось покаже класу."
          />
        ) : (
          data.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>
    </div>
  );
}
