"""Habit Tracker REST API and bundled web interface."""
import hashlib
import os
import secrets
import smtplib
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import Base, engine, get_db
from .models import Completion, Habit, PasswordReset, User
from .schemas import (HabitCreate, HabitOut, HabitStats, HabitUpdate, Login, ProfileUpdate,
                      Register, ResetConfirm, ResetRequest, Summary, TokenOut, UserOut)
from .security import create_token, get_current_user, hash_password, verify_password
from .stats import calendar, streaks

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title='Habit Tracker API', version='1.0.0', lifespan=lifespan)
allowed_origins = [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=False,
                   allow_methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], allow_headers=['Authorization', 'Content-Type'])

@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={'error': {'code': exc.status_code, 'message': exc.detail}})

@app.exception_handler(RequestValidationError)
async def invalid_input(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={'error': {'code': 422, 'message': 'Проверьте введённые данные',
        'details': [{'field': '.'.join(map(str, e['loc'])), 'message': e['msg']} for e in exc.errors()]}})


def owned_habit(db: Session, user_id: int, habit_id: int) -> Habit:
    habit = db.scalar(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    if habit is None:
        raise HTTPException(status_code=404, detail='Привычка не найдена')
    return habit


def completion_days(db: Session, habit_id: int) -> set[date]:
    return set(db.scalars(select(Completion.on_date).where(Completion.habit_id == habit_id)).all())


def habit_output(db: Session, habit: Habit, today: date) -> HabitOut:
    days = completion_days(db, habit.id)
    current, _ = streaks(days, today)
    return HabitOut(id=habit.id, title=habit.title, description=habit.description,
                    color=habit.color, reminder_time=habit.reminder_time,
                    completed_today=today in days, current_streak=current, total_completions=len(days))


@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'habit-tracker'}

@app.post('/api/auth/register', response_model=TokenOut, status_code=201)
def register(body: Register, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(status_code=409, detail='Этот email уже зарегистрирован')
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail='Этот email уже зарегистрирован')
    db.refresh(user)
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))

@app.post('/api/auth/login', response_model=TokenOut)
def login(body: Login, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Неправильный email или пароль')
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))

@app.get('/api/auth/me', response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user

@app.patch('/api/auth/me', response_model=UserOut)
def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.name = body.name.strip()
    db.commit()
    return user


def send_password_reset(email: str, token: str):
    host = os.getenv('SMTP_HOST')
    if not host:
        return False
    msg = EmailMessage()
    msg['From'] = os.getenv('SMTP_FROM', os.getenv('SMTP_USER', 'no-reply@example.com'))
    msg['To'] = email
    msg['Subject'] = 'Habit Tracker — восстановление пароля'
    base = os.getenv('APP_PUBLIC_URL', 'http://localhost:8000').rstrip('/')
    msg.set_content(f'Для сброса пароля откройте ссылку (действует 30 минут):\n{base}/?reset={token}\n\nЕсли это были не вы, проигнорируйте письмо.')
    with smtplib.SMTP(host, int(os.getenv('SMTP_PORT', '587')), timeout=15) as client:
        client.starttls()
        if os.getenv('SMTP_USER'):
            client.login(os.getenv('SMTP_USER'), os.getenv('SMTP_PASSWORD', ''))
        client.send_message(msg)
    return True

@app.post('/api/auth/password-reset/request')
def request_password_reset(body: ResetRequest, db: Session = Depends(get_db)):
    # Never reveal whether an account exists.
    response = {'message': 'Если адрес зарегистрирован и SMTP настроен, вы получите письмо.'}
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user and os.getenv('SMTP_HOST'):
        token = secrets.token_urlsafe(32)
        reset = PasswordReset(user_id=user.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                              expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30))
        db.add(reset)
        db.commit()
        try:
            send_password_reset(user.email, token)
        except (OSError, smtplib.SMTPException):
            # Do not expose infrastructure details or user existence.
            pass
    return response

