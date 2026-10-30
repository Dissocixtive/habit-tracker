def calculate_streak(check_ins):
    """Возвращает текущую серию (streak) выполнения привычки."""
    streak = 0
    for done in reversed(check_ins):
        if not done:
            break
        streak += 1
    return streak
