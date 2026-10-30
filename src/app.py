def calculate_streak(habit_checkins):
    """Серия (streak) выполнения привычки, максимум 365 дней."""
    streak = 0
    for done in reversed(habit_checkins):
        if not done:
            break
        streak += 1
    streak = min(streak, 365)
    print(f"Текущая серия: {streak}")
    return streak
