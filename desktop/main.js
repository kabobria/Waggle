const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const SETTINGS_FILE = "waggle-settings.json";

function settingsFilePath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

function getIndexPath() {
  // In dev, /web sits next to /desktop. In a packaged build, electron-builder
  // copies /web into the resources directory via "extraResources" (see package.json).
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web", "index.html");
  }
  return path.join(__dirname, "..", "web", "index.html");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(getIndexPath());
}

ipcMain.handle("waggle:load-settings", () => {
  try {
    const raw = fs.readFileSync(settingsFilePath(), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
});

ipcMain.handle("waggle:save-settings", (event, settings) => {
  try {
    fs.writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Waggle: failed to write settings file", err);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
