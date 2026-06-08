const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const BACKUP_FILE = path.join(DB_DIR, 'db.backup.json');

// Default initial state
const DEFAULT_STATE = {
  users: [],
  qrCodes: {
    gpay: {
      name: "Google Pay",
      upiId: "sriammavari@okaxis",
      phone: "9876543210",
      qrImage: "/assets/mock-gpay-qr.png",
      enabled: true
    },
    phonepe: {
      name: "PhonePe",
      upiId: "sriammavari@ybl",
      phone: "9876543210",
      qrImage: "/assets/mock-phonepe-qr.png",
      enabled: true
    },
    paytm: {
      name: "Paytm",
      upiId: "9876543210@paytm",
      phone: "9876543210",
      qrImage: "/assets/mock-paytm-qr.png",
      enabled: true
    },
    bank: {
      name: "State Bank of India",
      holderName: "Sri Ammavari Utsavam Committee",
      accountNumber: "30489274812",
      ifsc: "SBIN0004812",
      branch: "Grama Devatha Temple Branch",
      enabled: true
    }
  },
  donations: [],
  expenses: [],
  events: [],
  announcements: [],
  gallery: []
};

// Setup directories
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// In-memory cache for fast reads
let dbCache = null;

// Read database with locking/fallback
function readDb() {
  if (dbCache) return dbCache;

  try {
    if (!fs.existsSync(DB_FILE)) {
      initializeDb();
      return dbCache;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    dbCache = JSON.parse(data);
    return dbCache;
  } catch (err) {
    console.error("Error reading database file, attempting backup recovery:", err);
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        const data = fs.readFileSync(BACKUP_FILE, 'utf8');
        dbCache = JSON.parse(data);
        // Restore main db
        fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf8');
        return dbCache;
      }
    } catch (backupErr) {
      console.error("Backup recovery failed:", backupErr);
    }
    
    // Hard fallback
    initializeDb();
    return dbCache;
  }
}

// Write database safely (atomic write)
function writeDb(data) {
  try {
    dbCache = data;
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Create temporary file
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, jsonStr, 'utf8');
    
    // Rename temporary file to real file (atomic replacement in OS)
    if (fs.existsSync(DB_FILE)) {
      // Create backup first
      fs.copyFileSync(DB_FILE, BACKUP_FILE);
      fs.unlinkSync(DB_FILE);
    }
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error("Error writing database:", err);
    return false;
  }
}

