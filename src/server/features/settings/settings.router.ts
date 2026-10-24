import { Router } from 'express';
import { settingsRepo } from './settings.repo.ts';
import { getUsers, logAuditEvent } from '../../db.ts';

export const settingsRouter = Router();

function resolveActorUser(req: any) {
  const userIdHeader = req.headers['x-user-id'];
  const userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : 'editor-chief';
  const users = getUsers();
  return users.find((u) => u.id === userId) || users[0];
}

// 1. GET /api/settings
settingsRouter.get('/', (_req, res) => {
  return res.json({ settings: settingsRepo.get() });
});

// 2. PATCH /api/settings
settingsRouter.patch('/', (req, res) => {
  const actor = resolveActorUser(req);
  const updated = settingsRepo.update(req.body || {});
  logAuditEvent(actor.id, 'settings', '1', 'publication_settings_updated', req.body || {});
  return res.json({ settings: updated });
});
