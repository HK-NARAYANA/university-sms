const express = require('express');
const router = express.Router();
const pool = require('../db');

const BASE_SELECT = `
  SELECT s.*, d.dept_name, d.dept_code
  FROM students s
  JOIN departments d ON d.department_id = s.major_department_id
`;

// GET all students (optional filters)
router.get('/', async (req, res) => {
  const { department_id, standing, status, q } = req.query;
  const clauses = [];
  const params = [];
  if (department_id) { clauses.push('s.major_department_id = ?'); params.push(department_id); }
  if (standing)       { clauses.push('s.standing = ?'); params.push(standing); }
  if (status)         { clauses.push('s.status = ?'); params.push(status); }
  if (q)              { clauses.push('(s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_number LIKE ?)');
                         params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(`${BASE_SELECT} ${where} ORDER BY s.last_name`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single student with their enrollment history
router.get('/:id', async (req, res) => {
  try {
    const [[student]] = await pool.query(`${BASE_SELECT} WHERE s.student_id = ?`, [req.params.id]);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [enrollments] = await pool.query(
      `SELECT e.enrollment_id, e.status, e.grade, e.enrollment_date,
              c.course_code, c.title, c.credits, cs.semester, cs.academic_year
       FROM enrollments e
       JOIN course_schedule cs ON cs.schedule_id = e.schedule_id
       JOIN courses c ON c.course_id = cs.course_id
       WHERE e.student_id = ?
       ORDER BY cs.academic_year DESC, cs.semester`,
      [req.params.id]
    );
    res.json({ ...student, enrollments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create student
router.post('/', async (req, res) => {
  const { student_number, first_name, last_name, email, date_of_birth,
          major_department_id, enrollment_year, standing, status } = req.body;
  if (!student_number || !first_name || !last_name || !email || !major_department_id || !enrollment_year) {
    return res.status(400).json({ error: 'student_number, first_name, last_name, email, major_department_id, enrollment_year are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO students (student_number, first_name, last_name, email, date_of_birth,
                              major_department_id, enrollment_year, standing, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_number, first_name, last_name, email, date_of_birth || null,
       major_department_id, enrollment_year, standing || 'freshman', status || 'active']
    );
    res.status(201).json({ student_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Student number or email already exists' });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Invalid major_department_id' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update student
router.put('/:id', async (req, res) => {
  const { first_name, last_name, email, date_of_birth,
          major_department_id, enrollment_year, standing, status } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE students SET first_name=?, last_name=?, email=?, date_of_birth=?,
              major_department_id=?, enrollment_year=?, standing=?, status=?
       WHERE student_id=?`,
      [first_name, last_name, email, date_of_birth || null,
       major_department_id, enrollment_year, standing, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ updated: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE student
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM students WHERE student_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
