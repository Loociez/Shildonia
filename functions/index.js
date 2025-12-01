const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const { Rcon } = require('rcon-client');
const rateLimit = require('express-rate-limit');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// rate limiting
const limiter = rateLimit({
  windowMs: 15 * 1000,
  max: 10
});
app.use(limiter);

// verify Firebase ID token
async function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.*)$/);
  if (!match) return null;
  const idToken = match[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    return null;
  }
}

// Exec endpoint
app.post('/exec', async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const uid = decoded.uid;
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return res.status(403).json({ error: 'User record missing' });
  const u = userDoc.data();
  if (!u.isApproved) return res.status(403).json({ error: 'Account not approved' });

  const cmd = (req.body && req.body.command) ? String(req.body.command).slice(0, 1000) : '';
  if (!cmd) return res.status(400).json({ error: 'Missing command' });

  // load rcon config
  const host = functions.config().rcon.host;
  const port = Number(functions.config().rcon.port || 0);
  const password = functions.config().rcon.password;
  if (!host || !port || !password) return res.status(500).json({ error: 'RCON not configured' });

  // basic precaution: disallow very destructive commands (you can tweak)
  const forbidden = ['quit', 'save', 'stop', 'exit', 'shutdown'];
  const lower = cmd.toLowerCase();
  if (forbidden.some(f => lower.startsWith(f) || lower.includes(' ' + f + ' '))) {
    return res.status(403).json({ error: 'Command forbidden' });
  }

  try {
    const rcon = await Rcon.connect({ host, port, password, timeout: 7000 });
    const reply = await rcon.send(cmd);
    await rcon.end();
    return res.json({ ok: true, output: reply });
  } catch (err) {
    console.error('RCON error', err);
    return res.status(500).json({ error: 'RCON error: ' + (err.message || String(err)) });
  }
});

// admin approve endpoint
app.post('/admin/approve', async (req, res) => {
  const decoded = await verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  const uid = decoded.uid;
  const meDoc = await db.collection('users').doc(uid).get();
  if (!meDoc.exists) return res.status(403).json({ error: 'User record missing' });
  const me = meDoc.data();
  const isMaster = !!me.isMaster || (me.username === 'Lambertio');

  if (!isMaster) return res.status(403).json({ error: 'Not master' });

  const { targetUid, approve } = req.body || {};
  if (!targetUid || typeof approve !== 'boolean') return res.status(400).json({ error: 'Bad payload' });

  try {
    await db.collection('users').doc(targetUid).update({ isApproved: approve, approvedAt: Date.now() });
    return res.json({ ok: true, message: 'Updated approval' });
  } catch (err) {
    console.error('approve err', err);
    return res.status(500).json({ error: 'Failed updating user doc' });
  }
});

// export function (choose region; eu-west recommended for UK)
exports.rconApi = functions.region('europe-west1').https.onRequest(app);
