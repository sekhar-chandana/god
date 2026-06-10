const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  donorName:          { type: String, required: true, trim: true },
  phone:              { type: String, required: true, trim: true },
  amount:             { type: Number, required: true, min: 1 },
  message:            { type: String, default: '', trim: true },
  screenshotUrl:      { type: String, default: '' },
  screenshotPublicId: { type: String, default: '' },
  status:             { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  timestamp:          { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Donation', donationSchema);
