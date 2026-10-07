# University Student Management System

Full-stack app automating **enrollment tracking**, **course scheduling**, and **faculty administration**, backed by a normalized MySQL schema.

**Stack:** MySQL · Node.js/Express · HTML/CSS/JavaScript (no frontend framework, no build step)

## 1. Database schema

Six normalized tables: `departments`, `faculty`, `students`, `courses`, `course_schedule` (a term offering of a course), `enrollments` (a student registered into an offering). Integrity is enforced with:
- Foreign keys (`ON DELETE RESTRICT` for faculty/department references so you can't orphan records; `CASCADE` where deleting the parent should clean up children, e.g. deleting a student drops their enrollments)
- `UNIQUE` constraints — no duplicate emails/student numbers/course codes, and `uq_student_schedule` blocks double-enrolling a student in the same offering
- `CHECK` constraints — credit range, positive capacity, start_time < end_time
- A view (`v_schedule_seats`) that computes live seat availability per offering

## 2. Setup

**Prerequisites:** Node.js 18+, MySQL 8+ running locally (or update `.env` for a remote instance).

```bash
# 1. Install dependencies
npm install

# 2. Create the database and load sample data
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

# 3. Configure credentials
cp .env.example .env
# edit .env with your MySQL user/password

# 4. Run the server
npm start
```

> **Note on default installs (e.g. `apt install mysql-server` on Ubuntu):** the `root` MySQL user is often locked to local socket authentication and can't log in over TCP, which is what `mysql2` uses — you'll see `ER_ACCESS_DENIED_NO_PASSWORD_ERROR` even with the right password. Create a dedicated app user instead (also better practice than running as root):
> ```sql
> CREATE USER 'sms_app'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
> GRANT ALL PRIVILEGES ON university_sms.* TO 'sms_app'@'localhost';
> FLUSH PRIVILEGES;
> ```
> Then set `DB_USER=sms_app` / `DB_PASSWORD=your_password` in `.env`.

Then open **http://localhost:3000**.

## 3. Project structure

```
university-sms/
├── database/
│   ├── schema.sql       # tables, constraints, indexes, view
│   └── seed.sql         # sample departments/faculty/students/courses
├── server/
│   ├── index.js         # Express app + /api/stats dashboard endpoint
│   ├── db.js            # mysql2 connection pool
│   └── routes/
│       ├── departments.js
│       ├── students.js
│       ├── faculty.js
│       ├── courses.js
│       ├── schedules.js     # course_schedule (term offerings)
│       └── enrollments.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js        # vanilla JS — view routing + all API calls
├── package.json
└── .env.example
```

## 4. Business rules worth knowing

- **Enrollment capacity**: `POST /api/enrollments` locks the offering row, and if it's full the student is placed on the `waitlisted` status instead of `enrolled` — no over-capacity registration.
- **Instructor double-booking**: `POST /api/schedules` rejects a new offering if the same instructor already has an offering at an overlapping time in the same term.
- **Referential safety**: you can't delete a department, course, or faculty member that's still referenced elsewhere (e.g. a faculty member currently teaching a scheduled offering) — the API returns a 409 with an explanation instead of silently orphaning data.

## 5. API summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/api/departments` | reference data |
| GET/POST/PUT/DELETE | `/api/students` | enrollment module — student roster |
| GET/POST/PUT/DELETE | `/api/faculty` | faculty admin — records + course load |
| GET/POST/PUT/DELETE | `/api/courses` | course catalog |
| GET/POST/DELETE | `/api/schedules` | scheduling module — term offerings |
| GET/POST/PUT/DELETE | `/api/enrollments` | enrollment records (enroll/drop/grade) |
| GET | `/api/stats` | dashboard counts |

## Extending it

- Add auth (e.g. `express-session` + role checks) before deploying beyond local use — there's currently none.
- Swap `mysql2` queries for an ORM (Prisma/Sequelize) if the schema grows.
- Add a `transcripts` report (GPA calculation from `enrollments.grade`) as a natural next module.
