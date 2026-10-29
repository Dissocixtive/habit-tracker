'use strict';
const app = document.getElementById('app');
const toastNode = document.getElementById('toast');
const colors = ['#a491ff', '#5bd8ae', '#ffbe85', '#ff84aa', '#74b9ff', '#ffd36b'];
const state = { token: localStorage.getItem('ht_token') || '', user: null, habits: [], stats: null, tab: 'home', authMode: 'login', modal: null, editId: null, selectedHabit: null, loading: false };
const pad = value => String(value).padStart(2, '0');
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
if (params.has('reset')) state.authMode = 'reset';

function notice(message, bad=false) {
  toastNode.textContent = message;
  toastNode.style.background = bad ? '#573144' : '#323e53';
  toastNode.classList.add('visible');
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => toastNode.classList.remove('visible'), 3800);
}
async function api(path, { method='GET', body, auth=true }={}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try { response = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new Error('Нет соединения с сервером. Проверьте подключение.'); }
  if (response.status === 204) return null;
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || 'Ошибка запроса');
  return json;
}
async function refresh() {
  const on = localDay();
  const [habits, stats] = await Promise.all([api('/habits?on=' + on), api('/stats/summary?days=14&on=' + on)]);
  state.habits = habits; state.stats = stats;
}
async function load() {
  if (!state.token) { render(); return; }
  try { state.user = await api('/auth/me'); await refresh(); render(); }
  catch (e) { if (/авторизац|токен|пользователь/i.test(e.message)) logout(); else { notice(e.message, true); render(); } }
}
function logout() { state.token = ''; state.user = null; localStorage.removeItem('ht_token'); render(); }
const emoji = name => /вод|drink/i.test(name) ? '💧' : /чтени|книг|read/i.test(name) ? '📚' : /бег|спорт|трен|work/i.test(name) ? '🏃' : /сон|спать|sleep/i.test(name) ? '🌙' : /уч|язык/i.test(name) ? '🧠' : '✦';
const weekDays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
function authScreen() {
  let title = 'С возвращением!', desc = 'Войдите, чтобы продолжить свой прогресс.';
  if (state.authMode === 'register') {title = 'Начни сегодня';desc = 'Первый шаг к устойчивым привычкам.';}
  if (state.authMode === 'forgot') {title = 'Забыли пароль?';desc = 'Отправим ссылку для восстановления на вашу почту.';}
  if (state.authMode === 'reset') {title = 'Новый пароль';desc = 'Придумайте новый надёжный пароль.';}
  const register = state.authMode === 'register', login = state.authMode === 'login', forgot = state.authMode === 'forgot', reset = state.authMode === 'reset';
  return `<div class="auth-layout"><section class="auth-visual"><div class="brand"><div class="brand-symbol">✓</div>habit tracker</div><div><div class="eyebrow">Маленькие шаги · Большие перемены</div><h1>Каждый день — твоя новая победа.</h1><p>Сохраняй хорошие привычки, отмечай достижения и смотри, как растёт твой прогресс.</p></div><div class="art"><div style="font-weight:800;font-size:20px">Твой сегодняшний день ☀️</div><div class="artrow">✓ &nbsp; Стакан воды</div><div class="artrow">✓ &nbsp; Чтение 20 минут</div><div class="artrow" style="opacity:.55">◯ &nbsp; Вечерняя прогулка</div></div></section><section class="auth-side"><div class="auth-box"><div class="eyebrow">HABIT TRACKER</div><h2>${title}</h2><p>${desc}</p><form id="auth-form" autocomplete="on">${register?'<div class="form-group"><label>Имя</label><input class="field" name="name" required maxlength="100" placeholder="Как к вам обращаться?" autocomplete="name"></div>':''}${reset?'':`<div class="form-group"><label>Email</label><input class="field" type="email" name="email" required placeholder="name@example.com" autocomplete="email"></div>`}${(!forgot)?`<div class="form-group"><label>${reset?'Новый пароль':'Пароль'}</label><input class="field" type="password" name="password" required minlength="${login?1:8}" placeholder="${login?'Ваш пароль':'Не менее 8 символов'}" autocomplete="${login?'current-password':'new-password'}"></div>`:''}<button class="btn" type="submit">${login?'Войти':register?'Создать аккаунт':forgot?'Отправить письмо':'Сохранить пароль'} →</button></form>${login?'<p style="text-align:right;margin:12px 0"><button class="text-button" data-auth="forgot">Забыли пароль?</button></p>':''}<div class="auth-swap">${register?'Уже есть аккаунт? <button data-auth="login">Войти</button>':login?'Нет аккаунта? <button data-auth="register">Зарегистрироваться</button>':'<button data-auth="login">Вернуться ко входу</button>'}</div><p class="small-note" style="margin-top:25px">Данные доступны только вашему аккаунту.</p></div></section></div>`;
}
function nav() {
  return `<aside class="sidebar"><div class="brand"><div class="brand-symbol">✓</div>habit tracker</div><nav class="nav"><button data-tab="home" class="${state.tab==='home'?'active':''}"><span class="ico">▦</span>Обзор</button><button data-tab="stats" class="${state.tab==='stats'?'active':''}"><span class="ico">▥</span>Статистика</button><button data-tab="profile" class="${state.tab==='profile'?'active':''}"><span class="ico">♙</span>Профиль</button><button id="logout"><span class="ico">↪</span>Выйти</button></nav><div class="sidebar-foot">Каждый день имеет значение.<br>Версия 1.0 · Habit Tracker</div></aside>`;
}
function statCard(ico, val, label) {return `<div class="stat-card"><div class="stat-icon">${ico}</div><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`;}
function chart() {
  const values = state.stats?.days || [];
  const max = Math.max(1,...values.map(v=>v.count));
  return `<div class="chart" aria-label="Количество завершённых привычек за последние 14 дней">${values.map(d=>`<div class="chart-col" title="${escapeHtml(d.date)}: ${d.count}"><div class="chart-bar" style="height:${Math.max(5,d.count/max*165)}px;${d.count?'':'opacity:.28'}"></div><span>${new Date(d.date+'T12:00:00').getDate()}</span></div>`).join('')}</div><p class="small-note">Каждый столбец — количество выполненных привычек за день.</p>`;
}
function habitCard(h) {
  return `<article class="habit-card"><div class="habit-symbol" style="background:${escapeHtml(h.color)}29;color:${escapeHtml(h.color)}">${emoji(h.title)}</div><div class="habit-info"><div class="habit-title">${escapeHtml(h.title)}</div><div class="habit-desc">${escapeHtml(h.description || 'Ещё один шаг к твоей цели')}</div><div class="habit-meta"><span class="pill fire">🔥 ${h.current_streak} дн. подряд</span>${h.reminder_time?`<span class="pill">◷ ${escapeHtml(h.reminder_time)}</span>`:''}<span class="pill">✓ ${h.total_completions}</span></div><div class="habit-options"><button class="icon-btn" data-edit="${h.id}" title="Редактировать" aria-label="Редактировать">✎</button><button class="icon-btn" data-detail="${h.id}" title="Статистика" aria-label="Статистика">▥</button><button class="icon-btn" data-delete="${h.id}" title="Удалить" aria-label="Удалить">×</button></div></div><button class="done-toggle ${h.completed_today?'done':''}" data-toggle="${h.id}" title="${h.completed_today?'Отменить отметку':'Отметить сегодня'}" aria-label="${h.completed_today?'Отменить отметку':'Отметить сегодня'}">${h.completed_today?'✓':''}</button></article>`;
}
function dashboard() {
 const stats=state.stats||{total_habits:0,completed_today:0,total_completions:0,best_streak:0,days:[]};
 const percent = stats.total_habits ? Math.round(stats.completed_today/stats.total_habits*100):0;
 const greeting = new Date().getHours()<12?'Доброе утро':new Date().getHours()<18?'Добрый день':'Добрый вечер';
 return `<section class="hero"><div><div class="eyebrow">Ежедневный прогресс</div><h1>${greeting}, ${escapeHtml((state.user?.name||'друг').split(' ')[0])}! ✨</h1><p class="subtext">Продолжай в своём темпе. Даже маленький шаг имеет значение.</p></div><button class="btn" data-new="1">＋ Добавить привычку</button></section><section class="stats-grid">${statCard('✦',stats.total_habits,'Активных привычек')}${statCard('✓',stats.completed_today,'Выполнено сегодня')}${statCard('🔥',stats.best_streak,'Лучшая текущая серия')}${statCard('◈',stats.total_completions,'Всего отметок')}</section><section class="section-head"><h2>Мои привычки</h2><span>${stats.completed_today} из ${stats.total_habits} сегодня</span></section>${state.habits.length?`<section class="habit-grid">${state.habits.map(habitCard).join('')}</section>`:`<div class="empty"><div class="emoji">🌱</div><h3>Начни с одной привычки</h3><p>Создай первую привычку и отмечай выполнение каждый день.</p><button class="btn" data-new="1">＋ Создать привычку</button></div>`}<section class="split"><div class="panel"><h3>Твой прогресс за 14 дней</h3><div class="muted">Немного каждый день — уже большой результат.</div>${chart()}</div><div class="panel"><h3>Сегодняшняя цель</h3><div class="muted">Двигайся к 100% постепенно.</div><div class="progress-ring" style="--progress:${percent}%"><div class="progress-inner"><strong>${percent}%</strong><span>выполнено</span></div></div><p class="ring-caption">${stats.completed_today} из ${stats.total_habits} привычек завершено сегодня.<br>У тебя всё получится!</p></div></section>`;
}
function statsScreen(){
 const stats=state.stats||{};
 return `<div class="eyebrow">Аналитика</div><h1>Статистика прогресса 📊</h1><p class="subtext">Наглядно о твоих ежедневных действиях.</p><section class="stats-grid">${statCard('🔥',stats.best_streak||0,'Лучшая текущая серия')}${statCard('✓',stats.total_completions||0,'Всего отметок')}${statCard('◉',stats.completed_today||0,'Отметок сегодня')}${statCard('✦',stats.total_habits||0,'Привычек')}</section><div class="panel"><h3>Активность за две недели</h3>${chart()}</div><div class="section-head"><h2>Статистика по привычкам</h2></div>${state.habits.length?`<div class="habit-grid">${state.habits.map(habitCard).join('')}</div>`:'<div class="empty">Добавь привычки, чтобы увидеть статистику.</div>'}`;
}
function profileScreen(){
 return `<div class="eyebrow">Настройки</div><h1>Мой профиль</h1><p class="subtext">Информация о твоём аккаунте.</p><div class="panel settings-panel" style="margin-top:26px"><div class="profile-row"><span class="profile-round">👤</span><div><h3 style="margin:0">${escapeHtml(state.user.name)}</h3><span class="muted">${escapeHtml(state.user.email)}</span></div></div><form id="profile-form"><div class="form-group"><label>Имя</label><input class="field" required name="name" maxlength="100" value="${escapeHtml(state.user.name)}"></div><div class="form-group"><label>Email (не редактируется)</label><input class="field" disabled value="${escapeHtml(state.user.email)}"></div><button class="btn">Сохранить изменения</button></form></div>`;
}
function modal(){
 if (!state.modal) return '';
 if(state.modal==='habit') {
  const h=state.habits.find(x=>x.id===state.editId);
  const selected=h?.color || colors[0];
  return `<div class="modal-wrap" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Привычка"><div class="modal-head"><h2>${h?'Редактировать':'Новая привычка'}</h2><button class="icon-btn" data-close="1">×</button></div><p class="muted" style="margin-top:10px">Заполни карточку, чтобы видеть прогресс каждый день.</p><form id="habit-form"><div class="form-group"><label>Название *</label><input class="field" name="title" maxlength="100" required autofocus placeholder="Например, читать 20 минут" value="${escapeHtml(h?.title||'')}"></div><div class="form-group"><label>Описание</label><textarea class="field" name="description" maxlength="500" placeholder="Почему эта привычка важна?">${escapeHtml(h?.description||'')}</textarea></div><div class="form-group"><label>Время напоминания (для приложения на телефоне)</label><input class="field" type="time" name="reminder_time" value="${escapeHtml(h?.reminder_time||'')}"></div><div class="form-group"><label>Цвет</label><div class="color-swatches">${colors.map(c=>`<button type="button" class="swatch ${c===selected?'selected':''}" style="background:${c}" data-color="${c}" aria-label="Выбрать цвет ${c}"></button>`).join('')}</div><input type="hidden" name="color" value="${selected}"></div><button class="btn">${h?'Сохранить':'Создать привычку'}</button></form></div></div>`;
 }
 if(state.modal==='detail') {
  const h=state.habits.find(x=>x.id===state.selectedHabit?.habit_id);
  const d=state.selectedHabit;
  if(!d) return '';
  return `<div class="modal-wrap" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Статистика привычки"><div class="modal-head"><h2>${escapeHtml(h?.title||'Привычка')}</h2><button class="icon-btn" data-close="1">×</button></div><div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">${statCard('🔥',d.current_streak,'Текущая серия')}${statCard('🏆',d.longest_streak,'Лучшая серия')}${statCard('✓',d.total_completions,'Всего отметок')}${statCard('◴',d.completion_rate+'%','За 28 дней')}</div><h3>Последние 28 дней</h3><div class="heatmap">${d.days.map(day=>`<div title="${day.date}" class="heat-day ${day.completed?'checked':''}">${new Date(day.date+'T12:00:00').getDate()}</div>`).join('')}</div><p class="small-note">Зелёным отмечены дни выполнения.</p><button class="btn light" data-close="1">Закрыть</button></div></div>`;
 }
 return '';
}
function render(){
 if(!state.user){app.innerHTML=authScreen();return;}
 const label=state.tab==='home'?'Обзор':state.tab==='stats'?'Статистика':'Профиль';
 const dateLabel=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'});
 app.innerHTML=`<div class="shell">${nav()}<main class="main"><header class="topbar"><div class="breadcrumbs">Главная / ${label}</div><div class="top-actions"><span class="date-chip">◷ ${escapeHtml(dateLabel)}</span><span class="avatar">${escapeHtml(state.user.name[0]?.toUpperCase()||'?')}</span></div></header>${state.tab==='home'?dashboard():state.tab==='stats'?statsScreen():profileScreen()}</main></div>${modal()}`;
}
async function run(promise){ try { await promise; } catch(e){notice(e.message||'Ошибка',true);} }
async function handleAuth(form){
 const f=new FormData(form);
 if(state.authMode==='forgot') {const r=await api('/auth/password-reset/request',{method:'POST',body:{email:f.get('email')},auth:false});notice(r.message);state.authMode='login';render();return;}
 if(state.authMode==='reset') {const r=await api('/auth/password-reset/confirm',{method:'POST',body:{token:params.get('reset'),new_password:f.get('password')},auth:false});notice(r.message);history.replaceState({},'',location.pathname);state.authMode='login';render();return;}
 const path=state.authMode==='register'?'/auth/register':'/auth/login';
 const body={email:f.get('email'),password:f.get('password')};if(state.authMode==='register')body.name=f.get('name');
 const data=await api(path,{method:'POST',body,auth:false});state.token=data.access_token;state.user=data.user;localStorage.setItem('ht_token',state.token);await refresh();state.tab='home';render();notice('Добро пожаловать!');
}
async function saveHabit(form){
 const f=new FormData(form);
 const body={title:f.get('title').trim(),description:f.get('description').trim(),color:f.get('color'),reminder_time:f.get('reminder_time')||null};
 if(!body.title)throw new Error('Введите название привычки');
 const existing=state.editId;
 await api(existing?`/habits/${existing}`:'/habits',{method:existing?'PATCH':'POST',body});
 state.modal=null;state.editId=null;await refresh();render();notice(existing?'Привычка обновлена':'Привычка создана ✨');
}
document.addEventListener('submit',e=>{
 if(!['auth-form','habit-form','profile-form'].includes(e.target.id))return;
 e.preventDefault();const form=e.target;const btn=form.querySelector('button[type="submit"],button.btn');if(btn)btn.disabled=true;
 run((async()=>{try{if(form.id==='auth-form')await handleAuth(form);else if(form.id==='habit-form')await saveHabit(form);else {const name=new FormData(form).get('name');state.user=await api('/auth/me',{method:'PATCH',body:{name}});render();notice('Профиль обновлён');}}finally{if(btn)btn.disabled=false;}})());
});
document.addEventListener('click',e=>{
 const target=e.target.closest('button');
 if(e.target.id==='modal-backdrop'){state.modal=null;render();return;}
 if(!target)return;
 if(target.dataset.auth){state.authMode=target.dataset.auth;render();return;}
 if(target.id==='logout'){logout();return;}
 if(target.dataset.tab){state.tab=target.dataset.tab;render();return;}
 if(target.dataset.new){state.editId=null;state.modal='habit';render();return;}
 if(target.dataset.close){state.modal=null;render();return;}
 if(target.dataset.color){const form=target.closest('form');form.querySelector('input[name=color]').value=target.dataset.color;form.querySelectorAll('.swatch').forEach(x=>x.classList.toggle('selected',x===target));return;}
 if(target.dataset.edit){state.editId=Number(target.dataset.edit);state.modal='habit';render();return;}
 if(target.dataset.toggle){const id=Number(target.dataset.toggle),h=state.habits.find(x=>x.id===id);if(!h)return;
  target.disabled=true;run((async()=>{await api(`/habits/${id}/completions/${localDay()}?on=${localDay()}`,{method:h.completed_today?'DELETE':'PUT'});await refresh();render();notice(h.completed_today?'Отметка отменена':'Отличная работа! ✓');})());return;}
 if(target.dataset.delete){const id=Number(target.dataset.delete);if(!confirm('Удалить привычку и всю историю отметок?'))return;run((async()=>{await api(`/habits/${id}`,{method:'DELETE'});await refresh();render();notice('Привычка удалена');})());return;}
 if(target.dataset.detail){const id=Number(target.dataset.detail);run((async()=>{state.selectedHabit=await api(`/habits/${id}/stats?days=28&on=${localDay()}`);state.modal='detail';render();})());return;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal){state.modal=null;render();}});
load();
