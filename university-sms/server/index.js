const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./db');
const departmentsRoute = require('./routes/departments');
const facultyRoute = require('./routes/faculty');
const studentsRoute = require('./routes/students');
const coursesRoute = require('./routes/courses');
const schedulesRoute = require('./routes/schedules');
const enrollmentsRoute = require('./routes/enrollments');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/departments', departmentsRoute);
app.use('/api/faculty', facultyRoute);
app.use('/api/students', studentsRoute);
app.use('/api/courses', coursesRoute);
app.use('/api/schedules', schedulesRoute);
app.use('/api/enrollments', enrollmentsRoute);

// Dashboard summary stats for the landing view
app.get('/api/stats', async (req, res) => {
  try {
    const [[{ total_students }]] = await pool.query('SELECT COUNT(*) AS total_students FROM students WHERE status = "active"');
    const [[{ total_faculty }]]  = await pool.query('SELECT COUNT(*) AS total_faculty FROM faculty WHERE status = "active"');
    const [[{ total_courses }]]  = await pool.query('SELECT COUNT(*) AS total_courses FROM courses');
    const [[{ total_offerings }]] = await pool.query('SELECT COUNT(*) AS total_offerings FROM course_schedule');
    const [[{ total_enrollments }]] = await pool.query('SELECT COUNT(*) AS total_enrollments FROM enrollments WHERE status = "enrolled"');
    res.json({ total_students, total_faculty, total_courses, total_offerings, total_enrollments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`University SMS server running on http://localhost:${PORT}`);
});
