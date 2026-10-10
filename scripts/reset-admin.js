// Resets (or creates) the administrator login.
// Usage:  npm run reset-admin
// Optional: ADMIN_EMAIL / ADMIN_PASSWORD in .env decide the new credentials.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
mkdirSync(DATA, { recursive: true });
const dbFile = path.join(DATA, 'medcircle.sqlite');
const db = new DatabaseSync(dbFile);

const email = (process.env.ADMIN_EMAIL || 'admin@cathlab.dev').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
if (password.length < 10) {
 console.error('ADMIN_PASSWORD must be at least 10 characters.');
 process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const hashed = salt + ':' + scryptSync(password, salt, 64).toString('hex');

const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
if (!hasUsers) {
 console.error('No database found yet. Run "npm start" once, stop it, then run this again.');
 process.exit(1);
}
const admin = db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY created LIMIT 1").get();
const taken = db.prepare('SELECT id FROM users WHERE email=?').get(email);
if (taken && taken.id !== admin?.id) {
 console.error(`The email ${email} already belongs to another account. Choose a different ADMIN_EMAIL.`);
 process.exit(1);
}
if (admin) {
 db.prepare("UPDATE users SET email=?,password=?,status='active' WHERE id=?").run(email, hashed, admin.id);
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(admin.id);
} else {
 db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(randomUUID(), 'Academy Admin', email, hashed, 'admin', 'active', new Date().toISOString());
}
console.log(`Admin login is ready.\n  Database: ${dbFile}\n  Email:    ${email}\n  Password: ${password}`);
