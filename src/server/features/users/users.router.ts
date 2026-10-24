import { Router } from 'express';
import { usersRepo } from './users.repo.ts';
import { logAuditEvent } from '../../db.ts';
import { syncUserToSupabase, removeUserFromSupabase } from '../../supabase.ts';

export const usersRouter = Router();
export const authRouter = Router();

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const jsonPayload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function setSessionCookie(res: any, userId: string) {
  // Session cookie (expires when browser closes; permanently avoids lingering local storage)
  res.setHeader('Set-Cookie', `pv_user_id=${encodeURIComponent(userId)}; Path=/; SameSite=Lax; HttpOnly`);
}

function clearSessionCookie(res: any) {
  res.setHeader('Set-Cookie', `pv_user_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly`);
}

// 1. GET /api/users - List all users
usersRouter.get('/', (_req, res) => {
  return res.json({ users: usersRepo.list() });
});

// 2a. GET /api/users/reporters - List all reporters
usersRouter.get('/reporters', (_req, res) => {
  return res.json({ reporters: usersRepo.getReporters() });
});

// 2b. POST /api/users/reporters - Add a new reporter (Editor action)
usersRouter.post('/reporters', (req, res) => {
  const { name, email, displayNameTelugu, district, bureau } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'రిపోర్టర్ పేరు అవసరం (Reporter name is required).' });
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'సరైన Gmail ఈమెయిల్ అవసరం (Valid Gmail email is required).' });
  }

  try {
    const reporter = usersRepo.addReporter({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      displayNameTelugu: typeof displayNameTelugu === 'string' && displayNameTelugu.trim() ? displayNameTelugu.trim() : undefined,
      district: typeof district === 'string' && district.trim() ? district.trim() : undefined,
      bureau: typeof bureau === 'string' && bureau.trim() ? bureau.trim() : undefined,
    });
    logAuditEvent(reporter.id, 'user', reporter.id, 'reporter_added', { email: reporter.email, name: reporter.displayName });
    syncUserToSupabase(reporter).catch((e) => console.warn('Supabase sync background note:', e));
    return res.status(201).json({
      reporter,
      message: `రిపోర్టర్ ${reporter.displayName} (${reporter.email}) విజయవంతంగా చేర్చబడ్డారు.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'రిపోర్టర్‌ను చేర్చడంలో విఫలమైంది.' });
  }
});

// 2c. DELETE /api/users/reporters/:id - Remove a reporter
usersRouter.delete('/reporters/:id', (req, res) => {
  try {
    const targetId = req.params.id;
    const success = usersRepo.removeReporter(targetId);
    if (!success) {
      return res.status(404).json({ error: 'రిపోర్టర్ కనిపించలేదు లేదా ఇప్పటికే తొలగించబడ్డారు.' });
    }
    logAuditEvent(targetId, 'user', targetId, 'reporter_removed', {});
    removeUserFromSupabase(targetId).catch((e) => console.warn('Supabase remove background note:', e));
    return res.json({ success: true, message: 'రిపోర్టర్ విజయవంతంగా తొలగించబడ్డారు.' });
  } catch (err: any) {
    console.error('Error removing reporter:', err);
    return res.status(500).json({ error: err.message || 'రిపోర్టర్‌ను తొలగించడంలో విఫలమైంది.' });
  }
});

// 3. GET /api/users/:id - Get specific user profile
usersRouter.get('/:id', (req, res) => {
  const user = usersRepo.getById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  return res.json({ user });
});

// 4. PUT /api/users/:id - Update specific user profile
usersRouter.put('/:id', (req, res) => {
  const targetId = req.params.id;
  const updates = req.body || {};
  const updated = usersRepo.updateProfile(targetId, updates);
  if (!updated) {
    return res.status(404).json({ error: 'User not found to update.' });
  }
  logAuditEvent(targetId, 'user', targetId, 'user_profile_updated', { updates });
  syncUserToSupabase(updated).catch((e) => console.warn('Supabase sync background note:', e));
  return res.json({ user: updated, message: 'Profile updated successfully.' });
});

// 5. POST /api/auth/login - Persona login (reporters, editors)
authRouter.post('/login', (req, res) => {
  const { userId, username } = req.body || {};
  const users = usersRepo.list();
  const matched =
    users.find((u) => u.id === userId || u.username === username) || users[0];
  logAuditEvent(matched.id, 'user', matched.id, 'user_login', { role: matched.role });
  setSessionCookie(res, matched.id);
  return res.json({
    token: `session-${matched.id}-${Date.now()}`,
    user: matched,
  });
});

// 5. POST /api/auth/google - Authenticate with Google account
authRouter.post('/google', async (req, res) => {
  try {
    const {
      credential,
      sub,
      email,
      name,
      picture,
      displayNameTelugu,
      role,
      district,
      bureau,
      registerAsEditor,
    } = req.body || {};

    let resolvedEmail = email;
    let resolvedName = name;
    let resolvedPicture = picture;
    let resolvedSub = sub;

    // Decode Google ID token / JWT credential if passed from Google Identity Services button
    if (credential && typeof credential === 'string') {
      const decoded = parseJwtPayload(credential);
      if (decoded) {
        resolvedEmail = decoded.email || resolvedEmail;
        resolvedName = decoded.name || resolvedName;
        resolvedPicture = decoded.picture || resolvedPicture;
        resolvedSub = decoded.sub || resolvedSub;
      }
    }

    if (!resolvedEmail || typeof resolvedEmail !== 'string') {
      return res.status(400).json({ error: 'Valid Google account email is required.' });
    }

    const cleanEmail = resolvedEmail.trim().toLowerCase();
    const finalName = (resolvedName && typeof resolvedName === 'string')
      ? resolvedName.trim()
      : cleanEmail.split('@')[0];

    // Check if this email or Google sub already exists in our database
    const existingUser = usersRepo.findByEmail(cleanEmail) || (resolvedSub ? usersRepo.findByGoogleId(resolvedSub) : null);

    if (existingUser) {
      // User is already registered (either as Editor or Reporter)
      // Update avatar or sub if provided
      const updatedUser = usersRepo.upsertGoogle({
        sub: resolvedSub || existingUser.googleId,
        email: cleanEmail,
        name: existingUser.displayName || finalName,
        picture: resolvedPicture || existingUser.avatarUrl,
        displayNameTelugu: existingUser.displayNameTelugu,
        role: existingUser.role,
        district: existingUser.district,
        bureau: existingUser.bureau,
      });

      logAuditEvent(updatedUser.id, 'user', updatedUser.id, 'google_login_success', {
        email: updatedUser.email,
        role: updatedUser.role,
      });

      await syncUserToSupabase(updatedUser);

      setSessionCookie(res, updatedUser.id);
      const token = `g-session-${updatedUser.id}-${Date.now()}`;
      return res.json({
        token,
        user: updatedUser,
        registered: true,
        message: `Welcome, ${updatedUser.displayName}! Signed in with Google.`,
      });
    }

    // Unregistered user workflow
    const systemHasEditor = usersRepo.hasEditor();

    // If explicit registration as editor is requested, or if no editor exists in system yet
    if (registerAsEditor === true || role === 'editor' || !systemHasEditor) {
      const editorTeluguName = displayNameTelugu?.trim() || `${finalName} (ప్రధాన సంపాదకులు)`;
      const newEditor = usersRepo.upsertGoogle({
        sub: resolvedSub,
        email: cleanEmail,
        name: finalName,
        picture: resolvedPicture,
        displayNameTelugu: editorTeluguName,
        role: 'editor',
        district: district?.trim() || 'విజయవాడ కేంద్ర కార్యాలయం',
        bureau: bureau?.trim() || 'సెంట్రల్ ఎడిటోరియల్ డెస్క్',
      });

      logAuditEvent(newEditor.id, 'user', newEditor.id, 'editor_registered', {
        email: newEditor.email,
      });

      await syncUserToSupabase(newEditor);

      setSessionCookie(res, newEditor.id);
      const token = `g-session-${newEditor.id}-${Date.now()}`;
      return res.json({
        token,
        user: newEditor,
        registered: true,
        message: `స్వాగతం ప్రధాన సంపాదకులు ${newEditor.displayName}!`,
      });
    }

    // Auto-onboard new Google users as a Reporter so login works seamlessly for everyone
    const newReporter = usersRepo.upsertGoogle({
      sub: resolvedSub,
      email: cleanEmail,
      name: finalName,
      picture: resolvedPicture,
      displayNameTelugu: displayNameTelugu?.trim() || `${finalName} (జర్నలిస్ట్)`,
      role: 'reporter',
      district: district?.trim() || 'ఎన్టీఆర్ జిల్లా',
      bureau: bureau?.trim() || 'విజయవాడ డిజిటల్ బ్యూరో',
    });

    logAuditEvent(newReporter.id, 'user', newReporter.id, 'google_reporter_auto_registered', {
      email: newReporter.email,
    });

    await syncUserToSupabase(newReporter);

    setSessionCookie(res, newReporter.id);
    const token = `g-session-${newReporter.id}-${Date.now()}`;
    return res.json({
      token,
      user: newReporter,
      registered: true,
      message: `స్వాగతం, ${newReporter.displayName}! రిపోర్టర్‌గా విజయవంతంగా లాగిన్ అయ్యారు.`,
    });
  } catch (err: any) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Failed to authenticate Google account: ' + (err.message || 'Unknown error') });
  }
});

// 6. GET /api/auth/me - Current authenticated user
authRouter.get('/me', (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  const authHeader = req.headers.authorization;
  let userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : '';

  if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const match = token.match(/^(?:g-)?session-([^-]+(?:-[^-]+)*)-\d+$/);
    if (match) {
      userId = match[1];
    }
  }

  // Check cookie if headers are absent (ensures session persistence without local storage)
  if (!userId && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)pv_user_id=([^;]+)/);
    if (match) {
      userId = decodeURIComponent(match[1]);
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated', user: null });
  }

  const user = usersRepo.getById(userId);
  if (!user) {
    return res.status(401).json({ error: 'Session user not found.', user: null });
  }
  return res.json({ user });
});

// 7. PUT /api/auth/profile - Update current user profile
authRouter.put('/profile', (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  let userId = typeof userIdHeader === 'string' && userIdHeader ? userIdHeader : '';

  if (!userId && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)pv_user_id=([^;]+)/);
    if (match) {
      userId = decodeURIComponent(match[1]);
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'User ID is required to update profile.' });
  }

  const user = usersRepo.getById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const updates = req.body || {};
  const updated = usersRepo.updateProfile(userId, updates);
  logAuditEvent(userId, 'user', userId, 'profile_updated', { updates });
  if (updated) {
    syncUserToSupabase(updated).catch((e) => console.warn('Supabase profile update sync note:', e));
  }

  return res.json({
    user: updated,
    message: 'Profile details saved successfully (ప్రొఫైల్ వివరాలు విజయవంతంగా భద్రపరచబడ్డాయి).',
  });
});

// 8. POST /api/auth/logout - Sign out
authRouter.post('/logout', (req, res) => {
  const userIdHeader = req.headers['x-user-id'];
  if (typeof userIdHeader === 'string' && userIdHeader) {
    logAuditEvent(userIdHeader, 'user', userIdHeader, 'user_logout', {});
  }
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Logged out successfully.' });
});
