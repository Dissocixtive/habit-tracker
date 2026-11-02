import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import practice5_api


@pytest.fixture(autouse=True)
def clean_state():
    practice5_api._habits.clear()
    practice5_api._next_id = 1
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_create_habit(client):
    response = client.post("/habits", json={"name": "Morning run"})
    assert response.status_code == 201
    assert response.json()["name"] == "Morning run"
    assert response.json()["id"] == 1


def test_empty_name(client):
    response = client.post("/habits", json={"name": ""})
    assert response.status_code == 422


def test_list_habits(client):
    client.post("/habits", json={"name": "Reading"})
    client.post("/habits", json={"name": "Running"})

    response = client.get("/habits")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_streak(client):
    client.post("/habits", json={"name": "Reading"})

    for done in [True, False, True, True]:
        client.post("/habits/1/checkins", json={"done": done})

    response = client.get("/habits/1/streak")
    assert response.status_code == 200
    assert response.json()["streak"] == 2


def test_unknown_habit(client):
    response = client.get("/habits/999/streak")
    assert response.status_code == 404


def test_empty_streak(client):
    client.post("/habits", json={"name": "Water"})

    response = client.get("/habits/1/streak")
    assert response.status_code == 200
    assert response.json()["streak"] == 0
