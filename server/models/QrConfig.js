const mongoose = require('mongoose');

const upiMethodSchema = new mongoose.Schema({
  name:    { type: String },
  upiId:   { type: String },
  phone:   { type: String },
  enabled: { type: Boolean, default: true }
}, { _id: false });

const bankSchema = new mongoose.Schema({
  name:          { type: String },
  holderName:    { type: String },
  accountNumber: { type: String },
  ifsc:          { type: String },
  branch:        { type: String },
  enabled:       { type: Boolean, default: true }
}, { _id: false });

const qrConfigSchema = new mongoose.Schema({
  gpay:    upiMethodSchema,
  phonepe: upiMethodSchema,
  paytm:   upiMethodSchema,
  bank:    bankSchema
}, { versionKey: false });

module.exports = mongoose.model('QrConfig', qrConfigSchema);
