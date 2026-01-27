chrome.runtime.onMessage.addListener(
  (request, _sender, sendResponse) => {
    if (request.type === "API_REQUEST") {
      handleAPIRequest(request.url, request.options).then((data) => sendResponse({ success: true, data })).catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === "TEST_TRANSLATION") {
      handleTestTranslation(request.engine, request.text, request.settings).then((translated) => sendResponse({ success: true, translated })).catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === "FETCH_IMAGE") {
      fetchImageAsBase64(request.imageUrl).then((imageData) => sendResponse({ success: true, imageData })).catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
  }
);
async function handleAPIRequest(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function fetchImageAsBase64(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`图片获取失败: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("读取图片失败"));
      }
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}
async function handleTestTranslation(engine, text, settings) {
  switch (engine) {
    case "microsoft":
      return testMicrosoftTranslate(text);
    case "google":
      return testGoogleTranslate(text);
    case "openai":
      return testOpenAITranslate(text, settings);
    case "deeplx":
      return testDeepLXTranslate(text, settings);
    case "deepl":
      return testDeepLTranslate(text, settings);
    default:
      throw new Error("未知的翻译引擎");
  }
}
async function testMicrosoftTranslate(text) {
  var _a, _b, _c;
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify([{ text }])
    });
    if (!response.ok) {
      console.warn("[MangaFlow] 微软翻译需要认证，回退到 Google 翻译");
      return testGoogleTranslate(text);
    }
    const data = await response.json();
    return ((_c = (_b = (_a = data[0]) == null ? void 0 : _a.translations) == null ? void 0 : _b[0]) == null ? void 0 : _c.text) || "";
  } catch {
    return testGoogleTranslate(text);
  }
}
async function testGoogleTranslate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Google 翻译请求失败");
  }
  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map((item) => item[0]).join("");
  }
  throw new Error("Google 翻译返回格式错误");
}
async function testOpenAITranslate(text, settings) {
  var _a, _b, _c, _d;
  if (!(settings == null ? void 0 : settings.apiBaseUrl) || !(settings == null ? void 0 : settings.apiKey)) {
    throw new Error("请先配置 API 地址和 Key");
  }
  const url = `${settings.apiBaseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "你是一个翻译助手。请将用户输入的文本翻译成简体中文。只输出翻译结果，不要解释。"
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 100
    })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(((_a = errorData.error) == null ? void 0 : _a.message) || `API 请求失败: ${response.status}`);
  }
  const data = await response.json();
  return ((_d = (_c = (_b = data.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) || "";
}
async function testDeepLXTranslate(text, settings) {
  var _a;
  if (!(settings == null ? void 0 : settings.deeplxUrl)) {
    throw new Error("请先配置 DeepLX 服务地址");
  }
  const response = await fetch(settings.deeplxUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      source_lang: "auto",
      target_lang: "ZH"
    })
  });
  if (!response.ok) {
    throw new Error(`DeepLX 请求失败: ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== 200 && data.code !== void 0) {
    throw new Error(data.message || "DeepLX 翻译失败");
  }
  return data.data || ((_a = data.alternatives) == null ? void 0 : _a[0]) || "";
}
async function testDeepLTranslate(text, settings) {
  var _a, _b;
  if (!(settings == null ? void 0 : settings.deeplApiKey)) {
    throw new Error("请先配置 DeepL API Key");
  }
  const url = "https://api-free.deepl.com/v2/translate";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${settings.deeplApiKey}`
    },
    body: JSON.stringify({
      text: [text],
      target_lang: "ZH"
    })
  });
  if (!response.ok) {
    throw new Error(`DeepL API 请求失败: ${response.status}`);
  }
  const data = await response.json();
  return ((_b = (_a = data.translations) == null ? void 0 : _a[0]) == null ? void 0 : _b.text) || "";
}
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("漫译 MangaFlow 已安装");
    chrome.storage.local.set({
      settings: {
        sourceLang: "ko",
        targetLang: "zh",
        translateEngine: "microsoft",
        apiBaseUrl: "",
        apiKey: "",
        model: "gpt-4o-mini",
        deeplxUrl: "",
        deeplApiKey: "",
        fontSize: 14,
        fontColor: "#000000",
        ocrEngine: "local",
        cloudOcrKey: ""
      }
    });
  }
});
console.log("漫译 MangaFlow Service Worker 已启动");
//# sourceMappingURL=service-worker.js.map
