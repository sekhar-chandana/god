const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
  title:         { type: String, default: 'Utsavam Highlight', trim: true },
  mediaUrl:      { type: String, required: true },
  mediaPublicId: { type: String, required: true },
  type:          { type: String, enum: ['image', 'video'], default: 'image' }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Gallery', gallerySchema);
