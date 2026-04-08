// Vercel serverless entry point.
// Vercel's @vercel/node runtime calls this as an HTTP handler — it does not
// call app.listen(), so we simply export the Express app as the default export.
import app from '../src/app';

export default app;
