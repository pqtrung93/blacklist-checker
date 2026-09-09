import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import type { BlacklistEntry, CreateEntryRequest, ListQuery } from '../types.js';

const router = Router();

// GET /api/blacklist?page=1&limit=50&q=keyword
router.get('/', (req: Request, res: Response) => {
  const { page = '1', limit = '50', q } = req.query as ListQuery;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let rows: BlacklistEntry[];
  let total: number;

  if (q) {
    const like = `%${q.toLowerCase()}%`;
    rows = db.prepare(`
      SELECT * FROM blacklist
      WHERE lower(phone) LIKE ? OR lower(name) LIKE ? OR lower(address) LIKE ? OR lower(email) LIKE ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(like, like, like, like, limitNum, offset) as BlacklistEntry[];
    const row = db.prepare(`
      SELECT COUNT(*) as cnt FROM blacklist
      WHERE lower(phone) LIKE ? OR lower(name) LIKE ? OR lower(address) LIKE ? OR lower(email) LIKE ?
    `).get(like, like, like, like) as { cnt: number };
    total = row.cnt;
  } else {
    rows = db.prepare('SELECT * FROM blacklist ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limitNum, offset) as BlacklistEntry[];
    const row = db.prepare('SELECT COUNT(*) as cnt FROM blacklist').get() as { cnt: number };
    total = row.cnt;
  }

  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

// POST /api/blacklist
router.post('/', (req: Request, res: Response) => {
  const body = req.body as CreateEntryRequest;

  if (!body.phone && !body.name && !body.address && !body.email) {
    res.status(400).json({ error: 'At least one identifier field required' });
    return;
  }
  if (!body.reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const stmt = db.prepare(`
    INSERT INTO blacklist (phone, name, address, email, reason, severity, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    body.phone ?? null,
    body.name ?? null,
    body.address ?? null,
    body.email ?? null,
    body.reason,
    body.severity ?? 'medium',
    body.added_by ?? 'manual',
  );

  const entry = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(result.lastInsertRowid) as BlacklistEntry;
  res.status(201).json(entry);
});

// DELETE /api/blacklist/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params['id'] ?? '', 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const existing = db.prepare('SELECT id FROM blacklist WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  db.prepare('DELETE FROM blacklist WHERE id = ?').run(id);
  res.status(204).send();
});

// GET /api/blacklist/export — CSV
router.get('/export', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM blacklist ORDER BY created_at DESC').all() as BlacklistEntry[];

  const header = 'id,phone,name,address,email,reason,severity,created_at,added_by';
  const lines = rows.map(r =>
    [r.id, r.phone ?? '', r.name ?? '', r.address ?? '', r.email ?? '', r.reason, r.severity, r.created_at, r.added_by]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="blacklist.csv"');
  res.send([header, ...lines].join('\n'));
});

export default router;
