'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { AppShell } from '@/components/navigation/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PostCard } from '@/components/posts/PostCard';
import { DailyContextCard } from '@/components/class/DailyContextCard';
import { studentApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { formatEventRange } from '@/lib/format';
import { selectDailyContextEntries } from '@/lib/dailyContext';
import type { ClassEvent, LessonSlot, Quest } from '@/types';
import styles from './class.module.css';

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];

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
  const [boardTab, setBoardTab] = useState<'feed' | 'schedule'>('feed');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['class'],
    queryFn: studentApi.getClass,
  });

  const { data: learningData, isLoading: isLearningLoading } = useQuery({
    queryKey: ['learning'],
    queryFn: studentApi.getLearning,
  });

  const { data: schedule } = useQuery({
    queryKey: ['student-schedule'],
    queryFn: studentApi.getSchedule,
  });

  const reactMutation = useMutation({
    mutationFn: ({ postId, reaction }: { postId: string; reaction: string }) =>
      studentApi.react(postId, reaction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['class'] });
      showToast('Ти підтримав!');
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

  const activeQuests = data.quests.filter((quest) => !quest.completed);
  const activeEvents = data.events.filter(
    (event) => event.status === 'upcoming' || event.status === 'live',
  );

  const dailyContextEntries = selectDailyContextEntries({
    homework: learningData?.homework,
    events: data.events,
    quests: data.quests,
  });

  const joinedEventIds = new Set(
    data.events
      .filter((event) => user && event.participantIds.includes(user.id))
      .map((event) => event.id),
  );

  return (
    <div className={styles.page}>
      <Card className={styles.overview}>
        <div className={styles.hero}>
          <div>
            <p className={styles.kicker}>Наш клас</p>
            <h1>{data.class.name}</h1>
            <p className={styles.teacher}>
              Учитель: {data.teacher?.displayName}
            </p>
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
        </div>

        <div className={styles.goalBlock}>
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
        </div>
      </Card>

      <div className={styles.dailyContext}>
        <DailyContextCard
          isLoading={isLearningLoading}
          entries={dailyContextEntries}
          joinedEventIds={joinedEventIds}
          joinBusy={joinMutation.isPending}
          onJoinEvent={(id) => joinMutation.mutate(id)}
        />
      </div>

      <div className={styles.stack}>
        <CompactPanel
          title="Активні квести"
          count={activeQuests.length}
          href="/quests"
          empty="Зараз активних квестів немає"
        >
          {activeQuests.map((quest) => (
            <QuestPulseRow key={quest.id} quest={quest} />
          ))}
        </CompactPanel>

        <CompactPanel
          title="Події"
          count={activeEvents.length}
          href="/events"
          empty="Найближчих подій немає"
        >
          {activeEvents.map((event) => (
            <EventPulseRow
              key={event.id}
              event={event}
              joined={Boolean(user && event.participantIds.includes(user.id))}
              busy={joinMutation.isPending}
              onJoin={() => joinMutation.mutate(event.id)}
            />
          ))}
        </CompactPanel>

        <section className={styles.board}>
          <div className={styles.sectionHead}>
            <h2>Дошка класу</h2>
            <div className={styles.boardTabs}>
              <button
                type="button"
                className={boardTab === 'feed' ? styles.boardTabActive : ''}
                onClick={() => setBoardTab('feed')}
              >
                Стрічка
              </button>
              <button
                type="button"
                className={boardTab === 'schedule' ? styles.boardTabActive : ''}
                onClick={() => setBoardTab('schedule')}
              >
                Розклад
              </button>
            </div>
          </div>
          {boardTab === 'feed' ? (
            data.board.length === 0 ? (
              <EmptyState
                title="Дошка ще порожня"
                description="Учитель скоро опублікує новини для класу."
              />
            ) : (
              <div className={styles.boardList}>
                {data.board.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onReact={(reaction) =>
                      reactMutation.mutate({ postId: post.id, reaction })
                    }
                  />
                ))}
              </div>
            )
          ) : (
            <ScheduleView slots={schedule ?? []} />
          )}
        </section>
      </div>
    </div>
  );
}

function ScheduleView({ slots }: { slots: LessonSlot[] }) {
  const byDay = new Map<number, LessonSlot[]>();
  for (let day = 1; day <= 5; day += 1) {
    byDay.set(day, []);
  }
  for (const slot of slots) {
    byDay.get(slot.dayOfWeek)?.push(slot);
  }
  for (const daySlots of byDay.values()) {
    daySlots.sort((a, b) => a.period - b.period);
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        title="Розкладу ще немає"
        description="Учитель додасть уроки на дошці класу."
      />
    );
  }

  return (
    <div className={styles.scheduleGrid}>
      {DAY_LABELS.map((label, index) => {
        const daySlots = byDay.get(index + 1) ?? [];
        return (
          <div key={label} className={styles.dayCol}>
            <h3>{label}</h3>
            {daySlots.length === 0 ? (
              <p className={styles.dayEmpty}>—</p>
            ) : (
              daySlots.map((slot) => (
                <div key={slot.id} className={styles.slotCard}>
                  <strong>
                    {slot.period}. {slot.subject}
                  </strong>
                  <span>
                    {slot.startsAtTime}–{slot.endsAtTime}
                    {slot.room ? ` · ${slot.room}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompactPanel({
  title,
  count,
  href,
  empty,
  children,
}: {
  title: string;
  count: number;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(count > 0);

  return (
    <div className={styles.pulse}>
      <button
        type="button"
        className={styles.pulseToggle}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>
          {title}
          {count > 0 ? ` · ${count}` : ''}
        </span>
        <ChevronDown
          size={18}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className={styles.pulseBody}>
          {count === 0 ? (
            <p className={styles.pulseEmpty}>{empty}</p>
          ) : (
            children
          )}
        </div>
      ) : null}

      <Link href={href} className={styles.pulseMore}>
        Детальніше
      </Link>
    </div>
  );
}

function QuestPulseRow({ quest }: { quest: Quest }) {
  const step = quest.currentStep ?? 0;

  return (
    <div className={styles.pulseItem}>
      <span className={styles.pulseEmoji} aria-hidden="true">
        {quest.illustration}
      </span>
      <div className={styles.pulseCopy}>
        <strong>{quest.title}</strong>
        <span>
          {quest.completed
            ? 'Завершено'
            : `Крок ${step} із ${quest.totalSteps}`}
        </span>
      </div>
    </div>
  );
}

function EventPulseRow({
  event,
  joined,
  busy,
  onJoin,
}: {
  event: ClassEvent;
  joined: boolean;
  busy: boolean;
  onJoin: () => void;
}) {
  return (
    <div className={styles.pulseItem}>
      <div className={styles.pulseCopy}>
        <strong>{event.title}</strong>
        <span>{formatEventRange(event.startsAt, event.endsAt)}</span>
      </div>
      {event.status === 'upcoming' || event.status === 'live' ? (
        <button
          type="button"
          className={styles.pulseJoin}
          disabled={joined || busy}
          onClick={onJoin}
        >
          {joined ? 'Ти з нами' : 'Приєднатися'}
        </button>
      ) : null}
    </div>
  );
}
