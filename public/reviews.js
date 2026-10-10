// Ratings & reviews UI: rating tags on cards, review section, review dialog.
import { $, esc, icon, api, toast, dateText, stars, confirmAction } from './utils.js';

/* ---------- Small pieces other pages reuse ---------- */

/** Inner HTML of a rating tag. No reviews yet -> NEW tag. Otherwise show the average (even for 1-2 reviews). */
export function ratingInner(r) {
 if (!r || !r.count) return '<span class="tag-new">NEW</span>';
 return `<span class="rating-chip"><i>★</i> ${r.avg.toFixed(1)} <small>(${r.count})</small></span>`;
}
export const ratingTag = (type, id, r) => `<span class="rating-tag" data-rating-for="${type}:${id}">${ratingInner(r)}</span>`;

/** Empty container; hydrateReviews() fills it in. */
export const reviewsRoot = (type, id) => `<div data-reviews-root data-type="${esc(type)}" data-id="${esc(id)}"><div class="loading small">Loading reviews…</div></div>`;

/* ---------- Rendering ---------- */
let getUser = () => null;
let uid = 0;

function summaryHtml(s) {
 if (!s.count) return `<div class="rating-summary"><div class="rating-big">–</div><div><span class="tag-new">NEW</span><p class="hint">No reviews yet. Be the first to share your experience.</p></div></div>`;
 const bars = [5, 4, 3, 2, 1].map(n => {
  const count = s.breakdown[n - 1], pct = Math.round(count / s.count * 100);
  return `<div class="bar-row"><span>${n}★</span><div class="bar"><i style="width:${pct}%"></i></div><span>${count}</span></div>`;
 }).join('');
 return `<div class="rating-summary"><div class="rating-big">${s.avg.toFixed(1)}</div><div class="rating-meta">${stars(s.avg)}<p class="hint">${s.count} review${s.count === 1 ? '' : 's'}</p></div><div class="bars">${bars}</div></div>`;
}

function formHtml(type, id, mine) {
 const user = getUser();
 if (!user) {
  sessionStorage.setItem('returnTo', location.hash);
  return `<div class="review-note">${icon('chat')}<div><b>Share your experience</b><p class="hint"><a class="inline-link" href="#/login">Sign in</a> or <a class="inline-link" href="#/signup">create a free account</a> to rate and review.</p></div></div>`;
 }
 if (user.role === 'admin') return `<div class="review-note">${icon('shield')}<div><b>Student reviews</b><p class="hint">Administrators can remove inappropriate reviews but cannot post their own.</p></div></div>`;
 const key = 'r' + (++uid);
 return `<form class="review-form" data-type="${esc(type)}" data-id="${esc(id)}"><b>${mine ? 'Update your review' : 'Write a review'}</b><div class="form-error" role="alert"></div><small class="hint">Your rating</small><div class="star-input" role="radiogroup" aria-label="Your rating">${[5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="${key}-${n}" value="${n}" ${mine?.rating === n ? 'checked' : ''} required><label for="${key}-${n}" title="${n} star${n === 1 ? '' : 's'}">★</label>`).join('')}</div><label class="field">Your review (optional)<textarea name="body" rows="3" maxlength="1000" placeholder="What did you like? What could be better?">${esc(mine?.body || '')}</textarea></label><button class="btn small" type="submit">${icon('check')} ${mine ? 'Update review' : 'Post review'}</button></form>`;
}

function itemHtml(r) {
 const user = getUser(), canDelete = r.mine || user?.role === 'admin';
 return `<article class="review-item"><div class="avatar">${esc(r.name.trim()[0]?.toUpperCase() || '?')}</div><div class="review-body"><div class="review-top"><b>${esc(r.name)}</b>${r.mine ? '<span class="pill">YOU</span>' : ''}${stars(r.rating)}<small>${dateText(r.updated)}</small>${canDelete ? `<button class="textbtn danger-text" data-review-delete="${r.id}" aria-label="Delete review">${icon('trash')}</button>` : ''}</div>${r.body ? `<p>${esc(r.body)}</p>` : ''}</div></article>`;
}

async function renderRoot(root) {
 const { type, id } = root.dataset;
 const data = await api(`/api/reviews?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`);
 const mine = data.items.find(i => i.mine);
 root.innerHTML = `<section class="reviews"><div class="reviews-top">${summaryHtml(data.summary)}<div class="review-form-wrap">${formHtml(type, id, mine)}</div></div><div class="review-list">${data.items.map(itemHtml).join('') || ''}</div></section>`;
 document.querySelectorAll(`[data-rating-for="${type}:${id}"]`).forEach(el => { el.innerHTML = ratingInner(data.summary); });
}

/** Call after the page HTML is in the DOM. */
export async function hydrateReviews() {
 for (const root of document.querySelectorAll('[data-reviews-root]')) {
  try { await renderRoot(root); } catch (e) { root.innerHTML = `<p class="hint">${esc(e.message)}</p>`; }
 }
}

/* ---------- Reel review dialog ---------- */
function openReviewDialog(type, id, title) {
 const dialog = $('#modal');
 dialog.className = 'modal-wide';
 dialog.innerHTML = `<h2>${esc(title)}</h2><p>Ratings and reviews from the community.</p>${reviewsRoot(type, id)}<form method="dialog"><button class="btn outline full modal-close">Close</button></form>`;
 dialog.showModal();
 hydrateReviews();
}

/* ---------- Events (bound once) ---------- */
export function initReviews({ user }) {
 getUser = user;
 document.addEventListener('submit', async e => {
  const form = e.target.closest('.review-form');
  if (!form) return;
  e.preventDefault();
  const error = form.querySelector('.form-error'), button = form.querySelector('button[type="submit"]');
  error.textContent = ''; button.disabled = true;
  try {
   const v = Object.fromEntries(new FormData(form));
   await api('/api/reviews', { method: 'POST', body: { target_type: form.dataset.type, target_id: form.dataset.id, rating: Number(v.rating), body: v.body } });
   await renderRoot(form.closest('[data-reviews-root]'));
   toast('Thanks! Your review is saved.');
  } catch (err) { error.textContent = err.message; button.disabled = false; }
 });
 document.addEventListener('click', async e => {
  const del = e.target.closest('[data-review-delete]');
  if (del) {
   // Inside the reel dialog we cannot open a second dialog, so use the browser's own prompt there.
   const ok = del.closest('dialog') ? confirm('Delete this review?') : await confirmAction('Delete this review?', 'This removes the rating and the message.');
   if (!ok) return;
   try {
    await api('/api/reviews/' + del.dataset.reviewDelete, { method: 'DELETE', body: {} });
    const root = del.closest('[data-reviews-root]');
    if (root) await renderRoot(root); else window.dispatchEvent(new Event('hashchange')); // re-render the current page
    toast('Review deleted');
   } catch (err) { toast(err.message); }
   return;
  }
  const open = e.target.closest('[data-review-open]');
  if (open) openReviewDialog(open.dataset.type, open.dataset.id, open.dataset.title);
 });
}
