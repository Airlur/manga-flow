document.addEventListener("DOMContentLoaded", async () => {
  const sourceLangSelect = document.getElementById("source-lang");
  const targetLangSelect = document.getElementById("target-lang");
  const engineSelect = document.getElementById("translate-engine");
  const translateBtn = document.getElementById("translate-btn");
  const settingsLink = document.getElementById("settings-link");
  const tip = document.getElementById("tip");
  const status = document.getElementById("status");
  const result = await chrome.storage.local.get("settings");
  let settings = result.settings || {};
  console.log("[MangaFlow Popup] 加载设置:", settings);
  if (!settings.translateEngine) {
    settings = {
      sourceLang: "ko",
      targetLang: "zh",
      translateEngine: "google",
      fontSize: 14,
      fontScale: 1,
      fontColor: "#000000",
      maskOpacity: 0.24,
      ocrEngine: "local"
    };
    await chrome.storage.local.set({ settings });
  }
  if (sourceLangSelect && settings.sourceLang) {
    sourceLangSelect.value = settings.sourceLang;
  }
  if (targetLangSelect && settings.targetLang) {
    targetLangSelect.value = settings.targetLang;
  }
  if (engineSelect && settings.translateEngine) {
    engineSelect.value = settings.translateEngine;
  }
  sourceLangSelect == null ? void 0 : sourceLangSelect.addEventListener("change", async () => {
    const currentResult = await chrome.storage.local.get("settings");
    const currentSettings = currentResult.settings || {};
    currentSettings.sourceLang = sourceLangSelect.value;
    await chrome.storage.local.set({ settings: currentSettings });
    console.log("[MangaFlow Popup] 保存原文语言:", sourceLangSelect.value);
  });
  targetLangSelect == null ? void 0 : targetLangSelect.addEventListener("change", async () => {
    const currentResult = await chrome.storage.local.get("settings");
    const currentSettings = currentResult.settings || {};
    currentSettings.targetLang = targetLangSelect.value;
    await chrome.storage.local.set({ settings: currentSettings });
    console.log("[MangaFlow Popup] 保存目标语言:", targetLangSelect.value);
  });
  engineSelect == null ? void 0 : engineSelect.addEventListener("change", async () => {
    const currentResult = await chrome.storage.local.get("settings");
    const currentSettings = currentResult.settings || {};
    currentSettings.translateEngine = engineSelect.value;
    await chrome.storage.local.set({ settings: currentSettings });
    console.log("[MangaFlow Popup] 保存翻译引擎:", engineSelect.value);
  });
  translateBtn == null ? void 0 : translateBtn.addEventListener("click", async () => {
    console.log("[MangaFlow Popup] 点击开始翻译");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log("[MangaFlow Popup] 当前标签页:", tab == null ? void 0 : tab.url);
      if (!(tab == null ? void 0 : tab.id) || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        showTip("请先打开漫画网站再使用");
        return;
      }
      showStatus("正在启动翻译...");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "START_TRANSLATION" });
      console.log("[MangaFlow Popup] 收到响应:", response);
      if (response == null ? void 0 : response.success) {
        window.close();
      }
    } catch (error) {
      console.error("[MangaFlow Popup] 发送消息失败:", error);
      showTip("请先刷新页面后再使用");
    }
  });
  settingsLink == null ? void 0 : settingsLink.addEventListener("click", async () => {
    console.log("[MangaFlow Popup] 点击更多设置");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!(tab == null ? void 0 : tab.id) || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        showTip("请先打开漫画网站再使用");
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { type: "OPEN_SETTINGS" });
      console.log("[MangaFlow Popup] 设置响应:", response);
      if (response == null ? void 0 : response.success) {
        window.close();
      }
    } catch (error) {
      console.error("[MangaFlow Popup] 发送消息失败:", error);
      showTip("请先刷新页面后再使用");
    }
  });
  const clearCacheBtn = document.getElementById("clear-cache-btn");
  clearCacheBtn == null ? void 0 : clearCacheBtn.addEventListener("click", async () => {
    if (!confirm("确定要清除所有 OCR/翻译缓存吗？（不会影响您的设置和 API Key）")) return;
    try {
      showStatus("正在清除缓存...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!(tab == null ? void 0 : tab.id) || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        showTip("请先打开漫画页面再清除缓存");
        return;
      }
      const response = await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_CACHE" });
      if (!(response == null ? void 0 : response.success)) {
        throw new Error((response == null ? void 0 : response.error) || "清除失败");
      }
      showStatus("✅ OCR/翻译缓存已清除！");
      setTimeout(() => window.close(), 1500);
    } catch (error) {
      console.error("[MangaFlow] 清除缓存失败:", error);
      showTip("清除失败");
    }
  });
  function showTip(message) {
    if (tip) {
      tip.textContent = "⚠️ " + message;
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
