# Моя парта · Цифровий світ класу

Закритий цифровий клас для учнів **1–4** і їхнього **вчителя**.

> «У кожного є своя парта. У кожного є своє місце в класі.»

Це **не** електронний щоденник і не LMS: акцент на парті дитини, класі, творчості, навчанні, подіях і маленьких перемогах — **без рейтингів між дітьми**.

---

## Посилання

| Що | URL |
|----|-----|
| **Код (монорепо)** | https://github.com/tony-kobs/moya-parta |
| **Прод · фронт** | https://moya-parta.vercel.app |
| **Прод · API** | https://backend-myclassroom.onrender.com |
| **Дерево продукту** | [`presentation/index.html`](./presentation/index.html) |
| **Рішення / inventory** | [`.cursor/PROJECT_CHAIN.md`](./.cursor/PROJECT_CHAIN.md) |

---

## Хто в продукті (MVP)

| Роль | Статус |
|------|--------|
| **Учитель** | є — клас, код, завдання, тести, перевірка, події, чат, дошка |
| **Учень** | є — парта, клас, навчання, чат, перемоги |
| **Батьки** | **немає кабінету** — лише допомагають на вході (варіант A) |
| **School admin** | **немає** в MVP |

### Ланцюг доступу

```text
Учитель /register
  → створює клас
  → код + /join/КОД
  → учень (або з допомогою батька) реєструється
  → onboarding
  → Моя парта
```

- Пости на дошці зʼявляються **одразу** (учитель може **приховати**).
- Чат: клас + особисті **лише всередині свого класу**.

---

## Структура репо

```text
moya-parta/
├── frontend/        Next.js (App Router), TS, CSS Modules, TanStack Query, Zustand
├── backend/         Express + TS (GoIT: routes → controllers → services), Prisma + MySQL
├── presentation/    HTML-презентація дерева продукту для команди
├── render.yaml      підказка для Render (rootDir: backend)
└── .cursor/         PROJECT_CHAIN, ORIGINAL_PROMPT, правила агента
```

**Деплой з одного репо:**

| Хостинг | Root Directory | Призначення |
|---------|----------------|-------------|
| **Vercel** | `frontend` | сайт |
| **Render** | `backend` | API |

---

## План роботи для команди — як почати

### 1. Отримай доступ

1. Попроси власника (`@tony-kobs`) додати тебе **Collaborator** у репо `moya-parta`.
2. PR можуть відкривати **лише collaborators**.
3. Merge у `master` — **тільки після ревʼю власника**.

### 2. Клонуй і постав залежності

```bash
git clone https://github.com/tony-kobs/moya-parta.git
cd moya-parta

cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 3. Env (локально)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

`backend/.env` (приклад):

```env
PORT=4000
JWT_SECRET=demo-digital-classroom-secret-key
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

> Секрети (`.env`, `.env.local`) у git **не комітимо**.

### 4. Запусти локально (два термінали)

```bash
# термінал 1
cd backend && npm run dev

# термінал 2
cd frontend && npm run dev
```

- Сайт: http://localhost:3000  
- API: http://localhost:4000/api/health  

### 5. Перевір демо

Пароль для всіх демо-акаунтів: **`demo1234`**

| Роль | Логін | Нотатка |
|------|-------|---------|
| Учень | `student@example.com` | уже в класі |
| Учитель | `teacher@example.com` | код класу `3B-DEMO` |

Новий учень: `/join/3B-DEMO`.

### 6. Як вносити зміни (щоденний ритм)

```text
1. git checkout master && git pull
2. git checkout -b feature/коротка-назва
3. Працюй у frontend/ або backend/
4. Перевір локально (обидва сервери)
5. git add → commit → push
6. Відкрий Pull Request у moya-parta
7. Дочекайся ревʼю власника → merge
8. Після merge: Vercel/Render самі задеплоять (якщо Git підключений до moya-parta)
```

**Правила команди**

- Не пуш напряму в `master` (окрім власника в екстрених випадках).
- Одна гілка ≈ одна зрозуміла задача.
- UI-тексти — українською, простою мовою.
- Не додаємо батьківський dashboard / school admin / рейтинги дітей без явного рішення в `PROJECT_CHAIN`.

### 7. Де дивитись «що вже є / що далі»

1. [`.cursor/PROJECT_CHAIN.md`](./.cursor/PROJECT_CHAIN.md) — актуальні рішення й inventory.  
2. [`presentation/index.html`](./presentation/index.html) — дерево: головна → учитель → учень.  
3. [`.cursor/ORIGINAL_PROMPT.md`](./.cursor/ORIGINAL_PROMPT.md) — початкове ТЗ (історія); **канон рішень** — лише PROJECT_CHAIN.

### 8. Якщо чіпаєш деплой

| Змінна | Де | Приклад |
|--------|-----|---------|
| `NEXT_PUBLIC_API_URL` | Vercel | `https://backend-myclassroom.onrender.com/api` |
| `CORS_ORIGIN` | Render | `https://moya-parta.vercel.app` (**без** `/` в кінці) |
| `JWT_SECRET` | Render | довгий унікальний рядок |
| Root Directory | Vercel / Render | `frontend` / `backend` |

Після зміни env — Redeploy відповідного сервісу.

---

## Стек

- **Frontend:** Next.js App Router, TypeScript, CSS Modules, TanStack Query, Zustand  
- **Backend:** Express, TypeScript, Zod, JWT (структура GoIT)  
- **Дані:** MySQL (`192.168.0.212`, БД `parta`) через Prisma; демо — `npm run prisma:seed` у `backend/`  

---

## Що вже вміє MVP (коротко)

**Учитель:** клас + invite, завдання/тести (база + свої), перевірка з коментарем, події (старт/кінець → ревʼю на дошку), чат, приховати пост, бейджі «нове».

**Учень:** Моя парта, клас/дошка, навчання (ДЗ, тести, квести), чат, події, перемоги/рюкзак, сповіщення.

Детальніше — у `PROJECT_CHAIN.md` і презентації.

---

## Корисні команди

```bash
npm run dev:backend      # з кореня монорепо
npm run dev:frontend
npm run build:backend
npm run build:frontend
```

Backend окремо:

```bash
cd backend && npm run build && npm start
```
