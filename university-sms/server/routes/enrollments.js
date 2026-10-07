const express = require('express');
const router = express.Router();
const pool = require('../db');

const BASE_SELECT = `
  SELECT e.*, s.student_number, s.first_name AS student_first_name, s.last_name AS student_last_name,
         c.course_code, c.title, cs.semester, cs.academic_year
  FROM enrollments e
  JOIN students s ON s.student_id = e.student_id
  JOIN course_schedule cs ON cs.schedule_id = e.schedule_id
  JOIN courses c ON c.course_id = cs.course_id
`;

// GET all enrollments (optional filters)
router.get('/', async (req, res) => {
  const { student_id, schedule_id, status } = req.query;
  const clauses = [];
  const params = [];
  if (student_id)  { clauses.push('e.student_id = ?'); params.push(student_id); }
  if (schedule_id) { clauses.push('e.schedule_id = ?'); params.push(schedule_id); }
  if (status)      { clauses.push('e.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(`${BASE_SELECT} ${where} ORDER BY e.enrollment_date DESC`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST enroll a student into an offering.
// Enforces: no duplicate enrollment (DB unique constraint) and no over-capacity enrollment.
router.post('/', async (req, res) => {
  const { student_id, schedule_id } = req.body;
  if (!student_id || !schedule_id) {
    return res.status(400).json({ error: 'student_id and schedule_id are required' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the seats view logic manually via a row lock on course_schedule
    const [[seatInfo]] = await conn.query(
      `SELECT cs.capacity,
              (SELECT COUNT(*) FROM enrollments e WHERE e.schedule_id = cs.schedule_id AND e.status = 'enrolled') AS seats_taken
       FROM course_schedule cs WHERE cs.schedule_id = ? FOR UPDATE`,
      [schedule_id]
    );
    if (!seatInfo) {
      await conn.rollback();
      return res.status(404).json({ error: 'Course offering not found' });
    }

    const status = seatInfo.seats_taken >= seatInfo.capacity ? 'waitlisted' : 'enrolled';

    const [result] = await conn.query(
      `INSERT INTO enrollments (student_id, schedule_id, status) VALUES (?, ?, ?)`,
      [student_id, schedule_id, status]
    );

    await conn.commit();
    res.status(201).json({ enrollment_id: result.insertId, status });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Student is already enrolled in this offering' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Invalid student_id or schedule_id' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT update enrollment status/grade (drop, complete, assign grade)
router.put('/:id', async (req, res) => {
  const { status, grade } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE enrollments SET status = COALESCE(?, status), grade = COALESCE(?, grade) WHERE enrollment_id = ?',
      [status || null, grade || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE (withdraw) an enrollment record entirely
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM enrollments WHERE enrollment_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
