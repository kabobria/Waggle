/**
 * Storage abstraction shared by the web and desktop builds.
 *
 * On the web, settings live in localStorage.
 * On desktop, preload.js exposes window.waggleDesktop backed by a JSON file
 * in the OS user-data directory. Same async interface either way, so
 * app.js never needs to know which one it's talking to.
 */
const WaggleStorage = (() => {
  const LOCAL_KEY = "waggle.settings.v1";

  const hasDesktopStore = () =>
    typeof window !== "undefined" && !!window.waggleDesktop;

  async function load(defaults) {
    if (hasDesktopStore()) {
      try {
        const stored = await window.waggleDesktop.loadSettings();
        return stored ? { ...defaults, ...stored } : { ...defaults };
      } catch (err) {
        console.error("Waggle: failed to load desktop settings", err);
        return { ...defaults };
      }
    }
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch (err) {
      console.error("Waggle: failed to load local settings", err);
      return { ...defaults };
    }
  }

  async function save(settings) {
    if (hasDesktopStore()) {
      try {
        await window.waggleDesktop.saveSettings(settings);
      } catch (err) {
        console.error("Waggle: failed to save desktop settings", err);
      }
      return;
    }
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error("Waggle: failed to save local settings", err);
    }
  }

  return { load, save };
})();
