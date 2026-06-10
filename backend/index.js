require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');

const { connectDB } = require('./database');
const { generateToken, authenticateAdmin, comparePassword, hashPassword } = require('./auth');
const { cloudinary, donationStorage, expenseStorage, galleryStorage } = require('./cloudinary');

const User         = require('./models/User');
const Donation     = require('./models/Donation');
const Expense      = require('./models/Expense');
const Event        = require('./models/Event');
const Announcement = require('./models/Announcement');
const Gallery      = require('./models/Gallery');
const QrConfig     = require('./models/QrConfig');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'https://blkgod.netlify.app'
  ]
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Multer instances backed by Cloudinary storage
const uploadDonation = multer({ storage: donationStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadExpense  = multer({ storage: expenseStorage,  limits: { fileSize: 10 * 1024 * 1024 } });
const uploadGallery  = multer({ storage: galleryStorage,  limits: { fileSize: 100 * 1024 * 1024 } });

// ----------------------------------------------------
// PUBLIC ROUTES
// ----------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Please enter your username and password.' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !comparePassword(password, user.passwordHash))
      return res.status(401).json({ error: 'Invalid username or password. Please try again.' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.get('/api/auth/verify', authenticateAdmin, (req, res) => {
  res.json({ valid: true, user: req.user });
});

app.get('/api/qr', async (req, res) => {
  try {
    const config = await QrConfig.findOne();
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to load payment info.' });
  }
});

// Submit donation with payment screenshot → uploaded to Cloudinary
app.post('/api/donations', uploadDonation.single('screenshot'), async (req, res) => {
  try {
    const { donorName, phone, amount, message } = req.body;
    if (!donorName || !phone || !amount)
      return res.status(400).json({ error: 'Name, Phone Number, and Amount are required fields.' });

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0)
      return res.status(400).json({ error: 'Amount must be a valid positive number.' });

    const donation = await Donation.create({
      donorName:          donorName.trim(),
      phone:              phone.trim(),
      amount:             numericAmount,
      message:            (message || '').trim(),
      screenshotUrl:      req.file ? req.file.path     : '',
      screenshotPublicId: req.file ? req.file.filename : '',
      status:             'pending',
      timestamp:          new Date()
    });

    res.status(201).json({
      message: 'Donation submitted successfully! It will appear on the donor wall after admin verification.',
      donation
    });
  } catch (err) {
    console.error('Donation submission error:', err);
    res.status(500).json({ error: 'Server error during donation processing.' });
  }
});

app.get('/api/donations', async (req, res) => {
  try {
    const donations = await Donation.find({ status: 'approved' }).sort({ timestamp: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load donations.' });
  }
});

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load expenses.' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1, time: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

app.get('/api/announcements', async (req, res) => {
  try {
    const list = await Announcement.find({ isActive: true }).sort({ timestamp: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load announcements.' });
  }
});

app.get('/api/gallery', async (req, res) => {
  try {
    const list = await Gallery.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load gallery.' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [donations, expenses] = await Promise.all([
      Donation.find({ status: 'approved' }),
      Expense.find()
    ]);

    const totalCollected = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalSpent     = expenses.reduce((sum, e) => sum + e.amount, 0);

    const donorMap = {};
    donations.forEach(d => {
      const key = d.donorName.trim();
      donorMap[key] = (donorMap[key] || 0) + d.amount;
    });

    const topDonors = Object.keys(donorMap)
      .map(name => ({ name, totalAmount: donorMap[name] }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    res.json({
      goalAmount:       parseInt(process.env.GOAL_AMOUNT) || 200000,
      totalCollected,
      totalSpent,
      remainingBalance: totalCollected - totalSpent,
      topDonors,
      donationsCount:   donations.length,
      expensesCount:    expenses.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate stats.' });
  }
});

// ----------------------------------------------------
// ADMIN ROUTES (JWT GUARDED)
// ----------------------------------------------------

app.get('/api/admin/donations', authenticateAdmin, async (req, res) => {
  try {
    const donations = await Donation.find().sort({ timestamp: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load donations.' });
  }
});

app.post('/api/admin/donations/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status))
      return res.status(400).json({ error: "Invalid status. Must be 'approved', 'rejected', or 'pending'." });

    const donation = await Donation.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!donation) return res.status(404).json({ error: 'Donation record not found.' });

    res.json({ message: `Donation ${status} successfully!`, donation });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update donation status.' });
  }
});

// Update UPI / bank details (replaces entire QrConfig document)
app.post('/api/admin/qr', authenticateAdmin, async (req, res) => {
  try {
    const config = await QrConfig.findOneAndUpdate({}, req.body, { new: true, upsert: true });
    res.json({ message: 'Payment information updated successfully.', qrCodes: config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update QR config.' });
  }
});

// Add expense with optional receipt image → Cloudinary
app.post('/api/admin/expenses', authenticateAdmin, uploadExpense.single('receipt'), async (req, res) => {
  try {
    const { title, amount, category, description, date } = req.body;
    if (!title || !amount || !category || !date)
      return res.status(400).json({ error: 'Title, Amount, Category, and Date are required.' });

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0)
      return res.status(400).json({ error: 'Amount must be a positive number.' });

    const expense = await Expense.create({
      title:           title.trim(),
      amount:          numericAmount,
      category:        category.trim(),
      description:     (description || '').trim(),
      receiptUrl:      req.file ? req.file.path     : '',
      receiptPublicId: req.file ? req.file.filename : '',
      date
    });

    res.status(201).json({ message: 'Expense recorded successfully.', expense });
  } catch (err) {
    console.error('Expense save error:', err);
    res.status(500).json({ error: 'Failed to save expense.' });
  }
});

// Delete expense and remove its receipt from Cloudinary
app.delete('/api/admin/expenses/:id', authenticateAdmin, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense)
       return res.status(404).json({ error: 'Expense record not found.' });

    if (expense.receiptPublicId) {
      await cloudinary.uploader.destroy(expense.receiptPublicId).catch(console.error);
    }

    await expense.deleteOne();
    res.json({ message: 'Expense record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
});

app.post('/api/admin/events', authenticateAdmin, async (req, res) => {
  try {
    const { title, date, time, description } = req.body;
    if (!title || !date || !time)
      return res.status(400).json({ error: 'Title, Date, and Time are required fields.' });

    const event = await Event.create({
      title:       title.trim(),
      date,
      time:        time.trim(),
      description: (description || '').trim(),
      status:      'upcoming'
    });

    res.status(201).json({ message: 'Event added to timeline schedule.', event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add event.' });
  }
});

app.put('/api/admin/events/:id', authenticateAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ error: 'Event record not found.' });
    res.json({ message: 'Event updated successfully.', event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event.' });
  }
});

app.delete('/api/admin/events/:id', authenticateAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event record not found.' });
    res.json({ message: 'Event deleted from timeline.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

app.post('/api/admin/announcements', authenticateAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim())
      return res.status(400).json({ error: 'Announcement text cannot be empty.' });

    const announcement = await Announcement.create({
      content:   content.trim(),
      timestamp: new Date(),
      isActive:  true
    });

    res.status(201).json({ message: 'Announcement published live.', announcement });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish announcement.' });
  }
});

app.delete('/api/admin/announcements/:id', authenticateAdmin, async (req, res) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found.' });
    res.json({ message: 'Announcement removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement.' });
  }
});

// Upload gallery image/video → Cloudinary
app.post('/api/admin/gallery', authenticateAdmin, uploadGallery.single('media'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a photo or video file.' });

    const type = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const item = await Gallery.create({
      title:         ((req.body.title || '').trim()) || 'Utsavam Highlight',
      mediaUrl:      req.file.path,
      mediaPublicId: req.file.filename,
      type
    });

    res.status(201).json({ message: 'Media uploaded to festival gallery.', item });
  } catch (err) {
    console.error('Gallery upload error:', err);
    res.status(500).json({ error: 'Gallery upload failed.' });
  }
});

// Delete gallery item and remove media from Cloudinary
app.delete('/api/admin/gallery/:id', authenticateAdmin, async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Gallery item not found.' });

    await cloudinary.uploader.destroy(item.mediaPublicId, {
      resource_type: item.type === 'video' ? 'video' : 'image'
    }).catch(console.error);

    await item.deleteOne();
    res.json({ message: 'Gallery item removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete gallery item.' });
  }
});

app.post('/api/admin/profile', authenticateAdmin, async (req, res) => {
  try {
    const { name, newPassword } = req.body;
    const updates = {};

    if (name && name.trim()) updates.name = name.trim();

    if (newPassword) {
      if (newPassword.trim().length < 6)
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      updates.passwordHash = hashPassword(newPassword);
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No profile updates provided.' });

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({
      message: 'Admin profile updated successfully.',
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// Wildcard: serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Connect to MongoDB first, then start HTTP server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('========================================');
      console.log('  Sri Ammavari Utsavam Server Live!     ');
      console.log(`  Running on: http://localhost:${PORT}  `);
      console.log('  Database : MongoDB Atlas              ');
      console.log('  Media    : Cloudinary                 ');
      console.log('  Admin    : admin / AmmavariSeva2026!  ');
      console.log('========================================');
    });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
