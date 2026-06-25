import { Router } from 'express';
import { pushOps, pullSince } from '../../db/sync.js';

export function syncRouter(db) {
  const r = Router();
  r.post('/push', (req, res) => {
    const { ops } = req.body;
    if (!Array.isArray(ops)) return res.status(400).json({ error: 'ops must be an array' });
    res.json(pushOps(db, ops));
  });
  r.get('/pull', (req, res) => {
    const since = req.query.since != null ? String(req.query.since) : null;
    res.json(pullSince(db, since));
  });
  return r;
}
