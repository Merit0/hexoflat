export function corsOptions() {
  return {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Player-Session'],
  };
}
