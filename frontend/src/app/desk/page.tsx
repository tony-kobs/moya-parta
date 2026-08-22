'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/navigation/AppShell';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { XPBar } from '@/components/ui/XPBar';
import { HomeworkCard } from '@/components/learning/HomeworkCard';
import { studentApi } from '@/services/api';
import { formatEventRange } from '@/lib/format';
import styles from './desk.module.css';

export default function DeskPage() {
  return (
    <AppShell title="Моя парта" allowedRoles={['student']}>
      <DeskContent />
    </AppShell>
  );
}

function DeskContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['desk'],
    queryFn: studentApi.getDesk,
  });

  if (isLoading) {
    return <LoadingState label="Готуємо твою парту..." />;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Щось пішло не так"
        description="Спробуй ще раз відкрити парту."
        icon="🌿"
      />
    );
  }

  return (
    <div className={styles.page}>
      <motion.section
        className={styles.hero}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.heroMain}>
          <Avatar
            emoji={data.user.avatarEmoji}
            color={data.user.avatarColor}
            size="xl"
            label={data.user.displayName}
          />
          <div>
            <p className={styles.hello}>Привіт, {data.user.displayName}! 👋</p>
            <h1 className={styles.className}>{data.className} клас</h1>
            <XPBar
              level={data.profile.level}
              xp={data.profile.xp}
              xpToNextLevel={data.profile.xpToNextLevel}
            />
          </div>
        </div>
        <div className={styles.decor} aria-hidden="true">
          <span>✏️</span>
          <span>📘</span>
          <span>⭐</span>
        </div>
      </motion.section>

      <div className={styles.grid}>
        <section className={styles.column}>
          <Card>
            <div className={styles.sectionHead}>
              <h2>Сьогодні</h2>
              <Badge tone="warm">Маленький крок</Badge>
            </div>
            {data.todayHomework.length === 0 ? (
              <EmptyState
                title="Сьогодні все спокійно 🌿"
                description="Нових завдань поки немає."
              />
            ) : (
              <div className={styles.stack}>
                {data.todayHomework.map((homework) => (
                  <HomeworkCard
                    key={homework.id}
                    homework={homework}
                    onAction={() => {
                      window.location.href = `/learning/homework/${homework.id}`;
                    }}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className={styles.sectionHead}>
              <h2>Сьогоднішня маленька ціль</h2>
            </div>
            <p className={styles.goalText}>{data.dailyGoal.title}</p>
            <div className={styles.goalXp}>+{data.dailyGoal.xp} XP</div>
          </Card>
        </section>

        <section className={styles.column}>
          <Card>
            <div className={styles.sectionHead}>
              <h2>У класі</h2>
              <Link href="/class" className={styles.link}>
                Відкрити
              </Link>
            </div>
            {data.latestPosts[0] ? (
              <div className={styles.classPreview}>
                <p className={styles.postPreview}>{data.latestPosts[0].text}</p>
                <div className={styles.reactionsPreview}>👏 ❤️ ⭐</div>
              </div>
            ) : (
              <EmptyState
                title="Дошка ще порожня"
                description="Можеш стати першим, хто щось покаже класу."
              />
            )}
          </Card>

          <Card>
            <div className={styles.sectionHead}>
              <h2>Найближча подія</h2>
            </div>
            {data.nextEvent ? (
              <div className={styles.eventBox}>
                <Badge tone="primary">
                  {formatEventRange(
                    data.nextEvent.startsAt,
                    data.nextEvent.endsAt,
                  )}
                </Badge>
                <h3>{data.nextEvent.title}</h3>
                <p>{data.nextEvent.description}</p>
                <Link href="/events">
                  <Button variant="secondary" fullWidth>
                    Дізнатися більше
                  </Button>
                </Link>
              </div>
            ) : (
              <EmptyState title="Подій поки немає" description="Скоро зʼявиться щось цікаве." />
            )}
          </Card>

          <Card>
            <div className={styles.sectionHead}>
              <h2>Мета класу</h2>
            </div>
            <p className={styles.goalText}>{data.classGoal.title}</p>
            <ProgressBar
              value={data.classGoal.current}
              max={data.classGoal.target}
              label={`${data.classGoal.current} / ${data.classGoal.target} XP`}
              tone="secondary"
            />
          </Card>

          <Card>
            <div className={styles.sectionHead}>
              <h2>Мої перемоги</h2>
              <Link href="/wins" className={styles.link}>
                Усі
              </Link>
            </div>
            <div className={styles.wins}>
              {data.recentAchievements.map((item) => (
                <div key={item.id} className={styles.win}>
                  <span>{item.icon}</span>
                  <strong>{item.title}</strong>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <div className={styles.quickActions}>
        <Link href="/board">
          <Button>Поділитися з класом</Button>
        </Link>
        <Button variant="ghost" onClick={() => void refetch()}>
          Оновити
        </Button>
      </div>
    </div>
  );
}
