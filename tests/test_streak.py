from src.app import calculate_streak


def test_empty_checkins():
    assert calculate_streak([]) == 0


def test_all_completed():
    assert calculate_streak([True, True, True]) == 3


def test_streak_interrupted():
    assert calculate_streak([True, False, True, True]) == 2


def test_streak_capped_at_365():
    assert calculate_streak([True] * 400) == 365
