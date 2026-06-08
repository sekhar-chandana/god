const assert = require('assert');
const path = require('path');

// Local imports
const db = require('./server/database');
const auth = require('./server/auth');

console.log("====================================================");
console.log("  Sri Ammavari Utsavam Portal - Integration Tests   ");
console.log("====================================================");

try {
  // Test 1: Database Initialization
  console.log("\n[TEST 1] Verifying Database schema seeding...");
  const qrCodes = db.getQrCodes();
  assert.ok(qrCodes.gpay, "GPAY scanner details missing");
  assert.ok(qrCodes.phonepe, "PhonePe scanner details missing");
  assert.ok(qrCodes.bank, "Bank account details missing");
  console.log("✓ Database initialized with seed methods!");

  // Test 2: Donations Collection Retrieve
  console.log("\n[TEST 2] Verifying Donations collection queries...");
  const donations = db.getCollection('donations');
  assert.ok(Array.isArray(donations), "Donations collection is not an array");
  assert.ok(donations.length >= 3, "Seed donations count is insufficient");
  console.log(`✓ Retrieved ${donations.length} approved/pending donations!`);

  // Test 3: Insert Donation slip
  console.log("\n[TEST 3] Verifying insert transaction methods...");
  const sampleOffer = {
    donorName: "Vara Prasad Garu",
    phone: "9988776655",
    amount: 15000,
    message: "Ammavari Seva Offering - Deepam Sponsorship",
    screenshotPath: "/uploads/donations/mock-slip.png",
    status: "pending"
  };
  
  const inserted = db.insert('donations', sampleOffer);
  assert.ok(inserted.id, "Inserted item lacks unique generated ID");
  assert.strictEqual(inserted.donorName, sampleOffer.donorName, "Data corruption inside record name");
  console.log(`✓ Insert success! Generated Transaction ID: ${inserted.id}`);

  // Test 4: Verify Status Updates
  console.log("\n[TEST 4] Verifying update auditing checks...");
  const updated = db.update('donations', inserted.id, { status: "approved" });
  assert.strictEqual(updated.status, "approved", "Status was not successfully updated");
  console.log(`✓ Audit approval synchronization correct!`);

  // Test 5: Verify Auth Encryption Hashing & JWT Session Token
  console.log("\n[TEST 5] Checking Cryptography & JWT tokenizing...");
  const users = db.getCollection('users');
  const admin = users.find(u => u.username === 'admin');
  assert.ok(admin, "Seeded admin account was not found");

  const correctPass = auth.comparePassword("AmmavariSeva2026!", admin.passwordHash);
  assert.ok(correctPass, "Bcrypt fails to verify primary password hash");
  
  const wrongPass = auth.comparePassword("WrongPassword123", admin.passwordHash);
  assert.ok(!wrongPass, "Bcrypt falsely validates invalid passwords");
  console.log("✓ Bcrypt credential validations passed!");

  const token = auth.generateToken(admin);
  assert.ok(token, "JWT compilation yields null token");
  console.log(`✓ JWT Issued: ${token.substring(0, 30)}...`);

  // Cleanup testing record
  db.delete('donations', inserted.id);
  console.log("\n[TEST CLEANUP] Removed test records safely.");
  
  console.log("\n====================================================");
  console.log("  ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (5/5)   ");
  console.log("====================================================");

} catch (error) {
  console.error("\n❌ Test Suite Failed! Assertion error:", error.message);
  process.exit(1);
}
