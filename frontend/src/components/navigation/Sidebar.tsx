'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Backpack,
  Bell,
  BookOpen,
  LogOut,
  School,
  Trophy,
  Armchair,
  LayoutDashboard,
  ClipboardList,
  Shield,
  Link2,
  MessageCircle,
  CalendarDays,
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { useAuthStore } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { NavCount } from './NavCount';
import { badgeForHref, useNavBadges } from '@/hooks/useNavBadges';

const studentLinks = [
  { href: '/desk', label: 'Моя парта', icon: Armchair },
  { href: '/class', label: 'Мій клас', icon: School },
  { href: '/chat', label: 'Чат', icon: MessageCircle },
  { href: '/learning', label: 'Навчання', icon: BookOpen },
  { href: '/wins', label: 'Мої перемоги', icon: Trophy },
  { href: '/backpack', label: 'Мій рюкзак', icon: Backpack },
];

const teacherLinks = [
  { href: '/teacher', label: 'Сьогодні', icon: LayoutDashboard },
  { href: '/teacher/class', label: 'Мій клас', icon: School },
  { href: '/chat', label: 'Чат', icon: MessageCircle },
  { href: '/teacher/invite', label: 'Запросити', icon: Link2 },
  { href: '/teacher/tasks', label: 'Завдання', icon: ClipboardList },
  { href: '/teacher/events', label: 'Події', icon: CalendarDays },
  { href: '/teacher/moderation', label: 'Дошка', icon: Shield },
];

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }

  if (href === '/teacher' || href === '/desk') {
    return false;
  }

  return pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { badges } = useNavBadges();

  if (!user) {
    return null;
  }

  const links = user.role === 'teacher' ? teacherLinks : studentLinks;
  const notificationsCount = badges.notifications;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          🪑
        </span>
        <div>
          <strong>Цифровий клас</strong>
          <p>Твоє місце поруч</p>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Основна навігація">
        {links.map((link) => {
          const Icon = link.icon;
          const active = isNavActive(pathname, link.href);
          const count = badgeForHref(link.href, badges, user.role);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.link} ${active ? styles.active : ''}`}
            >
              <span className={styles.iconWrap}>
                <Icon size={20} aria-hidden="true" />
                <NavCount count={count} label={link.label} />
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <Link
          href="/notifications"
          className={`${styles.link} ${pathname.startsWith('/notifications') ? styles.active : ''}`}
        >
          <span className={styles.iconWrap}>
            <Bell size={20} aria-hidden="true" />
            <NavCount count={notificationsCount} label="Сповіщення" />
          </span>
          <span>Сповіщення</span>
        </Link>
        <Link href="/profile" className={styles.profile}>
          <Avatar
            emoji={user.avatarEmoji}
            color={user.avatarColor}
            size="sm"
            label={user.displayName}
          />
          <span>{user.displayName}</span>
        </Link>
        <button type="button" className={styles.logout} onClick={logout}>
          <LogOut size={18} aria-hidden="true" />
          Вийти
        </button>
      </div>
    </aside>
  );
}
