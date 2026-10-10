// "My account" area: overview, courses, payments, reviews, profile and security.
import { $, esc, icon, api, money, dateText, empty, stars } from './utils.js';

const STUDENT_NAV = [
 ['overview', 'grid', 'Overview'], ['courses', 'book', 'My courses'], ['payments', 'wallet', 'Payments'],
 ['reviews', 'star', 'My reviews'], ['profile', 'user', 'Profile'], ['security', 'lock', 'Security & privacy']
];
const ADMIN_NAV = [['profile', 'user', 'Profile'], ['security', 'lock', 'Security & privacy']];

function field(label, name, value = '', type = 'text', extra = '') {
 return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}

function sidebar(user, section, nav) {
 return `<aside class="acct-side"><div class="acct-me"><div class="avatar big">${esc(user.name.trim()[0]?.toUpperCase() || '?')}</div><b>${esc(user.name)}</b><small>${esc(user.email)}</small><span class="pill">${esc(user.role)}</span></div><nav aria-label="Account sections">${nav.map(([key, i, label]) => `<a class="side-link ${key === section ? 'active' : ''}" href="#/account${key === 'overview' ? '' : '/' + key}">${icon(i)}${label}</a>`).join('')}${user.role === 'admin' ? `<a class="side-link" href="#/admin">${icon('settings')}Admin dashboard</a>` : ''}</nav><button class="side-link logout" data-action="logout">${icon('logout')}Sign out</button></aside>`;
}

function head(title, text) { return `<div class="acct-head"><h1>${title}</h1><p>${text}</p></div>`; }

function paymentsTable(orders, badge) {
 if (!orders.length) return empty('No payment requests yet', 'Requests and administrator decisions will appear here.', '#/courses');
 return `<div class="tablewrap"><table><thead><tr><th>Course</th><th>Fee submitted</th><th>Status</th><th>Update</th></tr></thead><tbody>${orders.map(o => `<tr><td class="titlecell"><a href="#/course/${o.course_id}"><b>${esc(o.course_title)}</b></a><small>${dateText(o.created)}</small></td><td>${money(o.amount, o.currency)}</td><td>${badge(o.status)}</td><td class="titlecell">${esc(o.admin_note || (o.status === 'pending' ? 'Your payment is waiting for manual verification.' : o.status === 'approved' ? 'Your course Zoom links are unlocked.' : 'Contact the academy or submit an updated request.'))}</td></tr>`).join('')}</tbody></table></div>`;
}

function reviewsList(items) {
 if (!items.length) return empty('You have not reviewed anything yet', 'Open a course or reel and share what you think.', '#/courses');
 return items.map(r => `<article class="panel review-mine"><div><a class="inline-link" href="${r.target_type === 'course' ? '#/course/' : '#/reels/'}${r.target_id}"><b>${esc(r.title || 'Removed item')}</b></a> <span class="pill">${r.target_type}</span><div class="review-top">${stars(r.rating)}<small>${dateText(r.updated)}</small></div>${r.body ? `<p>${esc(r.body)}</p>` : ''}</div><button class="btn small danger" data-review-delete="${r.id}">${icon('trash')} Delete</button></article>`).join('');
}

