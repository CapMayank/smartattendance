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
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="super-secret-key-for-development"
NEXTAUTH_URL="http://localhost:3000"
TZ="Asia/Kolkata"
```

### 3. Setup the Database
Apply the Prisma schema to create your local SQLite database:
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

## 🌐 Production Architecture

The production environment is hosted on an Oracle Cloud Ubuntu instance using **PostgreSQL**, **PM2** (process manager), and **Nginx** (reverse proxy). 

The system operates two main services:
1.  **Next.js App:** Runs on port `3000` (proxied to port 80/443 via Nginx).
2.  **WebSocket Server:** Runs on port `7788` specifically to receive real-time ping/punch data from biometric hardware.

> For complete details on setting up the production environment from scratch, refer to the `system_documentation.md` (Artifact).
