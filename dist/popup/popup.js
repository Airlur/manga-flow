const DEFAULT_SETTINGS = {
  sourceLang: "ko",
  targetLang: "zh",
  translateEngine: "google",
  apiBaseUrl: "",
  apiKey: "",
  model: "gpt-4o-mini",
  deeplxUrl: "",
  deeplApiKey: "",
  fontSize: 14,
  fontScale: 1,
  fontColor: "#000000",
  maskOpacity: 0.24,
  ocrEngine: "local",
  cloudOcrKey: "",
  requestDelay: 0,
  devMode: true,
  devPhase: "roi",
  showOcrBoxes: true,
  showRoiBoxes: true,
  showMaskBoxes: false,
  sitePolicy: "auto_detect",
  siteWhitelist: []
};
function normalizeSettings(settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    targetLang: "zh",
    sitePolicy: (settings == null ? void 0 : settings.sitePolicy) || DEFAULT_SETTINGS.sitePolicy,
    siteWhitelist: Array.isArray(settings == null ? void 0 : settings.siteWhitelist) ? settings.siteWhitelist : []
  };
}
document.addEventListener("DOMContentLoaded", async () => {
  const sourceLangSelect = document.getElementById("source-lang");
  const targetLangSelect = document.getElementById("target-lang");
  const engineSelect = document.getElementById("translate-engine");
  const translateBtn = document.getElementById("translate-btn");
  const restoreBallBtn = document.getElementById("restore-ball-btn");
  const settingsLink = document.getElementById("settings-link");
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  const tip = document.getElementById("tip");
  const status = document.getElementById("status");
  const result = await chrome.storage.local.get("settings");
  let settings = normalizeSettings(result.settings);
  if (!result.settings) {
    await chrome.storage.local.set({ settings });
  }
  if (sourceLangSelect) sourceLangSelect.value = settings.sourceLang;
  if (targetLangSelect) targetLangSelect.value = settings.targetLang;
  if (engineSelect) engineSelect.value = settings.translateEngine;
  sourceLangSelect == null ? void 0 : sourceLangSelect.addEventListener("change", async () => {
    settings = await savePartialSettings({ sourceLang: sourceLangSelect.value });
  });
  targetLangSelect == null ? void 0 : targetLangSelect.addEventListener("change", async () => {
    settings = await savePartialSettings({ targetLang: targetLangSelect.value });
  });
  engineSelect == null ? void 0 : engineSelect.addEventListener("change", async () => {
    settings = await savePartialSettings({ translateEngine: engineSelect.value });
  });
  translateBtn == null ? void 0 : translateBtn.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (!(tab == null ? void 0 : tab.id)) {
        showTip("请先打开漫画网站再使用");
        return;
      }
      showStatus("正在启动翻译...");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "START_TRANSLATION" });
      if (response == null ? void 0 : response.success) {
        window.close();
        return;
      }
      showTip((response == null ? void 0 : response.error) || "启动翻译失败");
    } catch (error) {
      console.error("[MangaFlow Popup] 启动翻译失败:", error);
      showTip("请先刷新页面后再使用");
    }
  });
  restoreBallBtn == null ? void 0 : restoreBallBtn.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (!(tab == null ? void 0 : tab.id)) {
        showTip("请先打开漫画网站再使用");
        return;
      }
      showStatus("正在恢复悬浮球...");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "RESTORE_FLOATING_BALL" });
      if (response == null ? void 0 : response.success) {
        window.close();
        return;
      }
      if ((response == null ? void 0 : response.qualified) === false) {
        showTip("当前页面未识别为漫画页，暂不显示悬浮球");
        return;
      }
      showTip("恢复悬浮球失败，请先刷新页面");
    } catch (error) {
      console.error("[MangaFlow Popup] 恢复悬浮球失败:", error);
      showTip("请先刷新页面后再使用");
    }
  });
  settingsLink == null ? void 0 : settingsLink.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (!(tab == null ? void 0 : tab.id)) {
        showTip("请先打开漫画网站再使用");
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { type: "OPEN_SETTINGS" });
      if (response == null ? void 0 : response.success) {
        window.close();
        return;
      }
      showTip("打开设置失败");
    } catch (error) {
      console.error("[MangaFlow Popup] 打开设置失败:", error);
      showTip("请先刷新页面后再使用");
    }
  });
  clearCacheBtn == null ? void 0 : clearCacheBtn.addEventListener("click", async () => {
    if (!confirm("确定要清除所有 OCR/翻译缓存吗？（不会影响当前设置）")) return;
    try {
      const tab = await getActiveTab();
      if (!(tab == null ? void 0 : tab.id)) {
        showTip("请先打开漫画页面再清除缓存");
        return;
      }
      showStatus("正在清除缓存...");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_CACHE" });
      if (!(response == null ? void 0 : response.success)) {
        throw new Error((response == null ? void 0 : response.error) || "清除失败");
      }
      showStatus("OCR / 翻译缓存已清除");
      setTimeout(() => window.close(), 1200);
    } catch (error) {
      console.error("[MangaFlow Popup] 清除缓存失败:", error);
      showTip("清除缓存失败");
    }
  });
  async function savePartialSettings(partial) {
    const currentResult = await chrome.storage.local.get("settings");
    const merged = normalizeSettings({
      ...currentResult.settings,
      ...partial
    });
    await chrome.storage.local.set({ settings: merged });
    return merged;
  }
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!(tab == null ? void 0 : tab.url)) return void 0;
    const invalidUrl = tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:");
    return invalidUrl ? void 0 : tab;
  }
  function showTip(message) {
    if (tip) {
      tip.textContent = message;
      tip.classList.add("show");
    }
    if (status) {
      status.classList.remove("show");
    }
  }
  function showStatus(message) {
    if (status) {
      status.textContent = message;
      status.classList.add("show");
      status.classList.remove("error");
    }
    if (tip) {
      tip.classList.remove("show");
    }
  }
});
//# sourceMappingURL=popup.js.map
