import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { ASSETS_DIR } from '../../db.ts';

export const assetsRouter = Router();

// GET /api/assets/file/:filename
assetsRouter.get('/file/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const fullPath = path.join(ASSETS_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Image asset file not found.' });
  }
  const bytes = fs.readFileSync(fullPath);
  let mime = 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg';
  } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    mime = 'image/webp';
  }
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(bytes);
});
