from datetime import date
from typing import Annotated
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
import re

Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]

class Register(BaseModel):
    email: EmailStr
    password: Password
    name: str = Field(min_length=1, max_length=100)

class Login(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class ResetRequest(BaseModel):
    email: EmailStr

class ResetConfirm(BaseModel):
    token: str = Field(min_length=20)
    new_password: Password

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    name: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserOut

class HabitBase(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=500)
    color: str = '#7c6df2'
    reminder_time: str | None = None

    @field_validator('color')
    @classmethod
    def valid_color(cls, value):
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            raise ValueError('Цвет должен быть в формате #RRGGBB')
        return value

    @field_validator('reminder_time')
    @classmethod
    def valid_reminder(cls, value):
        if value is not None and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
            raise ValueError('Время должно быть в формате HH:MM')
        return value

class HabitCreate(HabitBase):
    pass

class HabitUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = None
    reminder_time: str | None = None

    @field_validator('color')
    @classmethod
    def valid_color(cls, value):
        if value is not None and not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
            raise ValueError('Цвет должен быть в формате #RRGGBB')
        return value

    @field_validator('reminder_time')
    @classmethod
    def valid_reminder(cls, value):
        if value is not None and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
            raise ValueError('Время должно быть в формате HH:MM')
        return value

class HabitOut(HabitBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    completed_today: bool = False
    current_streak: int = 0
    total_completions: int = 0

class DayOut(BaseModel):
    date: date
    completed: bool

class HabitStats(BaseModel):
    habit_id: int
    current_streak: int
    longest_streak: int
    total_completions: int
    completion_rate: float
    days: list[DayOut]

class Summary(BaseModel):
    total_habits: int
    completed_today: int
    total_completions: int
    best_streak: int
    days: list[dict]
