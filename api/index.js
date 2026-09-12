import { app, connectDB } from '../server/server.js';

/**
 * Vercel Serverless Function entry point
 * Wraps Express application with lazy, cached MongoDB connection
 */
export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.warn('MongoDB connection warning during invocation:', err?.message || err);
  }
  return app(req, res);
}
