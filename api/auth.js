const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '..', 'auth', 'users.json');
const JWT_SECRET = process.env.API_JWT_SECRET || 'change_this_secret';

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE)); } catch (e) { return []; }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

function verifyJWT(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ success: false, error: 'Invalid Authorization format' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

module.exports = { router, verifyJWT };
