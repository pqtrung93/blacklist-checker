import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { scoreFor } from '../score.js';
import type { CheckRequest, CheckResult, CheckMatch, BlacklistEntry } from '../types.js';

const router = Router();

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

router.post('/', (req: Request, res: Response) => {
  const body = req.body as CheckRequest;
  const { phone, name, address, email } = body;

  if (!phone && !name && !address && !email) {
    res.status(400).json({ error: 'At least one field required' });
    return;
  }

  const all = db.prepare('SELECT * FROM blacklist').all() as BlacklistEntry[];

  const matches: CheckMatch[] = [];

  for (const entry of all) {
    const matched_fields: string[] = [];

    // Phone: exact match on normalized digits
    if (phone && entry.phone) {
      if (normalizePhone(phone) === normalizePhone(entry.phone)) {
        matched_fields.push('phone');
      }
    }

    // Name: partial match, case-insensitive
    if (name && entry.name) {
      const q = normalizeName(name);
      const e = normalizeName(entry.name);
      if (e.includes(q) || q.includes(e)) {
        matched_fields.push('name');
      }
    }

    // Address: partial match, case-insensitive
    if (address && entry.address) {
      const q = address.toLowerCase().trim();
      const e = entry.address.toLowerCase().trim();
      if (e.includes(q) || q.includes(e)) {
        matched_fields.push('address');
      }
    }

    // Email: exact match, case-insensitive
    if (email && entry.email) {
      if (email.toLowerCase() === entry.email.toLowerCase()) {
        matched_fields.push('email');
      }
    }

    if (matched_fields.length > 0) {
      matches.push({ entry, matched_fields });
    }
  }

  const result: CheckResult = {
    matched: matches.length > 0,
    matches,
  };

  db.prepare('INSERT INTO check_log (query, matched) VALUES (?, ?)')
    .run(JSON.stringify(body), matches.length > 0 ? 1 : 0);
  const topScore = matches.length
    ? scoreFor(matches[0]!.entry.id).points
    : 0;

  res.json({ ...result, score: topScore });
});

export default router;
