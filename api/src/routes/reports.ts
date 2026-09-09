import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { scoreFor, type Score } from '../score.js';

const router = Router();

interface ReportBody {
  phone?: string;
  name?: string;
  address?: string;
  email?: string;
  comment: string;
  verdict: 'scam' | 'clean';
  platform?: string;
}

interface ReportRow {
  id: number;
  blacklist_id: number;
  comment: string;
  verdict: string;
  platform: string | null;
  created_at: string;
  b_phone: string | null;
  b_name: string | null;
  b_address: string | null;
}

function findEntry(phone?: string, name?: string, address?: string): { id: number } | null {
  if (phone) {
    const r = db.prepare('SELECT id FROM blacklist WHERE phone = ?').get(phone);
    if (r) return r as { id: number };
  }
  if (name) {
    const r = db.prepare('SELECT id FROM blacklist WHERE lower(name) = ?').get(name.toLowerCase());
    if (r) return r as { id: number };
  }
  if (address) {
    const r = db.prepare('SELECT id FROM blacklist WHERE lower(address) = ?').get(address.toLowerCase());
    if (r) return r as { id: number };
  }
  return null;
}

// GET /api/v1/reports?reports=1            → recent reports feed (popup)
// GET /api/v1/reports/history              → recent check_log rows (popup)
// GET /api/v1/reports?phone=09xx           → comment thread + score for one subject
router.get('/', (req: Request, res: Response) => {
  const q = req.query as { phone?: string; name?: string; address?: string; reports?: string };

  if (q.reports === '1') {
    const rows = db.prepare(
      `SELECT r.id, r.comment, r.verdict, r.platform, r.created_at,
              b.phone AS b_phone, b.name AS b_name
       FROM reports r JOIN blacklist b ON b.id = r.blacklist_id
       ORDER BY r.created_at DESC LIMIT 100`,
    ).all() as ReportRow[];
    res.json({ data: rows });
    return;
  }

  const entry = findEntry(q.phone, q.name, q.address);
  if (!entry) {
    res.json({ data: [], score: { scam_reports: 0, clean_reports: 0, total: 0, points: 0 }, entry: null });
    return;
  }
  const comments = db.prepare(
    'SELECT id, comment, verdict, platform, created_at FROM reports WHERE blacklist_id = ? ORDER BY created_at DESC',
  ).all(entry.id);
  res.json({ data: comments, score: scoreFor(entry.id), entry });
});

// GET /api/v1/reports/history
router.get('/history', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT id, query, matched, created_at FROM check_log ORDER BY id DESC LIMIT 50').all() as Array<{
    id: number; query: string; matched: number; created_at: string;
  }>;
  const data = rows.map((r) => ({
    id: r.id,
    query: JSON.parse(r.query) as Record<string, string>,
    matched: !!r.matched,
    created_at: r.created_at,
  }));
  res.json({ data });
});

// POST /api/v1/reports — add comment/verdict; auto-creates blacklist entry if new
router.post('/', (req: Request, res: Response) => {
  const body = req.body as ReportBody;
  const { comment, verdict } = body;

  if (!comment || !comment.trim()) {
    res.status(400).json({ error: 'comment required' });
    return;
  }
  if (verdict !== 'scam' && verdict !== 'clean') {
    res.status(400).json({ error: "verdict must be 'scam' | 'clean'" });
    return;
  }
  if (!body.phone && !body.name && !body.address && !body.email) {
    res.status(400).json({ error: 'At least one identifier required' });
    return;
  }

  let entryId: number;
  const existing = findEntry(body.phone, body.name, body.address);
  if (existing) {
    entryId = existing.id;
  } else {
    const r = db.prepare(
      'INSERT INTO blacklist (phone, name, address, email, reason, severity, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(body.phone ?? null, body.name ?? null, body.address ?? null, body.email ?? null,
      comment.trim().slice(0, 140), 'medium', 'extension');
    entryId = Number(r.lastInsertRowid);
  }

  const r2 = db.prepare(
    'INSERT INTO reports (blacklist_id, comment, verdict, platform) VALUES (?, ?, ?, ?)',
  ).run(entryId, comment.trim(), verdict, body.platform ?? null);

  res.status(201).json({ id: r2.lastInsertRowid, blacklist_id: entryId, score: scoreFor(entryId) });
});

export default router;
