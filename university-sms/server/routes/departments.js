const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all departments
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM departments ORDER BY dept_name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new department
router.post('/', async (req, res) => {
  const { dept_code, dept_name, building } = req.body;
  if (!dept_code || !dept_name) {
    return res.status(400).json({ error: 'dept_code and dept_name are required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO departments (dept_code, dept_name, building) VALUES (?, ?, ?)',
      [dept_code, dept_name, building || null]
    );
    res.status(201).json({ department_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Department code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
