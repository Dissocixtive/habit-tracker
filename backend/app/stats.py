from datetime import date, timedelta

def streaks(completed: set[date], today: date) -> tuple[int, int]:
    current = 0
    cursor = today if today in completed else today - timedelta(days=1)
    while cursor in completed:
        current += 1
        cursor -= timedelta(days=1)
    longest = 0
    run = 0
    previous = None
    for day in sorted(completed):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return current, longest


def calendar(completed: set[date], today: date, days: int):
    start = today - timedelta(days=days-1)
    dates = [start + timedelta(days=i) for i in range(days)]
    return [{'date': day, 'completed': day in completed} for day in dates]
