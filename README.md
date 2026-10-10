# MedCircle Academy

A responsive medical education community with paid courses, live Zoom lecture schedules, academy notices and short reels. This is the medical-focused replacement for the previous coding academy. All lectures happen on Zoom; the website handles discovery, schedules, student accounts, course payments and access to meeting links.

## Start in VS Code

1. Install **Node.js 24 or newer** from https://nodejs.org/.
2. Extract the ZIP and open the **medcircle-academy** folder in VS Code.
3. Open a terminal in that folder and run:

   ```bash
   npm start
   ```

4. Visit **http://localhost:3000**.

No packages, database server, API keys or build step are required. Do not open `index.html` directly or use VS Code Live Server. The Node server is required for accounts, payments and uploads.

For source editing with automatic server restarts, use `npm run dev`. Refresh the browser after changing frontend files.

## Demo admin

| Field | Value |
| --- | --- |
| Email | `admin@medcircle.dev` |
| Password | `Admin@12345` |

The login screen has a **Fill details** button in demo mode. Create a student account in an incognito window to test the student experience while staying signed in as admin.

## Your friend's workflow

### 1. Add a medical course and set its fee

Dashboard → **Courses** → **New course**.

Enter the course title, medical subject, description/syllabus, level, fee and currency. Choose a cover image or the built-in pastel cover. Publish when ready.

Each course has a separate **one-time fee**. The default currency is PKR; USD, GBP, EUR, AED and INR are also available. No recurring subscription is created. Price changes affect new submissions; existing payment requests retain the fee shown when submitted.

### 2. Schedule the lectures on Zoom

Create the meeting in your friend's own Zoom account. Then open Dashboard → **Live lectures** → **Schedule lecture**.

Select its course and enter:

- Lecture title and description.
- Instructor/speaker.
- Start date/time and duration.
- Private Zoom meeting link.
- Status: scheduled, cancelled or completed.

The date/time field uses the administrator's device time zone. The server stores the exact UTC moment, and students see it in their own device time zone. This avoids hard-coding every visitor to Pakistan time.

The public can see lecture titles and times. Only students with **approved access for that specific course** can retrieve its Zoom link. The server checks this on every request; the URL is not merely hidden by CSS. The **Zoom link** button opens a dialog with an **Open Zoom meeting** link.

Approved students can retrieve a scheduled meeting link before it starts so they can prepare. Cancelled, completed and automatically expired sessions cannot be joined through the site. A session becomes completed after its scheduled start plus its duration.

The site does not create Zoom meetings, host lecture videos or control Zoom admission. Configure Zoom's own meeting/waiting-room settings in Zoom. A meeting link that an approved student already copied cannot be made unshareable by the website.

### 3. Add payment instructions

Dashboard → **Settings** → **Manual course payments**.

Enter your friend's actual receiving-account instructions (for example, bank transfer, JazzCash or Easypaisa) and a support contact, then enable payment submissions.

**This is a manual payment flow, not an integrated payment gateway.** The website does not charge cards, initiate transfers, verify receipts with a bank or send refunds. No real receiving account has been invented or prefilled. Enrollment requests remain closed until the administrator configures them.

Student flow:

1. Sign up / sign in.
2. Choose a course and review its price.
3. Pay externally using the administrator's instructions.
4. Submit the transaction/reference number and an optional screenshot.
5. Check **My courses** for the approval decision.
6. Once approved, open the course's Zoom links and private notices.

Administrator flow:

1. Dashboard → **Payments**.
2. Check the transaction in the actual receiving account. A screenshot alone is not verification.
3. **Approve** to unlock that course, or **Reject** with a reason.
4. Use **Revoke access** if access needs to be withdrawn later. This does not refund a payment or remove someone already inside a Zoom meeting.

For a demo without transferring money: enable settings with clearly labeled test instructions, submit `TEST-001` from a student account, then approve it in the admin dashboard.

### 4. Publish notices and announcements

Dashboard → **Noticeboard** → **New notice**.

Post upcoming lecture announcements, schedule changes and academy updates. Choose the audience:

- **Everyone**: visible publicly.
- **A course**: visible only to approved members of that course and the administrator.

Pin important notices to the top. Save unfinished notices as drafts. Students see an unread count in the navigation; it refreshes while signed in and the page is open. Opening the noticeboard marks notices seen on that browser.

These are **in-app notices**, not email, WhatsApp, SMS or push notifications. Scheduling a lecture updates the schedule; use Noticeboard to publish a separate announcement. Keep Zoom meeting URLs in the private Zoom field, not in public descriptions.

### 5. Upload reels

Dashboard → **Reels** → **New reel**.

Upload MP4/WebM, use an HTTPS video URL, or paste a standard YouTube link. Vertical 9:16 videos work best. Set a caption and category; publish or save as a draft. Students can like reels. Without a video, the reel displays a readable preview card.

## Included functionality

- Original medical branding, calm teal/pastel styling, responsive layouts and small animations.
- Home page with medical courses, upcoming lectures, reels and noticeboard highlights.
- Searchable course catalogue.
- Per-course fees and manual payment requests.
- Student sign-up, login, sign-out and password changes.
- Student dashboard for approved courses, upcoming lectures and payment status.
- Server-authorized Zoom links.
- Lecture scheduling, rescheduling, cancellation and completion.
- Public and course-private notices, pinning and unread indication.
- Reels, video playback and likes.
- Administrator course, lecture, notice, reel, payment and student management.
- Student suspension/reactivation/deletion.
- Persistent SQLite database and uploaded files.

