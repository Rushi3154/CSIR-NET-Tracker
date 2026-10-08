const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const saveDir = path.join(app.getPath('documents'), 'CSIR Tracker');
fs.mkdirSync(saveDir, { recursive: true });
const legacySaveFilePath = path.join(saveDir, 'csir_progress.json');
const defaultSaveFilePath = path.join(saveDir, 'csir_progress.csv');
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
let saveFilePath = defaultSaveFilePath;

const STORAGE_HEADERS = [
  'record_type', 'id', 'topic', 'category', 'marks', 'status',
  'pyq', 'revision', 'test', 'username', 'deadline', 'note'
];
const REQUIRED_STORAGE_HEADERS = STORAGE_HEADERS.filter(header => header !== 'note');

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function dataToCsv(data) {
  const rows = [STORAGE_HEADERS, [
    'metadata', '', '', '', '', '', '', '', '', data.username || '', data.deadline || '', ''
  ]];

  for (const topic of data.topics || []) {
    const progress = data.progress && data.progress[topic.id] || {};
    rows.push([
      'topic', topic.id, topic.name, topic.cat, topic.marks,
      progress.status || 'remaining', Boolean(progress.pyq),
      Boolean(progress.revision), Boolean(progress.test), '', '', progress.note || ''
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

function csvSavePath(filePath) {
  return path.extname(filePath).toLowerCase() === '.csv'
    ? filePath
    : path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.csv`);
}

function readSavedData(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  if (text.trimStart().startsWith('{')) return JSON.parse(text);
  return dataFromCsv(text);
}

function persistSaveLocation(filePath) {
  fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
  fs.writeFileSync(settingsFilePath, JSON.stringify({ saveFilePath: filePath }), 'utf-8');
}

async function initializeSaveLocation() {
  if (fs.existsSync(settingsFilePath)) {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
    if (!settings || typeof settings.saveFilePath !== 'string' || !settings.saveFilePath.trim()) {
      throw new TypeError('Saved data location settings are invalid.');
    }
    const configuredPath = path.resolve(settings.saveFilePath);
    saveFilePath = csvSavePath(configuredPath);
    if (configuredPath !== saveFilePath && fs.existsSync(configuredPath) && !fs.existsSync(saveFilePath)) {
      const data = readSavedData(configuredPath);
      fs.writeFileSync(saveFilePath, dataToCsv(data), 'utf-8');
    }
    if (!fs.existsSync(saveFilePath) && fs.existsSync(legacySaveFilePath)) {
      const data = readSavedData(legacySaveFilePath);
      fs.writeFileSync(saveFilePath, dataToCsv(data), 'utf-8');
    }
    persistSaveLocation(saveFilePath);
    return;
  }

  const result = await dialog.showSaveDialog({
    title: 'Choose where to save your tracker data',
    defaultPath: defaultSaveFilePath,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });

  if (!result.canceled && result.filePath) {
    saveFilePath = csvSavePath(result.filePath);
  }
  if (!fs.existsSync(saveFilePath) && fs.existsSync(legacySaveFilePath)) {
    const data = readSavedData(legacySaveFilePath);
    fs.writeFileSync(saveFilePath, dataToCsv(data), 'utf-8');
  }

  persistSaveLocation(saveFilePath);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

ipcMain.on('window:minimize', event => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:toggle-maximize', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('window:close', event => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app.whenReady().then(async () => {
  try {
    await initializeSaveLocation();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Could not set up tracker data storage', error.message);
    app.quit();
  }
});

ipcMain.handle('load-data', () => {
  if (!fs.existsSync(saveFilePath)) return {};
  const data = readSavedData(saveFilePath);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Saved tracker data must contain a valid tracker object.');
  }
  return data;
});

ipcMain.handle('save-data', (event, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Tracker data must be an object.');
  }
  fs.mkdirSync(path.dirname(saveFilePath), { recursive: true });
  fs.writeFileSync(saveFilePath, dataToCsv(data), 'utf-8');
});

ipcMain.handle('choose-data-location', async (event, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Tracker data must be a JSON object.');
  }

  const result = await dialog.showSaveDialog({
    title: 'Choose where to save your tracker data',
    defaultPath: saveFilePath,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const nextSaveFilePath = csvSavePath(result.filePath);
  fs.mkdirSync(path.dirname(nextSaveFilePath), { recursive: true });
  fs.writeFileSync(nextSaveFilePath, dataToCsv(data), 'utf-8');
  persistSaveLocation(nextSaveFilePath);
  saveFilePath = nextSaveFilePath;
  return saveFilePath;
});

ipcMain.handle('export-csv', async (event, csv) => {
  if (typeof csv !== 'string') {
    throw new TypeError('CSV export data must be a string.');
  }

  const result = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath('documents'), 'csir_progress.csv'),
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled) return false;

  fs.writeFileSync(result.filePath, csv, 'utf-8');
  return true;
});

ipcMain.handle('import-csv', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  return fs.readFileSync(result.filePaths[0], 'utf-8');
});