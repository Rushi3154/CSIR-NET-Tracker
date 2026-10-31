const assert = require("node:assert");
const { DataProtection, SCHEMA_VERSIONS } = require("../data-protection.js");

console.log("=== Running DataProtection Unit Test Suite ===");

const dp = new DataProtection();
assert.strictEqual(dp.version, SCHEMA_VERSIONS.CURRENT);

const sampleData = {
  topics: [
    { id: "t0", name: "Transition Elements", cat: "bumper", marks: 32 },
    { id: "t1", name: "Reaction Mechanism", cat: "bumper", marks: 20.8 }
  ],
  progress: {
    t0: { status: "completed", lectures: 0, pyq: true, revision: true, test: true, note: "Solid foundation" },
    t1: { status: "doing", lectures: 5, pyq: false, revision: false, test: false, note: "" }
  },
  username: "Test Student",
  deadline: "2026-12-19",
  lectureDeadline: "2026-11-25"
};

// Test 1: Create wrapped backup
console.log("Test 1: Create wrapped backup with metadata and checksum");
const backup = dp.createBackup(sampleData, "manual");
assert.ok(backup.metadata);
assert.strictEqual(backup.metadata.mode, "manual");
assert.strictEqual(backup.schema.version, "2.1.0");
assert.strictEqual(backup.data.topics.length, 2);
assert.ok(backup.metadata.checksum);
console.log("✓ Test 1 passed: Wrapped backup created successfully.");

// Test 2: Restore wrapped backup
console.log("Test 2: Restore valid backup");
const restoreResult = dp.restoreBackup(backup);
assert.strictEqual(restoreResult.success, true);
assert.strictEqual(restoreResult.data.topics.length, 2);
assert.strictEqual(restoreResult.data.progress.t0.status, "completed");
assert.strictEqual(restoreResult.data.progress.t1.lectures, 5);
console.log("✓ Test 2 passed: Valid backup restored accurately.");

// Test 3: Unnested/raw backup support
console.log("Test 3: Support unnested raw JSON backups");
const rawBackup = {
  schemaVersion: 1,
  username: "Legacy Student",
  deadline: "2026-12-19",
  topics: [
    { id: "t0", name: "Transition Elements", cat: "bumper", marks: 32 }
  ],
  progress: {
    t0: { status: "remaining", lectures: 4, pyq: false, revision: false, test: false }
  }
};
const unnestedResult = dp.restoreBackup(rawBackup);
assert.strictEqual(unnestedResult.success, true);
assert.strictEqual(unnestedResult.data.topics[0].id, "t0");
assert.strictEqual(unnestedResult.data.username, "Legacy Student");
console.log("✓ Test 3 passed: Raw unnested JSON backup restored accurately.");

// Test 4: Rejection of invalid data
console.log("Test 4: Rejection of corrupted data");
const invalidBackup = {
  metadata: { timestamp: new Date().toISOString(), version: "2.1.0" },
  data: {
    topics: [{ id: "t0", name: "", cat: "invalid_cat", marks: -10 }]
  }
};
const invalidResult = dp.restoreBackup(invalidBackup);
assert.strictEqual(invalidResult.success, false);
console.log("✓ Test 4 passed: Corrupted data correctly rejected.");

console.log("\nALL DATA PROTECTION TESTS PASSED SUCCESSFULLY!");
