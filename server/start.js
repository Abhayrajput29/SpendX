process.env.NODE_ENV = 'production';

try {
  const { startServer } = await import('./server.js');
  await startServer();
} catch (error) {
  console.error('Unable to start server:', error.message);
  process.exitCode = 1;
}
