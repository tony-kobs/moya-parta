# Наступний крок: PostgreSQL замість in-memory seed

> Зафіксовано: 2026-08-22  
> Канон продукту: [PROJECT_CHAIN.md](./PROJECT_CHAIN.md)

## Навіщо

Без стійкого сховища деплой на Render/Vercel годиться лише для демо: рестарт або «сон» інстансу стирає класи, роботи й чат. Нові фічі поверх seed лише збільшують борг.

## Ціль

Перенести поточну модель даних з `backend/src/data/seed.ts` на **PostgreSQL**, не ламаючи API-контракт для frontend.

## Порядок робіт (1–2 сесії)

### 1. Інфра

- Postgres (Neon або Render Postgres)
- `DATABASE_URL` у `backend/.env` і на Render
- Міграції (наприклад Prisma / Drizzle / raw SQL — обрати один стек і триматись його)

### 2. Схема (мінімум під поточний MVP)

Користувачі, класи, memberships, invite-коди, пости + реакції, чат (клас + DM), homework / submissions, quiz templates + assignments + attempts, quests, events + participants + review materials, nav-seen / badges state, сповіщення, XP.

Демо-дані (`student@…`, `teacher@…`, `3B-DEMO`) — через seed-скрипт у БД, не через mutable global у RAM.

### 3. Бекенд

- Замінити звернення до in-memory `db` у services на запити до Postgres
- Зберегти GoIT-шар: routes → controllers → services
- Не міняти шляхи `/api/*` і форми відповідей без потреби

### 4. Одразу після міграції (P0 безпеки)

- Перевірка `classId` / membership на **усіх** learning / event / post мутаціях (закрити IDOR)
- Довші унікальні invite-коди + rate limit на preview / register / login (можна наступним комітом у тому ж спринті)

### 5. Перевірка

End-to-end: новий вчитель → клас → учень за кодом → пост → чат → завдання → ревʼю.

## Що НЕ робити в цьому кроці

- WebSocket / realtime замість polling
- Батьківський / school admin кабінет
- Bulk-дії вчителя, фото зошита, редактор персонажа
- Зміна ролей продукту (лише teacher + student)

## Критерій «готово»

1. Рестарт backend **не** стирає дані користувачів і класів.
2. Прод (Render) працює з `DATABASE_URL`.
3. Демо-логіни або seed відновлюються скриптом, а не «магією» в памʼяті.
4. Учень з JWT не може мутувати сутності чужого класу за id.

## Швидкий win (лише якщо БД відкладається)

Один вечір без Postgres: class-scoped checks + прибрати метрику «на модерації» + XP після `accept`. Для реальної школи все одно першим стоїть цей файл.
