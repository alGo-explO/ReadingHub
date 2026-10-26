import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.get('authorization');
  const [scheme, token] = authHeader?.split(' ') || [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'readinghub-api',
      audience: process.env.JWT_AUDIENCE || 'readinghub-web'
    });

    if (typeof payload !== 'object' || typeof payload.userId !== 'string') {
      throw new jwt.JsonWebTokenError('Invalid token payload');
    }

    req.userId = payload.userId;
    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default authenticateToken;
