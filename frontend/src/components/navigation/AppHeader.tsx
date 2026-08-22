'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import styles from './AppHeader.module.css';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { NavCount } from './NavCount';
import { useNavBadges } from '@/hooks/useNavBadges';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const user = useAuthStore((state) => state.user);
  const { badges } = useNavBadges();

  if (!user) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div>{title ? <h1 className={styles.title}>{title}</h1> : null}</div>
      <div className={styles.actions}>
        <Link
          href="/notifications"
          className={styles.iconBtn}
          aria-label={
            badges.notifications
              ? `Сповіщення, ${badges.notifications} нових`
              : 'Сповіщення'
          }
        >
          <span className={styles.iconWrap}>
            <Bell size={20} />
            <NavCount count={badges.notifications} />
          </span>
        </Link>
        <Link href="/profile" aria-label="Профіль">
          <Avatar
            emoji={user.avatarEmoji}
            color={user.avatarColor}
            size="sm"
            label={user.displayName}
          />
        </Link>
      </div>
    </header>
  );
}
