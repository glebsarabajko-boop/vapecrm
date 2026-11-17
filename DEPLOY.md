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
4. На экране импорта: **Build and Output Settings → Build Command → Override →** впиши
   `npm run build` — это обязательно: стандартная команда Vercel (`next build`) пропустила бы
   генерацию Prisma-клиента и миграции базы
5. Нажми **Create Project** — первый деплой **упадёт с ошибкой** (базы ещё нет), это нормально
6. Vercel предложит «Optional Integrations» — **ничего не добавляй** (особенно «Prisma Postgres»:
   это не Neon, а проксируемая база с особым подключением, не совместима с нашей сборкой)
7. В проекте: вкладка **Storage** → **Create Database** → выбери **Neon** → тариф **Free** → Create
8. Vercel сам создаст аккаунт Neon, базу и подключит переменную `DATABASE_URL` к проекту

**Альтернатива:** зарегистрироваться на [neon.tech](https://neon.tech) отдельно
(тоже через GitHub), создать проект → Dashboard → «Connection Details».

## 2. Добавить переменную DIRECT_URL

Neon даёт две строки подключения: пулед (для сайта) и прямую (для миграций).
`DATABASE_URL` Vercel подставит сам, а вторую добавь вручную:

1. В проекте Vercel: **Storage → твоя Neon-база** → Connection Details (вкладка `.env.local`) →
   проще всего скопировать значение переменной **`DATABASE_URL_UNPOOLED`** — это и есть прямая
   строка (хост **без** `-pooler`). Альтернатива: Neon Dashboard → «Connection Details» →
   режим **Direct connection**
2. **Settings → Environment Variables → Add:**
   - Name: `DIRECT_URL`
   - Value: эта прямая строка (формат `postgresql://…@ep-…(без pooler)…/neondb?sslmode=require`)
   - Environments: **Production, Preview, Development**

Итоговый набор переменных проекта:

| Переменная | Откуда | Куда | Что делает |
|---|---|---|---|
| `DATABASE_URL` | Neon (пулед, хост с `-pooler`) | Vercel + локальный `.env` | работа сайта с базой |
| `DIRECT_URL` | Neon (прямая, без `-pooler`) | Vercel + локальный `.env` | миграции схемы при сборке |
| `TELEGRAM_BOT_TOKEN` | @BotFather (уже в `.env`) | Vercel + локальный `.env` | токен Telegram-бота |
| `TELEGRAM_WEBHOOK_SECRET` | случайная строка из `.env` | Vercel + локальный `.env` | защита webhook от подделки апдейтов |
| `CRON_SECRET` | случайная строка из `.env` | Vercel + локальный `.env` | защита ежедневного cron-а уведомлений |

## 3. Telegram-бот в облаке (24/7, без твоего компьютера)

Бот работает через **webhook**: Telegram сам шлёт каждое сообщение на
`https://<домен>/api/telegram/webhook`, Vercel обрабатывает и отвечает. Ничего
запускать у себя не нужно — бот живёт на сервере постоянно.

После первого успешного деплоя зарегистрируй ссылку у Telegram (один раз):

```bash
node scripts/set-webhook.mjs https://vapecrm.vercel.app
```

Скрипт возьмёт токен и секрет из `.env` и покажет статус (`getWebhookInfo`).
При смене домена — просто выполни ещё раз с новым адресом.

Что делает бот в облаке:
- отвечает клиентам: `/status`, `/book`, привязка телефона через `/start`
- рассылает уведомления: «ремонт готов», «давно не забираете», «пора сменить картридж»
  (сразу после действий в CRM + ежедневно в 15:00 по Минску через Vercel Cron)

Локальная отладка бота: закомментируй `TELEGRAM_WEBHOOK_SECRET` в `.env` и
перезапусти `npm run dev` — бот запустится поллингом. После правок верни секрет
и снова выполни `set-webhook` (иначе прод будет молчать).

## 4. Первый деплой

**Deployments** → в упавшем деплое нажми ⋯ → **Redeploy**.

Сборка автоматически: `prisma generate` → `prisma migrate deploy` (создаёт все таблицы
в пустой базе Neon) → `next build`. Через ~2 минуты сайт доступен на адресе вида
`vapecrm-…vercel.app`.

## 5. Заполнить базу (один раз)

Локально вставь те же две строки в `.env` проекта (вместо плейсхолдеров), затем:

```bash
npm run db:seed     # пользователи admin/master, демо-товары, справочник совместимости
```

Вход на проде: `admin` / `admin123`, `master` / `master123`.

## 6. Дальше — просто работай

| Действие | Что произойдёт |
|---|---|
| `git push` в `main` | Vercel пересоберёт и выкатит новую версию (~2 мин) |
| `git push` в другую ветку | preview-ссылка для проверки, прод не затронут |
| Pull Request | preview-ссылка в PR |
| Изменение `prisma/schema.prisma` | сгенерируй миграцию (ниже) — применится при следующем деплое |
| Смена домена деплоя | повтори `node scripts/set-webhook.mjs https://новый-домен` |

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
| Бот молчит | 1) `TELEGRAM_BOT_TOKEN` добавлен в Vercel? 2) выполнен `node scripts/set-webhook.mjs https://домен`? 3) смотри `last_error_message` в выводе скрипта или в логах деплоя |
| Бот отвечает, но уведомления не приходят | проверь `https://домен/api/telegram/pump` из браузера: `{"ok":true,"sent":0}` — значит очередь пуста; если 403 — не задан `CRON_SECRET` |
| Клиент пишет боту, тишина | `getWebhookInfo` (показывает set-webhook) → поле `last_error_message`; часто причина — не заданы переменные в Vercel |
| Пулед-строка в Vercel не совпадает с твоей | Neon в маркетплейсе Vercel подставляет `DATABASE_URL` сам — не меняй её, только добавь `DIRECT_URL` |
