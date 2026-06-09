const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title:            { type: String, required: true, trim: true },
  amount:           { type: Number, required: true, min: 1 },
  category:         { type: String, required: true, trim: true },
  description:      { type: String, default: '', trim: true },
  receiptUrl:       { type: String, default: '' },
  receiptPublicId:  { type: String, default: '' },
  date:             { type: String, required: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Expense', expenseSchema);
