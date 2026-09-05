process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../server');

describe('Health check', () => {
  it('GET /api/health -> 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Users CRUD', () => {
  let userId;

  it('CREATE user', async () => {
    const res = await request(app).post('/api/users').send({ name: 'Alice', email: 'alice@test.dev' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    userId = res.body.id;
  });

  it('READ all users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('READ one user', async () => {
    const res = await request(app).get(`/api/users/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.dev');
  });

  it('UPDATE user', async () => {
    const res = await request(app).put(`/api/users/${userId}`).send({ name: 'Alice Cooper' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Cooper');
  });

  it('DELETE user (rejected FK cases covered elsewhere) - creates disposable user', async () => {
    const created = await request(app).post('/api/users').send({ name: 'Temp', email: 'temp@test.dev' });
    const res = await request(app).delete(`/api/users/${created.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('Categories CRUD', () => {
  let catId;

  it('CREATE category', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Work' });
    expect(res.status).toBe(201);
    catId = res.body.id;
  });

  it('READ all categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });

  it('READ one category', async () => {
    const res = await request(app).get(`/api/categories/${catId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Work');
  });

  it('UPDATE category', async () => {
    const res = await request(app).put(`/api/categories/${catId}`).send({ name: 'Personal' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Personal');
  });

  it('DELETE category', async () => {
    const created = await request(app).post('/api/categories').send({ name: 'Temp Cat' });
    const res = await request(app).delete(`/api/categories/${created.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('Tasks CRUD + filters + complete', () => {
  let taskId, userId, catId;

  beforeAll(async () => {
    const u = await request(app).post('/api/users').send({ name: 'Bob', email: 'bob@test.dev' });
    userId = u.body.id;
    const c = await request(app).post('/api/categories').send({ name: 'Study' });
    catId = c.body.id;
  });

  it('CREATE task', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: 'Write report', description: 'Lab CI/CD', user_id: userId, category_id: catId,
    });
    expect(res.status).toBe(201);
    taskId = res.body.id;
  });

  it('READ all tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
  });

  it('READ one task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Write report');
  });

  it('UPDATE task', async () => {
    const res = await request(app).put(`/api/tasks/${taskId}`).send({ title: 'Write CI/CD report' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Write CI/CD report');
  });

  it('FILTER tasks by category', async () => {
    const res = await request(app).get(`/api/tasks?category=${catId}`);
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.category_id === catId)).toBe(true);
  });

  it('FILTER tasks by user', async () => {
    const res = await request(app).get(`/api/tasks?user=${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.every(t => t.user_id === userId)).toBe(true);
  });

  it('PATCH complete task', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('DELETE task', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Temp task' });
    const res = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('Comments CRUD (nested under tasks)', () => {
  let taskId, commentId;

  beforeAll(async () => {
    const t = await request(app).post('/api/tasks').send({ title: 'Task with comments' });
    taskId = t.body.id;
  });

  it('CREATE comment', async () => {
    const res = await request(app).post(`/api/tasks/${taskId}/comments`).send({ text: 'First comment' });
    expect(res.status).toBe(201);
    commentId = res.body.id;
  });

  it('READ comments for task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('DELETE comment', async () => {
    const res = await request(app).delete(`/api/comments/${commentId}`);
    expect(res.status).toBe(204);
  });
});

describe('Negative cases', () => {
  it('404 on missing user', async () => {
    const res = await request(app).get('/api/users/999999');
    expect(res.status).toBe(404);
  });

  it('400 on invalid task creation', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.status).toBe(400);
  });
});
