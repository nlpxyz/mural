import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './lib/middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

// An immediate response endpoint to check if the server is running
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Mount all routes
app.use('/', routes);

app.use(errorHandler);

export default app;
