// Ratings & reviews for courses and reels.
// Factory pattern: server.js passes in the database and its small helper functions.
const TYPES = { course: 'courses', reel: 'reels' };

export function createReviews(db, { json, fail, payload, clean, requireUser, now, randomUUID }) {
 db.exec(`
 CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  rating INTEGER NOT NULL, body TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL, updated TEXT NOT NULL,
  UNIQUE(user_id, target_type, target_id)
 );
 CREATE INDEX IF NOT EXISTS reviews_target ON reviews(target_type, target_id);
 `);

 const round1 = n => Math.round(n * 10) / 10;

 /** {avg, count} for one course/reel. avg is 0 when there are no reviews. */
 function ratingOf(type, id) {
  const r = db.prepare('SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE target_type=? AND target_id=?').get(type, id);
  return { count: r.n, avg: r.n ? round1(r.a) : 0 };
 }

 /** Call when a course/reel is deleted so no orphan reviews stay behind. */
 function removeFor(type, id) {
  db.prepare('DELETE FROM reviews WHERE target_type=? AND target_id=?').run(type, id);
 }

 function targetOrFail(type, id, user) {
  if (!TYPES[type]) fail(400, 'Reviews are available for courses and reels.');
  const row = db.prepare(`SELECT * FROM ${TYPES[type]} WHERE id=?`).get(id);
  if (!row || (!row.published && user?.role !== 'admin')) fail(404, 'Item not found.');
  return row;
 }

 function listFor(type, id, user) {
  const rows = db.prepare(`SELECT r.id,r.user_id,r.rating,r.body,r.created,r.updated,u.name
   FROM reviews r JOIN users u ON u.id=r.user_id
   WHERE r.target_type=? AND r.target_id=? ORDER BY r.updated DESC LIMIT 200`).all(type, id);
  const breakdown = [0, 0, 0, 0, 0];
  rows.forEach(r => breakdown[r.rating - 1]++);
  return {
   summary: { ...ratingOf(type, id), breakdown },
   items: rows.map(r => ({
    id: r.id, name: r.name, rating: r.rating, body: r.body, created: r.created, updated: r.updated,
    mine: !!user && r.user_id === user.id
   }))
  };
 }

 /** Returns true when the request was handled here. */
 async function handle(req, res, url, user) {
  const p = url.pathname, m = req.method;

  if (p === '/api/reviews' && m === 'GET') {
   const type = url.searchParams.get('type'), id = url.searchParams.get('id');
   targetOrFail(type, id, user);
   json(res, 200, listFor(type, id, user));
   return true;
  }

  if (p === '/api/reviews/latest' && m === 'GET') {
   const rows = db.prepare(`SELECT r.rating,r.body,r.created,r.target_type,r.target_id,u.name,
     COALESCE(c.title, rl.title) title
    FROM reviews r JOIN users u ON u.id=r.user_id
    LEFT JOIN courses c ON r.target_type='course' AND c.id=r.target_id AND c.published=1
    LEFT JOIN reels rl ON r.target_type='reel' AND rl.id=r.target_id AND rl.published=1
    WHERE r.body<>'' AND COALESCE(c.id, rl.id) IS NOT NULL
    ORDER BY r.created DESC LIMIT 6`).all();
   json(res, 200, rows);
   return true;
  }

  if (p === '/api/my-reviews' && m === 'GET') {
   const me = requireUser(req);
   const rows = db.prepare(`SELECT r.id,r.rating,r.body,r.updated,r.target_type,r.target_id,
     COALESCE(c.title, rl.title) title
    FROM reviews r
    LEFT JOIN courses c ON r.target_type='course' AND c.id=r.target_id
    LEFT JOIN reels rl ON r.target_type='reel' AND rl.id=r.target_id
    WHERE r.user_id=? ORDER BY r.updated DESC`).all(me.id);
   json(res, 200, rows);
   return true;
  }

  if (p === '/api/reviews' && m === 'POST') {
   const me = requireUser(req), b = await payload(req);
   if (me.role === 'admin') fail(400, 'Administrators cannot review their own content. Use a student account.');
   const type = clean(b.target_type, 10), id = clean(b.target_id, 100);
   targetOrFail(type, id, me);
   const rating = Number(b.rating);
   if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Choose a rating from 1 to 5 stars.');
   const body = clean(b.body, 1000), stamp = now();
   const existing = db.prepare('SELECT id FROM reviews WHERE user_id=? AND target_type=? AND target_id=?').get(me.id, type, id);
   if (existing) db.prepare('UPDATE reviews SET rating=?,body=?,updated=? WHERE id=?').run(rating, body, stamp, existing.id);
   else db.prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), me.id, type, id, rating, body, stamp, stamp);
   json(res, 200, { ok: true, ...listFor(type, id, me) });
   return true;
  }

  const del = p.match(/^\/api\/reviews\/([^/]+)$/);
  if (del && m === 'DELETE') {
   const me = requireUser(req);
   const row = db.prepare('SELECT * FROM reviews WHERE id=?').get(del[1]);
   if (!row) fail(404, 'Review not found.');
   if (row.user_id !== me.id && me.role !== 'admin') fail(403, 'You can only delete your own review.');
   db.prepare('DELETE FROM reviews WHERE id=?').run(row.id);
   json(res, 200, { ok: true });
   return true;
  }

  return false;
 }

 return { ratingOf, removeFor, handle };
}
