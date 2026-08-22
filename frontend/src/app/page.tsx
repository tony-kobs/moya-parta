import Link from 'next/link';
import {
  BookOpen,
  HeartHandshake,
  School,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span aria-hidden="true">🪑</span>
          <strong>Цифровий світ класу</strong>
        </div>
        <Link href="/login" className={styles.loginLink}>
          Увійти
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Для учнів 1–4 класів</p>
          <h1>Це твій цифровий клас</h1>
          <p className={styles.subtitle}>
            Місце, де можна навчатися, спілкуватися, творити та залишатися
            разом із класом.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/register">
              <Button>Я вчитель — створити клас</Button>
            </Link>
            <Link href="/join">
              <Button variant="ghost">У мене є код класу</Button>
            </Link>
          </div>
          <p className={styles.loginHint}>
            Вже є акаунт? <Link href="/login">Увійти</Link>
          </p>
        </div>

        <div className={styles.deskPreview} aria-label="Стилізована Моя парта">
          <div className={styles.deskSurface}>
            <div className={styles.previewAvatar}>🦊</div>
            <div className={styles.previewCard}>
              <strong>Марійка</strong>
              <span>3-Б · Рівень 4</span>
              <div className={styles.previewXp}>████████░░ 780 XP</div>
            </div>
            <div className={styles.previewSticky}>⭐</div>
            <div className={styles.previewNote}>Дроби · +20 XP</div>
            <div className={styles.previewBoard}>LEGO 🚀</div>
          </div>
        </div>
      </section>

      <section id="how" className={styles.section}>
        <h2>Як це працює</h2>
        <p className={styles.sectionLead}>
          Дитина заходить не в журнал, а у свій цифровий клас.
        </p>
        <div className={styles.grid3}>
          <article className={styles.feature}>
            <ArmIcon />
            <h3>Вчитель створює клас</h3>
            <p>Реєстрація вчителя, назва класу і код для учнів.</p>
          </article>
          <article className={styles.feature}>
            <School size={24} />
            <h3>Учні заходять за кодом</h3>
            <p>Посилання або короткий код з дошки — і дитина в своєму класі.</p>
          </article>
          <article className={styles.feature}>
            <BookOpen size={24} />
            <h3>Далі — життя класу</h3>
            <p>Парта, дошка, завдання, квести й маленькі перемоги.</p>
          </article>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <div className={styles.split}>
          <div>
            <h2>Моя парта</h2>
            <p>
              Головний екран дитини. Тут видно, що важливо сьогодні, скільки XP
              вже є, і що цікавого відбувається в класі.
            </p>
          </div>
          <div className={styles.softPanel}>🪑 · 📘 · ⭐ · 🎒</div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Квести та досягнення</h2>
        <div className={styles.grid2}>
          <article className={styles.feature}>
            <Sparkles size={24} />
            <h3>Квести</h3>
            <p>Маленькі пригоди, які роблять навчання частиною світу класу.</p>
          </article>
          <article className={styles.feature}>
            <Trophy size={24} />
            <h3>Мої перемоги</h3>
            <p>Без рейтингів між дітьми — лише власні кроки вперед.</p>
          </article>
        </div>
      </section>

      <section className={styles.sectionAlt}>
        <h2>Безпечне середовище</h2>
        <p className={styles.sectionLead}>
          Закритий клас за запрошенням, модерація публікацій і тільки позитивні
          реакції. Без відкритого пошуку людей.
        </p>
        <div className={styles.grid2}>
          <article className={styles.feature}>
            <Users size={24} />
            <h3>Для вчителя</h3>
            <p>Клас, код запрошення, завдання, перевірка робіт і модерація.</p>
          </article>
          <article className={styles.feature}>
            <HeartHandshake size={24} />
            <h3>Для учнів</h3>
            <p>Своя парта, друзі з класу, творчість і навчання без рейтингів.</p>
          </article>
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2>Готовий відкрити клас?</h2>
        <p>У кожного є своя парта. У кожного є своє місце в класі.</p>
        <div className={styles.ctaRow} style={{ justifyContent: 'center' }}>
          <Link href="/register">
            <Button>Створити клас</Button>
          </Link>
          <Link href="/join">
            <Button variant="ghost">Увійти за кодом</Button>
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} Цифровий світ класу</span>
        <span>MVP для школи, вчителя, батьків і дітей</span>
      </footer>
    </main>
  );
}

function ArmIcon() {
  return <span aria-hidden="true">🪑</span>;
}
