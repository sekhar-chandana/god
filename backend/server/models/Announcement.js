const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  content:   { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
  isActive:  { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Announcement', announcementSchema);
