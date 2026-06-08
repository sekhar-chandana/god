const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const db = require('./database');
const { generateToken, authenticateAdmin, comparePassword, hashPassword } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure upload folders exist
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const UPLOADS_DONATIONS = path.join(UPLOADS_DIR, 'donations');
const UPLOADS_EXPENSES = path.join(UPLOADS_DIR, 'expenses');
const UPLOADS_GALLERY = path.join(UPLOADS_DIR, 'gallery');

[UPLOADS_DIR, UPLOADS_DONATIONS, UPLOADS_EXPENSES, UPLOADS_GALLERY].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure static file serving
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ----------------------------------------------------
// MULTER FILE UPLOAD CONFIGURATIONS
// ----------------------------------------------------
const storageDonations = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DONATIONS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `donation-${Date.now()}${ext}`);
  }
});
const uploadDonation = multer({ storage: storageDonations });

const storageExpenses = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_EXPENSES),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `expense-${Date.now()}${ext}`);
  }
});
const uploadExpense = multer({ storage: storageExpenses });

const storageGallery = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_GALLERY),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `gallery-${Date.now()}${ext}`);
  }
});
const uploadGallery = multer({ storage: storageGallery });

// ----------------------------------------------------
// PUBLIC ROUTING (Public Dashboard API)
// ----------------------------------------------------

// Admin authentication
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please enter your username and password." });
  }

  const users = db.getCollection('users');
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user || !comparePassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password. Please try again." });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// Admin verification status check
app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Get active payment methods & QR details
app.get('/api/qr', (req, res) => {
  res.json(db.getQrCodes());
});

// Submit a new donation with payment screenshot
app.post('/api/donations', uploadDonation.single('screenshot'), (req, res) => {
  try {
    const { donorName, phone, amount, message } = req.body;
    
    if (!donorName || !phone || !amount) {
      return res.status(400).json({ error: "Name, Phone Number, and Amount are required fields." });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a valid positive number." });
    }

    const donationItem = {
      donorName: donorName.trim(),
      phone: phone.trim(),
      amount: numericAmount,
      message: (message || "").trim(),
      screenshotPath: req.file ? `/uploads/donations/${req.file.filename}` : "",
      status: "pending", // Requires admin validation
      timestamp: new Date().toISOString()
    };

    const inserted = db.insert('donations', donationItem);
    res.status(201).json({
      message: "Donation submitted successfully! It will appear on the donor wall after admin verification.",
      donation: inserted
    });
  } catch (error) {
    console.error("Donation submission error:", error);
    res.status(500).json({ error: "Server error during donation processing." });
  }
});

// Get all *approved* donations for the public scroll-wall
app.get('/api/donations', (req, res) => {
  const donations = db.getCollection('donations');
  const approved = donations
    .filter(d => d.status === 'approved')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(approved);
});

// Get list of itemized expenses
app.get('/api/expenses', (req, res) => {
  const expenses = db.getCollection('expenses');
  const sorted = expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sorted);
});

// Get upcoming and current events schedules
app.get('/api/events', (req, res) => {
  const events = db.getCollection('events');
  const sorted = events.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
  res.json(sorted);
});

// Get active banners & announcements
app.get('/api/announcements', (req, res) => {
  const list = db.getCollection('announcements');
  const active = list.filter(a => a.isActive !== false).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(active);
});

// Get photos and video celebrations gallery
app.get('/api/gallery', (req, res) => {
  const list = db.getCollection('gallery');
  const sorted = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});

// Aggregate financial metrics (Goal, Total Collections, Balances, Top Donors)
app.get('/api/stats', (req, res) => {
  const donations = db.getCollection('donations');
  const expenses = db.getCollection('expenses');

  // Sum approved funds
  const approvedDonations = donations.filter(d => d.status === 'approved');
  const totalCollected = approvedDonations.reduce((sum, d) => sum + d.amount, 0);

  // Sum active expenses
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  const remainingBalance = totalCollected - totalSpent;

  // Compile top donors ranking
  const donorMap = {};
  approvedDonations.forEach(d => {
    const key = d.donorName.trim();
    donorMap[key] = (donorMap[key] || 0) + d.amount;
  });

  const topDonors = Object.keys(donorMap)
    .map(name => ({ name, totalAmount: donorMap[name] }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  res.json({
    goalAmount: 200000, // Target goal of ₹2,00,000 for the festival
    totalCollected,
    totalSpent,
    remainingBalance,
    topDonors,
    donationsCount: approvedDonations.length,
    expensesCount: expenses.length
  });
});

// ----------------------------------------------------
// SECURE ADMIN CONTROL ROUTES (JWT GUARDED)
// ----------------------------------------------------

// Admin get ALL donations (including pending/rejected proofs)
app.get('/api/admin/donations', authenticateAdmin, (req, res) => {
  const donations = db.getCollection('donations');
  const sorted = donations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(sorted);
});

// Admin change donation status (approve or reject)
app.post('/api/admin/donations/:id/status', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: "Invalid status value. Must be 'approved', 'rejected' or 'pending'." });
  }

  const updated = db.update('donations', id, { status });
  if (!updated) {
    return res.status(404).json({ error: "Donation record not found." });
  }

  res.json({ message: `Donation was successfully ${status}!`, donation: updated });
});

// Admin edit UPI details or toggle gateways
app.post('/api/admin/qr', authenticateAdmin, (req, res) => {
  const updates = req.body;
  const updatedCodes = db.updateQrCodes(updates);
  res.json({ message: "Payment information updated successfully.", qrCodes: updatedCodes });
});

