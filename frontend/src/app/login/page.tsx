'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { getRoleHomePath } from '@/lib/format';
import styles from '../login/login.module.css';

const schema = z.object({
  email: z.string().min(3, 'Введи логін'),
  password: z.string().min(4, 'Пароль занадто короткий'),
});

type FormValues = z.infer<typeof schema>;

const demos = [
  { role: 'Учень', email: 'student@example.com' },
  { role: 'Вчитель', email: 'teacher@example.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'student@example.com',
      password: 'demo1234',
    },
  });

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(getRoleHomePath(user.role));
    }
  }, [isAuthenticated, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    setError('');
    try {
      const nextUser = await login(values.email, values.password);
      router.replace(getRoleHomePath(nextUser.role));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Щось пішло не так. Спробуй ще раз',
      );
    }
  });

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.logo} aria-hidden="true">
          🪑
        </div>
        <h1>Вітаємо у твоєму класі</h1>
        <p className={styles.lead}>Увійди, щоб сісти за свою парту.</p>

        <label className={styles.field}>
          <span>Логін</span>
          <input type="text" autoComplete="username" {...register('email')} />
          {errors.email ? <em>{errors.email.message}</em> : null}
        </label>

        <label className={styles.field}>
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password ? <em>{errors.password.message}</em> : null}
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? 'Заходимо...' : 'Увійти'}
        </Button>

        <div className={styles.demos}>
          <p>Немає акаунта?</p>
          <div className={styles.demoRow}>
            <Link href="/register" className={styles.demoBtn}>
              Я вчитель
            </Link>
            <Link href="/join" className={styles.demoBtn}>
              У мене є код класу
            </Link>
          </div>
          <p className={styles.hint}>Демо: student@example.com / teacher@example.com · demo1234</p>
          <div className={styles.demoRow}>
            {demos.map((demo) => (
              <button
                key={demo.email}
                type="button"
                className={styles.demoBtn}
                onClick={() => {
                  setValue('email', demo.email);
                  setValue('password', 'demo1234');
                }}
              >
                {demo.role}
              </button>
            ))}
          </div>
        </div>
      </form>
    </main>
  );
}
