'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/brand/BrandMark';
import styles from '../login/login.module.css';
import pageStyles from './join.module.css';

export default function JoinEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <main className={`${styles.page} ${pageStyles.page}`}>
      <div className={styles.card}>
        <BrandMark href="/" size="lg" />
        <h1>Код класу</h1>
        <p className={styles.lead}>
          Вчитель дає код або посилання. Якщо треба — попроси маму чи тата допомогти ввести.
        </p>
        <label className={styles.field}>
          <span>Код</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="3B-DEMO"
          />
        </label>
        <Button
          fullWidth
          disabled={code.trim().length < 3}
          onClick={() => router.push(`/join/${code.trim().toUpperCase()}`)}
        >
          Далі
        </Button>
        <p className={styles.hint}>
          Вже є акаунт? <Link href="/login">Увійти</Link>
        </p>
        <p className={styles.hint}>Демо-код класу: 3B-DEMO</p>
      </div>
    </main>
  );
}