The initial three courses, fees, schedules, notices and reel cards are **sample content** for testing. No real lecture recordings, medical advice, instructors or Zoom meeting links are supplied. Replace these entries with your friend's content.

## Files

```text
medcircle-academy/
  public/
    index.html       Browser shell and metadata
    styles.css       Responsive styling, colors and animations
    app.js           Pages, forms, routing and API calls
    favicon.svg      Medical-themed academy icon
  tests/
    app.test.js      HTTP workflow and access-control tests
    views.test.js    Public/student/admin view-rendering checks
  server.js          Node server, SQLite schema and API
  package.json       Start, development and test commands
  .env.example       Optional configuration
  .gitignore         Excludes data and local secrets
  README.md          Setup and usage guide
  API.md             Endpoints, database and access rules
  CHANGELOG.md       Changes from the original coding version
```

## Storage and the previous coding version

This package creates a new **`data/medcircle.sqlite`** database. It does not read, overwrite or automatically migrate the previous `academy.sqlite` coding database. Run it from its new folder; keep the old folder if you want the earlier demo preserved.

Uploaded reels, cover images and receipts go in `data/uploads/`. Back up the complete `data` folder with the server stopped. The ZIP intentionally contains no accounts, sessions, uploads or populated database.

Payment screenshots are protected by authentication: only the submitting student and administrator can retrieve them, even if another person knows the URL. Public reel videos and cover images are available through their URLs. Deleted/unattached uploads are retained on disk; cleanup is manual.

## Optional settings

Copy `.env.example` to `.env` if you need changes:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Local server port |
| `HOST` | `127.0.0.1` | Default access is only your computer |
| `DATA_DIR` | `./data` relative to server.js | Optional absolute path for persistent data |
| `DEMO_MODE` | `true` | Initial sample content and demo-login hints |
| `ADMIN_EMAIL` | `admin@medcircle.dev` | Initial admin email for a new database |
| `ADMIN_PASSWORD` | `Admin@12345` in demo mode | Initial admin password for a new database |
| `APP_ORIGIN` | Incoming HTTP origin | Set the exact HTTPS origin when hosting |
| `COOKIE_SECURE` | `false` | Set `true` on HTTPS hosting |

After a database exists, environment variables do not reset its administrator credentials. Change the password through **Account** or **Dashboard → Settings**.

To use a custom initial administrator, configure `.env` before the first launch. The administrator display name defaults to “Academy Admin”. Edit branding and public copy in `public/app.js`, colors in `public/styles.css`, and metadata in `public/index.html`.

## Try it on mobile

Set `HOST=0.0.0.0` in `.env`, restart, then open `http://YOUR-COMPUTER-LAN-IP:3000` on a phone connected to the same Wi-Fi. On Windows, `ipconfig` shows the LAN IPv4 address. Permit the port on a private-network firewall if necessary.

This makes the server reachable on your local network. `localhost` on a phone refers to the phone, not your computer.

## Hosting boundaries

This ZIP is ready to run locally; it has not been deployed to the internet. Your friend will need a persistent Node.js hosting environment for visitors to sign up from other locations.

Before accepting real users/payments:

- Configure a unique administrator password, switch `DEMO_MODE=false`, and replace sample content/fees.
- Use HTTPS with the correct `APP_ORIGIN` and `COOKIE_SECURE=true`.
- Configure actual receiving-account details and support contact.
- Keep a persistent disk and backups for SQLite and uploads.
- Add a payment-gateway integration if automatic payment confirmation is needed. This version is intentionally honest about manual approval.

This is a single-server starter. Large video libraries need storage/CDN planning and disk quotas. Reel/cover uploads are limited to 100 MB each; payment screenshots to 5 MB and 10 uploads per student per day. There is no automatic refund, invoicing, email verification, password-reset email, push notification service, Zoom API integration or DRM.

## Verification

Run:

```bash
npm test
```

The tests use a separate temporary database. They cover registration, role enforcement, exact course fees, payment configuration, private receipts, approval/rejection/revocation, private Zoom URLs, course notice audiences, cancellations, reel uploads/likes, persistence across restart, suspension, passwords, deletions and view rendering.

All 18 reported tests passed under Node.js 24.19.0. Syntax checks passed. View tests exercise HTML generation without a browser; real browser rendering, mobile layout and real Zoom/video playback were not visually tested in the build environment.

## Common problems

- **`node:sqlite` unavailable:** install Node 24+, restart the VS Code terminal and check `node --version`.
- **Port already used:** stop the previous coding website, or set `PORT=3001` and visit that port.
- **Payment form not showing:** enable payment instructions in Dashboard → Settings.
- **No Zoom button:** the course may not be approved, the link may be missing, or the lecture may be completed/cancelled.
- **Different times on devices:** the same scheduled UTC moment is displayed in each device's local time zone; check your device clock/time-zone settings.
- **Cross-origin request blocked:** `APP_ORIGIN` must exactly match the browser origin, including the port and without a trailing slash.
- **Session disappears:** use a consistent hostname; enable Secure cookies only for HTTPS.
- **Upload rejected:** use supported file types and sizes. Renaming a file does not convert its contents.
- **YouTube video will not play:** that video may disallow embedding; try a permitted link or upload a compatible MP4.
