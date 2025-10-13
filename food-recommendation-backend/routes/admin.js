const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 获取所有表
router.get('/tables', async (req, res) => {
  try {
    const tables = await db.query(`
      SELECT tablename
      FROM pg_catalog.pg_tables
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    `);
    res.json(tables.rows.map(row => row.tablename));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 获取表数据
router.get('/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    // Basic validation to prevent SQL injection, but consider a more robust solution
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return res.status(400).send('Invalid table name');
    }
    const data = await db.query(`SELECT * FROM ${tableName}`);
    res.json(data.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
