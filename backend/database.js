const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Must be before any model requires — ensures id virtual is included in all res.json() responses
mongoose.plugin(function(schema) {
  schema.options.toJSON = Object.assign({}, schema.options.toJSON, { virtuals: true });
});

const User         = require('./models/User');
const Donation     = require('./models/Donation');
const Expense      = require('./models/Expense');
const Event        = require('./models/Event');
const Announcement = require('./models/Announcement');
const QrConfig     = require('./models/QrConfig');

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'ammavari_seva' });
  console.log('MongoDB Atlas connected.');
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const count = await User.countDocuments();
  if (count > 0) return;

  console.log('First run — seeding initial data...');

  // Admin user — credentials read from .env
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AmmavariSeva2026!';
  const passwordHash  = bcrypt.hashSync(adminPassword, 10);
  await User.create({ username: adminUsername, passwordHash, role: 'admin', name: 'Festival Administrator' });

  // Payment QR config (single document)
  await QrConfig.create({
    gpay:    { name: 'Google Pay',           upiId: 'sriammavari@okaxis',    phone: '9876543210', enabled: true },
    phonepe: { name: 'PhonePe',              upiId: 'sriammavari@ybl',       phone: '9876543210', enabled: true },
    paytm:   { name: 'Paytm',               upiId: '9876543210@paytm',      phone: '9876543210', enabled: true },
    bank:    { name: 'State Bank of India',  holderName: 'Sri Ammavari Utsavam Committee', accountNumber: '30489274812', ifsc: 'SBIN0004812', branch: 'Grama Devatha Temple Branch', enabled: true }
  });

  // Festival events
  await Event.insertMany([
    { title: 'Ganesh Pooja & Dwajarohanam',                    date: '2026-06-10', time: '08:00 AM', description: 'Inaugural prayers, holy flag hoisting, and temple setup decoration ceremony.',                                                                                    status: 'upcoming' },
    { title: 'Maha Annadanam (Grand Holy Feast)',               date: '2026-06-12', time: '11:30 AM', description: 'Providing sacred, delicious temple meals (Prasadam) to over 3,000 villagers and visitors.',                                                                     status: 'upcoming' },
    { title: 'Ammavari Gramotsavam (Divine Chariot Procession)', date: '2026-06-14', time: '06:00 PM', description: 'Sri Ammavari in magnificent golden alankaram taking a procession across all streets of the village with traditional drums and floats.', status: 'upcoming' }
  ]);

  // Announcements
  await Announcement.insertMany([
    { content: 'Welcome to Sri Ammavari Utsavam Portal! You can now scan QR codes to send donations and view direct receipts.', isActive: true },
    { content: 'Grand Annadanam sponsorship is open. Every ₹5,000 covers meals for 100 devotees.',                             isActive: true }
  ]);

  // Sample expenses
  await Expense.insertMany([
    { title: 'Temple Flower Decoration',       amount: 12000, category: 'Decoration', description: 'Imported jasmines, marigolds, and roses for temple inner sanctum and main arches.', date: '2026-05-20' },
    { title: 'Traditional Drums & Melam Band', amount: 8500,  category: 'Cultural',   description: 'Advanced booking advance for 6 members Melam troupe for procession.',              date: '2026-05-22' }
  ]);

  // Sample approved donations
  await Donation.insertMany([
    { donorName: 'Anil Kumar Reddi',   phone: '9123456789', amount: 10000, message: 'May Sri Ammavari bless our village with rich harvests and good health! Jai Ammavari.', status: 'approved', timestamp: new Date(Date.now() - 48 * 3600000) },
    { donorName: 'Saraswathi Patel',   phone: '9812738291', amount: 5001,  message: 'Wishes for a magnificent, successful Ammavari Utsavam celebration.',                   status: 'approved', timestamp: new Date(Date.now() - 24 * 3600000) },
    { donorName: 'Raju Garu & Family', phone: '8008123456', amount: 25000, message: 'Sponsoring Annadanam in memory of our grandparents. Blessings to all.',               status: 'approved', timestamp: new Date(Date.now() -  4 * 3600000) }
  ]);

  console.log('Seed complete.');
}

module.exports = { connectDB };
