import math
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .streak import calculate_streak

router = APIRouter(tags=["Practice 5 - Habits"])


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CheckInCreate(BaseModel):
    done: bool


class Habit(BaseModel):
    id: int
    name: str
    check_ins: list[bool] = Field(default_factory=list)


class StreakOut(BaseModel):
    habit_id: int
    streak: int


_habits: dict[int, Habit] = {}
_next_id = 1


def get_habit_or_404(habit_id: int) -> Habit:
    habit = _habits.get(habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.post("/habits", response_model=Habit, status_code=201)
def create_habit(payload: HabitCreate):
    global _next_id
    habit = Habit(id=_next_id, name=payload.name)
    _habits[habit.id] = habit
    _next_id += 1
    return habit


@router.get("/habits", response_model=list[Habit])
def list_habits():
    return list(_habits.values())


@router.post("/habits/{habit_id}/checkins", response_model=Habit)
def add_check_in(habit_id: int, payload: CheckInCreate):
    habit = get_habit_or_404(habit_id)
    habit.check_ins.append(payload.done)
    return habit


@router.get("/habits/{habit_id}/streak", response_model=StreakOut)
def get_streak(habit_id: int):
    habit = get_habit_or_404(habit_id)
    return StreakOut(
        habit_id=habit_id,
        streak=calculate_streak(habit.check_ins),
    )
