import crypto from 'crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.AUTH_SECRET || 'change-this-development-secret';
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createToken() {
  const payload = Buffer.from(JSON.stringify({
    sub: 'default-user',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  const [payload, signature] = token ? token.split('.') : [];
  const expected = payload ? sign(payload) : '';
  if (scheme !== 'Bearer' || !payload || !signature || signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: 'Authentication token expired' });
    }
    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

export function login(req, res) {
  const configuredPassword = process.env.APP_PASSWORD;
  if (!configuredPassword) {
    return res.status(503).json({ error: 'Set APP_PASSWORD in server/.env before signing in' });
  }
  if (typeof req.body?.password !== 'string' || req.body.password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const supplied = Buffer.from(req.body.password);
  const expected = Buffer.from(configuredPassword);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.json({ token: createToken() });
}