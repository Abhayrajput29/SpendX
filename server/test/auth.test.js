import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, createToken } from '../middleware/auth.js';

test('createToken produces an accepted bearer token', () => {
  const token = createToken();
  let nextCalled = false;
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status: () => ({ json: () => {} }) };

  authenticate(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.userId, 'default-user');
});

test('authenticate rejects missing credentials', () => {
  let nextCalled = false;
  const req = { headers: {} };
  const response = { statusCode: 0, body: null };
  const res = {
    status(code) {
      response.statusCode = code;
      return { json(body) { response.body = body; } };
    }
  };

  authenticate(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
});
