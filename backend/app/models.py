from datetime import datetime, timezone, date
from sqlalchemy import ForeignKey, String, Date, DateTime, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(256))
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    habits: Mapped[list['Habit']] = relationship(back_populates='owner', cascade='all, delete-orphan')

class Habit(Base):
    __tablename__ = 'habits'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default='')
    color: Mapped[str] = mapped_column(String(7), default='#7c6df2')
    reminder_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    owner: Mapped[User] = relationship(back_populates='habits')
    completions: Mapped[list['Completion']] = relationship(back_populates='habit', cascade='all, delete-orphan')

class Completion(Base):
    __tablename__ = 'completions'
    __table_args__ = (UniqueConstraint('habit_id', 'on_date', name='unique_habit_day'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey('habits.id', ondelete='CASCADE'), index=True)
    on_date: Mapped[date] = mapped_column(Date, index=True)
    habit: Mapped[Habit] = relationship(back_populates='completions')

class PasswordReset(Base):
    __tablename__ = 'password_resets'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
