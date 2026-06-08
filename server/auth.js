const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'sri_ammavari_utsavam_secret_2026_go_deepmind';

// Generate dynamic token for admin
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Valid for 7 days of active festival management
  );
}

// Verification Middleware for Admin-Only Routes
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Access Denied. No token provided." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    if (verified.role !== 'admin') {
      return res.status(403).json({ error: "Access Denied. Administrative privileges required." });
    }
    req.user = verified;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}

// Compare clear password with hash
function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Hash new password
function hashPassword(password) {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

module.exports = {
  generateToken,
  authenticateAdmin,
  comparePassword,
  hashPassword
};
