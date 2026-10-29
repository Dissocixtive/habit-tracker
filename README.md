# Habit Tracker — приложение для отслеживания привычек

Учебный полнофункциональный прототип по практической работе **Agile / Scrum / Kanban в Jira**. Репозиторий соответствует основным задачам из эпиков E1–E5: backend, веб-дашборд, мобильный клиент и тесты.

## Возможности

- Регистрация и вход по email и паролю; JWT для защищённых маршрутов.
- Просмотр и редактирование имени пользователя.
- Создание, просмотр, изменение и удаление привычек (REST API).
- Отметка выполнения на конкретную дату, повторная отметка не создаёт дубль.
- Текущая и самая длинная непрерывная серия (streak), статистика за 14/28/30 дней, графики.
- Веб-интерфейс (адаптивная вёрстка) с карточками, цветами и графиками.
- Мобильный клиент на React Native/Expo: вход, привычки, отметки, графики, расписание **локальных** уведомлений по времени.
- Восстановление пароля через email, **если настроен SMTP-сервер**.
- SQLite для локальной разработки, Docker Compose, тесты на pytest.

> Это рабочий исходный код для учебного проекта. Он не загружен на облачный сервер и ещё не опубликован в App Store/Google Play. Программный код не автоматически закрывает карточки Jira — статусы в Jira обновляются отдельно.

## Структура

```text
habit-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI: маршруты авторизации, привычек, статистики
│   │   ├── models.py     # SQLAlchemy: User, Habit, Completion, PasswordReset
│   │   ├── schemas.py    # Проверка входных данных и схемы ответов
│   │   ├── security.py   # Пароли PBKDF2, JWT
│   │   ├── stats.py      # Расчёт streak
│   │   └── db.py         # Настройка SQLite
│   ├── tests/            # Автотесты API
│   └── requirements.txt
├── web/                  # Веб-дашборд без сборки: HTML/CSS/JS
├── mobile/               # React Native + Expo
├── compose.yaml          # Запуск веба и API через Docker
└── .env.example          # Пример настроек
```

## Быстрый старт: Windows (без Docker)

Требуется **Python 3.11+**. Самый простой способ: распакуй архив и запусти **`start_windows.bat`** двойным кликом. При первом запуске он установит зависимости, создаст локальный секрет и поднимет сервер. Затем открой **http://localhost:8000**.

Если удобнее запускать вручную, открой PowerShell в папке `habit-tracker` и выполни:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:JWT_SECRET = python -c "import secrets; print(secrets.token_urlsafe(48))"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Если PowerShell запрещает активацию скриптов, можно вообще не активировать окружение:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:JWT_SECRET = python -c "import secrets; print(secrets.token_urlsafe(48))"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Открой **http://localhost:8000/** — регистрация и интерфейс уже готовы. API-документация: **http://localhost:8000/docs**.

Для macOS/Linux можно запустить `./start_linux_mac.sh`. Или вручную: `python3 -m venv .venv && source .venv/bin/activate`, затем такие же `pip install` и `uvicorn`, а секрет укажи командой `export JWT_SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')`.

В SQLite-файле `backend/habit_tracker.db` будут храниться твои пользователи и отметки. Не добавляй его в git.

## Быстрый старт: Docker

Нужен установленный Docker Desktop / Docker Engine. Из корня проекта:

```bash
cp .env.example .env
# ОБЯЗАТЕЛЬНО замени JWT_SECRET на длинное случайное значение
# python -c "import secrets; print(secrets.token_urlsafe(48))"
docker compose up --build
```

В Windows скопируй `.env.example` в `.env` через Проводник или `Copy-Item .env.example .env` и измени JWT_SECRET. После запуска — **http://localhost:8000**. Данные хранятся в отдельном Docker volume, не теряются при перезапуске.

## Тесты

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Тесты охватывают регистрацию, вход, ошибки авторизации, изоляцию пользователей, CRUD привычек, отметки, серии, статистику и защиту от раскрытия существования email при восстановлении пароля.

## Запуск мобильной версии (Android/iOS)

Требуются **Node.js 22+**, приложение **Expo Go** на телефоне или эмулятор и запущенный backend.

