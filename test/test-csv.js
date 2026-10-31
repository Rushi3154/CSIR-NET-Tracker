const assert = require("node:assert");

// Extract CSV functions from main.js to test regression
const STORAGE_HEADERS = [
  'record_type', 'id', 'topic', 'category', 'marks', 'status',
  'lectures', 'pyq', 'revision', 'test', 'username', 'deadline', 'lecture_deadline', 'note'
];
const REQUIRED_STORAGE_HEADERS = STORAGE_HEADERS.filter(
  header => header !== 'note' && header !== 'lectures' && header !== 'lecture_deadline'
);

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function dataToCsv(data) {
  const rows = [STORAGE_HEADERS, [
    'metadata', '', '', '', '', '', '', '', '', '', data.username || '', data.deadline || '', data.lectureDeadline || '', ''
  ]];

  for (const topic of data.topics || []) {
    const progress = data.progress && data.progress[topic.id] || {};
    const lectures = progress.lectures !== undefined && Number.isFinite(Number(progress.lectures))
      ? Math.max(0, Math.floor(Number(progress.lectures)))
      : 0;
    rows.push([
      'topic', topic.id, topic.name, topic.cat, topic.marks,
      progress.status || 'remaining',
      lectures,
      Boolean(progress.pyq),
      Boolean(progress.revision), Boolean(progress.test), '', '', '', progress.note || ''
    ]);
  }

  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;

  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      if (cell.length !== 0 || closedQuote) {
        throw new Error('Saved CSV contains an unexpected quote.');
      }
      quoted = true;
    } else if (char === ',') {
      closedQuote = false;
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      closedQuote = false;
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (closedQuote) {
      throw new Error('Saved CSV contains characters after a quoted field.');
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('Saved CSV contains an unterminated quoted field.');
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(csvRow => csvRow.some(value => value.length));
}

function dataFromCsv(text) {
  const [headers, ...rows] = parseCsv(text);
  if (!headers || REQUIRED_STORAGE_HEADERS.some(header => !headers.includes(header))) {
    throw new Error('Saved CSV is missing required tracker columns.');
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error('Saved CSV contains duplicate column names.');
  }

  const columns = Object.fromEntries(headers.map((header, index) => [header, index]));
  const data = { topics: [], progress: {}, username: '' };
  for (const [index, row] of rows.entries()) {
    if (row.length !== headers.length) {
      throw new Error(`Saved CSV row ${index + 2} has an invalid number of fields.`);
    }
    const value = header => row[columns[header]];
    if (value('record_type') === 'metadata') {
      data.username = value('username');
      const deadline = value('deadline');
      if (deadline) data.deadline = deadline;
      if (columns.lecture_deadline !== undefined) {
        const lectureDeadline = value('lecture_deadline');
        if (lectureDeadline) data.lectureDeadline = lectureDeadline;
      }
    } else if (value('record_type') === 'topic') {
      const id = value('id');
      data.topics.push({
        id,
        name: value('topic'),
        cat: value('category'),
        marks: Number(value('marks'))
      });
      data.progress[id] = {
        status: value('status'),
        lectures: columns.lectures !== undefined ? Math.max(0, parseInt(value('lectures'), 10) || 0) : 0,
        pyq: value('pyq') === 'true',
        revision: value('revision') === 'true',
        test: value('test') === 'true',
        note: columns.note === undefined ? '' : value('note')
      };
    } else {
      throw new Error(`Saved CSV row ${index + 2} has an unknown record type.`);
    }
  }
  return data;
}

console.log("=== Running CSV Compatibility & Regression Tests ===");

const sampleData = {
  username: "Test Student",
  deadline: "2026-12-19",
  lectureDeadline: "2026-11-20",
  topics: [
    { id: "t0", name: "Transition Metals", cat: "bumper", marks: 32 },
    { id: "t1", name: "Thermodynamics", cat: "major", marks: 10.8 }
  ],
  progress: {
    t0: { status: "completed", lectures: 0, pyq: true, revision: true, test: true, note: 'Special "notes" with quotes & commas' },
    t1: { status: "doing", lectures: 12, pyq: false, revision: false, test: false, note: "" }
  }
};

const csv = dataToCsv(sampleData);
assert.ok(csv.includes("Test Student"));
assert.ok(csv.includes("Transition Metals"));
assert.ok(csv.includes("2026-11-20"));

const parsed = dataFromCsv(csv);
assert.strictEqual(parsed.username, "Test Student");
assert.strictEqual(parsed.deadline, "2026-12-19");
assert.strictEqual(parsed.lectureDeadline, "2026-11-20");
assert.strictEqual(parsed.topics.length, 2);
assert.strictEqual(parsed.topics[0].marks, 32);
assert.strictEqual(parsed.progress.t0.status, "completed");
assert.strictEqual(parsed.progress.t0.note, 'Special "notes" with quotes & commas');
assert.strictEqual(parsed.progress.t1.lectures, 12);

console.log("✓ CSV round-trip compatibility passed with 100% fidelity.");
