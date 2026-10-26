const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'];
const PRODUCTION_ORIGINS = ['https://readinghub-1.onrender.com'];

export function validateEnvironment() {
  const required = process.env.NODE_ENV === 'production'
    ? [...REQUIRED_VARS, 'FRONTEND_URL']
    : REQUIRED_VARS;
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production');
  }

  if (process.env.FRONTEND_URL) {
    const frontendUrl = new URL(process.env.FRONTEND_URL);
    if (!['http:', 'https:'].includes(frontendUrl.protocol) || frontendUrl.pathname !== '/') {
      throw new Error('FRONTEND_URL must be an HTTP(S) origin without a path');
    }
  }

  const port = Number(process.env.PORT || 5001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return { port };
}

export function getAllowedOrigins() {
  const configured = [
    ...PRODUCTION_ORIGINS,
    process.env.FRONTEND_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',')
  ]
    .map((origin) => origin?.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:3000', 'http://localhost:5173');
  }

  return new Set(configured);
}
