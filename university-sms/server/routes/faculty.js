const express = require('express');
const router = express.Router();
const pool = require('../db');

const BASE_SELECT = `
  SELECT f.*, d.dept_name, d.dept_code
  FROM faculty f
  JOIN departments d ON d.department_id = f.department_id
`;

// GET all faculty (optionally filter by department or status)
router.get('/', async (req, res) => {
  const { department_id, status } = req.query;
  const clauses = [];
  const params = [];
  if (department_id) { clauses.push('f.department_id = ?'); params.push(department_id); }
  if (status)         { clauses.push('f.status = ?'); params.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(`${BASE_SELECT} ${where} ORDER BY f.last_name`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single faculty member, including their current course load
router.get('/:id', async (req, res) => {
  try {
    const [[faculty]] = await pool.query(`${BASE_SELECT} WHERE f.faculty_id = ?`, [req.params.id]);
    if (!faculty) return res.status(404).json({ error: 'Faculty member not found' });

    const [courses] = await pool.query(
      `SELECT cs.schedule_id, c.course_code, c.title, cs.semester, cs.academic_year,
              cs.days_of_week, cs.start_time, cs.end_time, cs.room
       FROM course_schedule cs
       JOIN courses c ON c.course_id = cs.course_id
       WHERE cs.faculty_id = ?
       ORDER BY cs.academic_year DESC, cs.semester`,
      [req.params.id]
    );
    res.json({ ...faculty, course_load: courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create faculty
router.post('/', async (req, res) => {
  const { first_name, last_name, email, title, department_id, hire_date, status } = req.body;
  if (!first_name || !last_name || !email || !title || !department_id || !hire_date) {
    return res.status(400).json({ error: 'first_name, last_name, email, title, department_id, hire_date are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO faculty (first_name, last_name, email, title, department_id, hire_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, title, department_id, hire_date, status || 'active']
    );
    res.status(201).json({ faculty_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Invalid department_id' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update faculty
router.put('/:id', async (req, res) => {
  const { first_name, last_name, email, title, department_id, hire_date, status } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE faculty SET first_name=?, last_name=?, email=?, title=?, department_id=?, hire_date=?, status=?
       WHERE faculty_id=?`,
      [first_name, last_name, email, title, department_id, hire_date, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Faculty member not found' });
    res.json({ updated: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE faculty (blocked if they still teach an active offering, enforced by FK RESTRICT)
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM faculty WHERE faculty_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Faculty member not found' });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete: faculty member is assigned to one or more course offerings' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
