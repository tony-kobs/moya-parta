'use client';

import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/navigation/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { AchievementCard } from '@/components/achievements/AchievementCard';
import { studentApi } from '@/services/api';
import styles from './wins.module.css';

export default function WinsPage() {
  return (
    <AppShell title="Мої перемоги" allowedRoles={['student']}>
      <WinsContent />
    </AppShell>
  );
}

function WinsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: studentApi.getAchievements,
  });

  if (isLoading) {
    return <LoadingState label="Збираємо перемоги..." />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Перемоги ще попереду"
        description="Виконуй завдання і відкривай нові нагороди."
      />
    );
  }

  const categories = Array.from(new Set(data.map((item) => item.category)));

  return (
    <div className={styles.page}>
      <p className={styles.lead}>
        Тут твої маленькі перемоги. Без порівнянь з іншими — лише твій шлях.
      </p>
      {categories.map((category) => (
        <section key={category}>
          <h2>{category}</h2>
          <div className={styles.grid}>
            {data
              .filter((item) => item.category === category)
              .map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
