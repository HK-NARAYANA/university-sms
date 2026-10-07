const express = require('express');
const router = express.Router();
const pool = require('../db');

const BASE_SELECT = `
  SELECT cs.*, c.course_code, c.title, c.credits,
         f.first_name AS faculty_first_name, f.last_name AS faculty_last_name,
         v.seats_taken, v.seats_available
  FROM course_schedule cs
  JOIN courses c ON c.course_id = cs.course_id
  JOIN faculty f ON f.faculty_id = cs.faculty_id
  JOIN v_schedule_seats v ON v.schedule_id = cs.schedule_id
`;

// GET all schedule entries (optionally filter by term)
router.get('/', async (req, res) => {
  const { semester, academic_year } = req.query;
  const clauses = [];
  const params = [];
  if (semester)      { clauses.push('cs.semester = ?'); params.push(semester); }
  if (academic_year) { clauses.push('cs.academic_year = ?'); params.push(academic_year); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(
      `${BASE_SELECT} ${where} ORDER BY cs.academic_year DESC, cs.semester, c.course_code`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new offering. Checks for room/time double-booking for the instructor.
router.post('/', async (req, res) => {
  const { course_id, faculty_id, semester, academic_year, days_of_week, start_time, end_time, room, capacity } = req.body;
  if (!course_id || !faculty_id || !semester || !academic_year || !days_of_week || !start_time || !end_time || !room || !capacity) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ error: 'start_time must be before end_time' });
  }
  try {
    // Guard against the same instructor being double-booked in the same term/time
    const [conflicts] = await pool.query(
      `SELECT schedule_id FROM course_schedule
       WHERE faculty_id = ? AND semester = ? AND academic_year = ?
         AND days_of_week = ? AND NOT (end_time <= ? OR start_time >= ?)`,
      [faculty_id, semester, academic_year, days_of_week, start_time, end_time]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'Instructor already has a conflicting offering at this time' });
    }

    const [result] = await pool.query(
      `INSERT INTO course_schedule (course_id, faculty_id, semester, academic_year, days_of_week, start_time, end_time, room, capacity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course_id, faculty_id, semester, academic_year, days_of_week, start_time, end_time, room, capacity]
    );
    res.status(201).json({ schedule_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This exact offering (course, term, room, time) already exists' });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Invalid course_id or faculty_id' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE a scheduled offering
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM course_schedule WHERE schedule_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Offering not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
