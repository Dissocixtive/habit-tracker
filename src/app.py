def calculate_streak(check_ins):
    """Серия (streak) выполнения привычки, максимум 365 дней."""
    streak = 0
    for done in reversed(check_ins):
        if not done:
            break
        streak += 1
    return min(streak, 365)
