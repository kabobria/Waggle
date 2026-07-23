const { contextBridge, ipcRenderer } = require("electron");

// Mirrors the interface storage.js expects: async loadSettings()/saveSettings().
// This is the only thing the desktop build adds over the web build — same
// app.js, same UI, just settings backed by a file instead of localStorage.
contextBridge.exposeInMainWorld("waggleDesktop", {
  loadSettings: () => ipcRenderer.invoke("waggle:load-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("waggle:save-settings", settings)
});
