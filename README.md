# Цифровий світ класу

Закрите цифрове середовище для учнів 1–4 класів і їхнього вчителя.

> «У кожного є своя парта. У кожного є своє місце в класі.»

## Хто в екосистемі

- **Учитель** — реєструється, створює клас, ділиться кодом/посиланням
- **Учень** — заходить за кодом класу і привʼязується до вчителя

Батьків і шкільного адміна в MVP немає як окремих кабінетів.

**Батьки (варіант A):** допомагають дитині зайти за кодом класу на етапі реєстрації. Окремого батьківського режиму немає.

School Admin не потрібен, поки вчитель сам володіє своїм класом.

## Як працює доступ

1. Вчитель реєструється на `/register`
2. Створює клас (наприклад, `3-Б`)
3. Отримує код на кшталт `3B-K7M2` і посилання `/join/3B-K7M2`
4. Учні переходять за посиланням або вводять код на `/join`
5. Реєструються (імʼя, логін, пароль, аватар) і потрапляють у клас

## Структура

```text
/
├── frontend/       # Next.js (App Router) + TypeScript + CSS Modules
├── backend/        # Express + TypeScript (routes → controllers → services)
├── presentation/   # Дерево продукту для команди
└── .cursor/        # Ланцюг рішень і правила агента
```

## GitHub

- **Монорепо (уся папка):** https://github.com/tony-kobs/moya-parta
- Окремо для деплою:
  - Backend: https://github.com/tony-kobs/backend-myclassroom
  - Frontend: https://github.com/tony-kobs/frontend-myclassroom

## Швидкий старт

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

- App: http://localhost:3000
- API: http://localhost:4000

## Demo

Пароль: `demo1234`

| Роль | Логін | Код класу |
|------|-------|-----------|
| Учень (Марійка) | student@example.com | уже в класі |
| Учитель | teacher@example.com | `3B-DEMO` |

Новий учень може зайти на `/join/3B-DEMO` і зареєструватися в демо-клас.

## Environment

Скопіюй приклади:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### backend/.env
```env
PORT=4000
JWT_SECRET=demo-digital-classroom-secret-key
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

### frontend/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