@app.post('/api/auth/password-reset/confirm')
def confirm_password_reset(body: ResetConfirm, db: Session = Depends(get_db)):
    digest = hashlib.sha256(body.token.encode()).hexdigest()
    reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == digest))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if reset is None or reset.used_at is not None or reset.expires_at < now:
        raise HTTPException(status_code=400, detail='Ссылка недействительна или истекла')
    user = db.get(User, reset.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail='Ссылка недействительна или истекла')
    user.password_hash = hash_password(body.new_password)
    reset.used_at = now
    db.commit()
    return {'message': 'Пароль изменён. Войдите с новым паролем.'}

@app.get('/api/habits', response_model=list[HabitOut])
def list_habits(on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = on or date.today()
    habits = db.scalars(select(Habit).where(Habit.user_id == user.id).order_by(Habit.id.desc())).all()
    return [habit_output(db, habit, today) for habit in habits]

@app.post('/api/habits', response_model=HabitOut, status_code=201)
def add_habit(body: HabitCreate, on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = Habit(user_id=user.id, **body.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit_output(db, habit, on or date.today())

@app.get('/api/habits/{habit_id}', response_model=HabitOut)
def get_habit(habit_id: int, on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return habit_output(db, owned_habit(db, user.id, habit_id), on or date.today())

@app.patch('/api/habits/{habit_id}', response_model=HabitOut)
def edit_habit(habit_id: int, body: HabitUpdate, on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = owned_habit(db, user.id, habit_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(habit, key, value)
    db.commit()
    return habit_output(db, habit, on or date.today())

@app.delete('/api/habits/{habit_id}', status_code=204)
def delete_habit(habit_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_habit(db, user.id, habit_id))
    db.commit()

@app.put('/api/habits/{habit_id}/completions/{day}', response_model=HabitOut)
def mark_done(habit_id: int, day: date, on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = owned_habit(db, user.id, habit_id)
    if day > date.today() + timedelta(days=1):
        raise HTTPException(status_code=422, detail='Нельзя отмечать далёкие будущие даты')
    existing = db.scalar(select(Completion.id).where(Completion.habit_id == habit.id, Completion.on_date == day))
    if existing is None:
        db.add(Completion(habit_id=habit.id, on_date=day))
        db.commit()
    return habit_output(db, habit, on or day)

@app.delete('/api/habits/{habit_id}/completions/{day}', response_model=HabitOut)
def unmark_done(habit_id: int, day: date, on: date | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = owned_habit(db, user.id, habit_id)
    existing = db.scalar(select(Completion).where(Completion.habit_id == habit.id, Completion.on_date == day))
    if existing is not None:
        db.delete(existing)
        db.commit()
    return habit_output(db, habit, on or day)

@app.get('/api/habits/{habit_id}/stats', response_model=HabitStats)
def habit_stats(habit_id: int, days: int = Query(30, ge=1, le=365), on: date | None = None,
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    habit = owned_habit(db, user.id, habit_id)
    today = on or date.today()
    completed = completion_days(db, habit.id)
    current, longest = streaks(completed, today)
    dates = calendar(completed, today, days)
    return HabitStats(habit_id=habit.id, current_streak=current, longest_streak=longest,
                      total_completions=len(completed), completion_rate=round(sum(d['completed'] for d in dates) * 100 / days, 1), days=dates)

@app.get('/api/stats/summary', response_model=Summary)
def summary(days: int = Query(14, ge=1, le=365), on: date | None = None,
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = on or date.today()
    habits = db.scalars(select(Habit).where(Habit.user_id == user.id)).all()
    all_days = [completion_days(db, h.id) for h in habits]
    best_streak = max([streaks(dates, today)[0] for dates in all_days], default=0)
    start = today - timedelta(days=days - 1)
    graph = []
    for i in range(days):
        dt = start + timedelta(days=i)
        graph.append({'date': dt.isoformat(), 'count': sum(dt in dates for dates in all_days)})
    return Summary(total_habits=len(habits), completed_today=sum(today in d for d in all_days),
                   total_completions=sum(len(d) for d in all_days), best_streak=best_streak, days=graph)

# Serve web app and API together on one port, no frontend build tool required.
web_dir = Path(__file__).resolve().parents[2] / 'web'
if not web_dir.is_dir():
    web_dir = Path(__file__).resolve().parents[1] / 'web'  # Docker layout
if web_dir.is_dir():
    app.mount('/', StaticFiles(directory=web_dir, html=True), name='web')