/** r = { card, lectureCard, badge } renderers from app.js */
export async function accountPage(user, section = 'overview', r) {
 const admin = user.role === 'admin', nav = admin ? ADMIN_NAV : STUDENT_NAV;
 if (!nav.some(n => n[0] === section)) section = nav[0][0];
 let main = '';

 if (!admin && ['overview', 'courses', 'payments', 'reviews'].includes(section)) {
  const [courses, orders, lectures, myReviews] = await Promise.all([api('/api/courses'), api('/api/my-orders'), api('/api/lectures'), api('/api/my-reviews')]);
  const mine = courses.filter(c => c.access);
  if (section === 'overview') {
   const next = lectures.filter(l => l.access && l.status === 'scheduled').slice(0, 3);
   main = `${head(`Hi, ${esc(user.name.split(' ')[0])}`, 'Everything about your learning in one place.')}<div class="stats">${[['Courses unlocked', mine.length, 'Approved for you'], ['Pending payments', orders.filter(o => o.status === 'pending').length, 'Waiting for review'], ['Reviews written', myReviews.length, 'Courses and reels'], ['Member since', dateText(user.created), 'Your join date']].map(([l, n, h]) => `<div class="stat"><small>${l}</small><b class="${typeof n === 'string' ? 'small-stat' : ''}">${n}</b><span>${h}</span></div>`).join('')}</div><div class="panel"><div class="section-head slim"><h2>Next live lectures</h2><a class="textbtn" href="#/schedule">Full schedule ${icon('arrow')}</a></div><div class="lecture-stack">${next.map(l => r.lectureCard(l, true)).join('') || empty('No upcoming lectures in your courses', 'Approved course schedules will appear here.', '#/courses')}</div></div><div class="panel"><h2>Quick actions</h2><div class="quicklinks">${[['#/courses', 'book', 'Browse courses', 'Find your next course.'], ['#/reels', 'play', 'Watch reels', 'Short learning moments.'], ['#/notices', 'bell', 'Noticeboard', 'Latest announcements.']].map(([h, i, t, s]) => `<a class="quicklink" href="${h}">${icon(i)}<b>${t}</b><small>${s}</small></a>`).join('')}</div></div>`;
  }
  if (section === 'courses') main = `${head('My courses', 'Courses you have access to. Open one to see lectures and Zoom links.')}<div class="grid">${mine.map(r.card).join('') || empty('No courses unlocked yet', 'Choose a course and submit your payment for approval.', '#/courses')}</div>`;
  if (section === 'payments') main = `${head('Payments', 'Your payment requests and the academy’s decisions.')}${paymentsTable(orders, r.badge)}`;
  if (section === 'reviews') main = `${head('My reviews', 'Your ratings on courses and reels. You can delete a review any time.')}${reviewsList(myReviews)}`;
 }

 if (section === 'profile') {
  main = `${head('Profile', 'Your details as the academy sees them.')}<form id="profile-form" class="panel editor-form"><div class="form-error" role="alert"></div>${field('Full name', 'name', user.name, 'text', 'required maxlength="80" autocomplete="name"')}${field('Email address', 'email', user.email, 'email', 'disabled')}<p class="hint">Your email is your sign-in and cannot be changed here. Contact the academy if it needs updating.</p><div class="form-grid"><div><small class="hint">Account type</small><p><b>${esc(user.role)}</b></p></div><div><small class="hint">Member since</small><p><b>${dateText(user.created)}</b></p></div></div><button class="btn" type="submit">${icon('check')} Save profile</button></form>`;
 }

 if (section === 'security') {
  main = `${head('Security & privacy', 'Keep your account safe and in your control.')}<form id="password-form" class="panel editor-form"><h2>Change password</h2><div class="form-error" role="alert"></div>${field('Current password', 'currentPassword', '', 'password', 'required autocomplete="current-password" maxlength="128"')}${field('New password', 'password', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}<p class="hint">Use at least 10 characters. Changing your password signs out your other devices.</p><button class="btn" type="submit">Update password</button></form><div class="panel"><h2>Sign out</h2><p class="hint">Finished for now? Sign out on this device.</p><button class="btn outline" data-action="logout">${icon('logout')} Sign out</button></div>${admin ? '' : `<div class="panel danger-zone"><h2>Delete account</h2><p class="hint">Permanently removes your account, payment requests, access and reviews. This cannot be undone and does not refund payments.</p><button class="btn danger" data-action="delete-account">${icon('trash')} Delete my account</button></div>`}`;
 }

 return `<div class="container acct">${sidebar(user, section, nav)}<section class="acct-main fade-in">${main}</section></div>`;
}

/** Asks for the password; resolves with it, or null if cancelled. */
export function deleteAccountDialog() {
 return new Promise(resolve => {
  const dialog = $('#modal');
  dialog.className = '';
  dialog.innerHTML = `<h2>Delete your account?</h2><p>This permanently removes your account, access and reviews. Enter your password to confirm.</p><form method="dialog"><label class="field">Password<input type="password" name="pw" required maxlength="128" autocomplete="current-password"></label><div class="actions"><button class="btn danger" value="confirm">Delete forever</button><button class="btn outline" value="cancel" formnovalidate autofocus>Cancel</button></div></form>`;
  dialog.returnValue = 'cancel';
  dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm' ? dialog.querySelector('input').value : null), { once: true });
  dialog.showModal();
 });
}
