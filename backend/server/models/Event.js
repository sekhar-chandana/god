const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  date:        { type: String, required: true },
  time:        { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  status:      { type: String, enum: ['upcoming', 'active', 'completed'], default: 'upcoming' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Event', eventSchema);
