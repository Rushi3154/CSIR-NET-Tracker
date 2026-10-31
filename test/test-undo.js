const assert = require("node:assert");
const UndoSystem = require("../undo-system.js");

console.log("=== Running Undo System Unit Test Suite ===");

const undoManager = new UndoSystem.UndoManager();

// Test 1: Initial state
console.log("Test 1: Initial state");
assert.strictEqual(undoManager.canUndo(), false);
assert.strictEqual(undoManager.undo(), null);
console.log("✓ Test 1 passed: UndoManager initializes with empty stack.");

// Test 2: Push and undo single action
console.log("Test 2: Push and undo single action");
let restoredValue = null;
undoManager.onUndo((action) => {
  restoredValue = action.previousValue;
});

undoManager.pushAction({
  type: "status_change",
  description: "Status changed to Completed",
  previousValue: "remaining"
});

assert.strictEqual(undoManager.canUndo(), true);
const undoneAction = undoManager.undo();
assert.ok(undoneAction);
assert.strictEqual(undoneAction.description, "Status changed to Completed");
assert.strictEqual(restoredValue, "remaining");
assert.strictEqual(undoManager.canUndo(), false);
console.log("✓ Test 2 passed: Single action pushed and undone correctly.");

// Test 3: Multiple actions (LIFO order)
console.log("Test 3: Multiple actions in LIFO order");
undoManager.pushAction({ type: "lecture", description: "Lecture 1", val: 1 });
undoManager.pushAction({ type: "lecture", description: "Lecture 2", val: 2 });
undoManager.pushAction({ type: "lecture", description: "Lecture 3", val: 3 });

assert.strictEqual(undoManager.canUndo(), true);
const undo3 = undoManager.undo();
assert.strictEqual(undo3.val, 3);
const undo2 = undoManager.undo();
assert.strictEqual(undo2.val, 2);
const undo1 = undoManager.undo();
assert.strictEqual(undo1.val, 1);
assert.strictEqual(undoManager.canUndo(), false);
console.log("✓ Test 3 passed: Multiple actions undone in correct LIFO order.");

// Test 4: Max history limit
console.log("Test 4: Max history limit capping");
for (let i = 0; i < 30; i++) {
  undoManager.pushAction({ type: "step", description: `Step ${i}`, idx: i });
}
let count = 0;
while (undoManager.canUndo()) {
  undoManager.undo();
  count++;
}
assert.strictEqual(count, UndoSystem.MAX_UNDO_HISTORY);
console.log(`✓ Test 4 passed: Capped accurately at MAX_UNDO_HISTORY (${UndoSystem.MAX_UNDO_HISTORY}).`);

// Test 5: Clear
console.log("Test 5: Clear history");
undoManager.pushAction({ type: "test", description: "Test" });
assert.strictEqual(undoManager.canUndo(), true);
undoManager.clear();
assert.strictEqual(undoManager.canUndo(), false);
console.log("✓ Test 5 passed: Clear resets stack completely.");

console.log("\nALL UNDO SYSTEM TESTS PASSED SUCCESSFULLY!");
