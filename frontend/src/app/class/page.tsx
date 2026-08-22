'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/navigation/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PostCard } from '@/components/posts/PostCard';
import { QuestCard } from '@/components/quests/QuestCard';
import { EventCard } from '@/components/events/EventCard';
import { studentApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import styles from './class.module.css';

export default function ClassPage() {
  return (
    <AppShell title="Мій клас" allowedRoles={['student']}>
      <ClassContent />
    </AppShell>
  );
}

function ClassContent() {
  const user = useAuthStore((state) => state.user);
  const showToast = useUiStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['class'],
    queryFn: studentApi.getClass,
  });

  const reactMutation = useMutation({
    mutationFn: ({ postId, reaction }: { postId: string; reaction: string }) =>
      studentApi.react(postId, reaction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class'] });
      showToast('Ти підтримав друга!');
    },
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => studentApi.joinEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class'] });
      showToast('Ти з нами! +10 XP');
    },
  });

  if (isLoading) {
    return <LoadingState label="Збираємо клас..." />;
  }

  if (isError || !data) {
    return (
      <EmptyState title="Щось пішло не так" description="Спробуй ще раз." />
    );
  }

  return (
    <div className={styles.page}>
      <Card className={styles.hero}>
        <div>
          <p className={styles.kicker}>Наш клас</p>
          <h1>{data.class.name}</h1>
          <p className={styles.teacher}>Учитель: {data.teacher?.displayName}</p>
        </div>
        <div className={styles.students}>
          {data.students.map((student) => (
            <Avatar
              key={student.id}
              emoji={student.avatarEmoji}
              color={student.avatarColor}
              size="sm"
              label={student.displayName}
            />
          ))}
        </div>
      </Card>

      <Card>
        <h2>Спільна мета</h2>
        <p className={styles.goal}>{data.goal.title}</p>
        <ProgressBar
          value={data.goal.current}
          max={data.goal.target}
          label={`${data.goal.current} / ${data.goal.target} XP`}
          tone="secondary"
        />
        {data.goal.current >= data.goal.target ? (
          <p className={styles.celebration}>Ми зробили це разом! 🎉</p>
        ) : null}
      </Card>

      <section className={styles.board}>
        <h2>Дошка класу</h2>
        {data.board.length === 0 ? (
          <EmptyState
            title="Дошка ще порожня"
            description="Можеш стати першим, хто щось покаже класу."
          />
        ) : (
          data.board.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onReact={(reaction) =>
                reactMutation.mutate({ postId: post.id, reaction })
              }
            />
          ))
        )}
      </section>

      <section className={styles.sideGrid}>
        <div>
          <h2>Активні квести</h2>
          <div className={styles.stack}>
            {data.quests.map((quest) => (
              <QuestCard key={quest.id} quest={quest} />
            ))}
          </div>
        </div>
        <div>
          <h2>Події</h2>
          <div className={styles.stack}>
            {data.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                joined={Boolean(user && event.participantIds.includes(user.id))}
                onJoin={() => joinMutation.mutate(event.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
