const assert = require("node:assert");
const CSIRStorage = require("../src/services/storage.js");

console.log("=== Running CSIR Tracker Storage & Backup Test Suite ===");

// Test 1: Validation functions
console.log("Test 1: Topic validation");
assert.strictEqual(CSIRStorage.isValidTopicId("t0"), true);
assert.strictEqual(CSIRStorage.isValidTopicId("custom-1234"), true);
assert.strictEqual(CSIRStorage.isValidTopicId("toString"), false); // Object.prototype collision check
assert.strictEqual(CSIRStorage.isValidTopicId(""), false);
assert.strictEqual(CSIRStorage.isValidTopicId("invalid id with spaces"), false);

assert.strictEqual(CSIRStorage.isValidDeadline("2026-12-19"), true);
assert.strictEqual(CSIRStorage.isValidDeadline("2026-02-29"), false); // 2026 is not a leap year
assert.strictEqual(CSIRStorage.isValidDeadline("invalid-date"), false);

const validTopic = { id: "t1", name: "Thermodynamics", cat: "major", marks: 10.8 };
assert.strictEqual(CSIRStorage.validateTopic(validTopic).valid, true);

const invalidTopic1 = { id: "t1", name: "", cat: "major", marks: 10.8 };
assert.strictEqual(CSIRStorage.validateTopic(invalidTopic1).valid, false);

const invalidTopic2 = { id: "t1", name: "Quantum", cat: "unknown_category", marks: 10.8 };
assert.strictEqual(CSIRStorage.validateTopic(invalidTopic2).valid, false);

const invalidTopic3 = { id: "t1", name: "Kinetics", cat: "bumper", marks: -5 };
assert.strictEqual(CSIRStorage.validateTopic(invalidTopic3).valid, false);

console.log("✓ Test 1 passed: Topic validation works accurately.");

// Test 2: Backward compatibility & Normalization of legacy unversioned data
console.log("Test 2: Normalization of legacy data");
const legacyData = {
  username: "Rushi",
  deadline: "2026-12-19",
  lectureDeadline: "2026-11-30",
  topics: [
    { id: "t0", name: "Transition Metals", cat: "bumper", marks: 32 },
    { id: "t1", name: "Thermodynamics", cat: "major", marks: 10.8 }
  ],
  progress: {
    t0: { status: "completed", lectures: 0, pyq: true, revision: true, test: true, note: "Mastered" },
    t1: { status: "doing", lectures: 8, pyq: false, revision: false, test: false, note: "" }
  },
  futureFeatureData: { customSettings: true } // Unrecognized field
};

const normalized = CSIRStorage.normalizeTrackerData(legacyData);
assert.strictEqual(normalized.schemaVersion, 1);
assert.strictEqual(normalized.originalSchemaVersion, 0);
assert.strictEqual(normalized.username, "Rushi");
assert.strictEqual(normalized.deadline, "2026-12-19");
assert.strictEqual(normalized.lectureDeadline, "2026-11-30");
assert.strictEqual(normalized.topics.length, 2);
assert.strictEqual(normalized.progress.t0.status, "completed");
assert.strictEqual(normalized.progress.t0.pyq, true);
assert.strictEqual(normalized.progress.t0.note, "Mastered");
assert.strictEqual(normalized.progress.t1.lectures, 8);
// Verify preservation of unrecognized fields
assert.deepStrictEqual(normalized.futureFeatureData, { customSettings: true });

console.log("✓ Test 2 passed: Legacy unversioned data normalized without data loss.");

// Test 3: Creation and round-trip validation of JSON backup
console.log("Test 3: JSON Backup creation and validation");
const backupPayload = CSIRStorage.createBackupPayload({
  topics: legacyData.topics,
  progress: legacyData.progress,
  username: legacyData.username,
  deadline: legacyData.deadline,
  lectureDeadline: legacyData.lectureDeadline,
  theme: "dark",
  extra: { studyPlan: { day1: "t0" } }
});

assert.strictEqual(backupPayload.appName, "CSIR-NET Chemistry Tracker");
assert.strictEqual(backupPayload.schemaVersion, 1);
assert.strictEqual(backupPayload.theme, "dark");
assert.ok(backupPayload.exportedAt);

const jsonString = JSON.stringify(backupPayload, null, 2);
const inspectionResult = CSIRStorage.inspectAndValidateBackup(jsonString);

assert.strictEqual(inspectionResult.valid, true);
assert.strictEqual(inspectionResult.summary.topicCount, 2);
assert.strictEqual(inspectionResult.summary.completedCount, 1);
assert.strictEqual(inspectionResult.summary.coveredMarks, 32);
assert.strictEqual(inspectionResult.summary.totalMarks, 42.8);
assert.strictEqual(inspectionResult.summary.remainingLectures, 8);
assert.strictEqual(inspectionResult.summary.username, "Rushi");
assert.deepStrictEqual(inspectionResult.data.extra, { studyPlan: { day1: "t0" } });

console.log("✓ Test 3 passed: JSON Backup round-trip verified.");

// Test 4: Rejection of corrupted backup files
console.log("Test 4: Rejection of corrupted backups");
const malformedJson = "{ this is invalid json }";
assert.strictEqual(CSIRStorage.inspectAndValidateBackup(malformedJson).valid, false);

const badTopics = JSON.stringify({
  schemaVersion: 1,
  topics: [{ id: "t0", name: "A", cat: "bumper", marks: -1 }],
  progress: {}
});
const badTopicsResult = CSIRStorage.inspectAndValidateBackup(badTopics);
assert.strictEqual(badTopicsResult.valid, false);
assert.ok(badTopicsResult.error.includes("invalid marks"));

const duplicateId = JSON.stringify({
  schemaVersion: 1,
  topics: [
    { id: "t0", name: "A", cat: "bumper", marks: 10 },
    { id: "t0", name: "B", cat: "major", marks: 10 }
  ],
  progress: {}
});
const dupResult = CSIRStorage.inspectAndValidateBackup(duplicateId);
assert.strictEqual(dupResult.valid, false);
assert.ok(dupResult.error.includes("Duplicate topic ID"));

console.log("✓ Test 4 passed: Malformed and corrupted backups safely rejected.");

// Test 5: Safety snapshot mechanism
console.log("Test 5: In-memory safety snapshots");
const mockLocalStorage = {
  store: {},
  setItem(key, value) { this.store[key] = String(value); },
  getItem(key) { return this.store[key] || null; }
};

const snapshotSaved = CSIRStorage.saveSafetySnapshot(mockLocalStorage, legacyData, "pre-test");
assert.strictEqual(snapshotSaved, true);
const retrievedSnapshot = CSIRStorage.getLatestSafetySnapshot(mockLocalStorage);
assert.ok(retrievedSnapshot);
assert.strictEqual(retrievedSnapshot.reason, "pre-test");
assert.strictEqual(retrievedSnapshot.data.topics.length, 2);
assert.strictEqual(retrievedSnapshot.data.progress.t0.status, "completed");

console.log("✓ Test 5 passed: Safety snapshot mechanism verified.");

console.log("\nALL STORAGE & BACKUP TESTS PASSED SUCCESSFULLY!");
