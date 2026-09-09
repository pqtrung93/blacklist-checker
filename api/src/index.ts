import express from 'express';
import cors from 'cors';
import checkRouter from './routes/check.js';
import blacklistRouter from './routes/blacklist.js';
import reportsRouter from './routes/reports.js';

const app = express();
const PORT = process.env['PORT'] ?? '7070';

app.use(cors());
app.use(express.json());

app.use('/api/check', checkRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/v1/reports', reportsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(parseInt(PORT, 10), () => {
  console.log(`Blacklist API running on port ${PORT}`);
});
