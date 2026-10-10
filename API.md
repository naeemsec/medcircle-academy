# MedCircle API

JSON responses; errors return `{ "error": "message" }` with an appropriate status code. Write requests use `Content-Type: application/json`, except raw-file uploads. Sessions use an HttpOnly cookie.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/me` | Public | Current user and demo-mode flag |
| POST | `/api/register` | Public | `{name,email,password}`; always creates student |
| POST | `/api/login` | Public | `{email,password}` |
| POST | `/api/logout` | Public | Revoke current session |
| PATCH | `/api/account` | Signed in | `{currentPassword,password}` |
| GET | `/api/courses` | Public | Published courses, prices, personal access state |
| GET | `/api/courses?all=1` | Admin | Include drafts |
| GET | `/api/courses/:id` | Public; admin for draft | Course and sanitized lecture list |
| POST | `/api/courses` | Admin | Create course |
| PUT | `/api/courses/:id` | Admin | Edit course/fee/publication |
| DELETE | `/api/courses/:id` | Admin | Delete course and dependent records |
| GET | `/api/payment-settings` | Public | Published payment instructions/contact |
| PUT | `/api/admin/payment-settings` | Admin | `{enabled,instructions,contact}` |
| POST | `/api/courses/:id/request-access` | Student | `{reference,proof,expectedAmount,expectedCurrency}` |
| GET | `/api/my-orders` | Signed in | Current student's requests/decisions |
| GET | `/api/admin/orders` | Admin | Payment review queue |
| PATCH | `/api/admin/orders/:id` | Admin | `{status,admin_note}` |
| GET | `/api/lectures` | Public | Schedule without private Zoom URLs |
| GET | `/api/lectures?course=:id` | Public | Course schedule |
| GET | `/api/lectures?all=1` | Admin | Include drafts and private Zoom fields |
| POST | `/api/lectures` | Admin | Schedule a lecture |
| PUT | `/api/lectures/:id` | Admin | Reschedule/edit/cancel |
| DELETE | `/api/lectures/:id` | Admin | Delete lecture |
| GET | `/api/lectures/:id/join` | Approved course member or admin | Validated Zoom URL |
| GET | `/api/notices` | Public / personalized | Public notices + permitted course notices |
| GET | `/api/notices?all=1` | Admin | All notices/drafts |
| POST | `/api/notices` | Admin | Create notice |
| PUT | `/api/notices/:id` | Admin | Update notice |
| DELETE | `/api/notices/:id` | Admin | Delete notice |
| GET | `/api/reels` | Public | Published reels and likes |
| GET | `/api/reels?all=1` | Admin | Include drafts |
| POST | `/api/reels` | Admin | Create reel |
| PUT | `/api/reels/:id` | Admin | Update reel |
| DELETE | `/api/reels/:id` | Admin | Delete reel |
| POST | `/api/reels/:id/like` | Signed in | `{liked:true/false}` |
| GET | `/api/admin/stats` | Admin | Actual counts and recent requests |
| GET | `/api/admin/users` | Admin | Safe user profiles and approved course counts |
| PATCH | `/api/admin/users/:id` | Admin | `{status:"active"/"suspended"}` |
| DELETE | `/api/admin/users/:id` | Admin | Delete student; admin is protected |
| POST | `/api/upload` | Admin | Public image/video upload |
| POST | `/api/upload?kind=proof` | Signed in | Private payment screenshot |

Raw uploads use `application/octet-stream` and return `{url,type}`. Supported media: MP4, WebM, PNG, JPEG, WebP. Payment proofs accept only images and require an authenticated owner/admin to view their URL.

## Example course input

```json
{
  "title": "Anatomy foundations",
  "description": "Your course overview and syllabus.",
  "category": "Anatomy",
  "level": "Foundation",
  "color": "blue",
  "icon": "AN",
  "thumbnail": "",
  "price": "2500.00",
  "currency": "PKR",
  "published": true
}
```

Course writes accept the price in **major currency units**, with up to two decimal places. Stored/output `price` is an integer in **minor units** (2500 PKR → 250000). Order `amount` and checkout `expectedAmount` also use minor units. The server takes the amount from the course and rejects stale or tampered expected fees. Currency is locked on submission alongside the amount.

## Example lecture input

```json
{
  "course_id": "existing-course-id",
  "title": "Course orientation",
  "description": "Topics and session details.",
  "speaker": "Instructor name",
  "starts_at": "2026-11-01T14:00:00.000Z",
  "duration": 60,
  "timezone": "Asia/Karachi",
  "zoom_url": "https://zoom.us/j/YOUR-MEETING-ID",
  "status": "scheduled"
}
```

Use an ISO date with timezone offset or `Z`. The frontend converts local date inputs to UTC. `duration` is 5–480 minutes. `status` is scheduled, cancelled or completed. Only HTTPS links on zoom.us/zoom.com or their subdomains are accepted; this does not confirm that a meeting actually exists.

## Example notice input

```json
{
  "title": "Lecture time updated",
  "body": "Please review the latest time on the lecture schedule.",
  "course_id": "",
  "pinned": true,
  "published": true
}
```

Empty `course_id` means public. A course ID restricts the notice to its approved members and admin. Draft courses' notices remain hidden from students.

## Access/payment state transitions

- Student submits → `pending`.
- Admin verifies payment → `approved`.
- Admin rejects with reason → `rejected`.
- Admin withdraws approved access with reason → `revoked`.
- Student may resubmit after rejection/revocation → `pending`.
- Duplicate pending/approved requests are rejected.
- Students cannot choose the amount, grant a role or approve themselves.

This is the current access request per student/course, not a complete financial audit ledger. Resubmission updates that request. Deleting courses/accounts cascades to associated requests. Use exports/backups or an accounting integration if durable financial reporting is required.

## Database

`users`, `sessions`, `courses`, `orders`, `lectures`, `notices`, `reels`, `likes`, `uploads`, `settings`.

- `orders.status='approved'` is the source of course access.
- Request sessions are checked against current account status.
- Upload metadata records ownership and whether a file is public media or private proof.
- Scrypt hashes and per-password salts protect passwords; only hashes of session tokens are stored.
- SQLite WAL and foreign-key cascading are enabled.
- Default database: `data/medcircle.sqlite`.

For future schema changes, add explicit migrations. `CREATE TABLE IF NOT EXISTS` alone does not alter an existing table.
