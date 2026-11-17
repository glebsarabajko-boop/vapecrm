# Деплой VapeCRM: Vercel + Neon (бесплатно)

Как это устроено после настройки:

```
git push → GitHub → Vercel автоматически пересобирает сайт → миграции БД → новая версия онлайн
```

Никаких ручных шагов при обычной работе: изменил код → `git push` → через ~2 минуты
новая версия сайта доступна. Это и есть непрерывное развертывание (CI/CD).

---

## 1. Создать базу данных (Neon Postgres, бесплатный тариф)

База хранит все данные ЦРМ в облаке — доступны с любого устройства, не привязаны к компу.

**Простой путь — прямо из панели Vercel (рекомендую):**

1. Зайди на [vercel.com](https://vercel.com) → **Continue with GitHub** (вход через GitHub-аккаунт)
2. Дай Vercel доступ к репозиториям
3. **Add New… → Project** → найди `vapecrm` → **Import**
4. На странице импорта пока **ничего не деплой** — сначала база:
   вкладка **Storage** → **Create Database** → выбери **Neon** → тариф **Free** → Create
5. Vercel сам создаст аккаунт Neon, базу и подключит переменную `DATABASE_URL` к проекту

**Альтернатива:** зарегистрироваться на [neon.tech](https://neon.tech) отдельно
(тоже через GitHub), создать проект → Dashboard → «Connection Details».

## 2. Добавить переменную DIRECT_URL

Neon даёт две строки подключения: пулед (для сайта) и прямую (для миграций).
`DATABASE_URL` Vercel подставит сам, а вторую добавь вручную:

1. В проекте Vercel: **Storage → твоя Neon-база** → `.env.local` tab (или в Neon Dashboard
   → «Connection Details» → **Direct connection**) — найди строку с хостом **без** `-pooler`
2. **Settings → Environment Variables → Add:**
   - Name: `DIRECT_URL`
   - Value: эта прямая строка (формат `postgresql://…@ep-…(без pooler)…/neondb?sslmode=require`)
   - Environments: **Production, Preview, Development**

Итоговый набор переменных проекта:

| Переменная | Откуда | Куда | Что делает |
|---|---|---|---|
| `DATABASE_URL` | Neon (пулед, хост с `-pooler`) | Vercel + локальный `.env` | работа сайта с базой |
| `DIRECT_URL` | Neon (прямая, без `-pooler`) | Vercel + локальный `.env` | миграции схемы при сборке |

⚠️ `TELEGRAM_BOT_TOKEN` в Vercel **не добавляем** — бот на проде не запускается
(serverless не умеет long polling). Бот работает локально: `npm run bot`.

## 3. Первый деплой

Вернись в **Deployments** → **Redeploy** (или нажми Deploy, если не деплоил после импорта).

Сборка автоматически: `prisma generate` → `prisma migrate deploy` (создаёт все таблицы
в пустой базе Neon) → `next build`. Через ~2 минуты сайт доступен на адресе вида
`vapecrm-…vercel.app`.

## 4. Заполнить базу (один раз)

Локально вставь те же две строки в `.env` проекта (вместо плейсхолдеров), затем:

```bash
npm run db:seed     # пользователи admin/master, демо-товары, справочник совместимости
```

Вход на проде: `admin` / `admin123`, `master` / `master123`.

## 5. Дальше — просто работай

| Действие | Что произойдёт |
|---|---|
| `git push` в `main` | Vercel пересоберёт и выкатит новую версию (~2 мин) |
| `git push` в другую ветку | preview-ссылка для проверки, прод не затронут |
| Pull Request | preview-ссылка в PR |
| Изменение `prisma/schema.prisma` | сгенерируй миграцию (ниже) — применится при следующем деплое |

**Новая миграция после изменения схемы:**

```bash
npx prisma migrate dev --name суть_изменения   # создаст файл в prisma/migrations
git add prisma/migrations && git commit -m "…" && git push
# миграция применится к базе сама на этапе сборки в Vercel
```

## Частые проблемы

| Проблема | Решение |
|---|---|
| Сборка падает: `Environment variable not found: DIRECT_URL` | не добавлена переменная (см. шаг 2) |
| Сборка падает: `Can't reach database server` | строки подключения скопированы не полностью; в конце должно быть `?sslmode=require` |
| Сборка падает: `P1001` / таймаут подключения | перепутаны пулед и прямая строки местами (в DIRECT_URL хост должен быть **без** `-pooler`) |
| Сайт отдаёт 500 | смотри логи: Vercel → Project → Deployments → в деплое → Runtime Logs |
| Бот молчит на проде | так и задумано: на Vercel он выключен, запусти локально `npm run bot` |
| Пулед-строка в Vercel не совпадает с твоей | Neon в маркетплейсе Vercel подставляет `DATABASE_URL` сам — не меняй её, только добавь `DIRECT_URL` |
