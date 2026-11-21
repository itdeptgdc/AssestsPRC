# AssetQR — Asset Registry with QR Codes

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Framer Motion, Recharts, html5-qrcode |
| Backend  | Node.js + Express 5 REST API, JWT auth, Multer uploads |
| Database | PostgreSQL (database `assetqr_db`, created, migrated and seeded automatically on first start) |
| DB admin | Adminer (or pgAdmin) |

No Docker needed. Languages: **Thai (default)**, Khmer, English.

## 1. Install the requirements (Windows)

1. **Node.js 20 LTS**: https://nodejs.org (tick "Add to PATH")
2. **PostgreSQL 16**: https://www.postgresql.org/download/windows/
   Remember the password you give the `postgres` user. pgAdmin is included in the installer.
3. *(Optional)* **Adminer**: install PHP (https://windows.php.net/download), download `adminer.php` from https://www.adminer.org, then run
   `php -S localhost:8080 adminer.php` and open http://localhost:8080 (System: PostgreSQL, Server: `localhost`, Database: `assetqr_db`).

## 2. Configure

Edit `backend/.env`. You usually only need to change the PostgreSQL password in `DATABASE_URL`:

```
DATABASE_URL=postgres://postgres:YOUR_PG_PASSWORD@localhost:5432/assetqr_db
ADMIN_EMAIL=assestsadmin@gmail.com
ADMIN_PASSWORD=password
```

`frontend/.env.local` points the web app to the API (`BACKEND_URL=http://localhost:4000`).

## 3. Run

From the project root:

```bash
npm run setup     # installs root, backend and frontend packages (first time only)
npm run dev       # starts API on :4000 and web on :3000 together
```

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API     | http://localhost:4000/api/health |

**First login:** `assestsadmin@gmail.com` / `password`. Change the password in Settings after logging in.
On the first start the API creates `assetqr_db`, all tables, the admin account and the master data from the code sheet.
The admin account is created only when the users table is empty.

### Production

```bash
npm run build     # builds the Next.js app
npm start         # runs API + web in production mode
```

To keep it running after logoff on Windows Server, use a service wrapper such as **pm2** (`npm i -g pm2`, then
`pm2 start "npm start" --name assetqr`) or **NSSM**.
The phone camera needs **HTTPS**, so put IIS / Nginx / Caddy with a TLS certificate in front of port 3000.

## HTTPS (needed for the phone camera and app install)

`start.ps1` runs a small gateway (`scripts/gateway.js`) on **port 3000** that speaks both protocols:

| You open | Result |
|---|---|
| `https://<server-ip>:3000` | the app (proxied to Next.js on `127.0.0.1:3001`) |
| `http://<server-ip>:3000` | redirected to https |
| `http://<server-ip>:3000/cert` | one-time setup page: download the certificate + steps for Android / iPhone / Windows |

Certificates are created on first start by `node scripts/make-certs.js [ip]` into `runtime/certs/`
(no system certificate stores are changed). The private CA is **name-constrained** to this server's IP,
`localhost` and the computer name, so devices that trust it cannot be fooled for any other website.
Keep `runtime/certs/ca.key` private. If the server IP changes, run `npm run certs -- <new-ip>` and restart the gateway.

Devices without the certificate can still use the camera: open the https link and choose **Advanced → Proceed**.
Installing the app (PWA) requires the certificate to be trusted.

## Code tables

| Table | Holds | Menu |
|---|---|---|
| `department_codes` | Dept Code (`dept_no`, e.g. 504) + department name | Departments |
| `asset_codes` | Asset/account code (e.g. 602) + description, its type numbers in `asset_types` | Asset Code |

The standard lists (Department Code and Asset Code sheets) live in `backend/src/seed.js`. To re-apply them to an
existing database (matching codes are renamed, missing ones added, others removed — or deactivated if assets use them):

```bash
cd backend
node src/seed.js --codes
```

## Asset code format

```
P   401  -  602  -  01  -  23  -  0001
│   │       │       │      │      └─ Running number (auto, per prefix, concurrency-safe)
│   │       │       │      └──────── Year: 00 = fully depreciated / unknown, 23 = 2023 … current year
│   │       │       └─────────────── Type number (per account code, e.g. 602-01 All in One)
│   │       └─────────────────────── Asset account code (Categories, e.g. 602 COMPUTER HARDWARE)
│   └─────────────────────────────── Department code (e.g. 401 CASINO - GAMING)
└─────────────────────────────────── Company code (P = Poipet Resort, G = Grand Diamond)
```

## Features

Dashboard, asset register, add/edit with live code builder, asset detail with QR, camera QR scan, public QR page (`/a/<code>`),
inspection schedule and checklists, repair jobs, print QR labels/cards, master data, reports with CSV export, notifications,
and user management:
- roles: admin, manager, staff, viewer
- department per user
- activate / deactivate toggle
- password reset
- force sign-out
- users with work history can only be deactivated, not deleted
