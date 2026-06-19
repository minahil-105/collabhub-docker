const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CollabHub API' });
});

// Mock users endpoint
app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Ali Hassan', dept: 'Computer Science' },
    { id: 2, name: 'Sara Khan', dept: 'Mathematics' },
    { id: 3, name: 'Ahmed Raza', dept: 'Physics' },
  ]);
});

// Mock stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: 120,
    activeRooms: 14,
    messages: 3400,
  });
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));