1. Убедись, что телефон и компьютер в **одной Wi-Fi сети**. Посмотри локальный IP компьютера командой `ipconfig` (Windows) / `ip addr` (Linux).
2. В папке `mobile` скопируй `.env.example` в `.env` и замени `192.168.1.10` на локальный IP твоего компьютера. Это важно: `localhost` на настоящем телефоне указывает на сам телефон, а не на компьютер.
3. Выполни:

```bash
cd mobile
npm install
npx expo install expo-notifications @react-native-async-storage/async-storage
npx expo install --fix
npm start
```

4. Сканируй QR-код через Expo Go. На Android-эмуляторе используй `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api`. Если Expo Go не поддерживает установленную версию SDK, используй совместимую версию Expo Go или development build.
5. Зарегистрируйся тем же email/паролем, что и в веб-версии: **оба клиента используют одну базу данных**. Создай привычку с временем напоминания, затем в разделе «Профиль» нажми «Разрешить уведомления».

### Об уведомлениях

Мобильная версия использует **локальные ежедневные уведомления** (`expo-notifications`), запланированные на устройстве. Они могут работать без интернета после синхронизации. Это не удалённая отправка через Firebase/APNs; для настоящих серверных push, отправляемых в фоне из облака, потребуется отдельная инфраструктура и настройки платформ.

### Восстановление пароля

Сервер поддерживает `/api/auth/password-reset/request` и `/api/auth/password-reset/confirm`. Чтобы реально отправлять письма, заполни SMTP-переменные и `APP_PUBLIC_URL` в окружении сервера. Без SMTP запрос безопасно возвращает нейтральный ответ, но письмо не доставляется. Не используй открытый SMTP без TLS.

## Основные API-методы

| Метод и путь | Назначение |
|---|---|
| POST `/api/auth/register` | Регистрация |
| POST `/api/auth/login` | Авторизация, выдача JWT |
| GET/PATCH `/api/auth/me` | Профиль |
| POST `/api/auth/password-reset/request` | Запрос ссылки для сброса |
| POST `/api/auth/password-reset/confirm` | Установка нового пароля |
| GET/POST `/api/habits` | Список и создание привычки |
| GET/PATCH/DELETE `/api/habits/{id}` | Получить, изменить, удалить |
| PUT/DELETE `/api/habits/{id}/completions/{date}` | Отметить / отменить выполнение |
| GET `/api/habits/{id}/stats?days=30` | Серии и дневная статистика |
| GET `/api/stats/summary?days=14` | Сводные графики |
| GET `/api/health` | Проверка сервера |

Формат ошибки: `{"error":{"code":404,"message":"Привычка не найдена"}}`.

## Ограничения и дальнейшая работа

- Проект предназначен для учебной работы и локального запуска. Для публичного продакшна нужны HTTPS, rate limiting, аудит безопасности, миграции БД, резервное копирование, безопасная конфигурация токенов и отдельная production-база (например PostgreSQL).
- В веб-версии JWT находится в `localStorage` (для учебной демонстрации); для публичной системы следует пересмотреть модель хранения сессий и защиту от XSS.
- Синхронизация между вебом и телефоном происходит через общее API при наличии соединения. Офлайн-редактирование с разрешением конфликтов пока не реализовано.
- Мобильные локальные напоминания надо проверять на реальном устройстве: возможность и точность доставки зависят от настроек ОС.

## Связь с Jira

- **E1:** регистрация, вход JWT, профиль, сброс пароля (при настройке SMTP).
- **E2:** CRUD, отметки по датам, streak, агрегированная статистика, обработка ошибок.
- **E3:** формы входа и регистрации, список привычек, редактирование, график, адаптивная вёрстка.
- **E4:** экран отметки в мобильной версии, локальные напоминания, синхронизация с API.
- **E5:** структура репозитория, конфигурация Docker, pytest и инструкции.

Для отчёта о разработке можно продемонстрировать рабочую веб-версию в браузере, страницу `/docs`, вывод тестов и мобильный экран Expo.

## Git practical work
This branch demonstrates fast-forward merge.
