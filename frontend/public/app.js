const API = '/api';

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(`Ошибка ${res.status}: ${data.error || 'сервис недоступен'}`);
    throw new Error(data.error);
  }
  return data;
}

// Статус каждого микросервиса + имя пода (реплики), который ответил.
// Обновляется каждые 3 секунды — видно балансировку и восстановление.
const SERVICES = ['users', 'categories', 'tasks'];

async function checkHealth() {
  const parts = await Promise.all(SERVICES.map(async s => {
    try {
      const r = await fetch(`${API}/${s}/health`);
      if (!r.ok) throw new Error();
      const h = await r.json();
      return `<span class="ok">${s}: ${h.pod}</span>`;
    } catch {
      return `<span class="down">${s}: offline</span>`;
    }
  }));
  document.getElementById('apiStatus').innerHTML = parts.join('');
}

async function loadCategories() {
  const cats = await api('/categories');
  const list = document.getElementById('catList');
  const select = document.getElementById('taskCategory');
  list.innerHTML = '';
  select.innerHTML = '<option value="">— категория —</option>';
  cats.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${c.name}</span>`;
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = '✕';
    del.onclick = async () => { await api(`/categories/${c.id}`, { method: 'DELETE' }); loadCategories(); loadTasks(); };
    li.appendChild(del);
    list.appendChild(li);
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    select.appendChild(opt);
  });
}

async function loadUsers() {
  const users = await api('/users');
  const list = document.getElementById('userList');
  const select = document.getElementById('taskUser');
  list.innerHTML = '';
  select.innerHTML = '<option value="">— исполнитель —</option>';
  users.forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${u.name} <span class="meta">${u.email}</span></span>`;
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = '✕';
    del.onclick = async () => { await api(`/users/${u.id}`, { method: 'DELETE' }); loadUsers(); loadTasks(); };
    li.appendChild(del);
    list.appendChild(li);
    const opt = document.createElement('option');
    opt.value = u.id; opt.textContent = u.name;
    select.appendChild(opt);
  });
}

async function loadTasks() {
  const tasks = await api('/tasks');
  const list = document.getElementById('taskList');
  list.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    if (t.status === 'done') li.classList.add('done');
    const meta = [t.user_name && `исполнитель: ${t.user_name}`, t.category_name && `категория: ${t.category_name}`]
      .filter(Boolean).join(' · ');
    li.innerHTML = `<span>${t.title} <span class="meta">${meta}</span></span>`;
    const actions = document.createElement('span');
    if (t.status !== 'done') {
      const done = document.createElement('button');
      done.className = 'ghost';
      done.textContent = '✓';
      done.onclick = async () => { await api(`/tasks/${t.id}/complete`, { method: 'PATCH' }); loadTasks(); };
      actions.appendChild(done);
    }
    const del = document.createElement('button');
    del.className = 'ghost';
    del.textContent = '✕';
    del.onclick = async () => { await api(`/tasks/${t.id}`, { method: 'DELETE' }); loadTasks(); };
    actions.appendChild(del);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

document.getElementById('catForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('catName').value;
  await api('/categories', { method: 'POST', body: JSON.stringify({ name }) });
  e.target.reset();
  loadCategories();
};

document.getElementById('userForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('userName').value;
  const email = document.getElementById('userEmail').value;
  await api('/users', { method: 'POST', body: JSON.stringify({ name, email }) });
  e.target.reset();
  loadUsers();
};

document.getElementById('taskForm').onsubmit = async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value;
  const user_id = document.getElementById('taskUser').value || null;
  const category_id = document.getElementById('taskCategory').value || null;
  await api('/tasks', { method: 'POST', body: JSON.stringify({ title, user_id, category_id }) });
  e.target.reset();
  loadTasks();
};

checkHealth();
setInterval(checkHealth, 3000);
loadCategories().catch(() => {});
loadUsers().catch(() => {});
loadTasks().catch(() => {});
