# InTime Smart Attendance

![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-blue?logo=prisma)
![Node.js](https://img.shields.io/badge/Node.js-WebSockets-green?logo=node.js)
![Database](https://img.shields.io/badge/Database-PostgreSQL%20%7C%20SQLite-lightgrey)

InTime is a full-stack, real-time web application designed to manage employee attendance, integrate directly with biometric attendance machines (AiFace/ZKTeco), and process complex HR attendance policies.

## 🚀 Features
*   **Real-time Biometric Integration:** Machines connect securely via WebSockets to automatically log punches.
*   **Comprehensive Dashboard:** A powerful Next.js admin panel to monitor attendance, staff, and devices.
*   **Advanced Policy Engine:** Handles rules for early arrivals, late allowances, overtime calculations, and automatic half-day logic.
*   **Automated Deployment:** CI/CD enabled via GitHub actions for zero-downtime updates.

---

## 🛠️ Tech Stack

*   **Frontend & API:** [Next.js](https://nextjs.org/) (React)
*   **Database ORM:** [Prisma](https://www.prisma.io/)
*   **Authentication:** [NextAuth.js](https://next-auth.js.org/) with Prisma Adapter
*   **Real-time Server:** Node.js WebSockets (`ws` library)

---

## 💻 Local Development Setup

To run this project on your local machine for development:

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory (or use the existing one):
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/attendance?schema=public"
NEXTAUTH_SECRET="replace-with-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
TZ="Asia/Kolkata"
```
A template is committed as `.env.example`. The Prisma schema uses PostgreSQL; to use SQLite locally instead, set `provider = "sqlite"` in `prisma/schema.prisma` and `DATABASE_URL="file:./dev.db"`.

### 3. Setup the Database
Apply the Prisma schema to create the database tables:
```bash
npx prisma db push
```

### 4. Run the Servers
Start both the Next.js frontend and the WebSocket server simultaneously:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the application.

---

## Timezone

The app and the websockets process always run in `Asia/Kolkata` (IST); the process `TZ` is forced in code and no longer follows the host or pm2 env.

Before deploying to a host that was previously running in UTC, back up the database and check how dates are stored:

```sql
SELECT date FROM "Holiday" LIMIT 5;
SELECT date FROM "DailyRecord" ORDER BY date DESC LIMIT 5;
```

- Values at `18:30:00` on the previous day (UTC) mean IST-midnight storage: nothing to do.
- Values at `00:00:00` UTC mean UTC-midnight storage: existing holidays and daily records need shifting (or the affected months recalculated). Lateness figures will change for any recalculated month.

---

## Shifts and shift history

A teacher's shift is a history of dated assignments, and each day is judged by the shift that applied on that day. Changing a shift never rewrites past months. Until a teacher's first change they keep using their current shift, so nothing changes at deploy.

**Changing a shift:** Staff page, edit the teacher, pick the shift and a start date. The preview shows how many days will change and how many fall in locked payroll months; locked months are never touched.

**Suggestions:** the system looks at the last 28 days and proposes a change only when a teacher's arrival is steady and 20 or more minutes away from their shift start (it needs 10 days of data, or 15 for a later start). It never applies a suggestion without approval. Detection runs at most once every 6 hours; the "Check now" button on the Shifts page forces a run. Approving a suggestion that proposes a new shift creates that shift.

**Deleting shifts:** a shift cannot be deleted while teachers, shift changes or pending suggestions use it.

**Editing a shift itself:** changing the start or end time of a shift still changes every past day that used it. To keep history, create a new shift and move teachers to it.

**Recovery:** if a shift change saves but the recalculation fails, the Shifts page shows a "Retry" banner that recalculates while the page stays open (the Staff edit dialog has the same "Recalculate" button while it is open). Afterwards, open the Reports view for each affected month: it recalculates all staff for that month. Monthly payroll reads the stored daily records, so if a banner was dismissed, recalculate the affected months (through Reports) before generating payroll.

**Known limitations:**
- The Reports "Shift" column shows a teacher's current shift, even next to past days that were judged by an earlier shift.
- Editing the times of a shift itself still changes past days that used it (see "Editing a shift itself" above).

**Deploy:** run `prisma db push`. It adds two tables (`ShiftAssignment`, `ShiftSuggestion`) and one nullable column (`Policy.shiftDetectionRanAt`); all changes are additive.

---

## 🌐 Production Architecture

The production environment is hosted on an Oracle Cloud Ubuntu instance using **PostgreSQL**, **PM2** (process manager), and **Nginx** (reverse proxy). 

The system operates two main services:
1.  **Next.js App:** Runs on port `3000` (proxied to port 80/443 via Nginx).
2.  **WebSocket Server:** Runs on port `7788` specifically to receive real-time ping/punch data from biometric hardware.

> For complete details on setting up the production environment from scratch, refer to the `system_documentation.md` (Artifact).
