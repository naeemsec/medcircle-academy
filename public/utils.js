// Shared helpers used by every page module (no app state in here).
export const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const icons = {
 calendar:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
 bell:'M6 8a6 6 0 0 1 12 0v7l2 3H4l2-3V8m4 13h4',
 wallet:'M3 5h17v15H3zM3 5V3h14v2M15 10h7v6h-7z',
 arrow:'M4 12h16m-6-6 6 6-6 6',
 back:'M20 12H4m6-6-6 6 6 6',
 book:'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm9 3a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2',
 play:'m9 5 11 7-11 7V5Z',
 search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-4a4 4 0 0 1 0 8',
 user:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 lock:'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
 star:'m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
 trash:'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
 plus:'M12 5v14M5 12h14',
 check:'m5 12 4 4L19 6',
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 logout:'M9 21H3V3h6m6 4 5 5-5 5M8 12h12',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
 menu:'M4 6h16M4 12h16M4 18h16',
 shield:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z',
 chat:'M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12Z'
};
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.arrow}"/></svg>`;

export const money = (minor, currency = 'PKR') => new Intl.NumberFormat('en', {style:'currency', currency, maximumFractionDigits: minor % 100 ? 2 : 0}).format(minor / 100);
export const dateText = value => new Date(value).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'});
export const dateTime = value => new Date(value).toLocaleString(undefined, {day:'numeric', month:'short', hour:'numeric', minute:'2-digit', timeZoneName:'short'});
export const localDateValue = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';

export async function api(url, options = {}) {
 const response = await fetch(url, {...options, headers: {'Content-Type':'application/json', ...options.headers}, body: options.body === undefined ? undefined : JSON.stringify(options.body)});
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || 'Request failed');
 return data;
}

export function toast(message) {
 const el = $('#toast');
 el.textContent = message; el.classList.add('show');
 clearTimeout(toast.timer);
 toast.timer = setTimeout(() => el.classList.remove('show'), 4000);
}

export const empty = (title, description, link = '', label = 'Explore courses') =>
 `<div class="empty"><h3>${title}</h3><p>${description}</p>${link ? `<a class="btn" href="${link}">${label} ${icon('arrow')}</a>` : ''}</div>`;

/** Star display. value 0-5, partial values are shown partially filled. */
export const stars = value => `<span class="stars" style="--pct:${Math.max(0, Math.min(5, value)) * 20}%" role="img" aria-label="${value} out of 5 stars">★★★★★</span>`;

export function confirmAction(title, message) {
 return new Promise(resolve => {
  const dialog = $('#modal');
  dialog.className = '';
  dialog.innerHTML = `<h2>${esc(title)}</h2><p>${esc(message)}</p><form method="dialog"><div class="actions"><button class="btn danger" value="confirm">Confirm</button><button class="btn outline" value="cancel" autofocus>Cancel</button></div></form>`;
  dialog.returnValue = 'cancel';
  dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {once: true});
  dialog.showModal();
 });
}
