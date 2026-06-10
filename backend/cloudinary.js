const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Custom multer storage engine — pipes file stream directly to Cloudinary.
// Sets req.file.path = secure_url and req.file.filename = public_id.
class CloudinaryStorage {
  constructor(opts) { this.opts = opts; }

  _handleFile(req, file, cb) {
    const stream = cloudinary.uploader.upload_stream(this.opts, (err, result) => {
      if (err) return cb(err);
      cb(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
    });
    file.stream.pipe(stream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, cb);
  }
}

const donationStorage = new CloudinaryStorage({ folder: 'ammavari-seva/donations', resource_type: 'image' });
const expenseStorage  = new CloudinaryStorage({ folder: 'ammavari-seva/expenses',  resource_type: 'image' });
const galleryStorage  = new CloudinaryStorage({ folder: 'ammavari-seva/gallery',   resource_type: 'auto'  });

module.exports = { cloudinary, donationStorage, expenseStorage, galleryStorage };