// Initialize database with seed data
function initializeDb() {
  console.log("Initializing database for the first time...");
  const dbData = JSON.parse(JSON.stringify(DEFAULT_STATE));
  
  // Seed default admin user
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync("AmmavariSeva2026!", salt);
  dbData.users.push({
    id: "admin-1",
    username: "admin",
    passwordHash: passwordHash,
    role: "admin",
    name: "Festival Administrator",
    createdAt: new Date().toISOString()
  });

  // Seed sample events
  dbData.events.push(
    {
      id: "evt-1",
      title: "Ganesh Pooja & Dwajarohanam",
      date: "2026-06-10",
      time: "08:00 AM",
      description: "Inaugural prayers, holy flag hoisting, and temple setup decoration ceremony.",
      status: "upcoming"
    },
    {
      id: "evt-2",
      title: "Maha Annadanam (Grand Holy Feast)",
      date: "2026-06-12",
      time: "11:30 AM",
      description: "Providing sacred, delicious temple meals (Prasadam) to over 3,000 villagers and visitors.",
      status: "upcoming"
    },
    {
      id: "evt-3",
      title: "Ammavari Gramotsavam (Divine Chariot Procession)",
      date: "2026-06-14",
      time: "06:00 PM",
      description: "Sri Ammavari in magnificent golden alankaram taking a procession across all streets of the village with traditional drums and floats.",
      status: "upcoming"
    }
  );

  // Seed sample announcements
  dbData.announcements.push(
    {
      id: "ann-1",
      content: "Welcome to Sri Ammavari Utsavam Portal! You can now scan QR codes to send donations and view direct receipts.",
      timestamp: new Date().toISOString(),
      isActive: true
    },
    {
      id: "ann-2",
      content: "Grand Annadanam sponsorship is open. Every ₹5,000 covers meals for 100 devotees.",
      timestamp: new Date().toISOString(),
      isActive: true
    }
  );

  // Seed sample expenses (creates trust in UI)
  dbData.expenses.push(
    {
      id: "exp-1",
      title: "Temple Flower Decoration",
      amount: 12000,
      category: "Decoration",
      description: "Imported jasmines, marigolds, and roses for temple inner sanctum and main arches.",
      receiptPath: "/uploads/mock-receipt.jpg",
      date: "2026-05-20"
    },
    {
      id: "exp-2",
      title: "Traditional Drums & Melam Band",
      amount: 8500,
      category: "Cultural",
      description: "Advanced booking advance for 6 members Melam troupe for procession.",
      receiptPath: "/uploads/mock-receipt.jpg",
      date: "2026-05-22"
    }
  );

  // Seed sample approved donations (creates beautiful feed)
  dbData.donations.push(
    {
      id: "don-1",
      donorName: "Anil Kumar Reddi",
      phone: "9123456789",
      amount: 10000,
      message: "May Sri Ammavari bless our village with rich harvests and good health! Jai Ammavari.",
      screenshotPath: "/uploads/mock-screenshot.jpg",
      status: "approved",
      timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString() // 2 days ago
    },
    {
      id: "don-2",
      donorName: "Saraswathi Patel",
      phone: "9812738291",
      amount: 5001,
      message: "Wishes for a magnificent, successful Ammavari Utsavam celebration.",
      screenshotPath: "/uploads/mock-screenshot.jpg",
      status: "approved",
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() // 1 day ago
    },
    {
      id: "don-3",
      donorName: "Raju Garu & Family",
      phone: "8008123456",
      amount: 25000,
      message: "Sponsoring Annadanam in memory of our grandparents. Blessings to all.",
      screenshotPath: "/uploads/mock-screenshot.jpg",
      status: "approved",
      timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString() // 4 hours ago
    }
  );

  writeDb(dbData);
}

// Database helper functions
const db = {
  // Get all items in a collection
  getCollection(name) {
    const data = readDb();
    return data[name] || [];
  },

  // Get item by key-value (e.g., id)
  findById(collectionName, id) {
    const list = this.getCollection(collectionName);
    return list.find(item => item.id === id);
  },

  // Insert item
  insert(collectionName, item) {
    const data = readDb();
    if (!data[collectionName]) data[collectionName] = [];
    
    const newItem = {
      id: collectionName.slice(0, 3) + '-' + Math.random().toString(36).substr(2, 9),
      ...item,
      createdAt: new Date().toISOString()
    };
    
    data[collectionName].push(newItem);
    writeDb(data);
    return newItem;
  },

  // Update item
  update(collectionName, id, updates) {
    const data = readDb();
    const list = data[collectionName] || [];
    const index = list.findIndex(item => item.id === id);
    
    if (index === -1) return null;
    
    const updatedItem = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    list[index] = updatedItem;
    data[collectionName] = list;
    writeDb(data);
    return updatedItem;
  },

  // Delete item
  delete(collectionName, id) {
    const data = readDb();
    const list = data[collectionName] || [];
    const index = list.findIndex(item => item.id === id);
    
    if (index === -1) return false;
    
    list.splice(index, 1);
    data[collectionName] = list;
    writeDb(data);
    return true;
  },

  // QR Code helpers
  getQrCodes() {
    const data = readDb();
    return data.qrCodes;
  },

  updateQrCodes(updates) {
    const data = readDb();
    data.qrCodes = {
      ...data.qrCodes,
      ...updates
    };
    writeDb(data);
    return data.qrCodes;
  }
};

module.exports = db;
