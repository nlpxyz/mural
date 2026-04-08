import app from './app';
import { getEnv } from './schemas/env';

const env = getEnv();

const server = app.listen(env.PORT, () => {
  console.log(`mural-service running on port ${env.PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
