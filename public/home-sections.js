// Extra home-page sections and the site footer. Pure HTML builders.
import { esc, icon, stars, dateText } from './utils.js';

export function statsStrip({ courses, lectures, reels }) {
 const upcoming = lectures.filter(l => l.status === 'scheduled').length;
 const items = [[courses.length, 'Courses'], [upcoming, 'Upcoming lectures'], [reels.length, 'Short reels'], ['Zoom', 'Live sessions']];
 return `<section class="stats-strip" aria-label="Academy at a glance">${items.map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('')}</section>`;
}

export function howItWorks() {
 const steps = [
  ['01', 'Choose a course', 'Browse the syllabus, see the schedule and check the one-time fee.'],
  ['02', 'Pay and submit your reference', 'Pay using the instructor’s instructions, then send your transaction reference.'],
  ['03', 'Get approved, join live', 'Once verified, your course Zoom links and private notices unlock.']
 ];
 return `<section class="section"><div class="section-head"><div><div class="overline">Simple by design</div><h2>How it works.</h2><p>Three steps from curiosity to your first live lecture.</p></div></div><div class="steps">${steps.map(([n, t, d]) => `<div class="step"><span class="number">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>`;
}

export function whyUs() {
 const items = [
  ['play', 'Live on Zoom', 'Real lectures with a real instructor, where you can ask questions.'],
  ['shield', 'Private links', 'Zoom links are shown only to students approved for that course.'],
  ['bell', 'Course notices', 'Schedule changes and updates reach the right students in one place.'],
  ['calendar', 'Your own time zone', 'Every lecture time is shown in your device’s local time.'],
  ['star', 'Honest reviews', 'Students rate courses and reels, so you can choose with confidence.'],
  ['book', 'One-time fees', 'Pay once per course. No subscription and no surprise renewals.']
 ];
 return `<section class="section why"><div class="section-head"><div><div class="overline">Why Cath Lab Insights</div><h2>Built around how you study.</h2></div></div><div class="why-grid">${items.map(([i, t, d]) => `<div class="why-card"><span class="why-icon">${icon(i)}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>`;
}

export function testimonials(list) {
 const body = list.length
  ? list.slice(0, 3).map(r => `<article class="quote-card">${stars(r.rating)}<p>“${esc(r.body)}”</p><div class="quote-by"><b>${esc(r.name)}</b><small>${esc(r.title)} · ${dateText(r.created)}</small></div></article>`).join('')
  : `<article class="quote-card"><p>No reviews yet. Join a course and be the first to share your experience with the community.</p><div class="quote-by"><a class="inline-link" href="#/courses">Browse courses</a></div></article>`;
 return `<section class="section"><div class="section-head"><div><div class="overline">From the community</div><h2>What students say.</h2><p>Real reviews from students on courses and reels.</p></div></div><div class="quotes">${body}</div></section>`;
}

export function faq() {
 const qa = [
  ['How do I pay for a course?', 'Each course has a one-time fee. Pay using the instructor’s payment instructions, then submit your transaction reference on the course’s checkout page. The administrator verifies it manually.'],
  ['When do I get the Zoom link?', 'As soon as your payment is approved. Links for upcoming lectures appear in the course schedule and in My account. Cancelled or finished lectures cannot be joined.'],
  ['What if my payment is rejected?', 'You will see the reason in your account. Fix the issue and submit the request again.'],
  ['Which time zone are lectures shown in?', 'Your own. Times are converted to your device’s time zone automatically.'],
  ['Can I review a course or reel?', 'Yes. Any signed-in student can rate from 1 to 5 stars and leave a message. You can edit or delete your review any time.']
 ];
 return `<section class="section"><div class="section-head"><div><div class="overline">Good to know</div><h2>Questions, answered.</h2></div></div><div class="faq">${qa.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>`;
}

export function siteFooter(brand, user) {
 return `<div class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-about">${brand}<p>Medical education with live Zoom lectures, short reels and a connected community.</p></div><div><h4>Explore</h4><a href="#/courses">Courses</a><a href="#/schedule">Live lectures</a><a href="#/reels">Reels</a><a href="#/notices">Notices</a></div><div><h4>Your account</h4>${user ? `<a href="#/account">Overview</a><a href="#/account/profile">Profile</a><a href="#/account/security">Security</a>` : `<a href="#/login">Log in</a><a href="#/signup">Create account</a>`}</div><div><h4>How it works</h4><a href="#/courses">Choose a course</a><a href="#/courses">Pay &amp; submit reference</a><a href="#/schedule">Join on Zoom</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Cath Lab Insights. All rights reserved.</span><span>Lectures are held on Zoom. Course fees are verified manually.</span></div></div></div>`;
}

/** Right-to-left infinite text slider (animation lives in components.css). */
export function techMarquee() {
 const items = ['Anatomy', 'Physiology', 'Medical sciences', 'Exam preparation'];
 const half = items.concat(items).map(t => `<span>${t}</span>`).join('');
 return `<div class="tech-strip"><small>Build your<br>understanding.</small><div class="marquee"><div class="marquee-track">${half}${half.replace(/<span>/g, '<span aria-hidden="true">')}</div></div></div>`;
}