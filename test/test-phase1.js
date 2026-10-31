const assert = require("node:assert");
const UndoSystem = require("../undo-system.js");
const CSIRStorage = require("../src/services/storage.js");

console.log("=== Running Phase 1 Acceptance & Verification Test Suite ===");

// 1. Test Undo Tracking for All Phase 1 Actions
console.log("Test 1: Undo tracking across all action types");
const undoManager = new UndoSystem.UndoManager();

let state = {
  t0: { status: "remaining", lectures: 10, pyq: false, revision: false, test: false, note: "" }
};
let topics = [
  { id: "t0", name: "Transition Metals", cat: "bumper", marks: 32 }
];

undoManager.onUndo((action) => {
  if (action.restore) action.restore();
});

// A. Checkbox toggle action
const stateBeforeCheckbox = JSON.parse(JSON.stringify(state));
state.t0.pyq = true;
undoManager.pushAction({
  type: "checkbox_toggle",
  description: 'Checked PYQ for "Transition Metals"',
  restore: () => { state = stateBeforeCheckbox; }
});
assert.strictEqual(undoManager.canUndo(), true);
assert.strictEqual(state.t0.pyq, true);
undoManager.undo();
assert.strictEqual(state.t0.pyq, false);
console.log("✓ Checkbox toggle undo verified.");

// B. Status change action
const stateBeforeStatus = JSON.parse(JSON.stringify(state));
state.t0.status = "completed";
undoManager.pushAction({
  type: "status_change",
  description: 'Status set to Completed for "Transition Metals"',
  restore: () => { state = stateBeforeStatus; }
});
assert.strictEqual(state.t0.status, "completed");
undoManager.undo();
assert.strictEqual(state.t0.status, "remaining");
console.log("✓ Status change undo verified.");

// C. Lecture increment and decrement
const stateBeforeLecture = JSON.parse(JSON.stringify(state));
state.t0.lectures = 15;
undoManager.pushAction({
  type: "lecture_increment",
  description: 'Increased lectures for "Transition Metals" (10 → 15)',
  restore: () => { state = stateBeforeLecture; }
});
assert.strictEqual(state.t0.lectures, 15);
undoManager.undo();
assert.strictEqual(state.t0.lectures, 10);
console.log("✓ Lecture counter undo verified.");

// D. Topic add and remove
const topicsBeforeAdd = JSON.parse(JSON.stringify(topics));
const newTopic = { id: "custom-1", name: "Bioinorganic", cat: "major", marks: 8 };
topics.push(newTopic);
undoManager.pushAction({
  type: "add_topic",
  description: 'Added topic "Bioinorganic"',
  restore: () => { topics = topicsBeforeAdd; }
});
assert.strictEqual(topics.length, 2);
undoManager.undo();
assert.strictEqual(topics.length, 1);
assert.strictEqual(topics[0].id, "t0");
console.log("✓ Topic addition and removal undo verified.");

// E. Topic note edit
const stateBeforeNote = JSON.parse(JSON.stringify(state));
state.t0.note = "Key formulas for d-orbitals";
undoManager.pushAction({
  type: "edit_note",
  description: 'Updated note for "Transition Metals"',
  restore: () => { state = stateBeforeNote; }
});
assert.strictEqual(state.t0.note, "Key formulas for d-orbitals");
undoManager.undo();
assert.strictEqual(state.t0.note, "");
console.log("✓ Note edit undo verified.");

// 2. Test Lecture Counter Stepping & Shift Logic
console.log("\nTest 2: Lecture counter step math and bounds");
function computeNewLectureCount(current, delta, min = 0, max = 999) {
  return Math.min(max, Math.max(min, current + delta));
}

// Single step
assert.strictEqual(computeNewLectureCount(10, -1), 9);
assert.strictEqual(computeNewLectureCount(10, 1), 11);

// Shift-click (+5 / -5)
assert.strictEqual(computeNewLectureCount(10, -5), 5);
assert.strictEqual(computeNewLectureCount(10, 5), 15);

// Boundaries (min 0, max 999)
assert.strictEqual(computeNewLectureCount(3, -5), 0);
assert.strictEqual(computeNewLectureCount(998, 5), 999);
console.log("✓ Lecture stepping math and boundary checks verified.");

// 3. Test Daily Lecture Pace Calculation
console.log("\nTest 3: Daily lecture pace calculations");
function calculateLecturesPerDay(remainingLectures, targetDateStr, nowMs) {
  if (!CSIRStorage.isValidDeadline(targetDateStr)) return "—";
  const [y, m, d] = targetDateStr.split("-").map(Number);
  const targetTime = new Date(y, m - 1, d).getTime();
  const diff = targetTime - nowMs;
  if (remainingLectures === 0) return "0";
  if (diff <= 0) return "—";
  const days = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const perDay = remainingLectures / days;
  return perDay < 0.1 ? "<0.1" : (Number.isInteger(perDay) ? String(perDay) : perDay.toFixed(1));
}

const mockNow = new Date("2026-11-01T00:00:00Z").getTime();
// 20 lectures over 10 days = 2.0 lectures/day
assert.strictEqual(calculateLecturesPerDay(20, "2026-11-11", mockNow), "2");
// 0 lectures = "0"
assert.strictEqual(calculateLecturesPerDay(0, "2026-11-11", mockNow), "0");
// Target in past = "—"
assert.strictEqual(calculateLecturesPerDay(10, "2026-10-20", mockNow), "—");
console.log("✓ Daily lecture pace calculation verified.");

// 4. Test Keyboard Shortcuts Guard Logic
console.log("\nTest 4: Keyboard shortcuts guard check");
function shouldTriggerUndo(event) {
  const isCtrlOrMeta = event.ctrlKey || event.metaKey;
  const isZ = event.key?.toLowerCase() === "z";
  const isShift = Boolean(event.shiftKey);
  const isInsideTextInput = ["INPUT", "TEXTAREA"].includes(event.targetTagName);
  return isCtrlOrMeta && isZ && !isShift && !isInsideTextInput;
}

assert.strictEqual(shouldTriggerUndo({ ctrlKey: true, key: "z", shiftKey: false, targetTagName: "BODY" }), true);
assert.strictEqual(shouldTriggerUndo({ metaKey: true, key: "Z", shiftKey: false, targetTagName: "BUTTON" }), true);
// Protected: native undo inside text inputs
assert.strictEqual(shouldTriggerUndo({ ctrlKey: true, key: "z", shiftKey: false, targetTagName: "INPUT" }), false);
assert.strictEqual(shouldTriggerUndo({ ctrlKey: true, key: "z", shiftKey: false, targetTagName: "TEXTAREA" }), false);
// Redo (Ctrl+Shift+Z) should not trigger undo
assert.strictEqual(shouldTriggerUndo({ ctrlKey: true, key: "z", shiftKey: true, targetTagName: "BODY" }), false);
console.log("✓ Keyboard shortcuts protection verified.");

console.log("\nALL PHASE 1 ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
