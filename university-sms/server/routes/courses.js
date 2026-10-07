const express = require('express');
const router = express.Router();
const pool = require('../db');

const BASE_SELECT = `
  SELECT c.*, d.dept_name, d.dept_code
  FROM courses c
  JOIN departments d ON d.department_id = c.department_id
`;

// GET all courses
router.get('/', async (req, res) => {
  const { department_id } = req.query;
  const where = department_id ? 'WHERE c.department_id = ?' : '';
  const params = department_id ? [department_id] : [];
  try {
    const [rows] = await pool.query(`${BASE_SELECT} ${where} ORDER BY c.course_code`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create course
router.post('/', async (req, res) => {
  const { course_code, title, credits, department_id, description } = req.body;
  if (!course_code || !title || !credits || !department_id) {
    return res.status(400).json({ error: 'course_code, title, credits, department_id are required' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO courses (course_code, title, credits, department_id, description)
       VALUES (?, ?, ?, ?, ?)`,
      [course_code, title, credits, department_id, description || null]
    );
    res.status(201).json({ course_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Course code already exists' });
    if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Invalid department_id' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update course
router.put('/:id', async (req, res) => {
  const { course_code, title, credits, department_id, description } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE courses SET course_code=?, title=?, credits=?, department_id=?, description=?
       WHERE course_id=?`,
      [course_code, title, credits, department_id, description, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Course not found' });
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE course
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM courses WHERE course_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Course not found' });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Cannot delete: course has scheduled offerings' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
