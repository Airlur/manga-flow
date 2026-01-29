const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
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
      fontColor: "#000000",
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
    if (!confirm("确定要清除所有翻译缓存吗？（不会影响您的设置和 API Key）")) return;
    try {
      const { default: localforage } = await __vitePreload(async () => {
        const { default: localforage2 } = await import("../chunks/localforage.js").then((n) => n.l);
        return { default: localforage2 };
      }, true ? [] : void 0);
      const store = localforage.createInstance({
        name: "manga-flow",
        storeName: "translations"
      });
      await store.clear();
      showStatus("✅ 翻译缓存已清除！");
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
