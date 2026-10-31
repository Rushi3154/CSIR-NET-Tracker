const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  chooseDataLocation: (data) => ipcRenderer.invoke('choose-data-location', data),
  exportCsv: (csv) => ipcRenderer.invoke('export-csv', csv),
  importCsv: () => ipcRenderer.invoke('import-csv'),
  exportJson: (jsonData, fileName) => ipcRenderer.invoke('export-json', jsonData, fileName),
  importJson: () => ipcRenderer.invoke('import-json'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
});