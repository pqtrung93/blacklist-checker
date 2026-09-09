import db from './db.js';

export interface Score {
  scam_reports: number;
  clean_reports: number;
  total: number;
  points: number; // 0..100 scam likelihood
}

export function scoreFor(blacklistId: number): Score {
  const row = db.prepare(
    `SELECT
       SUM(CASE WHEN verdict = 'scam' THEN 1 ELSE 0 END) AS scam,
       SUM(CASE WHEN verdict = 'clean' THEN 1 ELSE 0 END) AS clean,
       COUNT(*) AS total
     FROM reports WHERE blacklist_id = ?`,
  ).get(blacklistId) as { scam: number | null; clean: number | null; total: number };

  const scam = row.scam ?? 0;
  const clean = row.clean ?? 0;
  const total = row.total;
  if (total === 0) return { scam_reports: 0, clean_reports: 0, total: 0, points: 0 };

  // scam ratio, nudged: every scam report adds 20, clean subtracts 15, clamped 0..100
  const points = Math.max(0, Math.min(100, Math.round(20 * scam - 15 * clean + (100 * scam) / total * 0.2)));
  return { scam_reports: scam, clean_reports: clean, total, points };
}