// Admin add a new festival expense with bill proof upload
app.post('/api/admin/expenses', authenticateAdmin, uploadExpense.single('receipt'), (req, res) => {
  const { title, amount, category, description, date } = req.body;

  if (!title || !amount || !category || !date) {
    return res.status(400).json({ error: "Title, Amount, Category, and Date are required." });
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number." });
  }

  const expenseItem = {
    title: title.trim(),
    amount: numericAmount,
    category: category.trim(),
    description: (description || "").trim(),
    receiptPath: req.file ? `/uploads/expenses/${req.file.filename}` : "",
    date: date
  };

  const inserted = db.insert('expenses', expenseItem);
  res.status(201).json({ message: "Expense recorded successfully.", expense: inserted });
});

// Admin delete expense
app.delete('/api/admin/expenses/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const expense = db.findById('expenses', id);

  if (!expense) {
    return res.status(404).json({ error: "Expense record not found." });
  }

  // Delete matching bill scan if it exists locally
  if (expense.receiptPath && expense.receiptPath.startsWith('/uploads/')) {
    const fullPath = path.join(__dirname, '..', expense.receiptPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error("Error deleting expense receipt file:", err);
      }
    }
  }

  db.delete('expenses', id);
  res.json({ message: "Expense record deleted successfully." });
});

// Admin manage festival timeline events (Create, Edit, Delete)
app.post('/api/admin/events', authenticateAdmin, (req, res) => {
  const { title, date, time, description } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ error: "Title, Date, and Time are required fields." });
  }

  const eventItem = {
    title: title.trim(),
    date: date,
    time: time.trim(),
    description: (description || "").trim(),
    status: "upcoming"
  };

  const inserted = db.insert('events', eventItem);
  res.status(201).json({ message: "Event added to timeline schedule.", event: inserted });
});

app.put('/api/admin/events/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = db.update('events', id, updates);
  if (!updated) {
    return res.status(404).json({ error: "Event record not found." });
  }

  res.json({ message: "Event updated successfully.", event: updated });
});

app.delete('/api/admin/events/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = db.delete('events', id);
  
  if (!deleted) {
    return res.status(404).json({ error: "Event record not found." });
  }

  res.json({ message: "Event deleted from timeline." });
});

// Admin Announcements management (Add, Delete)
app.post('/api/admin/announcements', authenticateAdmin, (req, res) => {
  const { content } = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).json({ error: "Announcement text cannot be empty." });
  }

  const annItem = {
    content: content.trim(),
    timestamp: new Date().toISOString(),
    isActive: true
  };

  const inserted = db.insert('announcements', annItem);
  res.status(201).json({ message: "Announcement published live.", announcement: inserted });
});

app.delete('/api/admin/announcements/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = db.delete('announcements', id);

  if (!deleted) {
    return res.status(404).json({ error: "Announcement not found." });
  }

  res.json({ message: "Announcement removed." });
});

// Admin Gallery management (Upload image/video, Delete)
app.post('/api/admin/gallery', authenticateAdmin, uploadGallery.single('media'), (req, res) => {
  const { title } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Please upload a photo or video file." });
  }

  const mime = req.file.mimetype;
  let type = "image";
  if (mime.startsWith('video/')) {
    type = "video";
  }

  const galleryItem = {
    title: (title || "").trim() || "Utsavam Highlight",
    path: `/uploads/gallery/${req.file.filename}`,
    type: type,
    createdAt: new Date().toISOString()
  };

  const inserted = db.insert('gallery', galleryItem);
  res.status(201).json({ message: "Media uploaded to festival gallery.", item: inserted });
});

app.delete('/api/admin/gallery/:id', authenticateAdmin, (req, res) => {
  const { id } = req.params;
  const item = db.findById('gallery', id);

  if (!item) {
    return res.status(404).json({ error: "Gallery item not found." });
  }

  // Delete media file from uploads
  if (item.path && item.path.startsWith('/uploads/')) {
    const fullPath = path.join(__dirname, '..', item.path);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error("Error deleting gallery media file:", err);
      }
    }
  }

  db.delete('gallery', id);
  res.json({ message: "Gallery item removed successfully." });
});

// Admin update security profile credentials
app.post('/api/admin/profile', authenticateAdmin, (req, res) => {
  const { name, newPassword } = req.body;
  const adminId = req.user.id;

  const updates = {};
  if (name && name.trim() !== "") {
    updates.name = name.trim();
  }

  if (newPassword && newPassword.trim().length >= 6) {
    updates.passwordHash = hashPassword(newPassword);
  } else if (newPassword) {
    return res.status(400).json({ error: "New password must be at least 6 characters long." });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No profile updates provided." });
  }

  const updated = db.update('users', adminId, updates);
  res.json({
    message: "Admin profile updated successfully.",
    user: {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      role: updated.role
    }
  });
});

// Wildcard router: Fallback to single page client interface
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Start the Express HTTP listener
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  Sri Ammavari Utsavam Server Live!     `);
  console.log(`  Running on: http://localhost:${PORT}   `);
  console.log(`  Local Database: data/db.json           `);
  console.log(`  Default Admin Creds:                   `);
  console.log(`    User: admin                          `);
  console.log(`    Pass: AmmavariSeva2026!              `);
  console.log(`========================================`);
});
