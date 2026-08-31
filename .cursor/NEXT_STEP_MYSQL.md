# Наступний крок: MySQL замість in-memory seed

> Зафіксовано: 2026-08-26  
> Канон продукту: [PROJECT_CHAIN.md](./PROJECT_CHAIN.md)

## Навіщо

Без стійкого сховища деплой на Render/Vercel годиться лише для демо: рестарт або «сон» інстансу стирає класи, роботи й чат. Нові фічі поверх seed лише збільшують борг.

## Ціль

Перенести поточну модель даних з `backend/src/data/seed.ts` на **MySQL** (Prisma), не ламаючи API-контракт для frontend.

## Інфра (актуальне рішення)

| Параметр | Значення |
|----------|----------|
| СУБД | **MySQL** (не PostgreSQL) |
| Хост | `192.168.0.212:3306` |
| База / користувач | `parta` / `parta` |
| ORM | Prisma (`backend/prisma/schema.prisma`, provider `mysql`) |
| Локальний `.env` | `DATABASE_URL="mysql://parta:PASSWORD@192.168.0.212:3306/parta"` |
| Пароль | з `/root/parta-mysql-credentials.txt` на `root@10.10.10.2` (поле `MYSQL_PASSWORD`) — **не** комітити |

## Порядок локального запуску

```bash
cd backend
cp .env.example .env          # підставити пароль у DATABASE_URL
npm install
npm run prisma:generate
npm run prisma:migrate        # або: npx prisma db push
npm run prisma:seed           # demo teacher/student + 3B-DEMO
npm run build
npm run dev
```

Демо після seed:

- Учитель: `teacher@example.com` / `demo1234`
- Учень: `student@example.com` / `demo1234`
- Код класу: `3B-DEMO`

## Що зроблено в коді

- Prisma-моделі: School, User, ClassRoom, ClassMembership, StudentProfile, Post, Homework, HomeworkSubmission, QuizTemplate, Quiz, QuizAttempt, Quest, QuestProgress, Achievement, StudentAchievement, ClassEvent, Notification, XpTransaction, BackpackItem, LearningMaterial, ChatMessage, NavSeen
- `backend/src/lib/prisma.ts` — singleton
- `backend/prisma/seed.ts` — демо-дані з колекцій seed (без mutable `export const db`)
- Services + auth middleware → Prisma (async)
- `mathExpeditionQuestionsByGrade` лишається статичним TS import

## Одразу після міграції (P0 безпеки)

- Перевірка `classId` / membership на **усіх** learning / event / post мутаціях (закрити IDOR)
- Довші унікальні invite-коди + rate limit на preview / register / login

## Критерій «готово»

1. Рестарт backend **не** стирає дані користувачів і класів.
2. Прод (Render) працює з `DATABASE_URL` (MySQL).
3. Демо-логіни відновлюються `npm run prisma:seed`, а не RAM.
4. Учень з JWT не може мутувати сутності чужого класу за id.

## Що НЕ робити в цьому кроці

- PostgreSQL / Neon / Render Postgres
- WebSocket замість polling
- Батьківський / school admin кабінет
