const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Payment screenshot uploads (images only)
const donationStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'ammavari-seva/donations',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

// Expense bill/receipt uploads (images only)
const expenseStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'ammavari-seva/expenses',
    resource_type:   'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

// Gallery uploads (images + videos) — resource_type detected per file
const galleryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:          'ammavari-seva/gallery',
    resource_type:   file.mimetype.startsWith('video/') ? 'video' : 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'mkv']
  })
});

module.exports = { cloudinary, donationStorage, expenseStorage, galleryStorage };
