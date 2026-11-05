# Pathway Job Portal

A full-stack job portal built with React, Express, and MongoDB. Students can discover roles, submit resumes, and track applications; recruiters can publish jobs and manage candidates; administrators can review people and applications.

## Project structure

```text
client/                 React + Vite frontend
  src/PortalApp.jsx      React Router pages, role-aware dashboards, forms, and application flows
  src/main.jsx           Active app entry point
  src/App.css            Responsive portal design
server/                  Express API and Mongoose data models
  index.js               API routes, authentication, and server startup
  models.js              User, job, and application schemas
  middleware.js          JWT authentication and role checks
  uploads.js             Private resume upload validation
  seed-admin.js          One-time administrator account setup
.env.example             Template for the server-side MongoDB and API configuration
```

## Run locally

Prerequisites: Node.js 20+ and a MongoDB instance (local MongoDB Community Server or MongoDB Atlas).

1. Copy `.env.example` to `server/.env`. For MongoDB Atlas, replace the `MONGO_URI` placeholders with the database username, password, and host from Atlas. In Atlas, create a database user and allow your development IP under **Network Access**. URL-encode special characters in the database password. Keep `server/.env` private; it is ignored by Git. Replace `JWT_SECRET` and `ADMIN_PASSWORD` with strong, private values. Configure the `SMTP_*` values and `EMAIL_FROM` to enable password reset emails.
2. Install dependencies from the project root: `npm run install:all`.
3. Verify Atlas connectivity: `npm run db:check --prefix server`.
4. Create the first admin: `npm run seed:admin`.
5. Start the API and frontend together: `npm run dev`.
6. Open `http://localhost:5173`. The API is at `http://localhost:5000/api`.

The backend reads `server/.env` and connects to MongoDB with Mongoose. Database credentials must stay in server-side environment variables and must not be added to client code or `VITE_*` variables.

## Production deployment

Deploy the frontend and API as separate services, or configure a same-origin reverse proxy for `/api`.

### Frontend

- Build command: `npm run build --prefix client` (or `npm run build` from the project root).
- Publish the `client/dist` directory with a static hosting provider and enable SPA fallback to `index.html` for client-side routes.
- If the API has its own public domain, set the frontend build variable `VITE_API_URL` to its base URL including `/api`, for example `https://api.example.com/api`. This value is public configuration, not a secret. If `/api` is reverse-proxied by the frontend host, leave `VITE_API_URL` unset.
- `VITE_API_PROXY_TARGET` only configures the local Vite development proxy; it does not configure production hosting.

### Backend

- Install and start commands: `npm install --prefix server` and `npm start --prefix server`. The root `npm start` script also starts the API.
- Configure these environment variables in the backend host's secret/environment settings: `PORT` (provided by most hosts), `MONGO_URI` (MongoDB Atlas connection string), `JWT_SECRET` (long random secret), and `CLIENT_ORIGIN` (the exact public frontend origin, such as `https://portal.example.com`). `CLIENT_ORIGIN` accepts comma-separated origins when multiple frontend domains are needed. Local Vite origins on ports 5173 and 5174 remain allowed.
- Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` securely to create the initial administrator, then run `npm run seed:admin` from the project root (or `npm run seed:admin --prefix server`). Never put backend secrets in frontend variables or source control.
- Set `RESUME_UPLOAD_DIR` to a persistent mounted volume path if the host's filesystem is ephemeral. Without persistent storage, uploaded resumes may be lost when an instance restarts or is replaced. The default local path is `server/uploads/resumes`.
- The host's normal DNS is used by default. If an environment cannot resolve MongoDB Atlas SRV records, set `MONGODB_DNS_SERVERS` to a comma-separated list of resolvers supported by that environment.
- Configure SMTP variables only if password recovery email is required. In MongoDB Atlas, allow connections from the backend host's outbound IP addresses and use a database user with only the required database permissions.

The API now waits for MongoDB connectivity before accepting requests and exits with a non-secret diagnostic if startup configuration or database connectivity is invalid. The host must expose the configured `PORT`; CORS is restricted to the configured frontend origin(s) plus the two local Vite origins.

MongoDB must be running for registration and data-backed actions. The job-search page includes sample opportunities when the API is not connected; account and application data are never stored as a substitute in the browser.

## Page routes

- `/`: preserved Pathway homepage.
- `/login/student`, `/register/student`, `/login/recruiter`, `/register/recruiter`, `/login/admin`: separate role-specific sign-in and registration pages. Admin registration is not public; create the first admin with the seed command.
- `/jobs` and `/jobs/:jobId`: searchable listings and job details with the student resume application form.
- `/dashboard/student`, `/applications`, `/profile/student`: student workspace, application tracking and profile editing.
- `/dashboard/recruiter`, `/dashboard/recruiter/jobs`, `/dashboard/recruiter/jobs/new`, `/dashboard/recruiter/jobs/:jobId/edit`, `/dashboard/recruiter/applicants`, `/profile/recruiter`: recruiter dashboard, job CRUD, applicant review and company profile.
- `/dashboard/admin`, `/dashboard/admin/users`, `/dashboard/admin/jobs`, `/dashboard/admin/messages`: admin overview, user controls, listing moderation and contact inbox.
- `/about` and `/contact`: public company information and persistent contact form.

Dashboard, profile and application routes are protected by authentication and role checks. Login pages return users to the private route they originally requested.

## API overview

- `POST /api/auth/register` and `POST /api/auth/login`: student/recruiter registration and role-aware sign-in.
- `POST /api/auth/forgot-password` and `POST /api/auth/reset-password/:token`: email-backed, expiring password reset flow (SMTP settings required).
- `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs`, `PATCH/DELETE /api/jobs/:id`: browse, inspect and manage openings.
- `GET /api/jobs/mine`: recruiter-owned openings; `GET /api/jobs/admin/all`: admin listing moderation.
- `POST /api/applications`, `GET /api/applications/mine`, `GET /api/applications`, `PATCH /api/applications/:id`: submit resumes and follow or update application status.
- `GET/PATCH /api/users/me`, `GET /api/users`: profile management and admin people listing.
- `GET /api/users/me/resume` and `PUT/DELETE /api/users/me/saved-jobs/:jobId`: student resume and saved-job management.
- `PATCH /api/users/:id/disable`: admin account access control.
- `POST /api/contact`, `GET /api/contact`: persist contact messages and review them as an admin.
- `GET /api/applications/:id/resume`: authorized resume download.
- `GET /api/health`: API and MongoDB status.

Resumes are limited to PDF/DOC/DOCX files up to 5 MB and are served only to the applicant, the relevant recruiter, or an administrator. Admin accounts are created through the seed command, never public registration.