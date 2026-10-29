from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app

@pytest.fixture
def client(tmp_path):
    db_engine = create_engine(f'sqlite:///{tmp_path}/test.db', connect_args={'check_same_thread': False})
    @event.listens_for(db_engine, 'connect')
    def enable_fks(connection, record):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(db_engine)
    session = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    def override():
        with session() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    db_engine.dispose()

def signup(c, email='user@example.com'):
    res = c.post('/api/auth/register', json={'email': email, 'name': 'Тест', 'password': 'secure12345'})
    assert res.status_code == 201, res.text
    return {'Authorization': 'Bearer ' + res.json()['access_token']}

def test_register_login_and_profile(client):
    res = client.get('/api/habits')
    assert res.status_code == 401
    headers = signup(client)
    assert client.post('/api/auth/register', json={'email':'user@example.com','name':'x','password':'secure12345'}).status_code == 409
    login = client.post('/api/auth/login', json={'email':'user@example.com','password':'secure12345'})
    assert login.status_code == 200
    assert client.post('/api/auth/login', json={'email':'user@example.com','password':'wrong'}).status_code == 401
    assert client.get('/api/auth/me', headers=headers).json()['name'] == 'Тест'
    assert client.patch('/api/auth/me', headers=headers, json={'name':'Обновлено'}).json()['name'] == 'Обновлено'

def test_habit_crud_and_isolation(client):
    h1 = signup(client)
    h2 = signup(client, 'second@example.com')
    added = client.post('/api/habits', headers=h1, json={'title': 'Вода', 'color':'#123456', 'reminder_time': '09:00'})
    assert added.status_code == 201, added.text
    hid = added.json()['id']
    assert client.get('/api/habits', headers=h2).json() == []
    assert client.get(f'/api/habits/{hid}', headers=h2).status_code == 404
    assert client.patch(f'/api/habits/{hid}', headers=h2, json={'title':'Украсть'}).status_code == 404
    assert client.delete(f'/api/habits/{hid}', headers=h2).status_code == 404
    assert client.put(f'/api/habits/{hid}/completions/2026-10-01', headers=h2).status_code == 404
    assert client.patch(f'/api/habits/{hid}', headers=h1, json={'title':'Вода 2','reminder_time': None}).json()['reminder_time'] is None
    assert client.get(f'/api/habits/{hid}', headers=h1).json()['title'] == 'Вода 2'
    assert client.post('/api/habits', headers=h1, json={'title': 'X', 'color':'red'}).status_code == 422
    assert client.delete(f'/api/habits/{hid}', headers=h1).status_code == 204
    assert client.get(f'/api/habits/{hid}', headers=h1).status_code == 404

def test_completions_streak_and_statistics(client):
    headers = signup(client)
    hid = client.post('/api/habits', headers=headers, json={'title':'Читать'}).json()['id']
    today = date.today()
    days = [(today - timedelta(days=i)).isoformat() for i in (1,2,3,6)]
    for dt in days:
        assert client.put(f'/api/habits/{hid}/completions/{dt}', headers=headers).status_code == 200
    # duplicate daily mark should not create duplicates
    assert client.put(f'/api/habits/{hid}/completions/{days[0]}', headers=headers).status_code == 200
    res = client.get(f'/api/habits/{hid}/stats?days=7&on={today.isoformat()}', headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()['current_streak'] == 3
    assert res.json()['longest_streak'] == 3
    assert res.json()['total_completions'] == 4
    assert sum(d['completed'] for d in res.json()['days']) == 4
    assert client.put(f'/api/habits/{hid}/completions/{today}', headers=headers).json()['current_streak'] == 4
    assert client.get('/api/stats/summary', headers=headers).json()['completed_today'] == 1
    assert client.delete(f'/api/habits/{hid}/completions/{today}', headers=headers).json()['completed_today'] is False
    assert client.get(f'/api/habits/{hid}/stats?days=999', headers=headers).status_code == 422

def test_password_reset_request_not_enumerating_users(client):
    signup(client)
    r1 = client.post('/api/auth/password-reset/request', json={'email':'user@example.com'})
    r2 = client.post('/api/auth/password-reset/request', json={'email':'missing@example.com'})
    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json()
    assert client.post('/api/auth/password-reset/confirm', json={'token':'invalid-token-very-long-string', 'new_password':'newpassword999'}).status_code == 400
