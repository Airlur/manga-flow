(function() {
  "use strict";
  class FloatingBall {
    constructor(options) {
      this.element = null;
      this.progressText = null;
      this.mainBtn = null;
      this.state = "idle";
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
      this.dragStartTime = 0;
      this.options = options;
    }
    mount() {
      this.createElement();
      this.bindEvents();
    }
    createElement() {
      const iconUrl = chrome.runtime.getURL("icons/icon48.png");
      this.element = document.createElement("div");
      this.element.id = "manga-flow-ball";
      this.element.className = "manga-flow-ball";
      this.element.innerHTML = `
            <div class="manga-flow-ball__container">
                <button class="manga-flow-ball__main" title="点击开始翻译">
                    <img class="manga-flow-ball__icon" src="${iconUrl}" alt="MangaFlow" />
                    <div class="manga-flow-ball__spinner"></div>
                </button>
                <button class="manga-flow-ball__settings" title="设置">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="6" cy="12" r="1.5"/>
                        <circle cx="12" cy="12" r="1.5"/>
                        <circle cx="18" cy="12" r="1.5"/>
                    </svg>
                </button>
            </div>
            <div class="manga-flow-ball__progress"></div>
        `;
      this.progressText = this.element.querySelector(".manga-flow-ball__progress");
      this.mainBtn = this.element.querySelector(".manga-flow-ball__main");
      document.body.appendChild(this.element);
    }
    bindEvents() {
      if (!this.element) return;
      const mainBtn = this.element.querySelector(".manga-flow-ball__main");
      const settingsBtn = this.element.querySelector(".manga-flow-ball__settings");
      mainBtn == null ? void 0 : mainBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.isDragging) return;
        this.handleMainClick();
      });
      settingsBtn == null ? void 0 : settingsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.options.onSettings();
      });
      this.element.addEventListener("mousedown", this.handleDragStart.bind(this));
      document.addEventListener("mousemove", this.handleDragMove.bind(this));
      document.addEventListener("mouseup", this.handleDragEnd.bind(this));
      this.element.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: true });
      document.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: true });
      document.addEventListener("touchend", this.handleDragEnd.bind(this));
    }
    handleMainClick() {
      switch (this.state) {
        case "idle":
        case "completed":
        case "error":
          this.options.onStart();
          break;
        case "translating":
          this.options.onPause();
          break;
        case "paused":
          this.options.onStart();
          break;
      }
    }
    handleDragStart(e) {
      var _a, _b;
      if (e.target.closest(".manga-flow-ball__settings")) return;
      this.dragStartTime = Date.now();
      this.isDragging = false;
      this.dragOffset = {
        x: e.clientX - (((_a = this.element) == null ? void 0 : _a.offsetLeft) || 0),
        y: e.clientY - (((_b = this.element) == null ? void 0 : _b.offsetTop) || 0)
      };
    }
    handleDragMove(e) {
      if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
      if (!this.isDragging && Date.now() - this.dragStartTime > 150) {
        this.isDragging = true;
      }
      if (this.element && this.isDragging) {
        this.element.style.left = `${e.clientX - this.dragOffset.x}px`;
        this.element.style.top = `${e.clientY - this.dragOffset.y}px`;
        this.element.style.right = "auto";
        this.element.style.bottom = "auto";
      }
    }
    handleDragEnd() {
      setTimeout(() => {
        this.isDragging = false;
      }, 100);
      this.dragOffset = { x: 0, y: 0 };
    }
    handleTouchStart(e) {
      var _a, _b;
      const touch = e.touches[0];
      this.dragStartTime = Date.now();
      this.dragOffset = {
        x: touch.clientX - (((_a = this.element) == null ? void 0 : _a.offsetLeft) || 0),
        y: touch.clientY - (((_b = this.element) == null ? void 0 : _b.offsetTop) || 0)
      };
    }
    handleTouchMove(e) {
      if (this.dragOffset.x === 0 && this.dragOffset.y === 0) return;
      const touch = e.touches[0];
      if (!this.isDragging && Date.now() - this.dragStartTime > 150) {
        this.isDragging = true;
      }
      if (this.element && this.isDragging) {
        this.element.style.left = `${touch.clientX - this.dragOffset.x}px`;
        this.element.style.top = `${touch.clientY - this.dragOffset.y}px`;
        this.element.style.right = "auto";
        this.element.style.bottom = "auto";
      }
    }
    setState(state) {
      this.state = state;
      if (!this.element) return;
      this.element.classList.remove(
        "manga-flow-ball--idle",
        "manga-flow-ball--translating",
        "manga-flow-ball--paused",
        "manga-flow-ball--completed",
        "manga-flow-ball--error"
      );
      this.element.classList.add(`manga-flow-ball--${state}`);
    }
    updateProgress(current, total) {
      if (this.progressText) {
        this.progressText.textContent = `${current}/${total}`;
        this.progressText.style.display = "block";
      }
    }
    hideProgress() {
      if (this.progressText) {
        this.progressText.style.display = "none";
      }
    }
    unmount() {
      var _a;
      (_a = this.element) == null ? void 0 : _a.remove();
    }
  }
  let toastContainer = null;
  function ensureContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
      return toastContainer;
    }
    toastContainer = document.createElement("div");
    toastContainer.id = "manga-flow-toast-container";
    toastContainer.className = "manga-flow-toast-container";
    document.body.appendChild(toastContainer);
    return toastContainer;
  }
  function showToast(message, type = "info", duration = 3e3) {
    const container = ensureContainer();
    const toast = document.createElement("div");
    toast.className = `manga-flow-toast manga-flow-toast--${type}`;
    const icons = {
      success: "✓",
      error: "✗",
      warning: "⚠",
      info: "ℹ"
    };
    toast.innerHTML = `
    <span class="manga-flow-toast__icon">${icons[type]}</span>
    <span class="manga-flow-toast__message">${message}</span>
  `;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add("manga-flow-toast--visible");
    });
    setTimeout(() => {
      toast.classList.remove("manga-flow-toast--visible");
      toast.classList.add("manga-flow-toast--hiding");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }
  class SettingsPanel {
    constructor(options) {
      this.element = null;
      this.isVisible = false;
      this.options = options;
      this.createElement();
    }
    createElement() {
      this.element = document.createElement("div");
      this.element.id = "manga-flow-settings";
      this.element.className = "manga-flow-settings";
      this.element.innerHTML = `
      <div class="manga-flow-settings__overlay"></div>
      <div class="manga-flow-settings__panel">
        <div class="manga-flow-settings__header">
          <h2>漫译 MangaFlow 设置</h2>
          <button class="manga-flow-settings__close" title="关闭">×</button>
        </div>
        <div class="manga-flow-settings__content">
          <!-- 翻译设置 -->
          <section class="manga-flow-settings__section">
            <h3>语言设置</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-source-lang">原文语言</label>
              <select id="mf-source-lang">
                <option value="ko">韩语 (Korean)</option>
                <option value="ja">日语 (Japanese)</option>
                <option value="en">英语 (English)</option>
                <option value="auto">自动检测</option>
              </select>
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-target-lang">目标语言</label>
              <select id="mf-target-lang">
                <option value="zh">简体中文</option>
              </select>
            </div>
          </section>

          <!-- 翻译引擎选择 -->
          <section class="manga-flow-settings__section">
            <h3>翻译服务</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-translate-engine">翻译引擎</label>
              <select id="mf-translate-engine">
                <option value="microsoft">微软翻译（免费，无需配置）</option>
                <option value="google">Google 翻译（免费，无需配置）</option>
                <option value="openai">OpenAI 兼容 API（GPT/DeepSeek 等）</option>
                <option value="deeplx">DeepLX（免费，需配置 URL）</option>
                <option value="deepl">DeepL 官方 API（需配置 Key）</option>
              </select>
            </div>
            <div class="manga-flow-settings__field">
              <button type="button" class="manga-flow-settings__btn manga-flow-settings__btn--test" id="mf-test-btn">
                测试翻译服务
              </button>
              <span id="mf-test-result" style="margin-left: 12px; font-size: 13px;"></span>
            </div>
          </section>

          <!-- OpenAI 兼容 API 设置 -->
          <section class="manga-flow-settings__section manga-flow-settings__section--openai" style="display: none;">
            <h3>OpenAI 兼容 API 配置</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-api-base">API 地址</label>
              <input type="text" id="mf-api-base" placeholder="例如: https://api.openai.com/v1" />
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-api-key">API Key</label>
              <div class="manga-flow-settings__input-group">
                <input type="password" id="mf-api-key" placeholder="例如: sk-xxx..." />
                <button type="button" class="manga-flow-settings__toggle-pwd" data-target="mf-api-key" title="显示/隐藏">👁</button>
              </div>
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-model">模型名称</label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <select id="mf-model-select" style="flex: 1;">
                  <option value="">-- 请先获取模型列表 --</option>
                </select>
                <button type="button" id="mf-fetch-models" class="manga-flow-settings__btn" style="white-space: nowrap; padding: 6px 12px;">
                  获取列表
                </button>
              </div>
              <input type="text" id="mf-model" placeholder="或手动输入: gpt-4o-mini, deepseek-chat" style="margin-top: 8px;" />
              <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                点击"获取列表"自动加载可用模型，或直接手动输入模型名称
              </small>
            </div>
          </section>

          <!-- DeepLX 设置 -->
          <section class="manga-flow-settings__section manga-flow-settings__section--deeplx" style="display: none;">
            <h3>DeepLX 配置</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-deeplx-url">DeepLX 服务地址</label>
              <input type="text" id="mf-deeplx-url" placeholder="例如: https://api.deeplx.org/YOUR_KEY/translate" />
              <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                格式: https://api.deeplx.org/你的KEY/translate
              </small>
            </div>
          </section>

          <!-- DeepL 官方设置 -->
          <section class="manga-flow-settings__section manga-flow-settings__section--deepl" style="display: none;">
            <h3>DeepL 官方 API 配置</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-deepl-key">API Key</label>
              <div class="manga-flow-settings__input-group">
                <input type="password" id="mf-deepl-key" placeholder="例如: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx" />
                <button type="button" class="manga-flow-settings__toggle-pwd" data-target="mf-deepl-key" title="显示/隐藏">👁</button>
              </div>
            </div>
          </section>

          <!-- OCR 设置 -->
          <section class="manga-flow-settings__section">
            <h3>文字识别 (OCR)</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-ocr-engine">OCR 引擎</label>
              <select id="mf-ocr-engine">
                <option value="local">本地识别 (Tesseract.js，无需配置)</option>
                <option value="cloud">☁️ Google Cloud Vision (精度高，需 API Key)</option>
              </select>
            </div>
            <div class="manga-flow-settings__field manga-flow-settings__field--cloud-ocr" style="display: none;">
              <label for="mf-cloud-ocr-key">Google Cloud Vision API Key</label>
              <div class="manga-flow-settings__input-group">
                <input type="password" id="mf-cloud-ocr-key" placeholder="输入你的 Google Cloud Vision API Key" />
                <button type="button" class="manga-flow-settings__toggle-pwd" data-target="mf-cloud-ocr-key" title="显示/隐藏">👁</button>
              </div>
              <small style="color: #666; font-size: 12px; margin-top: 4px; display: block;">
                在 <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: #1a73e8;">Google Cloud Console</a> 创建 API Key，并启用 Vision API
              </small>
            </div>
          </section>

          <!-- 显示设置 -->
          <section class="manga-flow-settings__section">
            <h3>显示设置</h3>
            <div class="manga-flow-settings__field">
              <label for="mf-font-size">译文字体倍率: <span id="mf-font-size-value">100</span>%</label>
              <input type="range" id="mf-font-size" min="85" max="120" value="100" />
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-font-color">译文字体颜色</label>
              <input type="color" id="mf-font-color" value="#000000" />
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-mask-opacity">遮罩透明度: <span id="mf-mask-opacity-value">0.24</span></label>
              <input type="range" id="mf-mask-opacity" min="0.15" max="0.55" step="0.01" value="0.24" />
            </div>
          </section>

          <!-- 开发模式（仅调试） -->
          <section class="manga-flow-settings__section manga-flow-settings__section--dev" style="display: none;">
            <h3>开发模式</h3>
            <div class="manga-flow-settings__field">
              <label>
                <input type="checkbox" id="mf-dev-mode" />
                启用开发模式（默认开启）
              </label>
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-dev-phase">执行阶段</label>
              <select id="mf-dev-phase">
                <option value="roi">阶段 A：仅 ROI（不调用 OCR）</option>
                <option value="ocr">阶段 B：ROI + OCR（不翻译）</option>
                <option value="translate">阶段 C：OCR + 翻译（不渲染）</option>
                <option value="full">阶段 D：完整流程（擦除 + 渲染）</option>
              </select>
            </div>
            <div class="manga-flow-settings__field">
              <label>
                <input type="checkbox" id="mf-show-ocr-boxes" />
                显示 OCR 红框
              </label>
            </div>
            <div class="manga-flow-settings__field">
              <label>
                <input type="checkbox" id="mf-show-roi-boxes" />
                显示 ROI 橙框
              </label>
            </div>
            <div class="manga-flow-settings__field">
              <label>
                <input type="checkbox" id="mf-show-mask-boxes" />
                显示 遮罩 绿框
              </label>
            </div>
          </section>
        </div>
        <div class="manga-flow-settings__footer">
          <button class="manga-flow-settings__btn manga-flow-settings__btn--cancel">取消</button>
          <button class="manga-flow-settings__btn manga-flow-settings__btn--save">保存设置</button>
        </div>
      </div>
    `;
      document.body.appendChild(this.element);
      const devSection = this.element.querySelector(".manga-flow-settings__section--dev");
      if (devSection) {
        devSection.style.display = "block";
      }
      this.bindEvents();
      this.loadSettings();
    }
    bindEvents() {
      if (!this.element) return;
      const closeBtn = this.element.querySelector(".manga-flow-settings__close");
      const cancelBtn = this.element.querySelector(".manga-flow-settings__btn--cancel");
      const overlay = this.element.querySelector(".manga-flow-settings__overlay");
      closeBtn == null ? void 0 : closeBtn.addEventListener("click", () => this.hide());
      cancelBtn == null ? void 0 : cancelBtn.addEventListener("click", () => this.hide());
      overlay == null ? void 0 : overlay.addEventListener("click", () => this.hide());
      const saveBtn = this.element.querySelector(".manga-flow-settings__btn--save");
      saveBtn == null ? void 0 : saveBtn.addEventListener("click", () => this.save());
      const testBtn = this.element.querySelector("#mf-test-btn");
      testBtn == null ? void 0 : testBtn.addEventListener("click", () => this.testService());
      const engineSelect = this.element.querySelector("#mf-translate-engine");
      const testResult = this.element.querySelector("#mf-test-result");
      engineSelect == null ? void 0 : engineSelect.addEventListener("change", () => {
        this.toggleEngineSettings(engineSelect.value);
        if (testResult) {
          testResult.textContent = "";
        }
      });
      const ocrSelect = this.element.querySelector("#mf-ocr-engine");
      const cloudOcrField = this.element.querySelector(".manga-flow-settings__field--cloud-ocr");
      ocrSelect == null ? void 0 : ocrSelect.addEventListener("change", () => {
        cloudOcrField.style.display = ocrSelect.value === "cloud" ? "block" : "none";
      });
      const fetchModelsBtn = this.element.querySelector("#mf-fetch-models");
      fetchModelsBtn == null ? void 0 : fetchModelsBtn.addEventListener("click", () => this.fetchModelList());
      const modelSelect = this.element.querySelector("#mf-model-select");
      const modelInput = this.element.querySelector("#mf-model");
      modelSelect == null ? void 0 : modelSelect.addEventListener("change", () => {
        if (modelSelect.value) {
          modelInput.value = modelSelect.value;
        }
      });
      const fontSizeInput = this.element.querySelector("#mf-font-size");
      const fontSizeValue = this.element.querySelector("#mf-font-size-value");
      fontSizeInput == null ? void 0 : fontSizeInput.addEventListener("input", () => {
        if (fontSizeValue) fontSizeValue.textContent = fontSizeInput.value;
      });
      const maskOpacityInput = this.element.querySelector("#mf-mask-opacity");
      const maskOpacityValue = this.element.querySelector("#mf-mask-opacity-value");
      maskOpacityInput == null ? void 0 : maskOpacityInput.addEventListener("input", () => {
        if (maskOpacityValue) maskOpacityValue.textContent = maskOpacityInput.value;
      });
      const devModeInput = this.element.querySelector("#mf-dev-mode");
      const devPhaseSelect = this.element.querySelector("#mf-dev-phase");
      if (devModeInput && devPhaseSelect) {
        devModeInput.addEventListener("change", () => {
          devPhaseSelect.disabled = !devModeInput.checked;
        });
      }
      const togglePwdBtns = this.element.querySelectorAll(".manga-flow-settings__toggle-pwd");
      togglePwdBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          var _a;
          const targetId = btn.dataset.target;
          if (!targetId) return;
          const input = (_a = this.element) == null ? void 0 : _a.querySelector(`#${targetId}`);
          if (!input) return;
          if (input.type === "password") {
            input.type = "text";
            btn.textContent = "🔒";
          } else {
            input.type = "password";
            btn.textContent = "👁";
          }
        });
      });
    }
    toggleEngineSettings(engine) {
      if (!this.element) return;
      const openaiSection = this.element.querySelector(".manga-flow-settings__section--openai");
      const deeplxSection = this.element.querySelector(".manga-flow-settings__section--deeplx");
      const deeplSection = this.element.querySelector(".manga-flow-settings__section--deepl");
      if (openaiSection) openaiSection.style.display = "none";
      if (deeplxSection) deeplxSection.style.display = "none";
      if (deeplSection) deeplSection.style.display = "none";
      switch (engine) {
        case "openai":
          if (openaiSection) openaiSection.style.display = "block";
          break;
        case "deeplx":
          if (deeplxSection) deeplxSection.style.display = "block";
          break;
        case "deepl":
          if (deeplSection) deeplSection.style.display = "block";
          break;
      }
    }
    async testService() {
      if (!this.element) return;
      const resultEl = this.element.querySelector("#mf-test-result");
      const testBtn = this.element.querySelector("#mf-test-btn");
      if (!resultEl || !testBtn) return;
      testBtn.disabled = true;
      resultEl.textContent = "测试中...";
      resultEl.style.color = "#666";
      try {
        const engine = this.element.querySelector("#mf-translate-engine").value;
        const testText = "Hello";
        const response = await chrome.runtime.sendMessage({
          type: "TEST_TRANSLATION",
          engine,
          text: testText,
          settings: this.getCurrentSettings()
        });
        if (response == null ? void 0 : response.success) {
          resultEl.textContent = `✓ 测试成功: "${response.translated}"`;
          resultEl.style.color = "#2e7d32";
        } else {
          resultEl.textContent = `✗ 测试失败: ${(response == null ? void 0 : response.error) || "未知错误"}`;
          resultEl.style.color = "#c62828";
        }
      } catch (error) {
        resultEl.textContent = `✗ 测试失败: ${error.message}`;
        resultEl.style.color = "#c62828";
      } finally {
        testBtn.disabled = false;
      }
    }
    /**
     * 获取模型列表
     */
    async fetchModelList() {
      var _a;
      if (!this.element) return;
      const modelSelect = this.element.querySelector("#mf-model-select");
      const fetchBtn = this.element.querySelector("#mf-fetch-models");
      const apiBase = this.element.querySelector("#mf-api-base").value;
      const apiKey = this.element.querySelector("#mf-api-key").value;
      if (!modelSelect || !fetchBtn) return;
      if (!apiBase || !apiKey) {
        alert("请先填写 API 地址和 API Key");
        return;
      }
      fetchBtn.disabled = true;
      fetchBtn.textContent = "获取中...";
      try {
        const baseUrl = apiBase.replace(/\/$/, "");
        const response = await chrome.runtime.sendMessage({
          type: "API_REQUEST",
          url: `${baseUrl}/models`,
          options: {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`
            }
          }
        });
        if (!response.success) {
          throw new Error(response.error || "获取模型列表失败");
        }
        const models = ((_a = response.data) == null ? void 0 : _a.data) || [];
        modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';
        if (models.length === 0) {
          modelSelect.innerHTML = '<option value="">-- 未找到模型 --</option>';
          return;
        }
        models.sort((a, b) => a.id.localeCompare(b.id));
        for (const model of models) {
          const option = document.createElement("option");
          option.value = model.id;
          option.textContent = model.id;
          modelSelect.appendChild(option);
        }
        console.log(`[MangaFlow] 获取到 ${models.length} 个模型`);
      } catch (error) {
        console.error("[MangaFlow] 获取模型列表失败:", error);
        alert(`获取模型列表失败: ${error.message}`);
        modelSelect.innerHTML = '<option value="">-- 获取失败 --</option>';
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = "获取列表";
      }
    }
    getCurrentSettings() {
      if (!this.element) return {};
      return {
        translateEngine: this.element.querySelector("#mf-translate-engine").value,
        apiBaseUrl: this.element.querySelector("#mf-api-base").value,
        apiKey: this.element.querySelector("#mf-api-key").value,
        model: this.element.querySelector("#mf-model").value,
        deeplxUrl: this.element.querySelector("#mf-deeplx-url").value,
        deeplApiKey: this.element.querySelector("#mf-deepl-key").value
      };
    }
    async loadSettings() {
      var _a;
      if (!((_a = chrome == null ? void 0 : chrome.runtime) == null ? void 0 : _a.id)) {
        console.warn("[MangaFlow] 扩展上下文已失效，无法读取设置");
        return;
      }
      let settings;
      try {
        const result = await chrome.storage.local.get("settings");
        settings = result.settings;
      } catch (error) {
        console.error("[MangaFlow] 读取设置失败:", error);
        showToast("扩展已更新/重载，请刷新页面", "warning");
        return;
      }
      if (!settings || !this.element) return;
      this.element.querySelector("#mf-source-lang").value = settings.sourceLang || "ko";
      this.element.querySelector("#mf-target-lang").value = settings.targetLang || "zh";
      this.element.querySelector("#mf-translate-engine").value = settings.translateEngine || "microsoft";
      this.element.querySelector("#mf-api-base").value = settings.apiBaseUrl || "";
      this.element.querySelector("#mf-api-key").value = settings.apiKey || "";
      this.element.querySelector("#mf-model").value = settings.model || "gpt-4o-mini";
      this.element.querySelector("#mf-deeplx-url").value = settings.deeplxUrl || "";
      this.element.querySelector("#mf-deepl-key").value = settings.deeplApiKey || "";
      this.element.querySelector("#mf-ocr-engine").value = settings.ocrEngine || "local";
      this.element.querySelector("#mf-cloud-ocr-key").value = settings.cloudOcrKey || "";
      const rawScale = settings.fontScale ?? (settings.fontSize ? settings.fontSize / 14 : 1);
      const fontScale = Math.max(0.85, Math.min(1.2, rawScale));
      const scalePercent = Math.round(fontScale * 100);
      this.element.querySelector("#mf-font-size").value = String(scalePercent);
      this.element.querySelector("#mf-font-size-value").textContent = String(scalePercent);
      this.element.querySelector("#mf-font-color").value = settings.fontColor || "#000000";
      const maskOpacity = Math.max(0.15, Math.min(0.55, settings.maskOpacity ?? 0.24));
      this.element.querySelector("#mf-mask-opacity").value = String(maskOpacity);
      this.element.querySelector("#mf-mask-opacity-value").textContent = String(maskOpacity);
      this.toggleEngineSettings(settings.translateEngine || "microsoft");
      const cloudOcrField = this.element.querySelector(".manga-flow-settings__field--cloud-ocr");
      if (cloudOcrField) {
        cloudOcrField.style.display = settings.ocrEngine === "cloud" ? "block" : "none";
      }
      {
        const devMode = settings.devMode ?? true;
        const devPhase = settings.devPhase || "roi";
        const devModeInput = this.element.querySelector("#mf-dev-mode");
        const devPhaseSelect = this.element.querySelector("#mf-dev-phase");
        const showOcrInput = this.element.querySelector("#mf-show-ocr-boxes");
        const showRoiInput = this.element.querySelector("#mf-show-roi-boxes");
        const showMaskInput = this.element.querySelector("#mf-show-mask-boxes");
        if (devModeInput) devModeInput.checked = devMode;
        if (devPhaseSelect) {
          devPhaseSelect.value = devPhase;
          devPhaseSelect.disabled = !devMode;
        }
        if (showOcrInput) showOcrInput.checked = settings.showOcrBoxes ?? true;
        if (showRoiInput) showRoiInput.checked = settings.showRoiBoxes ?? true;
        if (showMaskInput) showMaskInput.checked = settings.showMaskBoxes ?? false;
      }
      const modelSelect = this.element.querySelector("#mf-model-select");
      const savedModel = settings.model || "";
      if (modelSelect && savedModel) {
        const existingOption = Array.from(modelSelect.options).find((opt) => opt.value === savedModel);
        if (!existingOption) {
          const option = document.createElement("option");
          option.value = savedModel;
          option.textContent = savedModel;
          option.selected = true;
          modelSelect.insertBefore(option, modelSelect.firstChild);
        } else {
          modelSelect.value = savedModel;
        }
      }
    }
    save() {
      var _a, _b, _c, _d, _e;
      if (!this.element) return;
      const settings = {
        sourceLang: this.element.querySelector("#mf-source-lang").value,
        targetLang: "zh",
        translateEngine: this.element.querySelector("#mf-translate-engine").value,
        apiBaseUrl: this.element.querySelector("#mf-api-base").value,
        apiKey: this.element.querySelector("#mf-api-key").value,
        model: this.element.querySelector("#mf-model").value,
        deeplxUrl: this.element.querySelector("#mf-deeplx-url").value,
        deeplApiKey: this.element.querySelector("#mf-deepl-key").value,
        ocrEngine: this.element.querySelector("#mf-ocr-engine").value,
        cloudOcrKey: this.element.querySelector("#mf-cloud-ocr-key").value,
        fontSize: Math.round(parseInt(this.element.querySelector("#mf-font-size").value) / 100 * 14),
        fontScale: parseInt(this.element.querySelector("#mf-font-size").value) / 100,
        fontColor: this.element.querySelector("#mf-font-color").value,
        maskOpacity: parseFloat(this.element.querySelector("#mf-mask-opacity").value),
        devMode: ((_a = this.element.querySelector("#mf-dev-mode")) == null ? void 0 : _a.checked) ?? true,
        devPhase: (_b = this.element.querySelector("#mf-dev-phase")) == null ? void 0 : _b.value,
        showOcrBoxes: ((_c = this.element.querySelector("#mf-show-ocr-boxes")) == null ? void 0 : _c.checked) ?? true,
        showRoiBoxes: ((_d = this.element.querySelector("#mf-show-roi-boxes")) == null ? void 0 : _d.checked) ?? true,
        showMaskBoxes: ((_e = this.element.querySelector("#mf-show-mask-boxes")) == null ? void 0 : _e.checked) ?? false
      };
      this.options.onSave(settings);
      this.hide();
    }
    show() {
      var _a;
      this.loadSettings();
      (_a = this.element) == null ? void 0 : _a.classList.add("manga-flow-settings--visible");
      this.isVisible = true;
    }
    hide() {
      var _a;
      (_a = this.element) == null ? void 0 : _a.classList.remove("manga-flow-settings--visible");
      this.isVisible = false;
      this.options.onClose();
    }
  }
  const siteConfigs = {
    "comix.to": {
      name: "Comix.to",
      // 精确匹配正文图片，排除封面区域
      imageSelector: ".reading-content img, #readerarea img, .chapter-content img, .chapter-images img",
      containerSelector: ".reading-content, #readerarea, .chapter-content",
      lazyLoadAttr: "data-src",
      language: "ko",
      features: {
        lazyLoad: true,
        infiniteScroll: true
      }
    },
    "toongod.org": {
      name: "ToonGod",
      imageSelector: ".wp-manga-chapter-img, img.ts-main-image, .reading-content img",
      containerSelector: ".reading-content",
      lazyLoadAttr: "data-src",
      language: "en",
      features: {
        lazyLoad: true,
        infiniteScroll: false
      }
    },
    "omegascans.org": {
      name: "OmegaScans",
      imageSelector: 'img[class*="chapter"], .container img, main img, .reader-area img',
      containerSelector: ".container, main, .reader-area",
      lazyLoadAttr: "data-src",
      language: "en",
      features: {
        lazyLoad: true,
        infiniteScroll: true
      }
    },
    "manhwaread.com": {
      name: "ManhwaRead",
      imageSelector: ".page-break img, .reading-content img, .chapter-content img",
      containerSelector: ".reading-content, .chapter-content",
      lazyLoadAttr: "data-src",
      language: "en",
      features: {
        lazyLoad: true,
        infiniteScroll: false
      }
    }
    // 可扩展更多站点...
  };
  const defaultConfig = {
    name: "Default",
    // 通用选择器，尝试匹配常见的阅读容器
    imageSelector: ".reading-content img, .chapter-content img, .reader-area img, article img, main img, img",
    containerSelector: ".reading-content, .chapter-content, .reader-area, article, main",
    lazyLoadAttr: "data-src",
    language: "auto",
    features: {
      lazyLoad: true,
      infiniteScroll: false
    }
  };
  function getSiteConfig(url) {
    try {
      const hostname = new URL(url).hostname;
      for (const [domain, config] of Object.entries(siteConfigs)) {
        if (hostname.includes(domain)) {
          console.log(`[MangaFlow] 站点适配: ${config.name}`);
          return config;
        }
      }
    } catch (error) {
      console.warn("[MangaFlow] URL 解析失败:", error);
    }
    console.log("[MangaFlow] 使用默认配置（通用模式）");
    return defaultConfig;
  }
  const _ImageDetector = class _ImageDetector {
    constructor() {
      this.observer = null;
      this.intersectionObserver = null;
      this.processedImages = /* @__PURE__ */ new Set();
      this.onNewImage = null;
      this.siteConfig = getSiteConfig(window.location.href);
      this.init();
    }
    init() {
      this.setupMutationObserver();
      this.setupIntersectionObserver();
    }
    // 获取图片的真实 URL（处理懒加载）
    getImageRealSrc(img) {
      for (const attr of _ImageDetector.LAZY_ATTRS) {
        const lazySrc = img.getAttribute(attr);
        if (lazySrc && this.isValidImageUrl(lazySrc)) {
          return lazySrc;
        }
      }
      if (this.siteConfig.lazyLoadAttr) {
        const lazySrc = img.getAttribute(this.siteConfig.lazyLoadAttr);
        if (lazySrc && this.isValidImageUrl(lazySrc)) {
          return lazySrc;
        }
      }
      return img.src || "";
    }
    // 检查是否为有效的图片 URL
    isValidImageUrl(url) {
      if (!url) return false;
      const placeholders = ["placeholder", "loading", "blank", "data:image/gif", "data:image/png;base64,iVBOR"];
      return !placeholders.some((p) => url.toLowerCase().includes(p));
    }
    // 设置 DOM 变化监听器（懒加载图片检测）
    setupMutationObserver() {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            var _a, _b;
            if (node instanceof HTMLElement) {
              if (node.tagName === "IMG") {
                this.checkImage(node);
              }
              (_b = (_a = node.querySelectorAll) == null ? void 0 : _a.call(node, "img")) == null ? void 0 : _b.forEach((img) => {
                this.checkImage(img);
              });
            }
          });
          if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
            this.checkImage(mutation.target);
          }
        });
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", ..._ImageDetector.LAZY_ATTRS, this.siteConfig.lazyLoadAttr].filter(Boolean)
      });
    }
    // 设置视口交叉监听器
    setupIntersectionObserver() {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
              const src2 = this.getImageRealSrc(entry.target);
              if (src2 && !this.processedImages.has(src2)) {
                console.log("[MangaFlow] 图片进入视口:", src2.substring(src2.lastIndexOf("/") + 1));
                if (this.onNewImage) {
                  this.onNewImage(entry.target);
                }
              }
            }
          });
        },
        { rootMargin: "500px" }
        // 提前 500px 开始检测
      );
    }
    // 检查单个图片是否为漫画图片
    checkImage(img) {
      var _a;
      const src2 = this.getImageRealSrc(img);
      if (!src2 || this.processedImages.has(src2)) return;
      if (img.src && !img.complete) {
        img.addEventListener("load", () => this.checkImage(img), { once: true });
        return;
      }
      if (this.isComicImage(img)) {
        console.log("[MangaFlow] ✓ 识别为漫画图片:", src2.substring(src2.lastIndexOf("/") + 1));
        this.processedImages.add(src2);
        (_a = this.intersectionObserver) == null ? void 0 : _a.observe(img);
      }
    }
    // 判断是否为漫画图片
    isComicImage(img) {
      const src2 = this.getImageRealSrc(img);
      if (!src2) return false;
      const srcLower = src2.toLowerCase();
      const className = (img.className || "").toLowerCase();
      const id = (img.id || "").toLowerCase();
      const alt = (img.alt || "").toLowerCase();
      const combined = srcLower + className + id + alt;
      if (_ImageDetector.EXCLUDE_KEYWORDS.some((kw) => combined.includes(kw))) {
        return false;
      }
      const isSequentialImage = /\/\d{1,3}\.(webp|jpg|jpeg|png|gif)$/i.test(src2) || // 06.webp
      /\/[a-z]+_\d{2,3}\.(jpg|jpeg|png|webp|gif)$/i.test(src2) || // mr_004.jpg
      /\/\d+\/\d+\/[^/]+\.(jpg|jpeg|png|webp|gif)$/i.test(src2);
      const width = img.naturalWidth || img.width || parseInt(img.getAttribute("width") || "0");
      const height = img.naturalHeight || img.height || parseInt(img.getAttribute("height") || "0");
      if (width > 0 && height > 0) {
        if (width < 200 || height < 200) return false;
      }
      if (this.siteConfig.containerSelector) {
        const container = document.querySelector(this.siteConfig.containerSelector);
        if (container && !container.contains(img)) {
          return false;
        }
      }
      if (this.siteConfig.imageSelector) {
        const selectors = this.siteConfig.imageSelector.split(",").map((s) => s.trim());
        const matchesSelector = selectors.some((selector) => {
          try {
            return img.matches(selector);
          } catch {
            return false;
          }
        });
        if (matchesSelector) return true;
      }
      if (isSequentialImage) return true;
      if (width >= 400 && height >= 400) return true;
      return false;
    }
    // 获取当前页面所有漫画图片（用于初始翻译）
    getComicImages() {
      const images = [];
      const allImages = document.querySelectorAll("img");
      console.log("[MangaFlow] 扫描页面图片，共", allImages.length, "张");
      allImages.forEach((img) => {
        const src2 = this.getImageRealSrc(img);
        if (src2 && this.isComicImage(img)) {
          console.log("[MangaFlow] + 添加图片:", src2.substring(src2.lastIndexOf("/") + 1));
          images.push(img);
          this.processedImages.add(src2);
        }
      });
      console.log("[MangaFlow] 最终筛选出", images.length, "张漫画图片");
      return images;
    }
    // 设置新图片回调
    setOnNewImage(callback) {
      this.onNewImage = callback;
    }
    // 销毁
    destroy() {
      var _a, _b;
      (_a = this.observer) == null ? void 0 : _a.disconnect();
      (_b = this.intersectionObserver) == null ? void 0 : _b.disconnect();
      this.processedImages.clear();
    }
  };
  _ImageDetector.EXCLUDE_KEYWORDS = [
    "cover",
    "thumbnail",
    "avatar",
    "logo",
    "banner",
    "poster",
    "icon",
    "button",
    "badge",
    "emoji",
    "sticker",
    "ad",
    "sponsor",
    "favicon"
  ];
  _ImageDetector.LAZY_ATTRS = ["data-src", "data-lazy-src", "data-original", "data-lazy", "lazysrc"];
  let ImageDetector = _ImageDetector;
  var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var runtime = { exports: {} };
  (function(module) {
    var runtime2 = function(exports$1) {
      var Op = Object.prototype;
      var hasOwn = Op.hasOwnProperty;
      var defineProperty = Object.defineProperty || function(obj, key, desc) {
        obj[key] = desc.value;
      };
      var undefined$1;
      var $Symbol = typeof Symbol === "function" ? Symbol : {};
      var iteratorSymbol = $Symbol.iterator || "@@iterator";
      var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
      var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
      function define(obj, key, value) {
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
        return obj[key];
      }
      try {
        define({}, "");
      } catch (err) {
        define = function(obj, key, value) {
          return obj[key] = value;
        };
      }
      function wrap(innerFn, outerFn, self2, tryLocsList) {
        var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
        var generator = Object.create(protoGenerator.prototype);
        var context = new Context(tryLocsList || []);
        defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self2, context) });
        return generator;
      }
      exports$1.wrap = wrap;
      function tryCatch(fn, obj, arg) {
        try {
          return { type: "normal", arg: fn.call(obj, arg) };
        } catch (err) {
          return { type: "throw", arg: err };
        }
      }
      var GenStateSuspendedStart = "suspendedStart";
      var GenStateSuspendedYield = "suspendedYield";
      var GenStateExecuting = "executing";
      var GenStateCompleted = "completed";
      var ContinueSentinel = {};
      function Generator() {
      }
      function GeneratorFunction() {
      }
      function GeneratorFunctionPrototype() {
      }
      var IteratorPrototype = {};
      define(IteratorPrototype, iteratorSymbol, function() {
        return this;
      });
      var getProto = Object.getPrototypeOf;
      var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
      if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
        IteratorPrototype = NativeIteratorPrototype;
      }
      var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
      GeneratorFunction.prototype = GeneratorFunctionPrototype;
      defineProperty(Gp, "constructor", { value: GeneratorFunctionPrototype, configurable: true });
      defineProperty(
        GeneratorFunctionPrototype,
        "constructor",
        { value: GeneratorFunction, configurable: true }
      );
      GeneratorFunction.displayName = define(
        GeneratorFunctionPrototype,
        toStringTagSymbol,
        "GeneratorFunction"
      );
      function defineIteratorMethods(prototype) {
        ["next", "throw", "return"].forEach(function(method) {
          define(prototype, method, function(arg) {
            return this._invoke(method, arg);
          });
        });
      }
      exports$1.isGeneratorFunction = function(genFun) {
        var ctor = typeof genFun === "function" && genFun.constructor;
        return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
      };
      exports$1.mark = function(genFun) {
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
        } else {
          genFun.__proto__ = GeneratorFunctionPrototype;
          define(genFun, toStringTagSymbol, "GeneratorFunction");
        }
        genFun.prototype = Object.create(Gp);
        return genFun;
      };
      exports$1.awrap = function(arg) {
        return { __await: arg };
      };
      function AsyncIterator(generator, PromiseImpl) {
        function invoke(method, arg, resolve, reject) {
          var record = tryCatch(generator[method], generator, arg);
          if (record.type === "throw") {
            reject(record.arg);
          } else {
            var result = record.arg;
            var value = result.value;
            if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
              return PromiseImpl.resolve(value.__await).then(function(value2) {
                invoke("next", value2, resolve, reject);
              }, function(err) {
                invoke("throw", err, resolve, reject);
              });
            }
            return PromiseImpl.resolve(value).then(function(unwrapped) {
              result.value = unwrapped;
              resolve(result);
            }, function(error) {
              return invoke("throw", error, resolve, reject);
            });
          }
        }
        var previousPromise;
        function enqueue(method, arg) {
          function callInvokeWithMethodAndArg() {
            return new PromiseImpl(function(resolve, reject) {
              invoke(method, arg, resolve, reject);
            });
          }
          return previousPromise = // If enqueue has been called before, then we want to wait until
          // all previous Promises have been resolved before calling invoke,
          // so that results are always delivered in the correct order. If
          // enqueue has not been called before, then it is important to
          // call invoke immediately, without waiting on a callback to fire,
          // so that the async generator function has the opportunity to do
          // any necessary setup in a predictable way. This predictability
          // is why the Promise constructor synchronously invokes its
          // executor callback, and why async functions synchronously
          // execute code before the first await. Since we implement simple
          // async functions in terms of async generators, it is especially
          // important to get this right, even though it requires care.
          previousPromise ? previousPromise.then(
            callInvokeWithMethodAndArg,
            // Avoid propagating failures to Promises returned by later
            // invocations of the iterator.
            callInvokeWithMethodAndArg
          ) : callInvokeWithMethodAndArg();
        }
        defineProperty(this, "_invoke", { value: enqueue });
      }
      defineIteratorMethods(AsyncIterator.prototype);
      define(AsyncIterator.prototype, asyncIteratorSymbol, function() {
        return this;
      });
      exports$1.AsyncIterator = AsyncIterator;
      exports$1.async = function(innerFn, outerFn, self2, tryLocsList, PromiseImpl) {
        if (PromiseImpl === void 0) PromiseImpl = Promise;
        var iter = new AsyncIterator(
          wrap(innerFn, outerFn, self2, tryLocsList),
          PromiseImpl
        );
        return exports$1.isGeneratorFunction(outerFn) ? iter : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
      };
      function makeInvokeMethod(innerFn, self2, context) {
        var state = GenStateSuspendedStart;
        return function invoke(method, arg) {
          if (state === GenStateExecuting) {
            throw new Error("Generator is already running");
          }
          if (state === GenStateCompleted) {
            if (method === "throw") {
              throw arg;
            }
            return doneResult();
          }
          context.method = method;
          context.arg = arg;
          while (true) {
            var delegate = context.delegate;
            if (delegate) {
              var delegateResult = maybeInvokeDelegate(delegate, context);
              if (delegateResult) {
                if (delegateResult === ContinueSentinel) continue;
                return delegateResult;
              }
            }
            if (context.method === "next") {
              context.sent = context._sent = context.arg;
            } else if (context.method === "throw") {
              if (state === GenStateSuspendedStart) {
                state = GenStateCompleted;
                throw context.arg;
              }
              context.dispatchException(context.arg);
            } else if (context.method === "return") {
              context.abrupt("return", context.arg);
            }
            state = GenStateExecuting;
            var record = tryCatch(innerFn, self2, context);
            if (record.type === "normal") {
              state = context.done ? GenStateCompleted : GenStateSuspendedYield;
              if (record.arg === ContinueSentinel) {
                continue;
              }
              return {
                value: record.arg,
                done: context.done
              };
            } else if (record.type === "throw") {
              state = GenStateCompleted;
              context.method = "throw";
              context.arg = record.arg;
            }
          }
        };
      }
      function maybeInvokeDelegate(delegate, context) {
        var methodName = context.method;
        var method = delegate.iterator[methodName];
        if (method === undefined$1) {
          context.delegate = null;
          if (methodName === "throw" && delegate.iterator["return"]) {
            context.method = "return";
            context.arg = undefined$1;
            maybeInvokeDelegate(delegate, context);
            if (context.method === "throw") {
              return ContinueSentinel;
            }
          }
          if (methodName !== "return") {
            context.method = "throw";
            context.arg = new TypeError(
              "The iterator does not provide a '" + methodName + "' method"
            );
          }
          return ContinueSentinel;
        }
        var record = tryCatch(method, delegate.iterator, context.arg);
        if (record.type === "throw") {
          context.method = "throw";
          context.arg = record.arg;
          context.delegate = null;
          return ContinueSentinel;
        }
        var info = record.arg;
        if (!info) {
          context.method = "throw";
          context.arg = new TypeError("iterator result is not an object");
          context.delegate = null;
          return ContinueSentinel;
        }
        if (info.done) {
          context[delegate.resultName] = info.value;
          context.next = delegate.nextLoc;
          if (context.method !== "return") {
            context.method = "next";
            context.arg = undefined$1;
          }
        } else {
          return info;
        }
        context.delegate = null;
        return ContinueSentinel;
      }
      defineIteratorMethods(Gp);
      define(Gp, toStringTagSymbol, "Generator");
      define(Gp, iteratorSymbol, function() {
        return this;
      });
      define(Gp, "toString", function() {
        return "[object Generator]";
      });
      function pushTryEntry(locs) {
        var entry = { tryLoc: locs[0] };
        if (1 in locs) {
          entry.catchLoc = locs[1];
        }
        if (2 in locs) {
          entry.finallyLoc = locs[2];
          entry.afterLoc = locs[3];
        }
        this.tryEntries.push(entry);
      }
      function resetTryEntry(entry) {
        var record = entry.completion || {};
        record.type = "normal";
        delete record.arg;
        entry.completion = record;
      }
      function Context(tryLocsList) {
        this.tryEntries = [{ tryLoc: "root" }];
        tryLocsList.forEach(pushTryEntry, this);
        this.reset(true);
      }
      exports$1.keys = function(val) {
        var object = Object(val);
        var keys = [];
        for (var key in object) {
          keys.push(key);
        }
        keys.reverse();
        return function next() {
          while (keys.length) {
            var key2 = keys.pop();
            if (key2 in object) {
              next.value = key2;
              next.done = false;
              return next;
            }
          }
          next.done = true;
          return next;
        };
      };
      function values(iterable) {
        if (iterable) {
          var iteratorMethod = iterable[iteratorSymbol];
          if (iteratorMethod) {
            return iteratorMethod.call(iterable);
          }
          if (typeof iterable.next === "function") {
            return iterable;
          }
          if (!isNaN(iterable.length)) {
            var i = -1, next = function next2() {
              while (++i < iterable.length) {
                if (hasOwn.call(iterable, i)) {
                  next2.value = iterable[i];
                  next2.done = false;
                  return next2;
                }
              }
              next2.value = undefined$1;
              next2.done = true;
              return next2;
            };
            return next.next = next;
          }
        }
        return { next: doneResult };
      }
      exports$1.values = values;
      function doneResult() {
        return { value: undefined$1, done: true };
      }
      Context.prototype = {
        constructor: Context,
        reset: function(skipTempReset) {
          this.prev = 0;
          this.next = 0;
          this.sent = this._sent = undefined$1;
          this.done = false;
          this.delegate = null;
          this.method = "next";
          this.arg = undefined$1;
          this.tryEntries.forEach(resetTryEntry);
          if (!skipTempReset) {
            for (var name in this) {
              if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
                this[name] = undefined$1;
              }
            }
          }
        },
        stop: function() {
          this.done = true;
          var rootEntry = this.tryEntries[0];
          var rootRecord = rootEntry.completion;
          if (rootRecord.type === "throw") {
            throw rootRecord.arg;
          }
          return this.rval;
        },
        dispatchException: function(exception) {
          if (this.done) {
            throw exception;
          }
          var context = this;
          function handle(loc, caught) {
            record.type = "throw";
            record.arg = exception;
            context.next = loc;
            if (caught) {
              context.method = "next";
              context.arg = undefined$1;
            }
            return !!caught;
          }
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            var record = entry.completion;
            if (entry.tryLoc === "root") {
              return handle("end");
            }
            if (entry.tryLoc <= this.prev) {
              var hasCatch = hasOwn.call(entry, "catchLoc");
              var hasFinally = hasOwn.call(entry, "finallyLoc");
              if (hasCatch && hasFinally) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                } else if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else if (hasCatch) {
                if (this.prev < entry.catchLoc) {
                  return handle(entry.catchLoc, true);
                }
              } else if (hasFinally) {
                if (this.prev < entry.finallyLoc) {
                  return handle(entry.finallyLoc);
                }
              } else {
                throw new Error("try statement without catch or finally");
              }
            }
          }
        },
        abrupt: function(type, arg) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
              var finallyEntry = entry;
              break;
            }
          }
          if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
            finallyEntry = null;
          }
          var record = finallyEntry ? finallyEntry.completion : {};
          record.type = type;
          record.arg = arg;
          if (finallyEntry) {
            this.method = "next";
            this.next = finallyEntry.finallyLoc;
            return ContinueSentinel;
          }
          return this.complete(record);
        },
        complete: function(record, afterLoc) {
          if (record.type === "throw") {
            throw record.arg;
          }
          if (record.type === "break" || record.type === "continue") {
            this.next = record.arg;
          } else if (record.type === "return") {
            this.rval = this.arg = record.arg;
            this.method = "return";
            this.next = "end";
          } else if (record.type === "normal" && afterLoc) {
            this.next = afterLoc;
          }
          return ContinueSentinel;
        },
        finish: function(finallyLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.finallyLoc === finallyLoc) {
              this.complete(entry.completion, entry.afterLoc);
              resetTryEntry(entry);
              return ContinueSentinel;
            }
          }
        },
        "catch": function(tryLoc) {
          for (var i = this.tryEntries.length - 1; i >= 0; --i) {
            var entry = this.tryEntries[i];
            if (entry.tryLoc === tryLoc) {
              var record = entry.completion;
              if (record.type === "throw") {
                var thrown = record.arg;
                resetTryEntry(entry);
              }
              return thrown;
            }
          }
          throw new Error("illegal catch attempt");
        },
        delegateYield: function(iterable, resultName, nextLoc) {
          this.delegate = {
            iterator: values(iterable),
            resultName,
            nextLoc
          };
          if (this.method === "next") {
            this.arg = undefined$1;
          }
          return ContinueSentinel;
        }
      };
      return exports$1;
    }(
      // If this script is executing as a CommonJS module, use module.exports
      // as the regeneratorRuntime namespace. Otherwise create a new empty
      // object. Either way, the resulting object will be used to initialize
      // the regeneratorRuntime variable at the top of this file.
      module.exports
    );
    try {
      regeneratorRuntime = runtime2;
    } catch (accidentalStrictMode) {
      if (typeof globalThis === "object") {
        globalThis.regeneratorRuntime = runtime2;
      } else {
        Function("r", "regeneratorRuntime = r")(runtime2);
      }
    }
  })(runtime);
  var getId$3 = (prefix, cnt) => `${prefix}-${cnt}-${Math.random().toString(16).slice(3, 8)}`;
  const getId$2 = getId$3;
  let jobCounter = 0;
  var createJob$2 = ({
    id: _id,
    action,
    payload = {}
  }) => {
    let id = _id;
    if (typeof id === "undefined") {
      id = getId$2("Job", jobCounter);
      jobCounter += 1;
    }
    return {
      id,
      action,
      payload
    };
  };
  var log$2 = {};
  let logging = false;
  log$2.logging = logging;
  log$2.setLogging = (_logging) => {
    logging = _logging;
  };
  log$2.log = (...args) => logging ? console.log.apply(void 0, args) : null;
  const createJob$1 = createJob$2;
  const { log: log$1 } = log$2;
  const getId$1 = getId$3;
  let schedulerCounter = 0;
  var createScheduler$1 = () => {
    const id = getId$1("Scheduler", schedulerCounter);
    const workers = {};
    const runningWorkers = {};
    let jobQueue = [];
    schedulerCounter += 1;
    const getQueueLen = () => jobQueue.length;
    const getNumWorkers = () => Object.keys(workers).length;
    const dequeue = () => {
      if (jobQueue.length !== 0) {
        const wIds = Object.keys(workers);
        for (let i = 0; i < wIds.length; i += 1) {
          if (typeof runningWorkers[wIds[i]] === "undefined") {
            jobQueue[0](workers[wIds[i]]);
            break;
          }
        }
      }
    };
    const queue = (action, payload) => new Promise((resolve, reject) => {
      const job = createJob$1({ action, payload });
      jobQueue.push(async (w) => {
        jobQueue.shift();
        runningWorkers[w.id] = job;
        try {
          resolve(await w[action].apply(void 0, [...payload, job.id]));
        } catch (err) {
          reject(err);
        } finally {
          delete runningWorkers[w.id];
          dequeue();
        }
      });
      log$1(`[${id}]: Add ${job.id} to JobQueue`);
      log$1(`[${id}]: JobQueue length=${jobQueue.length}`);
      dequeue();
    });
    const addWorker = (w) => {
      workers[w.id] = w;
      log$1(`[${id}]: Add ${w.id}`);
      log$1(`[${id}]: Number of workers=${getNumWorkers()}`);
      dequeue();
      return w.id;
    };
    const addJob = async (action, ...payload) => {
      if (getNumWorkers() === 0) {
        throw Error(`[${id}]: You need to have at least one worker before adding jobs`);
      }
      return queue(action, payload);
    };
    const terminate = async () => {
      Object.keys(workers).forEach(async (wid) => {
        await workers[wid].terminate();
      });
      jobQueue = [];
    };
    return {
      addWorker,
      addJob,
      terminate,
      getQueueLen,
      getNumWorkers
    };
  };
  function commonjsRequire(path) {
    throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
  }
  function isElectron$1() {
    if (typeof window !== "undefined" && typeof window.process === "object" && window.process.type === "renderer") {
      return true;
    }
    if (typeof process !== "undefined" && typeof process.versions === "object" && !!process.versions.electron) {
      return true;
    }
    if (typeof navigator === "object" && typeof navigator.userAgent === "string" && navigator.userAgent.indexOf("Electron") >= 0) {
      return true;
    }
    return false;
  }
  var isElectron_1 = isElectron$1;
  const isElectron = isElectron_1;
  var getEnvironment = (key) => {
    const env = {};
    if (typeof WorkerGlobalScope !== "undefined") {
      env.type = "webworker";
    } else if (isElectron()) {
      env.type = "electron";
    } else if (typeof document === "object") {
      env.type = "browser";
    } else if (typeof process === "object" && typeof commonjsRequire === "function") {
      env.type = "node";
    }
    if (typeof key === "undefined") {
      return env;
    }
    return env[key];
  };
  const isBrowser = getEnvironment("type") === "browser";
  const resolveURL = isBrowser ? (s) => new URL(s, window.location.href).href : (s) => s;
  var resolvePaths$1 = (options) => {
    const opts = { ...options };
    ["corePath", "workerPath", "langPath"].forEach((key) => {
      if (options[key]) {
        opts[key] = resolveURL(opts[key]);
      }
    });
    return opts;
  };
  var circularize$1 = (page) => {
    const blocks = [];
    const paragraphs = [];
    const lines = [];
    const words = [];
    const symbols = [];
    if (page.blocks) {
      page.blocks.forEach((block) => {
        block.paragraphs.forEach((paragraph) => {
          paragraph.lines.forEach((line) => {
            line.words.forEach((word) => {
              word.symbols.forEach((sym) => {
                symbols.push({
                  ...sym,
                  page,
                  block,
                  paragraph,
                  line,
                  word
                });
              });
              words.push({
                ...word,
                page,
                block,
                paragraph,
                line
              });
            });
            lines.push({
              ...line,
              page,
              block,
              paragraph
            });
          });
          paragraphs.push({
            ...paragraph,
            page,
            block
          });
        });
        blocks.push({
          ...block,
          page
        });
      });
    }
    return {
      ...page,
      blocks,
      paragraphs,
      lines,
      words,
      symbols
    };
  };
  var OEM$2 = {
    TESSERACT_ONLY: 0,
    LSTM_ONLY: 1,
    TESSERACT_LSTM_COMBINED: 2,
    DEFAULT: 3
  };
  const version$1 = "5.1.1";
  const require$$0 = {
    version: version$1
  };
  var defaultOptions$3 = {
    /*
     * Use BlobURL for worker script by default
     * TODO: remove this option
     *
     */
    workerBlobURL: true,
    logger: () => {
    }
  };
  const version = require$$0.version;
  const defaultOptions$2 = defaultOptions$3;
  var defaultOptions_1 = {
    ...defaultOptions$2,
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@v${version}/dist/worker.min.js`
  };
  var spawnWorker$2 = ({ workerPath, workerBlobURL }) => {
    let worker;
    if (Blob && URL && workerBlobURL) {
      const blob = new Blob([`importScripts("${workerPath}");`], {
        type: "application/javascript"
      });
      worker = new Worker(URL.createObjectURL(blob));
    } else {
      worker = new Worker(workerPath);
    }
    return worker;
  };
  var terminateWorker$2 = (worker) => {
    worker.terminate();
  };
  var onMessage$2 = (worker, handler) => {
    worker.onmessage = ({ data }) => {
      handler(data);
    };
  };
  var send$2 = async (worker, packet) => {
    worker.postMessage(packet);
  };
  const readFromBlobOrFile = (blob) => new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
      resolve(fileReader.result);
    };
    fileReader.onerror = ({ target: { error: { code } } }) => {
      reject(Error(`File could not be read! Code=${code}`));
    };
    fileReader.readAsArrayBuffer(blob);
  });
  const loadImage$2 = async (image) => {
    let data = image;
    if (typeof image === "undefined") {
      return "undefined";
    }
    if (typeof image === "string") {
      if (/data:image\/([a-zA-Z]*);base64,([^"]*)/.test(image)) {
        data = atob(image.split(",")[1]).split("").map((c) => c.charCodeAt(0));
      } else {
        const resp = await fetch(image);
        data = await resp.arrayBuffer();
      }
    } else if (typeof HTMLElement !== "undefined" && image instanceof HTMLElement) {
      if (image.tagName === "IMG") {
        data = await loadImage$2(image.src);
      }
      if (image.tagName === "VIDEO") {
        data = await loadImage$2(image.poster);
      }
      if (image.tagName === "CANVAS") {
        await new Promise((resolve) => {
          image.toBlob(async (blob) => {
            data = await readFromBlobOrFile(blob);
            resolve();
          });
        });
      }
    } else if (typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas) {
      const blob = await image.convertToBlob();
      data = await readFromBlobOrFile(blob);
    } else if (image instanceof File || image instanceof Blob) {
      data = await readFromBlobOrFile(image);
    }
    return new Uint8Array(data);
  };
  var loadImage_1 = loadImage$2;
  const defaultOptions$1 = defaultOptions_1;
  const spawnWorker$1 = spawnWorker$2;
  const terminateWorker$1 = terminateWorker$2;
  const onMessage$1 = onMessage$2;
  const send$1 = send$2;
  const loadImage$1 = loadImage_1;
  var browser = {
    defaultOptions: defaultOptions$1,
    spawnWorker: spawnWorker$1,
    terminateWorker: terminateWorker$1,
    onMessage: onMessage$1,
    send: send$1,
    loadImage: loadImage$1
  };
  const resolvePaths = resolvePaths$1;
  const circularize = circularize$1;
  const createJob = createJob$2;
  const { log } = log$2;
  const getId = getId$3;
  const OEM$1 = OEM$2;
  const {
    defaultOptions,
    spawnWorker,
    terminateWorker,
    onMessage,
    loadImage,
    send
  } = browser;
  let workerCounter = 0;
  var createWorker$2 = async (langs = "eng", oem = OEM$1.LSTM_ONLY, _options = {}, config = {}) => {
    const id = getId("Worker", workerCounter);
    const {
      logger,
      errorHandler,
      ...options
    } = resolvePaths({
      ...defaultOptions,
      ..._options
    });
    const resolves = {};
    const rejects = {};
    const currentLangs = typeof langs === "string" ? langs.split("+") : langs;
    let currentOem = oem;
    let currentConfig = config;
    const lstmOnlyCore = [OEM$1.DEFAULT, OEM$1.LSTM_ONLY].includes(oem) && !options.legacyCore;
    let workerResReject;
    let workerResResolve;
    const workerRes = new Promise((resolve, reject) => {
      workerResResolve = resolve;
      workerResReject = reject;
    });
    const workerError = (event) => {
      workerResReject(event.message);
    };
    let worker = spawnWorker(options);
    worker.onerror = workerError;
    workerCounter += 1;
    const setResolve = (promiseId, res) => {
      resolves[promiseId] = res;
    };
    const setReject = (promiseId, rej) => {
      rejects[promiseId] = rej;
    };
    const startJob = ({ id: jobId, action, payload }) => new Promise((resolve, reject) => {
      log(`[${id}]: Start ${jobId}, action=${action}`);
      const promiseId = `${action}-${jobId}`;
      setResolve(promiseId, resolve);
      setReject(promiseId, reject);
      send(worker, {
        workerId: id,
        jobId,
        action,
        payload
      });
    });
    const load = () => console.warn("`load` is depreciated and should be removed from code (workers now come pre-loaded)");
    const loadInternal = (jobId) => startJob(createJob({
      id: jobId,
      action: "load",
      payload: { options: { lstmOnly: lstmOnlyCore, corePath: options.corePath, logging: options.logging } }
    }));
    const writeText = (path, text, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "writeFile", args: [path, text] }
    }));
    const readText = (path, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "readFile", args: [path, { encoding: "utf8" }] }
    }));
    const removeFile = (path, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method: "unlink", args: [path] }
    }));
    const FS = (method, args, jobId) => startJob(createJob({
      id: jobId,
      action: "FS",
      payload: { method, args }
    }));
    const loadLanguage = () => console.warn("`loadLanguage` is depreciated and should be removed from code (workers now come with language pre-loaded)");
    const loadLanguageInternal = (_langs, jobId) => startJob(createJob({
      id: jobId,
      action: "loadLanguage",
      payload: {
        langs: _langs,
        options: {
          langPath: options.langPath,
          dataPath: options.dataPath,
          cachePath: options.cachePath,
          cacheMethod: options.cacheMethod,
          gzip: options.gzip,
          lstmOnly: [OEM$1.DEFAULT, OEM$1.LSTM_ONLY].includes(currentOem) && !options.legacyLang
        }
      }
    }));
    const initialize = () => console.warn("`initialize` is depreciated and should be removed from code (workers now come pre-initialized)");
    const initializeInternal = (_langs, _oem, _config, jobId) => startJob(createJob({
      id: jobId,
      action: "initialize",
      payload: { langs: _langs, oem: _oem, config: _config }
    }));
    const reinitialize = (langs2 = "eng", oem2, config2, jobId) => {
      if (lstmOnlyCore && [OEM$1.TESSERACT_ONLY, OEM$1.TESSERACT_LSTM_COMBINED].includes(oem2)) throw Error("Legacy model requested but code missing.");
      const _oem = oem2 || currentOem;
      currentOem = _oem;
      const _config = config2 || currentConfig;
      currentConfig = _config;
      const langsArr = typeof langs2 === "string" ? langs2.split("+") : langs2;
      const _langs = langsArr.filter((x) => !currentLangs.includes(x));
      currentLangs.push(..._langs);
      if (_langs.length > 0) {
        return loadLanguageInternal(_langs, jobId).then(() => initializeInternal(langs2, _oem, _config, jobId));
      }
      return initializeInternal(langs2, _oem, _config, jobId);
    };
    const setParameters = (params = {}, jobId) => startJob(createJob({
      id: jobId,
      action: "setParameters",
      payload: { params }
    }));
    const recognize2 = async (image, opts = {}, output = {
      blocks: true,
      text: true,
      hocr: true,
      tsv: true
    }, jobId) => startJob(createJob({
      id: jobId,
      action: "recognize",
      payload: { image: await loadImage(image), options: opts, output }
    }));
    const getPDF = (title = "Tesseract OCR Result", textonly = false, jobId) => {
      console.log("`getPDF` function is depreciated. `recognize` option `savePDF` should be used instead.");
      return startJob(createJob({
        id: jobId,
        action: "getPDF",
        payload: { title, textonly }
      }));
    };
    const detect2 = async (image, jobId) => {
      if (lstmOnlyCore) throw Error("`worker.detect` requires Legacy model, which was not loaded.");
      return startJob(createJob({
        id: jobId,
        action: "detect",
        payload: { image: await loadImage(image) }
      }));
    };
    const terminate = async () => {
      if (worker !== null) {
        terminateWorker(worker);
        worker = null;
      }
      return Promise.resolve();
    };
    onMessage(worker, ({
      workerId,
      jobId,
      status,
      action,
      data
    }) => {
      const promiseId = `${action}-${jobId}`;
      if (status === "resolve") {
        log(`[${workerId}]: Complete ${jobId}`);
        let d = data;
        if (action === "recognize") {
          d = circularize(data);
        } else if (action === "getPDF") {
          d = Array.from({ ...data, length: Object.keys(data).length });
        }
        resolves[promiseId]({ jobId, data: d });
      } else if (status === "reject") {
        rejects[promiseId](data);
        if (action === "load") workerResReject(data);
        if (errorHandler) {
          errorHandler(data);
        } else {
          throw Error(data);
        }
      } else if (status === "progress") {
        logger({ ...data, userJobId: jobId });
      }
    });
    const resolveObj = {
      id,
      worker,
      setResolve,
      setReject,
      load,
      writeText,
      readText,
      removeFile,
      FS,
      loadLanguage,
      initialize,
      reinitialize,
      setParameters,
      recognize: recognize2,
      getPDF,
      detect: detect2,
      terminate
    };
    loadInternal().then(() => loadLanguageInternal(langs)).then(() => initializeInternal(langs, oem, config)).then(() => workerResResolve(resolveObj)).catch(() => {
    });
    return workerRes;
  };
  const createWorker$1 = createWorker$2;
  const recognize = async (image, langs, options) => {
    const worker = await createWorker$1(langs, 1, options);
    return worker.recognize(image).finally(async () => {
      await worker.terminate();
    });
  };
  const detect = async (image, options) => {
    const worker = await createWorker$1("osd", 0, options);
    return worker.detect(image).finally(async () => {
      await worker.terminate();
    });
  };
  var Tesseract$2 = {
    recognize,
    detect
  };
  var languages$1 = {
    AFR: "afr",
    AMH: "amh",
    ARA: "ara",
    ASM: "asm",
    AZE: "aze",
    AZE_CYRL: "aze_cyrl",
    BEL: "bel",
    BEN: "ben",
    BOD: "bod",
    BOS: "bos",
    BUL: "bul",
    CAT: "cat",
    CEB: "ceb",
    CES: "ces",
    CHI_SIM: "chi_sim",
    CHI_TRA: "chi_tra",
    CHR: "chr",
    CYM: "cym",
    DAN: "dan",
    DEU: "deu",
    DZO: "dzo",
    ELL: "ell",
    ENG: "eng",
    ENM: "enm",
    EPO: "epo",
    EST: "est",
    EUS: "eus",
    FAS: "fas",
    FIN: "fin",
    FRA: "fra",
    FRK: "frk",
    FRM: "frm",
    GLE: "gle",
    GLG: "glg",
    GRC: "grc",
    GUJ: "guj",
    HAT: "hat",
    HEB: "heb",
    HIN: "hin",
    HRV: "hrv",
    HUN: "hun",
    IKU: "iku",
    IND: "ind",
    ISL: "isl",
    ITA: "ita",
    ITA_OLD: "ita_old",
    JAV: "jav",
    JPN: "jpn",
    KAN: "kan",
    KAT: "kat",
    KAT_OLD: "kat_old",
    KAZ: "kaz",
    KHM: "khm",
    KIR: "kir",
    KOR: "kor",
    KUR: "kur",
    LAO: "lao",
    LAT: "lat",
    LAV: "lav",
    LIT: "lit",
    MAL: "mal",
    MAR: "mar",
    MKD: "mkd",
    MLT: "mlt",
    MSA: "msa",
    MYA: "mya",
    NEP: "nep",
    NLD: "nld",
    NOR: "nor",
    ORI: "ori",
    PAN: "pan",
    POL: "pol",
    POR: "por",
    PUS: "pus",
    RON: "ron",
    RUS: "rus",
    SAN: "san",
    SIN: "sin",
    SLK: "slk",
    SLV: "slv",
    SPA: "spa",
    SPA_OLD: "spa_old",
    SQI: "sqi",
    SRP: "srp",
    SRP_LATN: "srp_latn",
    SWA: "swa",
    SWE: "swe",
    SYR: "syr",
    TAM: "tam",
    TEL: "tel",
    TGK: "tgk",
    TGL: "tgl",
    THA: "tha",
    TIR: "tir",
    TUR: "tur",
    UIG: "uig",
    UKR: "ukr",
    URD: "urd",
    UZB: "uzb",
    UZB_CYRL: "uzb_cyrl",
    VIE: "vie",
    YID: "yid"
  };
  var PSM$1 = {
    OSD_ONLY: "0",
    AUTO_OSD: "1",
    AUTO_ONLY: "2",
    AUTO: "3",
    SINGLE_COLUMN: "4",
    SINGLE_BLOCK_VERT_TEXT: "5",
    SINGLE_BLOCK: "6",
    SINGLE_LINE: "7",
    SINGLE_WORD: "8",
    CIRCLE_WORD: "9",
    SINGLE_CHAR: "10",
    SPARSE_TEXT: "11",
    SPARSE_TEXT_OSD: "12",
    RAW_LINE: "13"
  };
  const createScheduler = createScheduler$1;
  const createWorker = createWorker$2;
  const Tesseract = Tesseract$2;
  const languages = languages$1;
  const OEM = OEM$2;
  const PSM = PSM$1;
  const { setLogging } = log$2;
  var src = {
    languages,
    OEM,
    PSM,
    createScheduler,
    createWorker,
    setLogging,
    ...Tesseract
  };
  const Tesseract$1 = /* @__PURE__ */ getDefaultExportFromCjs(src);
  const _DebugOverlayManager = class _DebugOverlayManager {
    constructor() {
      this.enabled = true;
      this.showOcr = true;
      this.showRoi = true;
      this.showMask = false;
      this.data = /* @__PURE__ */ new WeakMap();
      this.images = /* @__PURE__ */ new Set();
    }
    static getInstance() {
      if (!_DebugOverlayManager.instance) {
        _DebugOverlayManager.instance = new _DebugOverlayManager();
      }
      return _DebugOverlayManager.instance;
    }
    applySettings(settings) {
      if (!settings) return;
      const devMode = settings.devMode ?? true;
      this.setEnabled(!!devMode);
      this.setShowFlags({
        ocr: settings.showOcrBoxes ?? true,
        roi: settings.showRoiBoxes ?? true,
        mask: settings.showMaskBoxes ?? false
      });
    }
    setEnabled(enabled) {
      if (this.enabled === enabled) return;
      this.enabled = enabled;
      if (!enabled) {
        this.clearAll();
      } else {
        this.renderAll();
      }
    }
    setShowFlags(flags) {
      this.showOcr = flags.ocr;
      this.showRoi = flags.roi;
      this.showMask = flags.mask;
      if (this.enabled) {
        this.renderAll();
      } else {
        this.clearAll();
      }
    }
    setOcrBoxes(image, blocks) {
      if (!this.enabled) return;
      const boxes = blocks.map((b) => b.bbox);
      const data = this.ensureData(image);
      data.ocr = boxes;
      this.renderImage(image);
    }
    setRoiBoxes(image, boxes, labelPrefix) {
      if (!this.enabled) return;
      const data = this.ensureData(image);
      data.roi = { boxes, labelPrefix };
      this.renderImage(image);
    }
    setMaskBoxes(image, boxes) {
      if (!this.enabled) return;
      const data = this.ensureData(image);
      data.mask = boxes;
      this.renderImage(image);
    }
    clearOcrBoxes(image) {
      this.clearBoxes(image, "ocr");
    }
    clearRoiBoxes(image) {
      this.clearBoxes(image, "roi");
    }
    clearMaskBoxes(image) {
      this.clearBoxes(image, "mask");
    }
    ensureData(image) {
      const existing = this.data.get(image);
      if (existing) return existing;
      const data = {};
      this.data.set(image, data);
      this.images.add(image);
      this.ensureDebugId(image);
      return data;
    }
    ensureDebugId(image) {
      const dataset = image instanceof HTMLImageElement ? image.dataset : image.dataset;
      if (!dataset) return "";
      if (!dataset.mfDebugId) {
        dataset.mfDebugId = `mf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      }
      return dataset.mfDebugId;
    }
    renderAll() {
      this.images.forEach((image) => this.renderImage(image));
    }
    renderImage(image) {
      var _a, _b, _c, _d;
      this.clearBoxes(image);
      if (!this.enabled) return;
      const data = this.data.get(image);
      if (!data) return;
      if (this.showOcr && ((_a = data.ocr) == null ? void 0 : _a.length)) {
        this.drawBoxes(image, "ocr", data.ocr);
      }
      if (this.showRoi && ((_c = (_b = data.roi) == null ? void 0 : _b.boxes) == null ? void 0 : _c.length)) {
        this.drawBoxes(image, "roi", data.roi.boxes, data.roi.labelPrefix);
      }
      if (this.showMask && ((_d = data.mask) == null ? void 0 : _d.length)) {
        this.drawBoxes(image, "mask", data.mask);
      }
    }
    clearAll() {
      this.clearBoxes();
    }
    clearBoxes(image, type) {
      if (image) {
        this.clearBoxesForImage(image, type);
        return;
      }
      const selector = type ? `.manga-flow-${type}-box` : ".manga-flow-ocr-box, .manga-flow-roi-box, .manga-flow-mask-box";
      document.querySelectorAll(selector).forEach((el) => el.remove());
    }
    clearBoxesForImage(image, type) {
      const parent = image.parentElement;
      if (!parent) return;
      const id = this.ensureDebugId(image);
      if (!id) return;
      const selector = type ? `.manga-flow-${type}-box[data-mf-debug-id="${id}"]` : `.manga-flow-ocr-box[data-mf-debug-id="${id}"], .manga-flow-roi-box[data-mf-debug-id="${id}"], .manga-flow-mask-box[data-mf-debug-id="${id}"]`;
      parent.querySelectorAll(selector).forEach((el) => el.remove());
    }
    drawBoxes(image, type, boxes, labelPrefix) {
      const parent = image.parentElement;
      if (!parent) return;
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.position === "static") {
        parent.style.position = "relative";
      }
      const rect = image.getBoundingClientRect();
      const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
      const naturalHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
      if (!naturalWidth || !naturalHeight) return;
      const scaleX = rect.width / naturalWidth;
      const scaleY = rect.height / naturalHeight;
      const parentRect = parent.getBoundingClientRect();
      const offsetX = rect.left - parentRect.left;
      const offsetY = rect.top - parentRect.top;
      const id = this.ensureDebugId(image);
      boxes.forEach((box, index) => {
        let x0 = box.x0;
        let y0 = box.y0;
        let x1 = box.x1;
        let y1 = box.y1;
        if (type === "ocr") {
          const w = x1 - x0;
          const h = y1 - y0;
          const px = w * 0.2;
          const py = h * 0.2;
          x0 = Math.max(0, x0 - px);
          y0 = Math.max(0, y0 - py);
          x1 = x1 + px;
          y1 = y1 + py;
        }
        const el = document.createElement("div");
        el.className = `manga-flow-${type}-box`;
        el.dataset.mfDebugId = id;
        el.style.left = `${offsetX + x0 * scaleX}px`;
        el.style.top = `${offsetY + y0 * scaleY}px`;
        el.style.width = `${(x1 - x0) * scaleX}px`;
        el.style.height = `${(y1 - y0) * scaleY}px`;
        if (type === "ocr" || type === "roi") {
          const label = document.createElement("span");
          label.className = `manga-flow-${type}-label`;
          if (type === "roi" && labelPrefix) {
            label.textContent = `${labelPrefix}-${index + 1}`;
          } else {
            label.textContent = `${index + 1}`;
          }
          el.appendChild(label);
        }
        parent.appendChild(el);
      });
    }
  };
  _DebugOverlayManager.instance = null;
  let DebugOverlayManager = _DebugOverlayManager;
  class OCREngine {
    constructor() {
      this.worker = null;
      this.tessInitialized = false;
      this.currentLang = "";
      this.engineType = "local";
      this.cloudApiKey = "";
      this.debugMode = true;
      this.config = {
        minConfidence: 50,
        // 最低置信度 (0-100)
        minTextLength: 2,
        // 最少字符数
        minBlockArea: 80
        // 最小文本块面积 (像素)
      };
      this.langMap = {
        ko: "kor",
        ja: "jpn+jpn_vert",
        en: "eng",
        zh: "chi_sim",
        auto: "kor+jpn+eng"
      };
    }
    /**
     * 设置 OCR 引擎配置
     */
    configure(settings) {
      if (settings.ocrEngine) {
        this.engineType = settings.ocrEngine;
      }
      if (settings.cloudOcrKey) {
        this.cloudApiKey = settings.cloudOcrKey;
      }
      console.log(`[MangaFlow] OCR 引擎: ${this.engineType === "cloud" ? "☁️ Google Cloud Vision" : "💻 本地 Tesseract"}`);
    }
    /**
     * 初始化本地 Tesseract 引擎
     */
    async initLocal(lang = "ko") {
      const tessLang = this.langMap[lang] || "kor+jpn+eng";
      if (this.tessInitialized && this.currentLang === tessLang) {
        return;
      }
      if (this.worker) {
        await this.worker.terminate();
      }
      console.log(`[MangaFlow] 📖 初始化本地 OCR，语言: ${tessLang}`);
      const startTime = performance.now();
      try {
        this.worker = await Tesseract$1.createWorker(tessLang, 1);
        this.currentLang = tessLang;
        this.tessInitialized = true;
        console.log(`[MangaFlow] ✅ 本地 OCR 初始化完成 (${(performance.now() - startTime).toFixed(0)}ms)`);
      } catch (error) {
        console.error("[MangaFlow] ❌ 本地 OCR 初始化失败:", error);
        throw error;
      }
    }
    /**
     * 识别图片中的文字（主入口）
     */
    async recognize(image, lang = "ko", debug = this.debugMode, filename) {
      const logName = filename || "Image";
      console.log(`[MangaFlow] 🔍 开始 OCR 识别 [${logName}] (${this.engineType})...`);
      const startTime = performance.now();
      let result;
      if (this.engineType === "cloud" && this.cloudApiKey) {
        result = await this.recognizeWithGoogleVision(image, filename);
      } else {
        result = await this.recognizeWithTesseract(image, lang);
      }
      const elapsed = performance.now() - startTime;
      console.log(`[MangaFlow] ✅ OCR 完成 (${elapsed.toFixed(0)}ms), 识别 ${result.blocks.length} 个文本块`);
      if (result.blocks.length > 0) {
        console.group("[MangaFlow] 📝 识别结果:");
        result.blocks.forEach((block, i) => {
          console.log(`  [${i + 1}] "${block.text}" (置信度: ${(block.confidence * 100).toFixed(0)}%)`);
        });
        console.groupEnd();
        if (debug) {
          this.drawDebugBoxes(image, result.blocks);
        }
      }
      return result;
    }
    /**
     * 仅识别指定区域（裁剪后 OCR）
     */
    async recognizeRegions(image, regions, lang = "ko", debug = this.debugMode, filename) {
      const safeImage = await this.ensureSafeImage(image);
      const allBlocks = [];
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const cropCanvas = this.cropRegionToCanvas(safeImage, region);
        const name = filename ? `${filename}#ROI${i + 1}` : `ROI${i + 1}`;
        let result;
        if (this.engineType === "cloud" && this.cloudApiKey) {
          result = await this.recognizeWithGoogleVision(cropCanvas, name);
          const regionArea = Math.max(1, cropCanvas.width * cropCanvas.height);
          if (this.shouldFallback(result.blocks, regionArea)) {
            const enhanced = this.preprocessCanvasForOcr(cropCanvas);
            console.log(`[MangaFlow] OCR enhance: ${name} (${enhanced.mode})`);
            const alt = await this.recognizeWithGoogleVision(enhanced.canvas, `${name}#ENH`);
            const scaledAltBlocks = this.scaleBlocks(alt.blocks, 1 / enhanced.scale);
            const altResult = {
              text: scaledAltBlocks.map((b) => b.text).join("\n"),
              confidence: scaledAltBlocks.length > 0 ? scaledAltBlocks.reduce((sum, b) => sum + b.confidence, 0) / scaledAltBlocks.length : 0,
              blocks: scaledAltBlocks
            };
            if (this.countMeaningfulBlocks(altResult.blocks) > this.countMeaningfulBlocks(result.blocks)) {
              result = altResult;
            }
          }
        } else {
          result = await this.recognizeWithTesseract(cropCanvas, lang);
        }
        result.blocks.forEach((block) => {
          allBlocks.push({
            text: block.text,
            confidence: block.confidence,
            bbox: {
              x0: block.bbox.x0 + region.x0,
              y0: block.bbox.y0 + region.y0,
              x1: block.bbox.x1 + region.x0,
              y1: block.bbox.y1 + region.y0
            }
          });
        });
      }
      const merged = {
        text: allBlocks.map((b) => b.text).join("\n"),
        confidence: allBlocks.length > 0 ? allBlocks.reduce((sum, b) => sum + b.confidence, 0) / allBlocks.length : 0,
        blocks: allBlocks
      };
      if (debug && allBlocks.length > 0) {
        this.drawDebugBoxes(image, allBlocks);
      }
      return merged;
    }
    /**
     * 使用 Tesseract.js 识别
     */
    async recognizeWithTesseract(image, lang) {
      var _a;
      if (!this.tessInitialized || !this.worker) {
        await this.initLocal(lang);
      }
      const result = await this.worker.recognize(image);
      const blocks = [];
      (_a = result.data.blocks) == null ? void 0 : _a.forEach((block) => {
        var _a2;
        (_a2 = block.paragraphs) == null ? void 0 : _a2.forEach((para) => {
          var _a3;
          (_a3 = para.lines) == null ? void 0 : _a3.forEach((line) => {
            const text = line.text.trim();
            const confidence = line.confidence;
            const area = (line.bbox.x1 - line.bbox.x0) * (line.bbox.y1 - line.bbox.y0);
            if (confidence < this.config.minConfidence) return;
            if (text.length < this.config.minTextLength) return;
            if (area < this.config.minBlockArea) return;
            if (/^[\d\s\.\,\-\+\=\:\;\'\"\!\?\(\)\[\]\{\}\<\>\@\#\$\%\^\&\*\_\/\\]+$/.test(text)) return;
            blocks.push({
              text,
              bbox: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 },
              confidence: confidence / 100
            });
          });
        });
      });
      return {
        text: blocks.map((b) => b.text).join("\n"),
        confidence: blocks.length > 0 ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length : 0,
        blocks
      };
    }
    /**
     * 使用 Google Cloud Vision API 识别
     */
    async recognizeWithGoogleVision(image, filename) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (!this.cloudApiKey) {
        throw new Error("请在设置中配置 Google Cloud Vision API Key");
      }
      const logName = filename || "Image";
      console.log(`[MangaFlow] ☁️ 调用 Google Cloud Vision API [${logName}]...`);
      const base64 = await this.imageToBase64(image);
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.cloudApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [{ type: "TEXT_DETECTION", maxResults: 50 }],
                imageContext: {
                  languageHints: ["ko", "ja", "zh", "en"]
                }
              }
            ]
          })
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[MangaFlow] Google Vision API 错误:", errorText);
        throw new Error(`Google Vision API 错误: ${response.status}`);
      }
      const data = await response.json();
      if ((_b = (_a = data.responses) == null ? void 0 : _a[0]) == null ? void 0 : _b.error) {
        throw new Error(data.responses[0].error.message);
      }
      const annotations = ((_d = (_c = data.responses) == null ? void 0 : _c[0]) == null ? void 0 : _d.textAnnotations) || [];
      const blocks = [];
      for (let i = 1; i < annotations.length; i++) {
        const ann = annotations[i];
        const text = (_e = ann.description) == null ? void 0 : _e.trim();
        if (!text || text.length < this.config.minTextLength) continue;
        const vertices = ((_f = ann.boundingPoly) == null ? void 0 : _f.vertices) || [];
        if (vertices.length < 4) continue;
        const xs = vertices.map((v) => v.x || 0);
        const ys = vertices.map((v) => v.y || 0);
        const x0 = Math.min(...xs);
        const y0 = Math.min(...ys);
        const x1 = Math.max(...xs);
        const y1 = Math.max(...ys);
        if (/^[\d\s\.\,\-\+\=\:\;\'\"\!\?\(\)\[\]\{\}\<\>\@\#\$\%\^\&\*\_\/\\]+$/.test(text)) continue;
        blocks.push({
          text,
          bbox: { x0, y0, x1, y1 },
          confidence: 0.95
          // Google Vision 不返回置信度，默认较高
        });
      }
      const mergedBlocks = this.mergeAdjacentBlocks(blocks);
      return {
        text: ((_g = annotations[0]) == null ? void 0 : _g.description) || "",
        confidence: 0.95,
        blocks: mergedBlocks
      };
    }
    /**
     * 合并相邻的文本块（垂直距离接近的合并成一行）
     */
    mergeAdjacentBlocks(blocks) {
      if (blocks.length === 0) return [];
      const sorted = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
      const merged = [];
      let current = { ...sorted[0] };
      for (let i = 1; i < sorted.length; i++) {
        const next = sorted[i];
        const verticalGap = Math.abs(next.bbox.y0 - current.bbox.y0);
        const lineHeight = current.bbox.y1 - current.bbox.y0;
        if (verticalGap < lineHeight * 0.5) {
          current.text += " " + next.text;
          current.bbox.x0 = Math.min(current.bbox.x0, next.bbox.x0);
          current.bbox.y0 = Math.min(current.bbox.y0, next.bbox.y0);
          current.bbox.x1 = Math.max(current.bbox.x1, next.bbox.x1);
          current.bbox.y1 = Math.max(current.bbox.y1, next.bbox.y1);
        } else {
          merged.push(current);
          current = { ...next };
        }
      }
      merged.push(current);
      return merged;
    }
    isMeaningfulText(text) {
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (/[가-힯]/.test(trimmed)) return trimmed.length >= 2;
      if (/[぀-ヿ]/.test(trimmed)) return trimmed.length >= 2;
      if (/[㐀-鿿]/.test(trimmed)) return trimmed.length >= 2;
      if (/[a-zA-Z]/.test(trimmed)) return trimmed.length >= 3;
      if (/\d/.test(trimmed)) return trimmed.length >= 3;
      return false;
    }
    countMeaningfulBlocks(blocks) {
      return blocks.filter((block) => this.isMeaningfulText(block.text)).length;
    }
    shouldFallback(blocks, regionArea) {
      if (!blocks.length) return true;
      const meaningful = this.countMeaningfulBlocks(blocks);
      if (meaningful === 0) return true;
      if (meaningful <= 1) {
        const avgArea = blocks.reduce((sum, b) => sum + (b.bbox.x1 - b.bbox.x0) * (b.bbox.y1 - b.bbox.y0), 0) / Math.max(1, blocks.length);
        if (avgArea < regionArea * 5e-3) return true;
      }
      return false;
    }
    preprocessCanvasForOcr(input) {
      const maxTarget = 1e3;
      const maxDim = Math.max(input.width, input.height);
      let scale = 2;
      if (maxDim * scale > maxTarget) {
        scale = Math.max(1, maxTarget / maxDim);
      }
      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.round(input.width * scale));
      out.height = Math.max(1, Math.round(input.height * scale));
      const ctx = out.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(input, 0, 0, out.width, out.height);
      const imageData = ctx.getImageData(0, 0, out.width, out.height);
      const data = imageData.data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        sum += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const mean = sum / Math.max(1, data.length / 4);
      const invert = mean < 110;
      const contrast = 1.4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = (gray - 128) * contrast + 128;
        if (invert) gray = 255 - gray;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      return { canvas: out, scale, mode: invert ? "invert" : "gray" };
    }
    scaleBlocks(blocks, scale) {
      return blocks.map((block) => ({
        text: block.text,
        confidence: block.confidence,
        bbox: {
          x0: Math.round(block.bbox.x0 * scale),
          y0: Math.round(block.bbox.y0 * scale),
          x1: Math.round(block.bbox.x1 * scale),
          y1: Math.round(block.bbox.y1 * scale)
        }
      }));
    }
    /**
     * 将图片转为 base64（不含 data:image/xxx;base64, 前缀）
     * 处理跨域图片：先尝试直接转换，失败则通过 fetch 获取
     */
    async imageToBase64(image) {
      if (image instanceof HTMLCanvasElement) {
        const dataUrl = image.toDataURL("image/png");
        return dataUrl.replace(/^data:image\/\w+;base64,/, "");
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        return dataUrl.replace(/^data:image\/\w+;base64,/, "");
      } catch {
        console.log("[MangaFlow] ⚠️ 图片跨域，使用 fetch 方式获取...");
        return await this.fetchImageAsBase64(image.src);
      }
    }
    /**
     * 通过 fetch 获取图片并转为 base64（绕过 CORS）
     */
    async fetchImageAsBase64(url) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "FETCH_IMAGE",
          imageUrl: url
        });
        if (!response.success || response.error) {
          throw new Error(response.error || "获取图片失败");
        }
        const dataUrl = response.imageData;
        return dataUrl.replace(/^data:image\/\w+;base64,/, "");
      } catch (error) {
        console.error("[MangaFlow] 获取图片失败:", error);
        throw new Error("无法获取图片: " + error.message);
      }
    }
    async ensureSafeImage(image) {
      if (image instanceof HTMLCanvasElement) return image;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        ctx.getImageData(0, 0, 1, 1);
        return image;
      } catch {
        const base64 = await this.fetchImageAsBase64(image.src);
        return await this.loadImageFromBase64(base64);
      }
    }
    cropRegionToCanvas(image, region) {
      const width = Math.max(1, Math.floor(region.x1 - region.x0));
      const height = Math.max(1, Math.floor(region.y1 - region.y0));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        region.x0,
        region.y0,
        width,
        height,
        0,
        0,
        width,
        height
      );
      return canvas;
    }
    loadImageFromBase64(base64) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
      });
    }
    /**
     * 阶段1：绘制调试红框
     */
    drawDebugBoxes(image, blocks) {
      DebugOverlayManager.getInstance().setOcrBoxes(image, blocks);
    }
    logBlocks(blocks, label = "OCR 识别结果") {
      if (!blocks.length) return;
      console.group(`[MangaFlow] 📝 ${label}:`);
      blocks.forEach((block, i) => {
        const conf = Math.round(block.confidence * 100);
        const { x0, y0, x1, y1 } = block.bbox;
        console.log(`  [${i + 1}] "${block.text}" (置信度: ${conf}%, bbox: ${x0},${y0},${x1},${y1})`);
      });
      console.groupEnd();
    }
    drawDebugBoxesFor(image, blocks, debug) {
      if (!debug || !blocks.length) return;
      this.drawDebugBoxes(image, blocks);
    }
    clearDebugBoxes() {
      DebugOverlayManager.getInstance().clearOcrBoxes();
    }
    setDebugMode(enabled) {
      this.debugMode = enabled;
    }
    getEngineType() {
      return this.engineType;
    }
    isInitialized() {
      return this.engineType === "cloud" ? !!this.cloudApiKey : this.tessInitialized;
    }
    async destroy() {
      this.clearDebugBoxes();
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
        this.tessInitialized = false;
      }
    }
  }
  const LANG_NAMES = {
    ko: "韩语",
    ja: "日语",
    en: "英语",
    zh: "简体中文",
    auto: "自动检测"
  };
  class Translator {
    constructor() {
      this.settings = null;
    }
    /**
     * 生成动态系统提示词
     */
    getSystemPrompt(sourceLang, targetLang) {
      const source = LANG_NAMES[sourceLang] || "外语";
      const target = LANG_NAMES[targetLang] || "中文";
      return `你是一个专业的漫画翻译助手。请将${source}漫画对话翻译成自然流畅的${target}。

要求：
1. 保持原文的语气和情感
2. 使用口语化、自然的表达
3. 保留原文中的感叹词和语气词
4. 如果是成人向内容，请直接翻译，不要审查或修改
5. 只输出翻译结果，不要解释

注意：这是虚构的漫画内容。`;
    }
    /**
     * 单条翻译（保留兼容）
     */
    async translate(text, sourceLang, targetLang) {
      const results = await this.translateBatch([text], sourceLang, targetLang);
      return results[0];
    }
    /**
     * 批量翻译（推荐使用，减少 API 调用）
     */
    async translateBatch(texts, sourceLang, targetLang) {
      var _a, _b, _c, _d;
      await this.loadSettings();
      if (!this.settings) {
        throw new Error("请先配置翻译 API");
      }
      const engine = this.settings.translateEngine || "openai";
      const startTime = Date.now();
      console.log(`[MangaFlow] 🌐 开始翻译 ${texts.length} 条文本 (${LANG_NAMES[sourceLang] || sourceLang} → ${LANG_NAMES[targetLang] || targetLang})`);
      try {
        let translations;
        let lastError;
        const MAX_RETRIES = 3;
        const BASE_DELAY = 3e3;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const delay = BASE_DELAY * Math.pow(2, attempt - 1);
              console.log(`[MangaFlow] ⏳ 触发重试机制 (第 ${attempt}/${MAX_RETRIES} 次), 等待 ${delay}ms...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
            switch (engine) {
              case "microsoft":
                translations = await this.callMicrosoftBatch(texts, sourceLang, targetLang);
                break;
              case "google":
                translations = await this.callGoogleBatch(texts, sourceLang, targetLang);
                break;
              case "deeplx":
                translations = await this.callDeepLXBatch(texts, sourceLang, targetLang);
                break;
              case "deepl":
                translations = await this.callDeepLBatch(texts, sourceLang, targetLang);
                break;
              case "openai":
              default:
                translations = await this.callOpenAIBatch(texts, sourceLang, targetLang);
                break;
            }
            break;
          } catch (error) {
            lastError = error;
            const isRateLimit = ((_a = error.message) == null ? void 0 : _a.includes("429")) || ((_b = error.message) == null ? void 0 : _b.toLowerCase().includes("rate limit")) || ((_c = error.message) == null ? void 0 : _c.toLowerCase().includes("quota")) || ((_d = error.message) == null ? void 0 : _d.toLowerCase().includes("too many requests"));
            if (isRateLimit && attempt < MAX_RETRIES) {
              console.warn(`[MangaFlow] ⚠️ 遇到 RPM 限制 (429), 准备重试...`, error.message);
              continue;
            }
            throw error;
          }
        }
        if (!translations) throw lastError;
        const duration = Date.now() - startTime;
        console.log(`[MangaFlow] ✅ 翻译完成，耗时 ${duration}ms`);
        return texts.map((text, i) => ({
          original: text,
          translated: translations[i] || "[翻译失败]",
          engine
        }));
      } catch (error) {
        console.error("[MangaFlow] ❌ 翻译失败 (重试无效):", error);
        throw error;
      }
    }
    // OpenAI 兼容格式 API（批量翻译）
    async callOpenAIBatch(texts, sourceLang, targetLang) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (!((_a = this.settings) == null ? void 0 : _a.apiBaseUrl) || !((_b = this.settings) == null ? void 0 : _b.apiKey)) {
        throw new Error("请先配置 OpenAI API");
      }
      const numberedTexts = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");
      const source = LANG_NAMES[sourceLang] || "外语";
      const target = LANG_NAMES[targetLang] || "中文";
      const userPrompt = `请将以下${source}漫画对话翻译成${target}。

每行以 [数字] 开头，请保持相同格式返回翻译结果。
只输出翻译，不要解释或添加额外内容。

${numberedTexts}`;
      const baseUrl = this.settings.apiBaseUrl.replace(/\/$/, "");
      const endpoint = `${baseUrl}/chat/completions`;
      const requestBody = {
        model: this.settings.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: this.getSystemPrompt(sourceLang, targetLang) },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4e3
      };
      const response = await chrome.runtime.sendMessage({
        type: "API_REQUEST",
        url: endpoint,
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.settings.apiKey}`
          },
          body: JSON.stringify(requestBody)
        }
      });
      if (!response.success) {
        throw new Error(response.error || "OpenAI API 请求失败");
      }
      const content = ((_g = (_f = (_e = (_d = (_c = response.data) == null ? void 0 : _c.choices) == null ? void 0 : _d[0]) == null ? void 0 : _e.message) == null ? void 0 : _f.content) == null ? void 0 : _g.trim()) || "";
      return this.parseNumberedTranslations(content, texts.length);
    }
    /**
     * 解析编号格式的翻译结果
     */
    parseNumberedTranslations(content, expectedCount) {
      const defaultValue = "[翻译失败]";
      const results = Array.from({ length: expectedCount }, () => defaultValue);
      const regex = /\[(\d+)\]\s*(.+?)(?=\[\d+\]|$)/gs;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const index = parseInt(match[1], 10) - 1;
        const translation = match[2].trim();
        if (index >= 0 && index < expectedCount) {
          results[index] = translation;
        }
      }
      const FAIL_MARKER = "[翻译失败]";
      const allFailed = results.every((r) => r === FAIL_MARKER);
      if (allFailed) {
        const lines = content.split("\n").filter((l) => l.trim());
        for (let i = 0; i < Math.min(lines.length, expectedCount); i++) {
          results[i] = lines[i].replace(/^\[\d+\]\s*/, "").trim();
        }
      }
      return results;
    }
    // DeepLX API 批量翻译（逐条调用，可设延迟）
    async callDeepLXBatch(texts, sourceLang, targetLang) {
      var _a, _b, _c, _d;
      if (!((_a = this.settings) == null ? void 0 : _a.deeplxUrl)) {
        throw new Error("请先配置 DeepLX URL");
      }
      const langMap = {
        ko: "KO",
        ja: "JA",
        en: "EN",
        zh: "ZH"
      };
      const results = [];
      const delay = this.settings.requestDelay || 0;
      for (const text of texts) {
        const requestBody = {
          text,
          source_lang: langMap[sourceLang] || "auto",
          target_lang: langMap[targetLang] || "ZH"
        };
        const response = await chrome.runtime.sendMessage({
          type: "API_REQUEST",
          url: this.settings.deeplxUrl,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          }
        });
        if (!response.success) {
          results.push(`[翻译失败: ${response.error}]`);
        } else {
          results.push(((_b = response.data) == null ? void 0 : _b.data) || ((_d = (_c = response.data) == null ? void 0 : _c.alternatives) == null ? void 0 : _d[0]) || "[翻译失败]");
        }
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      return results;
    }
    // DeepL 官方 API 批量翻译（原生支持批量）
    async callDeepLBatch(texts, sourceLang, targetLang) {
      var _a, _b;
      if (!((_a = this.settings) == null ? void 0 : _a.deeplApiKey)) {
        throw new Error("请先配置 DeepL API Key");
      }
      const langMap = {
        ko: "KO",
        ja: "JA",
        en: "EN",
        zh: "ZH"
      };
      const endpoint = "https://api-free.deepl.com/v2/translate";
      const response = await chrome.runtime.sendMessage({
        type: "API_REQUEST",
        url: endpoint,
        options: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `DeepL-Auth-Key ${this.settings.deeplApiKey}`
          },
          body: JSON.stringify({
            text: texts,
            source_lang: langMap[sourceLang] || null,
            target_lang: langMap[targetLang] || "ZH"
          })
        }
      });
      if (!response.success) {
        throw new Error(response.error || "DeepL API 请求失败");
      }
      const translations = ((_b = response.data) == null ? void 0 : _b.translations) || [];
      return texts.map((_, i) => {
        var _a2;
        return ((_a2 = translations[i]) == null ? void 0 : _a2.text) || "[翻译失败]";
      });
    }
    // Google 翻译批量（逐条调用）
    async callGoogleBatch(texts, sourceLang, targetLang) {
      var _a;
      const langMap = {
        ko: "ko",
        ja: "ja",
        en: "en",
        zh: "zh-CN",
        auto: "auto"
      };
      const sl = langMap[sourceLang] || "auto";
      const tl = langMap[targetLang] || "zh-CN";
      const results = [];
      const delay = ((_a = this.settings) == null ? void 0 : _a.requestDelay) || 0;
      for (const text of texts) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await chrome.runtime.sendMessage({
          type: "API_REQUEST",
          url,
          options: {
            method: "GET",
            headers: { "Content-Type": "application/json" }
          }
        });
        if (!response.success) {
          results.push(`[翻译失败: ${response.error}]`);
        } else {
          const data = response.data;
          if (Array.isArray(data) && Array.isArray(data[0])) {
            results.push(data[0].map((item) => item[0]).join(""));
          } else {
            results.push("[翻译失败]");
          }
        }
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      return results;
    }
    // 微软翻译批量（回退到 Google）
    async callMicrosoftBatch(texts, sourceLang, targetLang) {
      console.warn("[MangaFlow] 微软翻译暂未实现，回退到 Google 翻译");
      return this.callGoogleBatch(texts, sourceLang, targetLang);
    }
    async loadSettings() {
      const result = await chrome.storage.local.get("settings");
      this.settings = result.settings;
    }
  }
  class ImageProcessor {
    /**
     * 处理图片：按组擦除背景并返回 Canvas
     */
    async processImage(img, groups) {
      let canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      let ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      let isTainted = false;
      try {
        ctx.getImageData(0, 0, 1, 1);
      } catch {
        isTainted = true;
      }
      if (isTainted) {
        console.log("[MangaFlow] ⚠️ 跨域图片，使用代理重绘", img.src);
        const base64Image = await this.fetchImageViaProxy(img.src);
        const proxyImg = await this.loadImageFromBase64(base64Image);
        canvas = document.createElement("canvas");
        canvas.width = proxyImg.naturalWidth;
        canvas.height = proxyImg.naturalHeight;
        ctx = canvas.getContext("2d");
        ctx.drawImage(proxyImg, 0, 0);
      }
      console.log(`[MangaFlow] 🧹 组级擦除 ${groups.length} 个区域...`);
      const analysis = [];
      for (const group of groups) {
        const maskBox = this.expandBox(group.bbox, canvas.width, canvas.height);
        const analysisBox = this.expandAnalysisBox(group.bbox, canvas.width, canvas.height);
        const stats = this.analyzeRegion(ctx, analysisBox);
        const isBubble = this.isBubbleRegion(stats);
        const isComplex = this.isComplexRegion(stats);
        const sourceText = this.getGroupSourceText(group);
        const isShort = this.isShortLabel(sourceText);
        const isLightBubble = !isShort && isBubble && stats.edgeDensity <= 0.08 && stats.ringVariance <= 4500 && stats.dominantRatio >= 0.65 && stats.bubbleLuminance >= 205 && stats.ringLightRatio >= 0.55;
        const renderMode = !isShort && isBubble && !isComplex ? "erase" : "mask";
        const info = {
          bbox: group.bbox,
          maskBox,
          avgColor: stats.avgColor,
          variance: stats.variance,
          luminance: stats.luminance,
          edgeDensity: stats.edgeDensity,
          dominantRatio: stats.dominantRatio,
          ringVariance: stats.ringVariance,
          bubbleLuminance: stats.bubbleLuminance,
          ringLightRatio: stats.ringLightRatio,
          isDark: stats.luminance < 128,
          isComplex,
          isBubble,
          isLightBubble,
          renderMode
        };
        if (renderMode === "erase") {
          this.eraseRegion(ctx, maskBox, info);
        }
        analysis.push(info);
      }
      return { canvas, analysis };
    }
    expandBox(box, canvasWidth, canvasHeight) {
      const width = box.x1 - box.x0;
      const height = box.y1 - box.y0;
      const padX = Math.min(
        Math.max(6, Math.round(height * 0.6)),
        Math.round(width * 0.08)
      );
      const padY = Math.max(4, Math.round(height * 0.25));
      const x0 = Math.max(0, Math.floor(box.x0 - padX));
      const y0 = Math.max(0, Math.floor(box.y0 - padY));
      const x1 = Math.min(canvasWidth, Math.ceil(box.x1 + padX));
      const y1 = Math.min(canvasHeight, Math.ceil(box.y1 + padY));
      return { x0, y0, x1, y1 };
    }
    expandAnalysisBox(box, canvasWidth, canvasHeight) {
      const width = box.x1 - box.x0;
      const height = box.y1 - box.y0;
      const padX = Math.min(
        Math.max(4, Math.round(height * 0.35)),
        Math.round(width * 0.06)
      );
      const padY = Math.max(3, Math.round(height * 0.18));
      const x0 = Math.max(0, Math.floor(box.x0 - padX));
      const y0 = Math.max(0, Math.floor(box.y0 - padY));
      const x1 = Math.min(canvasWidth, Math.ceil(box.x1 + padX));
      const y1 = Math.min(canvasHeight, Math.ceil(box.y1 + padY));
      return { x0, y0, x1, y1 };
    }
    analyzeRegion(ctx, box) {
      const width = Math.max(1, Math.floor(box.x1 - box.x0));
      const height = Math.max(1, Math.floor(box.y1 - box.y0));
      const imageData = ctx.getImageData(box.x0, box.y0, width, height);
      const data = imageData.data;
      const step = Math.max(1, Math.floor(Math.max(width, height) / 180));
      const hist = new Uint32Array(512);
      const ringHist = new Uint32Array(512);
      let sampleCount = 0;
      let lumSum = 0;
      let lumSumSq = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let edgeCount = 0;
      let ringCount = 0;
      let ringLumSum = 0;
      let ringLumSumSq = 0;
      let ringRSum = 0;
      let ringGSum = 0;
      let ringBSum = 0;
      let ringEdgeCount = 0;
      let ringLightSum = 0;
      let ringLightCount = 0;
      const ringMargin = Math.max(2, Math.round(Math.min(width, height) * 0.08));
      const getLum = (idx) => {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          lumSum += lum;
          lumSumSq += lum * lum;
          rSum += r;
          gSum += g;
          bSum += b;
          sampleCount++;
          const bucket = r >> 5 << 6 | g >> 5 << 3 | b >> 5;
          hist[bucket]++;
          const isRing = x < ringMargin || y < ringMargin || x >= width - ringMargin || y >= height - ringMargin;
          if (isRing) {
            ringLumSum += lum;
            ringLumSumSq += lum * lum;
            ringRSum += r;
            ringGSum += g;
            ringBSum += b;
            ringCount++;
            ringHist[bucket]++;
            if (lum >= 200) {
              ringLightSum += lum;
              ringLightCount++;
            }
          }
          if (x + step < width && y + step < height) {
            const idxRight = (y * width + (x + step)) * 4;
            const idxDown = ((y + step) * width + x) * 4;
            const lumRight = getLum(idxRight);
            const lumDown = getLum(idxDown);
            const grad = Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
            if (grad > 40) {
              edgeCount++;
              if (isRing) ringEdgeCount++;
            }
          }
        }
      }
      const avgLum = lumSum / Math.max(1, sampleCount);
      const variance = lumSumSq / Math.max(1, sampleCount) - avgLum * avgLum;
      const ringAvgLum = ringLumSum / Math.max(1, ringCount);
      const ringLightAvg = ringLightCount ? ringLightSum / ringLightCount : ringAvgLum;
      const ringLightRatio = ringLightCount / Math.max(1, ringCount);
      const ringVariance = ringLumSumSq / Math.max(1, ringCount) - ringAvgLum * ringAvgLum;
      const avgR = Math.round((ringCount ? ringRSum : rSum) / Math.max(1, ringCount || sampleCount));
      const avgG = Math.round((ringCount ? ringGSum : gSum) / Math.max(1, ringCount || sampleCount));
      const avgB = Math.round((ringCount ? ringBSum : bSum) / Math.max(1, ringCount || sampleCount));
      let maxBin = 0;
      for (const count of hist) {
        if (count > maxBin) maxBin = count;
      }
      let ringMaxBin = 0;
      for (const count of ringHist) {
        if (count > ringMaxBin) ringMaxBin = count;
      }
      const dominantRatio = (ringCount ? ringMaxBin : maxBin) / Math.max(1, ringCount || sampleCount);
      const edgeDensity = (ringCount ? ringEdgeCount : edgeCount) / Math.max(1, ringCount || sampleCount);
      return {
        avgColor: `rgb(${avgR},${avgG},${avgB})`,
        variance: Math.max(0, variance),
        ringVariance: Math.max(0, ringVariance),
        luminance: avgLum,
        edgeDensity,
        dominantRatio,
        bubbleLuminance: ringLightAvg,
        ringLightRatio
      };
    }
    isBubbleRegion(stats) {
      if (stats.dominantRatio >= 0.62 && stats.edgeDensity <= 0.1) return true;
      if (stats.dominantRatio >= 0.56 && stats.edgeDensity <= 0.08 && stats.ringVariance <= 4500) return true;
      return false;
    }
    isComplexRegion(stats) {
      return stats.edgeDensity >= 0.14 || stats.ringVariance >= 6500;
    }
    isShortLabel(text) {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const compact = trimmed.replace(/\s+/g, "");
      const normalized = compact.replace(/[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g, "");
      if (!normalized) return false;
      const hasCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(normalized);
      const hasLatin = /[A-Za-z]/.test(normalized);
      if (normalized.length <= 8) return true;
      if (hasCjk && normalized.length <= 10) return true;
      if (hasLatin && normalized.length <= 14) return true;
      return false;
    }
    getGroupSourceText(group) {
      var _a;
      if (!((_a = group.blocks) == null ? void 0 : _a.length)) return "";
      return group.blocks.map((block) => block.text).join(" ");
    }
    eraseRegion(ctx, box, info) {
      const width = Math.max(1, Math.floor(box.x1 - box.x0));
      const height = Math.max(1, Math.floor(box.y1 - box.y0));
      const imageData = ctx.getImageData(box.x0, box.y0, width, height);
      const data = imageData.data;
      let { bgR, bgG, bgB } = this.sampleEdgeColor(data, width, { x: 0, y: 0, w: width, h: height });
      if (info.isLightBubble && info.bubbleLuminance >= 205) {
        bgR = 255;
        bgG = 255;
        bgB = 255;
      }
      const threshold = info.isBubble ? 35 : 28;
      const pixelsToErase = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dist = Math.sqrt(
          Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
        );
        if (dist > threshold) {
          pixelsToErase[i / 4] = 1;
        }
      }
      const expandedMask = new Uint8Array(width * height);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (pixelsToErase[idx]) {
            expandedMask[idx] = 1;
            expandedMask[idx - 1] = 1;
            expandedMask[idx + 1] = 1;
            expandedMask[idx - width] = 1;
            expandedMask[idx + width] = 1;
          }
        }
      }
      for (let i = 0; i < data.length / 4; i++) {
        if (expandedMask[i]) {
          const idx = i * 4;
          data[idx] = bgR;
          data[idx + 1] = bgG;
          data[idx + 2] = bgB;
        }
      }
      ctx.putImageData(imageData, box.x0, box.y0);
    }
    /**
     * 在指定的局部区域采样边缘颜色
     */
    sampleEdgeColor(data, totalWidth, box) {
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;
      const step = 2;
      const addSample = (x, y) => {
        const idx = (y * totalWidth + x) * 4;
        if (idx < 0 || idx >= data.length) return;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      };
      for (let x = box.x; x < box.x + box.w; x += step) {
        addSample(x, box.y);
        addSample(x, box.y + box.h - 1);
      }
      for (let y = box.y; y < box.y + box.h; y += step) {
        addSample(box.x, y);
        addSample(box.x + box.w - 1, y);
      }
      if (count === 0) return { bgR: 255, bgG: 255, bgB: 255 };
      return {
        bgR: Math.round(rSum / count),
        bgG: Math.round(gSum / count),
        bgB: Math.round(bSum / count)
      };
    }
    /**
     * 通过 Service Worker 代理加载跨域图片
     */
    async fetchImageViaProxy(imageUrl) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "FETCH_IMAGE", imageUrl },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if ((response == null ? void 0 : response.success) && response.imageData) {
              resolve(response.imageData);
            } else {
              reject(new Error((response == null ? void 0 : response.error) || "获取图片失败"));
            }
          }
        );
      });
    }
    loadImageFromBase64(base64) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = base64;
      });
    }
  }
  class Renderer {
    /**
     * 渲染译文到 Canvas
     */
    render(canvas, groups, analysis, options) {
      const ctx = canvas.getContext("2d");
      const fontFamily = options.fontFamily || "Arial, sans-serif";
      groups.forEach((group, index) => {
        const translation = (group.text || "").trim();
        if (!translation || translation.startsWith("[翻译失败")) return;
        const stats = analysis[index];
        const renderBox = group.bbox;
        (stats == null ? void 0 : stats.maskBox) ?? group.bbox;
        const width = Math.max(1, renderBox.x1 - renderBox.x0);
        const height = Math.max(1, renderBox.y1 - renderBox.y0);
        const normalizedText = translation.replace(/\s*\n\s*/g, " ");
        const baseFontSize = this.getBaseFontSize(group, height);
        const scale = options.fontScale ?? 1;
        const minSize = Math.max(11, Math.round(baseFontSize * 0.8));
        const maxSize = Math.min(52, Math.round(baseFontSize * 1.2));
        const scaledBase = Math.max(minSize, Math.min(maxSize, baseFontSize * scale));
        const singleLine = this.isShortLabel(normalizedText);
        const layout = this.layoutText(ctx, normalizedText, width, height, fontFamily, scaledBase, singleLine, minSize, maxSize);
        const userColor = options.fontColor || "#000000";
        let mainColor = userColor;
        if ((stats == null ? void 0 : stats.isDark) && userColor === "#000000") {
          mainColor = "#FFFFFF";
        }
        const strokeColor = this.getContrastColor(mainColor);
        if ((stats == null ? void 0 : stats.renderMode) === "mask") {
          const hasUserOpacity = options.maskOpacity !== void 0;
          const baseAlpha = hasUserOpacity ? options.maskOpacity : stats.isDark ? 0.36 : 0.24;
          const alpha = stats.isDark && !hasUserOpacity ? Math.min(0.7, baseAlpha + 0.12) : baseAlpha;
          const fillStyle = stats.isDark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
          ctx.fillStyle = fillStyle;
          ctx.fillRect(renderBox.x0, renderBox.y0, width, height);
        }
        ctx.font = `bold ${layout.fontSize}px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lineHeight = layout.fontSize * (singleLine ? 1.05 : 1.15);
        const totalHeight = layout.lines.length * lineHeight;
        const startY = renderBox.y0 + (height - totalHeight) / 2 + lineHeight / 2;
        const centerX = renderBox.x0 + width / 2;
        layout.lines.forEach((line, lineIndex) => {
          const y = startY + lineIndex * lineHeight;
          let strokeWidth = Math.max(3, layout.fontSize * 0.15);
          if ((stats == null ? void 0 : stats.renderMode) === "mask") {
            strokeWidth = Math.max(4, layout.fontSize * 0.25);
          }
          if (this.isShortLabel(normalizedText)) {
            strokeWidth = Math.max(3, layout.fontSize * 0.2);
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.strokeText(line, centerX, y);
          ctx.fillStyle = mainColor;
          ctx.fillText(line, centerX, y);
        });
      });
      console.log(`[MangaFlow] ✅ 渲染完成 (group render)，共 ${groups.length} 个区域`);
    }
    getBaseFontSize(group, boxHeight) {
      if (!group.blocks.length) {
        return Math.max(12, Math.min(boxHeight * 0.7, 56));
      }
      const avgHeight = group.blocks.reduce((sum, b) => sum + (b.bbox.y1 - b.bbox.y0), 0) / group.blocks.length;
      return Math.max(12, Math.min(avgHeight * 0.9, 56));
    }
    layoutText(ctx, text, maxWidth, maxHeight, fontFamily, baseSize, singleLine, minSize, maxSize) {
      let size = Math.min(baseSize, maxSize);
      for (; size >= minSize; size -= 2) {
        ctx.font = `bold ${size}px ${fontFamily}`;
        const lines = singleLine ? [text] : this.wrapText(ctx, text, maxWidth);
        const lineHeight = size * (singleLine ? 1.05 : 1.15);
        const totalHeight = lines.length * lineHeight;
        const fitsHeight = totalHeight <= maxHeight * 0.95;
        const fitsWidth = singleLine ? ctx.measureText(text).width <= maxWidth * 0.95 : true;
        if (fitsHeight && fitsWidth) {
          return { lines, fontSize: size };
        }
      }
      ctx.font = `bold ${minSize}px ${fontFamily}`;
      const fallbackLines = singleLine ? [text] : this.wrapText(ctx, text, maxWidth);
      return { lines: fallbackLines, fontSize: minSize };
    }
    wrapText(ctx, text, maxWidth) {
      const lines = [];
      const chars = text.split("");
      let currentLine = "";
      for (const char of chars) {
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    }
    isShortLabel(text) {
      const trimmed = text.trim();
      if (!trimmed) return false;
      const compact = trimmed.replace(/\s+/g, "");
      const normalized = compact.replace(/[^A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g, "");
      if (!normalized) return false;
      const hasCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(normalized);
      const hasLatin = /[A-Za-z]/.test(normalized);
      if (normalized.length <= 8) return true;
      if (hasCjk && normalized.length <= 10) return true;
      if (hasLatin && normalized.length <= 14) return true;
      return false;
    }
    getContrastColor(hexColor) {
      const hex = hexColor.replace("#", "").trim();
      if (hex.length !== 6) return "#000000";
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance >= 140 ? "#000000" : "#FFFFFF";
    }
  }
  var localforage$1 = { exports: {} };
  /*!
      localForage -- Offline Storage, Improved
      Version 1.10.0
      https://localforage.github.io/localForage
      (c) 2013-2017 Mozilla, Apache License 2.0
  */
  (function(module, exports$1) {
    (function(f) {
      {
        module.exports = f();
      }
    })(function() {
      return function e(t, n, r) {
        function s(o2, u) {
          if (!n[o2]) {
            if (!t[o2]) {
              var a = typeof commonjsRequire == "function" && commonjsRequire;
              if (!u && a) return a(o2, true);
              if (i) return i(o2, true);
              var f = new Error("Cannot find module '" + o2 + "'");
              throw f.code = "MODULE_NOT_FOUND", f;
            }
            var l = n[o2] = { exports: {} };
            t[o2][0].call(l.exports, function(e2) {
              var n2 = t[o2][1][e2];
              return s(n2 ? n2 : e2);
            }, l, l.exports, e, t, n, r);
          }
          return n[o2].exports;
        }
        var i = typeof commonjsRequire == "function" && commonjsRequire;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s;
      }({ 1: [function(_dereq_, module2, exports$12) {
        (function(global2) {
          var Mutation = global2.MutationObserver || global2.WebKitMutationObserver;
          var scheduleDrain;
          {
            if (Mutation) {
              var called = 0;
              var observer = new Mutation(nextTick);
              var element = global2.document.createTextNode("");
              observer.observe(element, {
                characterData: true
              });
              scheduleDrain = function() {
                element.data = called = ++called % 2;
              };
            } else if (!global2.setImmediate && typeof global2.MessageChannel !== "undefined") {
              var channel = new global2.MessageChannel();
              channel.port1.onmessage = nextTick;
              scheduleDrain = function() {
                channel.port2.postMessage(0);
              };
            } else if ("document" in global2 && "onreadystatechange" in global2.document.createElement("script")) {
              scheduleDrain = function() {
                var scriptEl = global2.document.createElement("script");
                scriptEl.onreadystatechange = function() {
                  nextTick();
                  scriptEl.onreadystatechange = null;
                  scriptEl.parentNode.removeChild(scriptEl);
                  scriptEl = null;
                };
                global2.document.documentElement.appendChild(scriptEl);
              };
            } else {
              scheduleDrain = function() {
                setTimeout(nextTick, 0);
              };
            }
          }
          var draining;
          var queue = [];
          function nextTick() {
            draining = true;
            var i, oldQueue;
            var len = queue.length;
            while (len) {
              oldQueue = queue;
              queue = [];
              i = -1;
              while (++i < len) {
                oldQueue[i]();
              }
              len = queue.length;
            }
            draining = false;
          }
          module2.exports = immediate;
          function immediate(task) {
            if (queue.push(task) === 1 && !draining) {
              scheduleDrain();
            }
          }
        }).call(this, typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
      }, {}], 2: [function(_dereq_, module2, exports$12) {
        var immediate = _dereq_(1);
        function INTERNAL() {
        }
        var handlers = {};
        var REJECTED = ["REJECTED"];
        var FULFILLED = ["FULFILLED"];
        var PENDING = ["PENDING"];
        module2.exports = Promise2;
        function Promise2(resolver) {
          if (typeof resolver !== "function") {
            throw new TypeError("resolver must be a function");
          }
          this.state = PENDING;
          this.queue = [];
          this.outcome = void 0;
          if (resolver !== INTERNAL) {
            safelyResolveThenable(this, resolver);
          }
        }
        Promise2.prototype["catch"] = function(onRejected) {
          return this.then(null, onRejected);
        };
        Promise2.prototype.then = function(onFulfilled, onRejected) {
          if (typeof onFulfilled !== "function" && this.state === FULFILLED || typeof onRejected !== "function" && this.state === REJECTED) {
            return this;
          }
          var promise = new this.constructor(INTERNAL);
          if (this.state !== PENDING) {
            var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
            unwrap(promise, resolver, this.outcome);
          } else {
            this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
          }
          return promise;
        };
        function QueueItem(promise, onFulfilled, onRejected) {
          this.promise = promise;
          if (typeof onFulfilled === "function") {
            this.onFulfilled = onFulfilled;
            this.callFulfilled = this.otherCallFulfilled;
          }
          if (typeof onRejected === "function") {
            this.onRejected = onRejected;
            this.callRejected = this.otherCallRejected;
          }
        }
        QueueItem.prototype.callFulfilled = function(value) {
          handlers.resolve(this.promise, value);
        };
        QueueItem.prototype.otherCallFulfilled = function(value) {
          unwrap(this.promise, this.onFulfilled, value);
        };
        QueueItem.prototype.callRejected = function(value) {
          handlers.reject(this.promise, value);
        };
        QueueItem.prototype.otherCallRejected = function(value) {
          unwrap(this.promise, this.onRejected, value);
        };
        function unwrap(promise, func, value) {
          immediate(function() {
            var returnValue;
            try {
              returnValue = func(value);
            } catch (e) {
              return handlers.reject(promise, e);
            }
            if (returnValue === promise) {
              handlers.reject(promise, new TypeError("Cannot resolve promise with itself"));
            } else {
              handlers.resolve(promise, returnValue);
            }
          });
        }
        handlers.resolve = function(self2, value) {
          var result = tryCatch(getThen, value);
          if (result.status === "error") {
            return handlers.reject(self2, result.value);
          }
          var thenable = result.value;
          if (thenable) {
            safelyResolveThenable(self2, thenable);
          } else {
            self2.state = FULFILLED;
            self2.outcome = value;
            var i = -1;
            var len = self2.queue.length;
            while (++i < len) {
              self2.queue[i].callFulfilled(value);
            }
          }
          return self2;
        };
        handlers.reject = function(self2, error) {
          self2.state = REJECTED;
          self2.outcome = error;
          var i = -1;
          var len = self2.queue.length;
          while (++i < len) {
            self2.queue[i].callRejected(error);
          }
          return self2;
        };
        function getThen(obj) {
          var then = obj && obj.then;
          if (obj && (typeof obj === "object" || typeof obj === "function") && typeof then === "function") {
            return function appyThen() {
              then.apply(obj, arguments);
            };
          }
        }
        function safelyResolveThenable(self2, thenable) {
          var called = false;
          function onError(value) {
            if (called) {
              return;
            }
            called = true;
            handlers.reject(self2, value);
          }
          function onSuccess(value) {
            if (called) {
              return;
            }
            called = true;
            handlers.resolve(self2, value);
          }
          function tryToUnwrap() {
            thenable(onSuccess, onError);
          }
          var result = tryCatch(tryToUnwrap);
          if (result.status === "error") {
            onError(result.value);
          }
        }
        function tryCatch(func, value) {
          var out = {};
          try {
            out.value = func(value);
            out.status = "success";
          } catch (e) {
            out.status = "error";
            out.value = e;
          }
          return out;
        }
        Promise2.resolve = resolve;
        function resolve(value) {
          if (value instanceof this) {
            return value;
          }
          return handlers.resolve(new this(INTERNAL), value);
        }
        Promise2.reject = reject;
        function reject(reason) {
          var promise = new this(INTERNAL);
          return handlers.reject(promise, reason);
        }
        Promise2.all = all;
        function all(iterable) {
          var self2 = this;
          if (Object.prototype.toString.call(iterable) !== "[object Array]") {
            return this.reject(new TypeError("must be an array"));
          }
          var len = iterable.length;
          var called = false;
          if (!len) {
            return this.resolve([]);
          }
          var values = new Array(len);
          var resolved = 0;
          var i = -1;
          var promise = new this(INTERNAL);
          while (++i < len) {
            allResolver(iterable[i], i);
          }
          return promise;
          function allResolver(value, i2) {
            self2.resolve(value).then(resolveFromAll, function(error) {
              if (!called) {
                called = true;
                handlers.reject(promise, error);
              }
            });
            function resolveFromAll(outValue) {
              values[i2] = outValue;
              if (++resolved === len && !called) {
                called = true;
                handlers.resolve(promise, values);
              }
            }
          }
        }
        Promise2.race = race;
        function race(iterable) {
          var self2 = this;
          if (Object.prototype.toString.call(iterable) !== "[object Array]") {
            return this.reject(new TypeError("must be an array"));
          }
          var len = iterable.length;
          var called = false;
          if (!len) {
            return this.resolve([]);
          }
          var i = -1;
          var promise = new this(INTERNAL);
          while (++i < len) {
            resolver(iterable[i]);
          }
          return promise;
          function resolver(value) {
            self2.resolve(value).then(function(response) {
              if (!called) {
                called = true;
                handlers.resolve(promise, response);
              }
            }, function(error) {
              if (!called) {
                called = true;
                handlers.reject(promise, error);
              }
            });
          }
        }
      }, { "1": 1 }], 3: [function(_dereq_, module2, exports$12) {
        (function(global2) {
          if (typeof global2.Promise !== "function") {
            global2.Promise = _dereq_(2);
          }
        }).call(this, typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
      }, { "2": 2 }], 4: [function(_dereq_, module2, exports$12) {
        var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(obj) {
          return typeof obj;
        } : function(obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
        function _classCallCheck(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        }
        function getIDB() {
          try {
            if (typeof indexedDB !== "undefined") {
              return indexedDB;
            }
            if (typeof webkitIndexedDB !== "undefined") {
              return webkitIndexedDB;
            }
            if (typeof mozIndexedDB !== "undefined") {
              return mozIndexedDB;
            }
            if (typeof OIndexedDB !== "undefined") {
              return OIndexedDB;
            }
            if (typeof msIndexedDB !== "undefined") {
              return msIndexedDB;
            }
          } catch (e) {
            return;
          }
        }
        var idb = getIDB();
        function isIndexedDBValid() {
          try {
            if (!idb || !idb.open) {
              return false;
            }
            var isSafari = typeof openDatabase !== "undefined" && /(Safari|iPhone|iPad|iPod)/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/BlackBerry/.test(navigator.platform);
            var hasFetch = typeof fetch === "function" && fetch.toString().indexOf("[native code") !== -1;
            return (!isSafari || hasFetch) && typeof indexedDB !== "undefined" && // some outdated implementations of IDB that appear on Samsung
            // and HTC Android devices <4.4 are missing IDBKeyRange
            // See: https://github.com/mozilla/localForage/issues/128
            // See: https://github.com/mozilla/localForage/issues/272
            typeof IDBKeyRange !== "undefined";
          } catch (e) {
            return false;
          }
        }
        function createBlob(parts, properties) {
          parts = parts || [];
          properties = properties || {};
          try {
            return new Blob(parts, properties);
          } catch (e) {
            if (e.name !== "TypeError") {
              throw e;
            }
            var Builder = typeof BlobBuilder !== "undefined" ? BlobBuilder : typeof MSBlobBuilder !== "undefined" ? MSBlobBuilder : typeof MozBlobBuilder !== "undefined" ? MozBlobBuilder : WebKitBlobBuilder;
            var builder = new Builder();
            for (var i = 0; i < parts.length; i += 1) {
              builder.append(parts[i]);
            }
            return builder.getBlob(properties.type);
          }
        }
        if (typeof Promise === "undefined") {
          _dereq_(3);
        }
        var Promise$1 = Promise;
        function executeCallback(promise, callback) {
          if (callback) {
            promise.then(function(result) {
              callback(null, result);
            }, function(error) {
              callback(error);
            });
          }
        }
        function executeTwoCallbacks(promise, callback, errorCallback) {
          if (typeof callback === "function") {
            promise.then(callback);
          }
          if (typeof errorCallback === "function") {
            promise["catch"](errorCallback);
          }
        }
        function normalizeKey(key2) {
          if (typeof key2 !== "string") {
            console.warn(key2 + " used as a key, but it is not a string.");
            key2 = String(key2);
          }
          return key2;
        }
        function getCallback() {
          if (arguments.length && typeof arguments[arguments.length - 1] === "function") {
            return arguments[arguments.length - 1];
          }
        }
        var DETECT_BLOB_SUPPORT_STORE = "local-forage-detect-blob-support";
        var supportsBlobs = void 0;
        var dbContexts = {};
        var toString = Object.prototype.toString;
        var READ_ONLY = "readonly";
        var READ_WRITE = "readwrite";
        function _binStringToArrayBuffer(bin) {
          var length2 = bin.length;
          var buf = new ArrayBuffer(length2);
          var arr = new Uint8Array(buf);
          for (var i = 0; i < length2; i++) {
            arr[i] = bin.charCodeAt(i);
          }
          return buf;
        }
        function _checkBlobSupportWithoutCaching(idb2) {
          return new Promise$1(function(resolve) {
            var txn = idb2.transaction(DETECT_BLOB_SUPPORT_STORE, READ_WRITE);
            var blob = createBlob([""]);
            txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, "key");
            txn.onabort = function(e) {
              e.preventDefault();
              e.stopPropagation();
              resolve(false);
            };
            txn.oncomplete = function() {
              var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
              var matchedEdge = navigator.userAgent.match(/Edge\//);
              resolve(matchedEdge || !matchedChrome || parseInt(matchedChrome[1], 10) >= 43);
            };
          })["catch"](function() {
            return false;
          });
        }
        function _checkBlobSupport(idb2) {
          if (typeof supportsBlobs === "boolean") {
            return Promise$1.resolve(supportsBlobs);
          }
          return _checkBlobSupportWithoutCaching(idb2).then(function(value) {
            supportsBlobs = value;
            return supportsBlobs;
          });
        }
        function _deferReadiness(dbInfo) {
          var dbContext = dbContexts[dbInfo.name];
          var deferredOperation = {};
          deferredOperation.promise = new Promise$1(function(resolve, reject) {
            deferredOperation.resolve = resolve;
            deferredOperation.reject = reject;
          });
          dbContext.deferredOperations.push(deferredOperation);
          if (!dbContext.dbReady) {
            dbContext.dbReady = deferredOperation.promise;
          } else {
            dbContext.dbReady = dbContext.dbReady.then(function() {
              return deferredOperation.promise;
            });
          }
        }
        function _advanceReadiness(dbInfo) {
          var dbContext = dbContexts[dbInfo.name];
          var deferredOperation = dbContext.deferredOperations.pop();
          if (deferredOperation) {
            deferredOperation.resolve();
            return deferredOperation.promise;
          }
        }
        function _rejectReadiness(dbInfo, err) {
          var dbContext = dbContexts[dbInfo.name];
          var deferredOperation = dbContext.deferredOperations.pop();
          if (deferredOperation) {
            deferredOperation.reject(err);
            return deferredOperation.promise;
          }
        }
        function _getConnection(dbInfo, upgradeNeeded) {
          return new Promise$1(function(resolve, reject) {
            dbContexts[dbInfo.name] = dbContexts[dbInfo.name] || createDbContext();
            if (dbInfo.db) {
              if (upgradeNeeded) {
                _deferReadiness(dbInfo);
                dbInfo.db.close();
              } else {
                return resolve(dbInfo.db);
              }
            }
            var dbArgs = [dbInfo.name];
            if (upgradeNeeded) {
              dbArgs.push(dbInfo.version);
            }
            var openreq = idb.open.apply(idb, dbArgs);
            if (upgradeNeeded) {
              openreq.onupgradeneeded = function(e) {
                var db = openreq.result;
                try {
                  db.createObjectStore(dbInfo.storeName);
                  if (e.oldVersion <= 1) {
                    db.createObjectStore(DETECT_BLOB_SUPPORT_STORE);
                  }
                } catch (ex) {
                  if (ex.name === "ConstraintError") {
                    console.warn('The database "' + dbInfo.name + '" has been upgraded from version ' + e.oldVersion + " to version " + e.newVersion + ', but the storage "' + dbInfo.storeName + '" already exists.');
                  } else {
                    throw ex;
                  }
                }
              };
            }
            openreq.onerror = function(e) {
              e.preventDefault();
              reject(openreq.error);
            };
            openreq.onsuccess = function() {
              var db = openreq.result;
              db.onversionchange = function(e) {
                e.target.close();
              };
              resolve(db);
              _advanceReadiness(dbInfo);
            };
          });
        }
        function _getOriginalConnection(dbInfo) {
          return _getConnection(dbInfo, false);
        }
        function _getUpgradedConnection(dbInfo) {
          return _getConnection(dbInfo, true);
        }
        function _isUpgradeNeeded(dbInfo, defaultVersion) {
          if (!dbInfo.db) {
            return true;
          }
          var isNewStore = !dbInfo.db.objectStoreNames.contains(dbInfo.storeName);
          var isDowngrade = dbInfo.version < dbInfo.db.version;
          var isUpgrade = dbInfo.version > dbInfo.db.version;
          if (isDowngrade) {
            if (dbInfo.version !== defaultVersion) {
              console.warn('The database "' + dbInfo.name + `" can't be downgraded from version ` + dbInfo.db.version + " to version " + dbInfo.version + ".");
            }
            dbInfo.version = dbInfo.db.version;
          }
          if (isUpgrade || isNewStore) {
            if (isNewStore) {
              var incVersion = dbInfo.db.version + 1;
              if (incVersion > dbInfo.version) {
                dbInfo.version = incVersion;
              }
            }
            return true;
          }
          return false;
        }
        function _encodeBlob(blob) {
          return new Promise$1(function(resolve, reject) {
            var reader = new FileReader();
            reader.onerror = reject;
            reader.onloadend = function(e) {
              var base64 = btoa(e.target.result || "");
              resolve({
                __local_forage_encoded_blob: true,
                data: base64,
                type: blob.type
              });
            };
            reader.readAsBinaryString(blob);
          });
        }
        function _decodeBlob(encodedBlob) {
          var arrayBuff = _binStringToArrayBuffer(atob(encodedBlob.data));
          return createBlob([arrayBuff], { type: encodedBlob.type });
        }
        function _isEncodedBlob(value) {
          return value && value.__local_forage_encoded_blob;
        }
        function _fullyReady(callback) {
          var self2 = this;
          var promise = self2._initReady().then(function() {
            var dbContext = dbContexts[self2._dbInfo.name];
            if (dbContext && dbContext.dbReady) {
              return dbContext.dbReady;
            }
          });
          executeTwoCallbacks(promise, callback, callback);
          return promise;
        }
        function _tryReconnect(dbInfo) {
          _deferReadiness(dbInfo);
          var dbContext = dbContexts[dbInfo.name];
          var forages = dbContext.forages;
          for (var i = 0; i < forages.length; i++) {
            var forage = forages[i];
            if (forage._dbInfo.db) {
              forage._dbInfo.db.close();
              forage._dbInfo.db = null;
            }
          }
          dbInfo.db = null;
          return _getOriginalConnection(dbInfo).then(function(db) {
            dbInfo.db = db;
            if (_isUpgradeNeeded(dbInfo)) {
              return _getUpgradedConnection(dbInfo);
            }
            return db;
          }).then(function(db) {
            dbInfo.db = dbContext.db = db;
            for (var i2 = 0; i2 < forages.length; i2++) {
              forages[i2]._dbInfo.db = db;
            }
          })["catch"](function(err) {
            _rejectReadiness(dbInfo, err);
            throw err;
          });
        }
        function createTransaction(dbInfo, mode, callback, retries) {
          if (retries === void 0) {
            retries = 1;
          }
          try {
            var tx = dbInfo.db.transaction(dbInfo.storeName, mode);
            callback(null, tx);
          } catch (err) {
            if (retries > 0 && (!dbInfo.db || err.name === "InvalidStateError" || err.name === "NotFoundError")) {
              return Promise$1.resolve().then(function() {
                if (!dbInfo.db || err.name === "NotFoundError" && !dbInfo.db.objectStoreNames.contains(dbInfo.storeName) && dbInfo.version <= dbInfo.db.version) {
                  if (dbInfo.db) {
                    dbInfo.version = dbInfo.db.version + 1;
                  }
                  return _getUpgradedConnection(dbInfo);
                }
              }).then(function() {
                return _tryReconnect(dbInfo).then(function() {
                  createTransaction(dbInfo, mode, callback, retries - 1);
                });
              })["catch"](callback);
            }
            callback(err);
          }
        }
        function createDbContext() {
          return {
            // Running localForages sharing a database.
            forages: [],
            // Shared database.
            db: null,
            // Database readiness (promise).
            dbReady: null,
            // Deferred operations on the database.
            deferredOperations: []
          };
        }
        function _initStorage(options) {
          var self2 = this;
          var dbInfo = {
            db: null
          };
          if (options) {
            for (var i in options) {
              dbInfo[i] = options[i];
            }
          }
          var dbContext = dbContexts[dbInfo.name];
          if (!dbContext) {
            dbContext = createDbContext();
            dbContexts[dbInfo.name] = dbContext;
          }
          dbContext.forages.push(self2);
          if (!self2._initReady) {
            self2._initReady = self2.ready;
            self2.ready = _fullyReady;
          }
          var initPromises = [];
          function ignoreErrors() {
            return Promise$1.resolve();
          }
          for (var j = 0; j < dbContext.forages.length; j++) {
            var forage = dbContext.forages[j];
            if (forage !== self2) {
              initPromises.push(forage._initReady()["catch"](ignoreErrors));
            }
          }
          var forages = dbContext.forages.slice(0);
          return Promise$1.all(initPromises).then(function() {
            dbInfo.db = dbContext.db;
            return _getOriginalConnection(dbInfo);
          }).then(function(db) {
            dbInfo.db = db;
            if (_isUpgradeNeeded(dbInfo, self2._defaultConfig.version)) {
              return _getUpgradedConnection(dbInfo);
            }
            return db;
          }).then(function(db) {
            dbInfo.db = dbContext.db = db;
            self2._dbInfo = dbInfo;
            for (var k = 0; k < forages.length; k++) {
              var forage2 = forages[k];
              if (forage2 !== self2) {
                forage2._dbInfo.db = dbInfo.db;
                forage2._dbInfo.version = dbInfo.version;
              }
            }
          });
        }
        function getItem(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_ONLY, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store.get(key2);
                  req.onsuccess = function() {
                    var value = req.result;
                    if (value === void 0) {
                      value = null;
                    }
                    if (_isEncodedBlob(value)) {
                      value = _decodeBlob(value);
                    }
                    resolve(value);
                  };
                  req.onerror = function() {
                    reject(req.error);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function iterate(iterator, callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_ONLY, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store.openCursor();
                  var iterationNumber = 1;
                  req.onsuccess = function() {
                    var cursor = req.result;
                    if (cursor) {
                      var value = cursor.value;
                      if (_isEncodedBlob(value)) {
                        value = _decodeBlob(value);
                      }
                      var result = iterator(value, cursor.key, iterationNumber++);
                      if (result !== void 0) {
                        resolve(result);
                      } else {
                        cursor["continue"]();
                      }
                    } else {
                      resolve();
                    }
                  };
                  req.onerror = function() {
                    reject(req.error);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function setItem(key2, value, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            var dbInfo;
            self2.ready().then(function() {
              dbInfo = self2._dbInfo;
              if (toString.call(value) === "[object Blob]") {
                return _checkBlobSupport(dbInfo.db).then(function(blobSupport) {
                  if (blobSupport) {
                    return value;
                  }
                  return _encodeBlob(value);
                });
              }
              return value;
            }).then(function(value2) {
              createTransaction(self2._dbInfo, READ_WRITE, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  if (value2 === null) {
                    value2 = void 0;
                  }
                  var req = store.put(value2, key2);
                  transaction.oncomplete = function() {
                    if (value2 === void 0) {
                      value2 = null;
                    }
                    resolve(value2);
                  };
                  transaction.onabort = transaction.onerror = function() {
                    var err2 = req.error ? req.error : req.transaction.error;
                    reject(err2);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function removeItem(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_WRITE, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store["delete"](key2);
                  transaction.oncomplete = function() {
                    resolve();
                  };
                  transaction.onerror = function() {
                    reject(req.error);
                  };
                  transaction.onabort = function() {
                    var err2 = req.error ? req.error : req.transaction.error;
                    reject(err2);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function clear(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_WRITE, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store.clear();
                  transaction.oncomplete = function() {
                    resolve();
                  };
                  transaction.onabort = transaction.onerror = function() {
                    var err2 = req.error ? req.error : req.transaction.error;
                    reject(err2);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function length(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_ONLY, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store.count();
                  req.onsuccess = function() {
                    resolve(req.result);
                  };
                  req.onerror = function() {
                    reject(req.error);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function key(n, callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            if (n < 0) {
              resolve(null);
              return;
            }
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_ONLY, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var advanced = false;
                  var req = store.openKeyCursor();
                  req.onsuccess = function() {
                    var cursor = req.result;
                    if (!cursor) {
                      resolve(null);
                      return;
                    }
                    if (n === 0) {
                      resolve(cursor.key);
                    } else {
                      if (!advanced) {
                        advanced = true;
                        cursor.advance(n);
                      } else {
                        resolve(cursor.key);
                      }
                    }
                  };
                  req.onerror = function() {
                    reject(req.error);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function keys(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              createTransaction(self2._dbInfo, READ_ONLY, function(err, transaction) {
                if (err) {
                  return reject(err);
                }
                try {
                  var store = transaction.objectStore(self2._dbInfo.storeName);
                  var req = store.openKeyCursor();
                  var keys2 = [];
                  req.onsuccess = function() {
                    var cursor = req.result;
                    if (!cursor) {
                      resolve(keys2);
                      return;
                    }
                    keys2.push(cursor.key);
                    cursor["continue"]();
                  };
                  req.onerror = function() {
                    reject(req.error);
                  };
                } catch (e) {
                  reject(e);
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function dropInstance(options, callback) {
          callback = getCallback.apply(this, arguments);
          var currentConfig = this.config();
          options = typeof options !== "function" && options || {};
          if (!options.name) {
            options.name = options.name || currentConfig.name;
            options.storeName = options.storeName || currentConfig.storeName;
          }
          var self2 = this;
          var promise;
          if (!options.name) {
            promise = Promise$1.reject("Invalid arguments");
          } else {
            var isCurrentDb = options.name === currentConfig.name && self2._dbInfo.db;
            var dbPromise = isCurrentDb ? Promise$1.resolve(self2._dbInfo.db) : _getOriginalConnection(options).then(function(db) {
              var dbContext = dbContexts[options.name];
              var forages = dbContext.forages;
              dbContext.db = db;
              for (var i = 0; i < forages.length; i++) {
                forages[i]._dbInfo.db = db;
              }
              return db;
            });
            if (!options.storeName) {
              promise = dbPromise.then(function(db) {
                _deferReadiness(options);
                var dbContext = dbContexts[options.name];
                var forages = dbContext.forages;
                db.close();
                for (var i = 0; i < forages.length; i++) {
                  var forage = forages[i];
                  forage._dbInfo.db = null;
                }
                var dropDBPromise = new Promise$1(function(resolve, reject) {
                  var req = idb.deleteDatabase(options.name);
                  req.onerror = function() {
                    var db2 = req.result;
                    if (db2) {
                      db2.close();
                    }
                    reject(req.error);
                  };
                  req.onblocked = function() {
                    console.warn('dropInstance blocked for database "' + options.name + '" until all open connections are closed');
                  };
                  req.onsuccess = function() {
                    var db2 = req.result;
                    if (db2) {
                      db2.close();
                    }
                    resolve(db2);
                  };
                });
                return dropDBPromise.then(function(db2) {
                  dbContext.db = db2;
                  for (var i2 = 0; i2 < forages.length; i2++) {
                    var _forage = forages[i2];
                    _advanceReadiness(_forage._dbInfo);
                  }
                })["catch"](function(err) {
                  (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function() {
                  });
                  throw err;
                });
              });
            } else {
              promise = dbPromise.then(function(db) {
                if (!db.objectStoreNames.contains(options.storeName)) {
                  return;
                }
                var newVersion = db.version + 1;
                _deferReadiness(options);
                var dbContext = dbContexts[options.name];
                var forages = dbContext.forages;
                db.close();
                for (var i = 0; i < forages.length; i++) {
                  var forage = forages[i];
                  forage._dbInfo.db = null;
                  forage._dbInfo.version = newVersion;
                }
                var dropObjectPromise = new Promise$1(function(resolve, reject) {
                  var req = idb.open(options.name, newVersion);
                  req.onerror = function(err) {
                    var db2 = req.result;
                    db2.close();
                    reject(err);
                  };
                  req.onupgradeneeded = function() {
                    var db2 = req.result;
                    db2.deleteObjectStore(options.storeName);
                  };
                  req.onsuccess = function() {
                    var db2 = req.result;
                    db2.close();
                    resolve(db2);
                  };
                });
                return dropObjectPromise.then(function(db2) {
                  dbContext.db = db2;
                  for (var j = 0; j < forages.length; j++) {
                    var _forage2 = forages[j];
                    _forage2._dbInfo.db = db2;
                    _advanceReadiness(_forage2._dbInfo);
                  }
                })["catch"](function(err) {
                  (_rejectReadiness(options, err) || Promise$1.resolve())["catch"](function() {
                  });
                  throw err;
                });
              });
            }
          }
          executeCallback(promise, callback);
          return promise;
        }
        var asyncStorage = {
          _driver: "asyncStorage",
          _initStorage,
          _support: isIndexedDBValid(),
          iterate,
          getItem,
          setItem,
          removeItem,
          clear,
          length,
          key,
          keys,
          dropInstance
        };
        function isWebSQLValid() {
          return typeof openDatabase === "function";
        }
        var BASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var BLOB_TYPE_PREFIX = "~~local_forage_type~";
        var BLOB_TYPE_PREFIX_REGEX = /^~~local_forage_type~([^~]+)~/;
        var SERIALIZED_MARKER = "__lfsc__:";
        var SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER.length;
        var TYPE_ARRAYBUFFER = "arbf";
        var TYPE_BLOB = "blob";
        var TYPE_INT8ARRAY = "si08";
        var TYPE_UINT8ARRAY = "ui08";
        var TYPE_UINT8CLAMPEDARRAY = "uic8";
        var TYPE_INT16ARRAY = "si16";
        var TYPE_INT32ARRAY = "si32";
        var TYPE_UINT16ARRAY = "ur16";
        var TYPE_UINT32ARRAY = "ui32";
        var TYPE_FLOAT32ARRAY = "fl32";
        var TYPE_FLOAT64ARRAY = "fl64";
        var TYPE_SERIALIZED_MARKER_LENGTH = SERIALIZED_MARKER_LENGTH + TYPE_ARRAYBUFFER.length;
        var toString$1 = Object.prototype.toString;
        function stringToBuffer(serializedString) {
          var bufferLength = serializedString.length * 0.75;
          var len = serializedString.length;
          var i;
          var p = 0;
          var encoded1, encoded2, encoded3, encoded4;
          if (serializedString[serializedString.length - 1] === "=") {
            bufferLength--;
            if (serializedString[serializedString.length - 2] === "=") {
              bufferLength--;
            }
          }
          var buffer = new ArrayBuffer(bufferLength);
          var bytes = new Uint8Array(buffer);
          for (i = 0; i < len; i += 4) {
            encoded1 = BASE_CHARS.indexOf(serializedString[i]);
            encoded2 = BASE_CHARS.indexOf(serializedString[i + 1]);
            encoded3 = BASE_CHARS.indexOf(serializedString[i + 2]);
            encoded4 = BASE_CHARS.indexOf(serializedString[i + 3]);
            bytes[p++] = encoded1 << 2 | encoded2 >> 4;
            bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
            bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
          }
          return buffer;
        }
        function bufferToString(buffer) {
          var bytes = new Uint8Array(buffer);
          var base64String = "";
          var i;
          for (i = 0; i < bytes.length; i += 3) {
            base64String += BASE_CHARS[bytes[i] >> 2];
            base64String += BASE_CHARS[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
            base64String += BASE_CHARS[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
            base64String += BASE_CHARS[bytes[i + 2] & 63];
          }
          if (bytes.length % 3 === 2) {
            base64String = base64String.substring(0, base64String.length - 1) + "=";
          } else if (bytes.length % 3 === 1) {
            base64String = base64String.substring(0, base64String.length - 2) + "==";
          }
          return base64String;
        }
        function serialize(value, callback) {
          var valueType = "";
          if (value) {
            valueType = toString$1.call(value);
          }
          if (value && (valueType === "[object ArrayBuffer]" || value.buffer && toString$1.call(value.buffer) === "[object ArrayBuffer]")) {
            var buffer;
            var marker = SERIALIZED_MARKER;
            if (value instanceof ArrayBuffer) {
              buffer = value;
              marker += TYPE_ARRAYBUFFER;
            } else {
              buffer = value.buffer;
              if (valueType === "[object Int8Array]") {
                marker += TYPE_INT8ARRAY;
              } else if (valueType === "[object Uint8Array]") {
                marker += TYPE_UINT8ARRAY;
              } else if (valueType === "[object Uint8ClampedArray]") {
                marker += TYPE_UINT8CLAMPEDARRAY;
              } else if (valueType === "[object Int16Array]") {
                marker += TYPE_INT16ARRAY;
              } else if (valueType === "[object Uint16Array]") {
                marker += TYPE_UINT16ARRAY;
              } else if (valueType === "[object Int32Array]") {
                marker += TYPE_INT32ARRAY;
              } else if (valueType === "[object Uint32Array]") {
                marker += TYPE_UINT32ARRAY;
              } else if (valueType === "[object Float32Array]") {
                marker += TYPE_FLOAT32ARRAY;
              } else if (valueType === "[object Float64Array]") {
                marker += TYPE_FLOAT64ARRAY;
              } else {
                callback(new Error("Failed to get type for BinaryArray"));
              }
            }
            callback(marker + bufferToString(buffer));
          } else if (valueType === "[object Blob]") {
            var fileReader = new FileReader();
            fileReader.onload = function() {
              var str = BLOB_TYPE_PREFIX + value.type + "~" + bufferToString(this.result);
              callback(SERIALIZED_MARKER + TYPE_BLOB + str);
            };
            fileReader.readAsArrayBuffer(value);
          } else {
            try {
              callback(JSON.stringify(value));
            } catch (e) {
              console.error("Couldn't convert value into a JSON string: ", value);
              callback(null, e);
            }
          }
        }
        function deserialize(value) {
          if (value.substring(0, SERIALIZED_MARKER_LENGTH) !== SERIALIZED_MARKER) {
            return JSON.parse(value);
          }
          var serializedString = value.substring(TYPE_SERIALIZED_MARKER_LENGTH);
          var type = value.substring(SERIALIZED_MARKER_LENGTH, TYPE_SERIALIZED_MARKER_LENGTH);
          var blobType;
          if (type === TYPE_BLOB && BLOB_TYPE_PREFIX_REGEX.test(serializedString)) {
            var matcher = serializedString.match(BLOB_TYPE_PREFIX_REGEX);
            blobType = matcher[1];
            serializedString = serializedString.substring(matcher[0].length);
          }
          var buffer = stringToBuffer(serializedString);
          switch (type) {
            case TYPE_ARRAYBUFFER:
              return buffer;
            case TYPE_BLOB:
              return createBlob([buffer], { type: blobType });
            case TYPE_INT8ARRAY:
              return new Int8Array(buffer);
            case TYPE_UINT8ARRAY:
              return new Uint8Array(buffer);
            case TYPE_UINT8CLAMPEDARRAY:
              return new Uint8ClampedArray(buffer);
            case TYPE_INT16ARRAY:
              return new Int16Array(buffer);
            case TYPE_UINT16ARRAY:
              return new Uint16Array(buffer);
            case TYPE_INT32ARRAY:
              return new Int32Array(buffer);
            case TYPE_UINT32ARRAY:
              return new Uint32Array(buffer);
            case TYPE_FLOAT32ARRAY:
              return new Float32Array(buffer);
            case TYPE_FLOAT64ARRAY:
              return new Float64Array(buffer);
            default:
              throw new Error("Unkown type: " + type);
          }
        }
        var localforageSerializer = {
          serialize,
          deserialize,
          stringToBuffer,
          bufferToString
        };
        function createDbTable(t, dbInfo, callback, errorCallback) {
          t.executeSql("CREATE TABLE IF NOT EXISTS " + dbInfo.storeName + " (id INTEGER PRIMARY KEY, key unique, value)", [], callback, errorCallback);
        }
        function _initStorage$1(options) {
          var self2 = this;
          var dbInfo = {
            db: null
          };
          if (options) {
            for (var i in options) {
              dbInfo[i] = typeof options[i] !== "string" ? options[i].toString() : options[i];
            }
          }
          var dbInfoPromise = new Promise$1(function(resolve, reject) {
            try {
              dbInfo.db = openDatabase(dbInfo.name, String(dbInfo.version), dbInfo.description, dbInfo.size);
            } catch (e) {
              return reject(e);
            }
            dbInfo.db.transaction(function(t) {
              createDbTable(t, dbInfo, function() {
                self2._dbInfo = dbInfo;
                resolve();
              }, function(t2, error) {
                reject(error);
              });
            }, reject);
          });
          dbInfo.serializer = localforageSerializer;
          return dbInfoPromise;
        }
        function tryExecuteSql(t, dbInfo, sqlStatement, args, callback, errorCallback) {
          t.executeSql(sqlStatement, args, callback, function(t2, error) {
            if (error.code === error.SYNTAX_ERR) {
              t2.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [dbInfo.storeName], function(t3, results) {
                if (!results.rows.length) {
                  createDbTable(t3, dbInfo, function() {
                    t3.executeSql(sqlStatement, args, callback, errorCallback);
                  }, errorCallback);
                } else {
                  errorCallback(t3, error);
                }
              }, errorCallback);
            } else {
              errorCallback(t2, error);
            }
          }, errorCallback);
        }
        function getItem$1(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "SELECT * FROM " + dbInfo.storeName + " WHERE key = ? LIMIT 1", [key2], function(t2, results) {
                  var result = results.rows.length ? results.rows.item(0).value : null;
                  if (result) {
                    result = dbInfo.serializer.deserialize(result);
                  }
                  resolve(result);
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function iterate$1(iterator, callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "SELECT * FROM " + dbInfo.storeName, [], function(t2, results) {
                  var rows = results.rows;
                  var length2 = rows.length;
                  for (var i = 0; i < length2; i++) {
                    var item = rows.item(i);
                    var result = item.value;
                    if (result) {
                      result = dbInfo.serializer.deserialize(result);
                    }
                    result = iterator(result, item.key, i + 1);
                    if (result !== void 0) {
                      resolve(result);
                      return;
                    }
                  }
                  resolve();
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function _setItem(key2, value, callback, retriesLeft) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              if (value === void 0) {
                value = null;
              }
              var originalValue = value;
              var dbInfo = self2._dbInfo;
              dbInfo.serializer.serialize(value, function(value2, error) {
                if (error) {
                  reject(error);
                } else {
                  dbInfo.db.transaction(function(t) {
                    tryExecuteSql(t, dbInfo, "INSERT OR REPLACE INTO " + dbInfo.storeName + " (key, value) VALUES (?, ?)", [key2, value2], function() {
                      resolve(originalValue);
                    }, function(t2, error2) {
                      reject(error2);
                    });
                  }, function(sqlError) {
                    if (sqlError.code === sqlError.QUOTA_ERR) {
                      if (retriesLeft > 0) {
                        resolve(_setItem.apply(self2, [key2, originalValue, callback, retriesLeft - 1]));
                        return;
                      }
                      reject(sqlError);
                    }
                  });
                }
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function setItem$1(key2, value, callback) {
          return _setItem.apply(this, [key2, value, callback, 1]);
        }
        function removeItem$1(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "DELETE FROM " + dbInfo.storeName + " WHERE key = ?", [key2], function() {
                  resolve();
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function clear$1(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "DELETE FROM " + dbInfo.storeName, [], function() {
                  resolve();
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function length$1(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "SELECT COUNT(key) as c FROM " + dbInfo.storeName, [], function(t2, results) {
                  var result = results.rows.item(0).c;
                  resolve(result);
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function key$1(n, callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "SELECT key FROM " + dbInfo.storeName + " WHERE id = ? LIMIT 1", [n + 1], function(t2, results) {
                  var result = results.rows.length ? results.rows.item(0).key : null;
                  resolve(result);
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function keys$1(callback) {
          var self2 = this;
          var promise = new Promise$1(function(resolve, reject) {
            self2.ready().then(function() {
              var dbInfo = self2._dbInfo;
              dbInfo.db.transaction(function(t) {
                tryExecuteSql(t, dbInfo, "SELECT key FROM " + dbInfo.storeName, [], function(t2, results) {
                  var keys2 = [];
                  for (var i = 0; i < results.rows.length; i++) {
                    keys2.push(results.rows.item(i).key);
                  }
                  resolve(keys2);
                }, function(t2, error) {
                  reject(error);
                });
              });
            })["catch"](reject);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function getAllStoreNames(db) {
          return new Promise$1(function(resolve, reject) {
            db.transaction(function(t) {
              t.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name <> '__WebKitDatabaseInfoTable__'", [], function(t2, results) {
                var storeNames = [];
                for (var i = 0; i < results.rows.length; i++) {
                  storeNames.push(results.rows.item(i).name);
                }
                resolve({
                  db,
                  storeNames
                });
              }, function(t2, error) {
                reject(error);
              });
            }, function(sqlError) {
              reject(sqlError);
            });
          });
        }
        function dropInstance$1(options, callback) {
          callback = getCallback.apply(this, arguments);
          var currentConfig = this.config();
          options = typeof options !== "function" && options || {};
          if (!options.name) {
            options.name = options.name || currentConfig.name;
            options.storeName = options.storeName || currentConfig.storeName;
          }
          var self2 = this;
          var promise;
          if (!options.name) {
            promise = Promise$1.reject("Invalid arguments");
          } else {
            promise = new Promise$1(function(resolve) {
              var db;
              if (options.name === currentConfig.name) {
                db = self2._dbInfo.db;
              } else {
                db = openDatabase(options.name, "", "", 0);
              }
              if (!options.storeName) {
                resolve(getAllStoreNames(db));
              } else {
                resolve({
                  db,
                  storeNames: [options.storeName]
                });
              }
            }).then(function(operationInfo) {
              return new Promise$1(function(resolve, reject) {
                operationInfo.db.transaction(function(t) {
                  function dropTable(storeName) {
                    return new Promise$1(function(resolve2, reject2) {
                      t.executeSql("DROP TABLE IF EXISTS " + storeName, [], function() {
                        resolve2();
                      }, function(t2, error) {
                        reject2(error);
                      });
                    });
                  }
                  var operations = [];
                  for (var i = 0, len = operationInfo.storeNames.length; i < len; i++) {
                    operations.push(dropTable(operationInfo.storeNames[i]));
                  }
                  Promise$1.all(operations).then(function() {
                    resolve();
                  })["catch"](function(e) {
                    reject(e);
                  });
                }, function(sqlError) {
                  reject(sqlError);
                });
              });
            });
          }
          executeCallback(promise, callback);
          return promise;
        }
        var webSQLStorage = {
          _driver: "webSQLStorage",
          _initStorage: _initStorage$1,
          _support: isWebSQLValid(),
          iterate: iterate$1,
          getItem: getItem$1,
          setItem: setItem$1,
          removeItem: removeItem$1,
          clear: clear$1,
          length: length$1,
          key: key$1,
          keys: keys$1,
          dropInstance: dropInstance$1
        };
        function isLocalStorageValid() {
          try {
            return typeof localStorage !== "undefined" && "setItem" in localStorage && // in IE8 typeof localStorage.setItem === 'object'
            !!localStorage.setItem;
          } catch (e) {
            return false;
          }
        }
        function _getKeyPrefix(options, defaultConfig2) {
          var keyPrefix = options.name + "/";
          if (options.storeName !== defaultConfig2.storeName) {
            keyPrefix += options.storeName + "/";
          }
          return keyPrefix;
        }
        function checkIfLocalStorageThrows() {
          var localStorageTestKey = "_localforage_support_test";
          try {
            localStorage.setItem(localStorageTestKey, true);
            localStorage.removeItem(localStorageTestKey);
            return false;
          } catch (e) {
            return true;
          }
        }
        function _isLocalStorageUsable() {
          return !checkIfLocalStorageThrows() || localStorage.length > 0;
        }
        function _initStorage$2(options) {
          var self2 = this;
          var dbInfo = {};
          if (options) {
            for (var i in options) {
              dbInfo[i] = options[i];
            }
          }
          dbInfo.keyPrefix = _getKeyPrefix(options, self2._defaultConfig);
          if (!_isLocalStorageUsable()) {
            return Promise$1.reject();
          }
          self2._dbInfo = dbInfo;
          dbInfo.serializer = localforageSerializer;
          return Promise$1.resolve();
        }
        function clear$2(callback) {
          var self2 = this;
          var promise = self2.ready().then(function() {
            var keyPrefix = self2._dbInfo.keyPrefix;
            for (var i = localStorage.length - 1; i >= 0; i--) {
              var key2 = localStorage.key(i);
              if (key2.indexOf(keyPrefix) === 0) {
                localStorage.removeItem(key2);
              }
            }
          });
          executeCallback(promise, callback);
          return promise;
        }
        function getItem$2(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = self2.ready().then(function() {
            var dbInfo = self2._dbInfo;
            var result = localStorage.getItem(dbInfo.keyPrefix + key2);
            if (result) {
              result = dbInfo.serializer.deserialize(result);
            }
            return result;
          });
          executeCallback(promise, callback);
          return promise;
        }
        function iterate$2(iterator, callback) {
          var self2 = this;
          var promise = self2.ready().then(function() {
            var dbInfo = self2._dbInfo;
            var keyPrefix = dbInfo.keyPrefix;
            var keyPrefixLength = keyPrefix.length;
            var length2 = localStorage.length;
            var iterationNumber = 1;
            for (var i = 0; i < length2; i++) {
              var key2 = localStorage.key(i);
              if (key2.indexOf(keyPrefix) !== 0) {
                continue;
              }
              var value = localStorage.getItem(key2);
              if (value) {
                value = dbInfo.serializer.deserialize(value);
              }
              value = iterator(value, key2.substring(keyPrefixLength), iterationNumber++);
              if (value !== void 0) {
                return value;
              }
            }
          });
          executeCallback(promise, callback);
          return promise;
        }
        function key$2(n, callback) {
          var self2 = this;
          var promise = self2.ready().then(function() {
            var dbInfo = self2._dbInfo;
            var result;
            try {
              result = localStorage.key(n);
            } catch (error) {
              result = null;
            }
            if (result) {
              result = result.substring(dbInfo.keyPrefix.length);
            }
            return result;
          });
          executeCallback(promise, callback);
          return promise;
        }
        function keys$2(callback) {
          var self2 = this;
          var promise = self2.ready().then(function() {
            var dbInfo = self2._dbInfo;
            var length2 = localStorage.length;
            var keys2 = [];
            for (var i = 0; i < length2; i++) {
              var itemKey = localStorage.key(i);
              if (itemKey.indexOf(dbInfo.keyPrefix) === 0) {
                keys2.push(itemKey.substring(dbInfo.keyPrefix.length));
              }
            }
            return keys2;
          });
          executeCallback(promise, callback);
          return promise;
        }
        function length$2(callback) {
          var self2 = this;
          var promise = self2.keys().then(function(keys2) {
            return keys2.length;
          });
          executeCallback(promise, callback);
          return promise;
        }
        function removeItem$2(key2, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = self2.ready().then(function() {
            var dbInfo = self2._dbInfo;
            localStorage.removeItem(dbInfo.keyPrefix + key2);
          });
          executeCallback(promise, callback);
          return promise;
        }
        function setItem$2(key2, value, callback) {
          var self2 = this;
          key2 = normalizeKey(key2);
          var promise = self2.ready().then(function() {
            if (value === void 0) {
              value = null;
            }
            var originalValue = value;
            return new Promise$1(function(resolve, reject) {
              var dbInfo = self2._dbInfo;
              dbInfo.serializer.serialize(value, function(value2, error) {
                if (error) {
                  reject(error);
                } else {
                  try {
                    localStorage.setItem(dbInfo.keyPrefix + key2, value2);
                    resolve(originalValue);
                  } catch (e) {
                    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
                      reject(e);
                    }
                    reject(e);
                  }
                }
              });
            });
          });
          executeCallback(promise, callback);
          return promise;
        }
        function dropInstance$2(options, callback) {
          callback = getCallback.apply(this, arguments);
          options = typeof options !== "function" && options || {};
          if (!options.name) {
            var currentConfig = this.config();
            options.name = options.name || currentConfig.name;
            options.storeName = options.storeName || currentConfig.storeName;
          }
          var self2 = this;
          var promise;
          if (!options.name) {
            promise = Promise$1.reject("Invalid arguments");
          } else {
            promise = new Promise$1(function(resolve) {
              if (!options.storeName) {
                resolve(options.name + "/");
              } else {
                resolve(_getKeyPrefix(options, self2._defaultConfig));
              }
            }).then(function(keyPrefix) {
              for (var i = localStorage.length - 1; i >= 0; i--) {
                var key2 = localStorage.key(i);
                if (key2.indexOf(keyPrefix) === 0) {
                  localStorage.removeItem(key2);
                }
              }
            });
          }
          executeCallback(promise, callback);
          return promise;
        }
        var localStorageWrapper = {
          _driver: "localStorageWrapper",
          _initStorage: _initStorage$2,
          _support: isLocalStorageValid(),
          iterate: iterate$2,
          getItem: getItem$2,
          setItem: setItem$2,
          removeItem: removeItem$2,
          clear: clear$2,
          length: length$2,
          key: key$2,
          keys: keys$2,
          dropInstance: dropInstance$2
        };
        var sameValue = function sameValue2(x, y) {
          return x === y || typeof x === "number" && typeof y === "number" && isNaN(x) && isNaN(y);
        };
        var includes = function includes2(array, searchElement) {
          var len = array.length;
          var i = 0;
          while (i < len) {
            if (sameValue(array[i], searchElement)) {
              return true;
            }
            i++;
          }
          return false;
        };
        var isArray = Array.isArray || function(arg) {
          return Object.prototype.toString.call(arg) === "[object Array]";
        };
        var DefinedDrivers = {};
        var DriverSupport = {};
        var DefaultDrivers = {
          INDEXEDDB: asyncStorage,
          WEBSQL: webSQLStorage,
          LOCALSTORAGE: localStorageWrapper
        };
        var DefaultDriverOrder = [DefaultDrivers.INDEXEDDB._driver, DefaultDrivers.WEBSQL._driver, DefaultDrivers.LOCALSTORAGE._driver];
        var OptionalDriverMethods = ["dropInstance"];
        var LibraryMethods = ["clear", "getItem", "iterate", "key", "keys", "length", "removeItem", "setItem"].concat(OptionalDriverMethods);
        var DefaultConfig = {
          description: "",
          driver: DefaultDriverOrder.slice(),
          name: "localforage",
          // Default DB size is _JUST UNDER_ 5MB, as it's the highest size
          // we can use without a prompt.
          size: 4980736,
          storeName: "keyvaluepairs",
          version: 1
        };
        function callWhenReady(localForageInstance, libraryMethod) {
          localForageInstance[libraryMethod] = function() {
            var _args = arguments;
            return localForageInstance.ready().then(function() {
              return localForageInstance[libraryMethod].apply(localForageInstance, _args);
            });
          };
        }
        function extend() {
          for (var i = 1; i < arguments.length; i++) {
            var arg = arguments[i];
            if (arg) {
              for (var _key in arg) {
                if (arg.hasOwnProperty(_key)) {
                  if (isArray(arg[_key])) {
                    arguments[0][_key] = arg[_key].slice();
                  } else {
                    arguments[0][_key] = arg[_key];
                  }
                }
              }
            }
          }
          return arguments[0];
        }
        var LocalForage = function() {
          function LocalForage2(options) {
            _classCallCheck(this, LocalForage2);
            for (var driverTypeKey in DefaultDrivers) {
              if (DefaultDrivers.hasOwnProperty(driverTypeKey)) {
                var driver = DefaultDrivers[driverTypeKey];
                var driverName = driver._driver;
                this[driverTypeKey] = driverName;
                if (!DefinedDrivers[driverName]) {
                  this.defineDriver(driver);
                }
              }
            }
            this._defaultConfig = extend({}, DefaultConfig);
            this._config = extend({}, this._defaultConfig, options);
            this._driverSet = null;
            this._initDriver = null;
            this._ready = false;
            this._dbInfo = null;
            this._wrapLibraryMethodsWithReady();
            this.setDriver(this._config.driver)["catch"](function() {
            });
          }
          LocalForage2.prototype.config = function config(options) {
            if ((typeof options === "undefined" ? "undefined" : _typeof(options)) === "object") {
              if (this._ready) {
                return new Error("Can't call config() after localforage has been used.");
              }
              for (var i in options) {
                if (i === "storeName") {
                  options[i] = options[i].replace(/\W/g, "_");
                }
                if (i === "version" && typeof options[i] !== "number") {
                  return new Error("Database version must be a number.");
                }
                this._config[i] = options[i];
              }
              if ("driver" in options && options.driver) {
                return this.setDriver(this._config.driver);
              }
              return true;
            } else if (typeof options === "string") {
              return this._config[options];
            } else {
              return this._config;
            }
          };
          LocalForage2.prototype.defineDriver = function defineDriver(driverObject, callback, errorCallback) {
            var promise = new Promise$1(function(resolve, reject) {
              try {
                var driverName = driverObject._driver;
                var complianceError = new Error("Custom driver not compliant; see https://mozilla.github.io/localForage/#definedriver");
                if (!driverObject._driver) {
                  reject(complianceError);
                  return;
                }
                var driverMethods = LibraryMethods.concat("_initStorage");
                for (var i = 0, len = driverMethods.length; i < len; i++) {
                  var driverMethodName = driverMethods[i];
                  var isRequired = !includes(OptionalDriverMethods, driverMethodName);
                  if ((isRequired || driverObject[driverMethodName]) && typeof driverObject[driverMethodName] !== "function") {
                    reject(complianceError);
                    return;
                  }
                }
                var configureMissingMethods = function configureMissingMethods2() {
                  var methodNotImplementedFactory = function methodNotImplementedFactory2(methodName) {
                    return function() {
                      var error = new Error("Method " + methodName + " is not implemented by the current driver");
                      var promise2 = Promise$1.reject(error);
                      executeCallback(promise2, arguments[arguments.length - 1]);
                      return promise2;
                    };
                  };
                  for (var _i = 0, _len = OptionalDriverMethods.length; _i < _len; _i++) {
                    var optionalDriverMethod = OptionalDriverMethods[_i];
                    if (!driverObject[optionalDriverMethod]) {
                      driverObject[optionalDriverMethod] = methodNotImplementedFactory(optionalDriverMethod);
                    }
                  }
                };
                configureMissingMethods();
                var setDriverSupport = function setDriverSupport2(support) {
                  if (DefinedDrivers[driverName]) {
                    console.info("Redefining LocalForage driver: " + driverName);
                  }
                  DefinedDrivers[driverName] = driverObject;
                  DriverSupport[driverName] = support;
                  resolve();
                };
                if ("_support" in driverObject) {
                  if (driverObject._support && typeof driverObject._support === "function") {
                    driverObject._support().then(setDriverSupport, reject);
                  } else {
                    setDriverSupport(!!driverObject._support);
                  }
                } else {
                  setDriverSupport(true);
                }
              } catch (e) {
                reject(e);
              }
            });
            executeTwoCallbacks(promise, callback, errorCallback);
            return promise;
          };
          LocalForage2.prototype.driver = function driver() {
            return this._driver || null;
          };
          LocalForage2.prototype.getDriver = function getDriver(driverName, callback, errorCallback) {
            var getDriverPromise = DefinedDrivers[driverName] ? Promise$1.resolve(DefinedDrivers[driverName]) : Promise$1.reject(new Error("Driver not found."));
            executeTwoCallbacks(getDriverPromise, callback, errorCallback);
            return getDriverPromise;
          };
          LocalForage2.prototype.getSerializer = function getSerializer(callback) {
            var serializerPromise = Promise$1.resolve(localforageSerializer);
            executeTwoCallbacks(serializerPromise, callback);
            return serializerPromise;
          };
          LocalForage2.prototype.ready = function ready(callback) {
            var self2 = this;
            var promise = self2._driverSet.then(function() {
              if (self2._ready === null) {
                self2._ready = self2._initDriver();
              }
              return self2._ready;
            });
            executeTwoCallbacks(promise, callback, callback);
            return promise;
          };
          LocalForage2.prototype.setDriver = function setDriver(drivers, callback, errorCallback) {
            var self2 = this;
            if (!isArray(drivers)) {
              drivers = [drivers];
            }
            var supportedDrivers = this._getSupportedDrivers(drivers);
            function setDriverToConfig() {
              self2._config.driver = self2.driver();
            }
            function extendSelfWithDriver(driver) {
              self2._extend(driver);
              setDriverToConfig();
              self2._ready = self2._initStorage(self2._config);
              return self2._ready;
            }
            function initDriver(supportedDrivers2) {
              return function() {
                var currentDriverIndex = 0;
                function driverPromiseLoop() {
                  while (currentDriverIndex < supportedDrivers2.length) {
                    var driverName = supportedDrivers2[currentDriverIndex];
                    currentDriverIndex++;
                    self2._dbInfo = null;
                    self2._ready = null;
                    return self2.getDriver(driverName).then(extendSelfWithDriver)["catch"](driverPromiseLoop);
                  }
                  setDriverToConfig();
                  var error = new Error("No available storage method found.");
                  self2._driverSet = Promise$1.reject(error);
                  return self2._driverSet;
                }
                return driverPromiseLoop();
              };
            }
            var oldDriverSetDone = this._driverSet !== null ? this._driverSet["catch"](function() {
              return Promise$1.resolve();
            }) : Promise$1.resolve();
            this._driverSet = oldDriverSetDone.then(function() {
              var driverName = supportedDrivers[0];
              self2._dbInfo = null;
              self2._ready = null;
              return self2.getDriver(driverName).then(function(driver) {
                self2._driver = driver._driver;
                setDriverToConfig();
                self2._wrapLibraryMethodsWithReady();
                self2._initDriver = initDriver(supportedDrivers);
              });
            })["catch"](function() {
              setDriverToConfig();
              var error = new Error("No available storage method found.");
              self2._driverSet = Promise$1.reject(error);
              return self2._driverSet;
            });
            executeTwoCallbacks(this._driverSet, callback, errorCallback);
            return this._driverSet;
          };
          LocalForage2.prototype.supports = function supports(driverName) {
            return !!DriverSupport[driverName];
          };
          LocalForage2.prototype._extend = function _extend(libraryMethodsAndProperties) {
            extend(this, libraryMethodsAndProperties);
          };
          LocalForage2.prototype._getSupportedDrivers = function _getSupportedDrivers(drivers) {
            var supportedDrivers = [];
            for (var i = 0, len = drivers.length; i < len; i++) {
              var driverName = drivers[i];
              if (this.supports(driverName)) {
                supportedDrivers.push(driverName);
              }
            }
            return supportedDrivers;
          };
          LocalForage2.prototype._wrapLibraryMethodsWithReady = function _wrapLibraryMethodsWithReady() {
            for (var i = 0, len = LibraryMethods.length; i < len; i++) {
              callWhenReady(this, LibraryMethods[i]);
            }
          };
          LocalForage2.prototype.createInstance = function createInstance(options) {
            return new LocalForage2(options);
          };
          return LocalForage2;
        }();
        var localforage_js = new LocalForage();
        module2.exports = localforage_js;
      }, { "3": 3 }] }, {}, [4])(4);
    });
  })(localforage$1);
  var localforageExports = localforage$1.exports;
  const localforage = /* @__PURE__ */ getDefaultExportFromCjs(localforageExports);
  class CacheManager {
    // 500MB
    constructor() {
      this.CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1e3;
      this.MAX_CACHE_SIZE = 500 * 1024 * 1024;
      this.ocrStore = localforage.createInstance({
        name: "manga-flow",
        storeName: "ocr-cache"
      });
      this.translationStore = localforage.createInstance({
        name: "manga-flow",
        storeName: "translation-cache"
      });
      this.cleanup();
    }
    // ===== OCR 缓存 =====
    /**
     * 获取 OCR 缓存
     * @param imageSrc 图片 URL
     * @param ocrEngine OCR 引擎类型
     */
    async getOCR(imageSrc, ocrEngine) {
      try {
        const hash = await this.getImageHash(imageSrc);
        const key = `${hash}_${ocrEngine}`;
        const entry = await this.ocrStore.getItem(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
          await this.ocrStore.removeItem(key);
          return null;
        }
        console.log(`[MangaFlow] 📦 OCR 缓存命中 (${ocrEngine})`);
        return entry.ocrResult;
      } catch (error) {
        console.warn("[MangaFlow] OCR 缓存读取失败:", error);
        return null;
      }
    }
    /**
     * 设置 OCR 缓存
     */
    async setOCR(imageSrc, ocrEngine, ocrResult) {
      try {
        const hash = await this.getImageHash(imageSrc);
        const key = `${hash}_${ocrEngine}`;
        const entry = {
          imageHash: hash,
          timestamp: Date.now(),
          ocrEngine,
          ocrResult
        };
        await this.ocrStore.setItem(key, entry);
      } catch (error) {
        console.warn("[MangaFlow] OCR 缓存写入失败:", error);
      }
    }
    // ===== 翻译缓存 =====
    /**
     * 获取翻译缓存
     * @param imageSrc 图片 URL
     * @param translateEngine 翻译引擎
     */
    async getTranslation(imageSrc, translateEngine) {
      try {
        const hash = await this.getImageHash(imageSrc);
        const key = `${hash}_${translateEngine}`;
        const entry = await this.translationStore.getItem(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.CACHE_EXPIRY) {
          await this.translationStore.removeItem(key);
          return null;
        }
        console.log(`[MangaFlow] 📦 翻译缓存命中 (${translateEngine})`);
        return entry.translations;
      } catch (error) {
        console.warn("[MangaFlow] 翻译缓存读取失败:", error);
        return null;
      }
    }
    /**
     * 设置翻译缓存
     */
    async setTranslation(imageSrc, translateEngine, translations) {
      try {
        const hash = await this.getImageHash(imageSrc);
        const key = `${hash}_${translateEngine}`;
        const entry = {
          imageHash: hash,
          timestamp: Date.now(),
          translateEngine,
          translations
        };
        await this.translationStore.setItem(key, entry);
      } catch (error) {
        console.warn("[MangaFlow] 翻译缓存写入失败:", error);
      }
    }
    // ===== 通用方法 =====
    /**
     * 计算图片哈希
     */
    async getImageHash(imageSrc) {
      const encoder = new TextEncoder();
      const data = encoder.encode(imageSrc);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8ClampedArray(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16);
    }
    /**
     * 清理过期缓存
     */
    async cleanup() {
      try {
        const now = Date.now();
        let removedCount = 0;
        const ocrKeysToRemove = [];
        await this.ocrStore.iterate((value, key) => {
          if (now - value.timestamp > this.CACHE_EXPIRY) {
            ocrKeysToRemove.push(key);
          }
        });
        for (const key of ocrKeysToRemove) {
          await this.ocrStore.removeItem(key);
        }
        removedCount += ocrKeysToRemove.length;
        const transKeysToRemove = [];
        await this.translationStore.iterate((value, key) => {
          if (now - value.timestamp > this.CACHE_EXPIRY) {
            transKeysToRemove.push(key);
          }
        });
        for (const key of transKeysToRemove) {
          await this.translationStore.removeItem(key);
        }
        removedCount += transKeysToRemove.length;
        if (removedCount > 0) {
          console.log(`[MangaFlow] 清理了 ${removedCount} 条过期缓存`);
        }
      } catch (error) {
        console.warn("[MangaFlow] 缓存清理失败:", error);
      }
    }
    /**
     * 清空所有缓存
     */
    async clear() {
      await this.ocrStore.clear();
      await this.translationStore.clear();
      console.log("[MangaFlow] 缓存已清空");
    }
    /**
     * 获取缓存大小（估算）
     */
    async getSize() {
      let ocrSize = 0;
      let transSize = 0;
      await this.ocrStore.iterate((value) => {
        ocrSize += JSON.stringify(value).length;
      });
      await this.translationStore.iterate((value) => {
        transSize += JSON.stringify(value).length;
      });
      return {
        ocr: ocrSize,
        translation: transSize,
        total: ocrSize + transSize
      };
    }
  }
  class TextFilter {
    constructor() {
      this.watermarkStrongKeywords = [
        "NEWTOKI",
        "NEW TOKI",
        "NEWTOKI469",
        "뉴토끼",
        "웹툰왕국",
        "웹툰 왕국"
      ];
      this.watermarkWeakKeywords = [
        "웹툰",
        "만화",
        "무료",
        "빠른",
        "사이트",
        "제공"
      ];
      this.urlPattern = /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|\.gg\b|\.me\b|\.to\b|\.kr\b|\.jp\b|\.cn\b/i;
      this.onomatopoeiaPatterns = [
        // 韩文拟声词（重复形态）
        /^([가-힣])\1{1,3}$/,
        /^([가-힣]{2})\1{1,2}$/,
        /^([가-힣]{3})\1$/,
        /^[ㄱ-ㅎ]{2,}$/,
        /^[ㅏ-ㅣ]{2,}$/,
        /^[ㅋㅎ]{2,}$/,
        /^(쿵쿵|두근두근|부릉|쾅쾅|쾅|팍|퍽|퍽퍽)+$/i,
        // 日文拟声词
        /^[ァ-ヴー]{1,6}$/,
        /^(ドキドキ|バキバキ|ゴゴゴゴ|ズキズキ|ガタンゴトン|ドン)+$/,
        // 英文拟声词
        /^(haha|hehe|lol|wow|boom|bang|crash|splash)+$/i
      ];
      this.decorativePatterns = [
        /^[!?？！…。，、；：]+$/,
        /^[★☆◆◇■□●○△▽]+$/,
        /^[~—-]+$/,
        /^\.{2,}$/
      ];
    }
    // 判断是否需要翻译
    shouldTranslate(text, bbox) {
      return this.classify(text, bbox).keep;
    }
    // 过滤分类（用于组内保护策略）
    classify(text, bbox) {
      const trimmedText = text.trim();
      const area = (bbox.x1 - bbox.x0) * (bbox.y1 - bbox.y0);
      const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(trimmedText);
      if (!trimmedText) return { keep: false, reason: "empty", hardDrop: false };
      if (/^\s+$/.test(trimmedText)) return { keep: false, reason: "blank", hardDrop: false };
      if (/^\d+$/.test(trimmedText)) return { keep: false, reason: "digits", hardDrop: false };
      if (this.isWatermark(trimmedText)) return { keep: false, reason: "watermark", hardDrop: true };
      if (this.isOnomatopoeia(trimmedText)) return { keep: false, reason: "onomatopoeia", hardDrop: true };
      if (this.isDecorative(trimmedText)) return { keep: false, reason: "decorative", hardDrop: false };
      if (!isCjk && trimmedText.length <= 1) {
        return { keep: false, reason: "short", hardDrop: false };
      }
      if (!isCjk && area < 300) {
        return { keep: false, reason: "small", hardDrop: false };
      }
      if (isCjk && trimmedText.length <= 2 && area < 120) {
        return { keep: false, reason: "small", hardDrop: false };
      }
      return { keep: true, reason: "ok", hardDrop: false };
    }
    // 水印/广告检测
    isWatermark(text) {
      if (this.urlPattern.test(text)) return true;
      const upper = text.toUpperCase();
      if (this.watermarkStrongKeywords.some((keyword) => upper.includes(keyword.toUpperCase()))) return true;
      const weakHitCount = this.watermarkWeakKeywords.filter((keyword) => upper.includes(keyword.toUpperCase())).length;
      const hasDigits = /\d{2,}/.test(text);
      return weakHitCount >= 2 && hasDigits;
    }
    // 检测是否为拟声词
    isOnomatopoeia(text) {
      return this.onomatopoeiaPatterns.some((pattern) => pattern.test(text));
    }
    // 检测是否为装饰文字
    isDecorative(text) {
      return this.decorativePatterns.some((pattern) => pattern.test(text));
    }
  }
  class TextDetector {
    async detect(image, options = {}) {
      const maxSize = options.maxSize ?? 900;
      const minWidth = options.minWidth ?? 20;
      const minHeight = options.minHeight ?? 12;
      const minArea = options.minArea ?? 200;
      const maxRegions = options.maxRegions ?? 40;
      const { canvas, scale } = await this.renderToCanvas(image, maxSize);
      const ctx = canvas.getContext("2d");
      let imageData;
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        console.warn("[MangaFlow] ROI 检测读取像素失败");
        return [];
      }
      const { width, height, data } = imageData;
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        gray[p] = 0.299 * r + 0.587 * g + 0.114 * b | 0;
      }
      const mag = new Float32Array(width * height);
      let sum = 0;
      let sumSq = 0;
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          const g00 = gray[idx - width - 1];
          const g01 = gray[idx - width];
          const g02 = gray[idx - width + 1];
          const g10 = gray[idx - 1];
          const g12 = gray[idx + 1];
          const g20 = gray[idx + width - 1];
          const g21 = gray[idx + width];
          const g22 = gray[idx + width + 1];
          const gx = -g00 - 2 * g10 - g20 + g02 + 2 * g12 + g22;
          const gy = -g00 - 2 * g01 - g02 + g20 + 2 * g21 + g22;
          const m = Math.abs(gx) + Math.abs(gy);
          mag[idx] = m;
          sum += m;
          sumSq += m * m;
        }
      }
      const count = (width - 2) * (height - 2);
      const mean = sum / Math.max(1, count);
      const variance = sumSq / Math.max(1, count) - mean * mean;
      const std = Math.sqrt(Math.max(0, variance));
      const threshold = mean + std * 0.6;
      const edge = new Uint8Array(width * height);
      for (let i = 0; i < mag.length; i++) {
        if (mag[i] > threshold) edge[i] = 1;
      }
      let dilated = edge;
      for (let iter = 0; iter < 2; iter++) {
        const next = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (dilated[idx]) {
              next[idx] = 1;
              next[idx - 1] = 1;
              next[idx + 1] = 1;
              next[idx - width] = 1;
              next[idx + width] = 1;
            }
          }
        }
        dilated = next;
      }
      const visited = new Uint8Array(width * height);
      const boxes = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (!dilated[idx] || visited[idx]) continue;
          let minX = x, maxX = x, minY = y, maxY = y;
          const qx = [x];
          const qy = [y];
          visited[idx] = 1;
          while (qx.length) {
            const cx = qx.pop();
            const cy = qy.pop();
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
                const nidx = ny * width + nx;
                if (dilated[nidx] && !visited[nidx]) {
                  visited[nidx] = 1;
                  qx.push(nx);
                  qy.push(ny);
                }
              }
            }
          }
          const bw = maxX - minX + 1;
          const bh = maxY - minY + 1;
          const area = bw * bh;
          if (bw < minWidth || bh < minHeight || area < minArea) continue;
          boxes.push({ x0: minX, y0: minY, x1: maxX, y1: maxY });
        }
      }
      const merged = this.mergeBoxes(boxes);
      const sorted = merged.sort((a, b) => {
        const areaA = (a.x1 - a.x0) * (a.y1 - a.y0);
        const areaB = (b.x1 - b.x0) * (b.y1 - b.y0);
        return areaB - areaA;
      }).slice(0, maxRegions);
      const scaleBack = scale;
      const expanded = sorted.map((b) => this.expandBox({
        x0: Math.round(b.x0 * scaleBack),
        y0: Math.round(b.y0 * scaleBack),
        x1: Math.round(b.x1 * scaleBack),
        y1: Math.round(b.y1 * scaleBack)
      }, scaleBack));
      if (options.debug) {
        this.drawDebugBoxes(image, expanded, options.debugLabel || "ROI");
      }
      return expanded;
    }
    // 合并相近/重叠的框
    mergeBoxes(boxes) {
      const merged = [];
      for (const box of boxes) {
        let mergedToExisting = false;
        for (const m of merged) {
          if (this.shouldMerge(m, box)) {
            m.x0 = Math.min(m.x0, box.x0);
            m.y0 = Math.min(m.y0, box.y0);
            m.x1 = Math.max(m.x1, box.x1);
            m.y1 = Math.max(m.y1, box.y1);
            mergedToExisting = true;
            break;
          }
        }
        if (!mergedToExisting) merged.push({ ...box });
      }
      return merged;
    }
    shouldMerge(a, b) {
      const ax = a.x1 - a.x0;
      const ay = a.y1 - a.y0;
      const bx = b.x1 - b.x0;
      const by = b.y1 - b.y0;
      const horizGap = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1));
      const vertGap = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
      const maxH = Math.max(ay, by);
      const maxW = Math.max(ax, bx);
      return horizGap < maxW * 0.35 && vertGap < maxH * 0.6;
    }
    expandBox(box, scale) {
      const pad = Math.max(4, Math.round(6 * (scale / 1)));
      return {
        x0: Math.max(0, box.x0 - pad),
        y0: Math.max(0, box.y0 - pad),
        x1: box.x1 + pad,
        y1: box.y1 + pad
      };
    }
    async renderToCanvas(image, maxSize) {
      const width = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
      const height = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
      const maxDim = Math.max(width, height);
      const scale = maxDim > maxSize ? maxDim / maxSize : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width / scale);
      canvas.height = Math.round(height / scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        ctx.getImageData(0, 0, 1, 1);
        return { canvas, scale };
      } catch {
        if (image instanceof HTMLImageElement) {
          const base64 = await this.fetchImageViaProxy(image.src);
          const proxyImg = await this.loadImageFromBase64(base64);
          canvas.width = Math.round(proxyImg.naturalWidth / scale);
          canvas.height = Math.round(proxyImg.naturalHeight / scale);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(proxyImg, 0, 0, canvas.width, canvas.height);
        }
        return { canvas, scale };
      }
    }
    async fetchImageViaProxy(imageUrl) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "FETCH_IMAGE", imageUrl },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if ((response == null ? void 0 : response.success) && response.imageData) {
              resolve(response.imageData);
            } else {
              reject(new Error((response == null ? void 0 : response.error) || "获取图片失败"));
            }
          }
        );
      });
    }
    loadImageFromBase64(base64) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = base64;
      });
    }
    drawDebugBoxes(image, boxes, labelPrefix) {
      DebugOverlayManager.getInstance().setRoiBoxes(image, boxes, labelPrefix);
    }
    clearDebugBoxes() {
      DebugOverlayManager.getInstance().clearRoiBoxes();
    }
  }
  class TranslationController {
    constructor() {
      this.isPaused = false;
      this.settings = null;
      this.ocrEngine = new OCREngine();
      this.translator = new Translator();
      this.imageProcessor = new ImageProcessor();
      this.renderer = new Renderer();
      this.cacheManager = new CacheManager();
      this.textFilter = new TextFilter();
      this.textDetector = new TextDetector();
      this.debugOverlay = DebugOverlayManager.getInstance();
    }
    // 批量翻译图片
    async translateImages(images, onProgress) {
      var _a, _b;
      await this.loadSettings();
      this.ocrEngine.configure(this.settings || {});
      if (((_a = this.settings) == null ? void 0 : _a.ocrEngine) !== "cloud") {
        await this.ocrEngine.initLocal(((_b = this.settings) == null ? void 0 : _b.sourceLang) || "ko");
      }
      const total = images.length;
      const batchSize = 3;
      let successCount = 0;
      let failedCount = 0;
      for (let i = 0; i < images.length; i += batchSize) {
        if (this.isPaused) break;
        const batch = images.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (img, batchIndex) => {
            const index = i + batchIndex;
            await this.translateSingleImage(img);
            onProgress == null ? void 0 : onProgress({
              current: index + 1,
              total,
              status: "processing"
            });
          })
        );
        for (const result of results) {
          if (result.status === "fulfilled") {
            successCount++;
          } else {
            failedCount++;
            console.error("[MangaFlow] 图片翻译失败:", result.reason);
          }
        }
      }
      onProgress == null ? void 0 : onProgress({
        current: total,
        total,
        status: this.isPaused ? "pending" : "completed"
      });
      if (failedCount === 0) {
        showToast(`翻译完成：${successCount} 张图片`, "success");
      } else if (successCount === 0) {
        showToast(`翻译失败：所有 ${failedCount} 张图片都失败了`, "error");
      } else {
        showToast(`翻译完成：${successCount} 张成功，${failedCount} 张失败`, "warning");
      }
      return { success: successCount, failed: failedCount };
    }
    // 翻译单张图片
    async translateSingleImage(img) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
      if (!this.settings) {
        await this.loadSettings();
      }
      this.ocrEngine.configure(this.settings || {});
      const sourceLang = ((_a = this.settings) == null ? void 0 : _a.sourceLang) || "ko";
      const targetLang = ((_b = this.settings) == null ? void 0 : _b.targetLang) || "zh";
      const devMode = ((_c = this.settings) == null ? void 0 : _c.devMode) ?? true;
      const devPhase = devMode ? ((_d = this.settings) == null ? void 0 : _d.devPhase) || "full" : "full";
      const showOcrBoxes = devMode ? ((_e = this.settings) == null ? void 0 : _e.showOcrBoxes) ?? true : false;
      const showRoiBoxes = devMode ? ((_f = this.settings) == null ? void 0 : _f.showRoiBoxes) ?? true : false;
      const showMaskBoxes = devMode ? ((_g = this.settings) == null ? void 0 : _g.showMaskBoxes) ?? false : false;
      this.debugOverlay.setEnabled(devMode);
      this.debugOverlay.setShowFlags({
        ocr: showOcrBoxes,
        roi: showRoiBoxes,
        mask: showMaskBoxes
      });
      this.ocrEngine.setDebugMode(devMode);
      const originalSrc = this.getOriginalSrc(img);
      if (img.dataset.mfTranslated === "1") {
        console.log(`[MangaFlow] 已翻译，跳过: ${originalSrc.substring(originalSrc.lastIndexOf("/") + 1)}`);
        return;
      }
      img.dataset.mfOriginalSrc = originalSrc;
      const imgSrc = originalSrc;
      const imgName = imgSrc.substring(imgSrc.lastIndexOf("/") + 1);
      console.log(`[MangaFlow] 🔄 开始处理: ${imgName}`);
      console.log(`[MangaFlow] 📍 语言: ${sourceLang} → ${targetLang}`);
      const roiStartTime = Date.now();
      const roiRegions = await this.textDetector.detect(img, {
        debug: devMode,
        debugLabel: `${imgName}-ROI`
      });
      const roiDuration = Date.now() - roiStartTime;
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      const imgArea = Math.max(1, imgW * imgH);
      const roiArea = roiRegions.reduce((sum, r) => sum + Math.max(0, (r.x1 - r.x0) * (r.y1 - r.y0)), 0);
      const roiCoverage = roiArea / imgArea;
      console.log(`[MangaFlow] ✂️ ${imgName} ROI 检测完成 (${roiDuration}ms)，候选区域: ${roiRegions.length}，覆盖率 ${(roiCoverage * 100).toFixed(1)}%`);
      if (showOcrBoxes && roiRegions.length) {
        console.group(`[MangaFlow] 🟧 ${imgName} ROI 区域列表`);
        roiRegions.forEach((r, i) => {
          console.log(`  [${i + 1}] bbox: ${r.x0},${r.y0},${r.x1},${r.y1}`);
        });
        console.groupEnd();
      }
      const minRoiCoverage = 0.02;
      const useRoi = roiRegions.length > 0 && roiCoverage >= minRoiCoverage;
      if (!useRoi && roiRegions.length > 0) {
        console.log(`[MangaFlow] ⚠️ ROI 覆盖过低，回退全图 OCR（覆盖率 ${(roiCoverage * 100).toFixed(1)}%）`);
      }
      if (devMode && devPhase === "roi") {
        console.log("[MangaFlow] 🛑 阶段 A：仅 ROI 检测，跳过 OCR/翻译/渲染");
        return;
      }
      const ocrStartTime = Date.now();
      let ocrResult = null;
      const ocrEngine = ((_h = this.settings) == null ? void 0 : _h.ocrEngine) || "local";
      const allowOcrCache = !(devMode && (devPhase === "roi" || devPhase === "ocr"));
      const cachedOcr = allowOcrCache ? await this.cacheManager.getOCR(imgSrc, ocrEngine) : null;
      if (cachedOcr) {
        console.log(`[MangaFlow] 📦 OCR 缓存命中 (${ocrEngine})`);
        ocrResult = cachedOcr;
      } else {
        const usedRegions = useRoi;
        if (useRoi) {
          ocrResult = await this.ocrEngine.recognizeRegions(
            img,
            roiRegions,
            sourceLang,
            devMode,
            imgName
          );
        } else {
          ocrResult = await this.ocrEngine.recognize(img, sourceLang, devMode, imgName);
        }
        await this.cacheManager.setOCR(imgSrc, ocrEngine, ocrResult);
        if (usedRegions && ((_i = ocrResult == null ? void 0 : ocrResult.blocks) == null ? void 0 : _i.length)) {
          this.ocrEngine.logBlocks(ocrResult.blocks, `${imgName}: OCR 识别结果`);
        }
      }
      if (cachedOcr && ((_j = ocrResult == null ? void 0 : ocrResult.blocks) == null ? void 0 : _j.length)) {
        this.ocrEngine.logBlocks(ocrResult.blocks, `${imgName}: OCR 缓存结果`);
        this.ocrEngine.drawDebugBoxesFor(img, ocrResult.blocks, devMode);
      }
      const ocrDuration = Date.now() - ocrStartTime;
      if (!ocrResult || !ocrResult.blocks.length) {
        console.log(`[MangaFlow] ⚠️ ${imgName}: 未检测到有效文字`);
        return;
      }
      console.log(`[MangaFlow] ✅ ${imgName}: OCR 完成 (${ocrDuration}ms)，共 ${ocrResult.blocks.length} 个文本块`);
      if (devMode && devPhase === "ocr") {
        console.log("[MangaFlow] 🛑 阶段 B：OCR 完成，跳过翻译/渲染");
        return;
      }
      const decisions = ocrResult.blocks.map(
        (block) => this.textFilter.classify(block.text, block.bbox)
      );
      const keptBlocks = [];
      const softDropped = [];
      ocrResult.blocks.forEach((block, index) => {
        const decision = decisions[index];
        if (decision.keep) {
          keptBlocks.push(block);
          return;
        }
        if (decision.hardDrop) return;
        softDropped.push({ block, reason: decision.reason });
      });
      if (keptBlocks.length && softDropped.length) {
        softDropped.filter((item) => item.reason === "short" || item.reason === "small").forEach((item) => {
          const nearKept = keptBlocks.some((kept) => this.isNearBlock(kept, item.block));
          if (nearKept) {
            keptBlocks.push(item.block);
          }
        });
      }
      const filteredBlocks = this.applyContextualFilters(keptBlocks, ocrResult.blocks);
      if (!filteredBlocks.length) {
        console.log(`[MangaFlow] ⚠️ ${imgName}: 过滤后无需翻译的文本`);
        return;
      }
      const groups = this.filterGroupsForTranslation(
        this.groupTextBlocks(filteredBlocks),
        ocrResult.blocks
      );
      const engine = ((_k = this.settings) == null ? void 0 : _k.translateEngine) || "google";
      console.log(`[MangaFlow] 🌐 翻译中... (引擎: ${engine}, 共 ${groups.length} 条)`);
      const translateStartTime = Date.now();
      const textsToTranslate = groups.map((group) => group.text);
      let translations;
      try {
        const cachedTrans = await this.cacheManager.getTranslation(imgSrc, engine);
        if (cachedTrans && cachedTrans.length === textsToTranslate.length && cachedTrans.every((t, i) => t.original === textsToTranslate[i])) {
          console.log(`[MangaFlow] 📦 翻译缓存命中 (${engine})`);
          translations = cachedTrans.map((t) => t.translated);
        } else {
          const results = await this.translator.translateBatch(
            textsToTranslate,
            sourceLang,
            targetLang
          );
          translations = results.map((r) => r.translated);
          await this.cacheManager.setTranslation(
            imgSrc,
            engine,
            results.map((r) => ({ original: r.original, translated: r.translated }))
          );
        }
      } catch (error) {
        console.error(`[MangaFlow] ❌ 批量翻译失败:`, error);
        translations = textsToTranslate.map(() => `[翻译失败: ${error.message}]`);
      }
      const translateDuration = Date.now() - translateStartTime;
      console.group(`[MangaFlow] 📝 ${imgName} - 翻译结果`);
      console.log(`引擎: ${engine} | OCR: ${ocrDuration}ms | 翻译: ${translateDuration}ms`);
      console.log("─".repeat(50));
      groups.forEach((group, i) => {
        console.log(`[${i + 1}] 原文: "${group.text}"`);
        console.log(`    译文: "${translations[i]}"`);
        console.log("");
      });
      console.groupEnd();
      if (devMode && devPhase === "translate") {
        console.log("[MangaFlow] 🛑 阶段 C：翻译完成，跳过渲染");
        return;
      }
      console.log(`[MangaFlow] 🎨 渲染中...`);
      const renderGroups = this.buildRenderGroups(groups, translations);
      const activeGroups = renderGroups.filter((g) => g.text && !g.text.startsWith("[翻译失败"));
      if (!activeGroups.length) {
        console.log(`[MangaFlow] ⚠️ ${imgName}: 无有效译文，跳过渲染`);
        return;
      }
      const { canvas, analysis } = await this.imageProcessor.processImage(img, activeGroups);
      if (devMode) {
        const maskBoxes = analysis.map((item) => item.maskBox);
        if (maskBoxes.length) {
          this.debugOverlay.setMaskBoxes(img, maskBoxes);
        }
      }
      const fontScale = ((_l = this.settings) == null ? void 0 : _l.fontScale) ?? (((_m = this.settings) == null ? void 0 : _m.fontSize) ? this.settings.fontSize / 14 : 1);
      this.renderer.render(canvas, activeGroups, analysis, {
        fontSize: ((_n = this.settings) == null ? void 0 : _n.fontSize) || 14,
        fontScale,
        fontColor: ((_o = this.settings) == null ? void 0 : _o.fontColor) || "#000000",
        maskOpacity: (_p = this.settings) == null ? void 0 : _p.maskOpacity,
        fontFamily: "Arial, sans-serif"
      });
      try {
        const renderedImage = canvas.toDataURL("image/png");
        img.src = renderedImage;
        img.dataset.mfTranslated = "1";
        console.log(`[MangaFlow] ✅ ${imgName}: 翻译完成！`);
      } catch (error) {
        console.error(`[MangaFlow] ❌ ${imgName}: 导出失败`, error);
        if (error.message.includes("Tainted")) {
          throw new Error(`跨域图片无法导出: ${imgName}`);
        }
        throw error;
      }
    }
    async clearCache() {
      await this.cacheManager.clear();
    }
    updateSettings(settings) {
      this.settings = settings;
    }
    // 加载设置
    async loadSettings() {
      var _a;
      if (!((_a = chrome == null ? void 0 : chrome.runtime) == null ? void 0 : _a.id)) {
        throw new Error("扩展上下文已失效");
      }
      try {
        const result = await chrome.storage.local.get("settings");
        this.settings = result.settings;
      } catch (error) {
        console.error("[MangaFlow] 读取设置失败:", error);
        showToast("扩展已更新/重载，请刷新页面", "warning");
        throw error;
      }
    }
    getOriginalSrc(img) {
      const dataSrc = img.dataset.mfOriginalSrc || img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src") || img.getAttribute("data-lazy") || img.getAttribute("data-srcset");
      if (dataSrc && !dataSrc.startsWith("data:image")) {
        return dataSrc;
      }
      return img.src || "";
    }
    isNearBlock(a, b) {
      const ax = a.bbox.x1 - a.bbox.x0;
      const ay = a.bbox.y1 - a.bbox.y0;
      const bx = b.bbox.x1 - b.bbox.x0;
      const by = b.bbox.y1 - b.bbox.y0;
      const vGap = Math.max(0, Math.max(a.bbox.y0 - b.bbox.y1, b.bbox.y0 - a.bbox.y1));
      const hGap = Math.max(0, Math.max(a.bbox.x0 - b.bbox.x1, b.bbox.x0 - a.bbox.x1));
      const maxH = Math.max(ay, by);
      const maxW = Math.max(ax, bx);
      return vGap < maxH * 0.6 && hGap < maxW * 0.5;
    }
    buildRenderGroups(groups, translations) {
      return groups.map((group, index) => ({
        bbox: group.bbox,
        text: translations[index] || "",
        blocks: group.blocks
      }));
    }
    filterGroupsForTranslation(groups, allBlocks) {
      if (!groups.length) return groups;
      const { medianArea } = this.computeMedianStats(allBlocks);
      return groups.filter((group) => {
        const compact = group.text.replace(/\s+/g, "");
        const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(compact);
        const isUpper = /^[A-Z]{2,6}$/.test(compact);
        const isShort = isCjk ? compact.length <= 3 : compact.length <= 4;
        const groupArea = (group.bbox.x1 - group.bbox.x0) * (group.bbox.y1 - group.bbox.y0);
        if (isUpper && groupArea > medianArea * 1.2) {
          return false;
        }
        if (isShort && group.blocks.length <= 2 && groupArea > medianArea * 1.6) {
          return false;
        }
        return true;
      });
    }
    applyContextualFilters(keptBlocks, allBlocks) {
      if (!keptBlocks.length) return [];
      const { medianArea, medianHeight } = this.computeMedianStats(allBlocks);
      return keptBlocks.filter((block) => {
        const text = block.text.trim();
        const compact = text.replace(/\s+/g, "");
        const area = (block.bbox.x1 - block.bbox.x0) * (block.bbox.y1 - block.bbox.y0);
        const height = block.bbox.y1 - block.bbox.y0;
        const width = block.bbox.x1 - block.bbox.x0;
        const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
        const isUpper = /^[A-Z]{2,6}$/.test(compact);
        const isShort = compact.length <= 3;
        const isLarge = area > medianArea * 2.6 || height > medianHeight * 1.7;
        const isolated = !keptBlocks.some((other) => other !== block && this.isNearBlock(other, block));
        const aspect = width > 0 && height > 0 ? Math.max(width / height, height / width) : 1;
        const edgeDensity = this.estimateEdgeDensity(allBlocks, block);
        if (isCjk && isShort && isLarge && isolated) {
          console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: "${text}"`);
          return false;
        }
        if (!isCjk && isShort && isolated && isLarge) {
          console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: "${text}"`);
          return false;
        }
        if (isUpper && isolated && area > medianArea * 1.2) {
          console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: "${text}"`);
          return false;
        }
        if (isShort && isolated && aspect >= 2.4 && area > medianArea * 1.8) {
          console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: "${text}"`);
          return false;
        }
        if (isShort && isolated && edgeDensity >= 0.2 && area > medianArea * 1.2) {
          console.log(`[MangaFlow] ⚠️ 拟声词/装饰过滤: "${text}"`);
          return false;
        }
        return true;
      });
    }
    computeMedianStats(blocks) {
      if (!blocks.length) return { medianArea: 1, medianHeight: 1 };
      const areas = blocks.map((b) => (b.bbox.x1 - b.bbox.x0) * (b.bbox.y1 - b.bbox.y0)).sort((a, b) => a - b);
      const heights = blocks.map((b) => b.bbox.y1 - b.bbox.y0).sort((a, b) => a - b);
      const mid = Math.floor(areas.length / 2);
      const medianArea = areas[mid] || areas[0];
      const medianHeight = heights[mid] || heights[0];
      return { medianArea, medianHeight };
    }
    estimateEdgeDensity(blocks, block) {
      const width = block.bbox.x1 - block.bbox.x0;
      const height = block.bbox.y1 - block.bbox.y0;
      if (width <= 0 || height <= 0) return 0;
      const aspect = Math.max(width / height, height / width);
      if (aspect >= 2.8) return 0.25;
      return 0.08;
    }
    // 暂停
    pause() {
      this.isPaused = true;
    }
    // 继续
    resume() {
      this.isPaused = false;
    }
    // 文本块聚类（按气泡/段落合并）
    groupTextBlocks(blocks) {
      if (blocks.length <= 1) {
        return blocks.map((block) => ({
          bbox: block.bbox,
          blocks: [block],
          text: block.text,
          confidence: block.confidence
        }));
      }
      const { medianArea, medianHeight } = this.computeMedianStats(blocks);
      const sorted = [...blocks].sort((a, b) => a.bbox.y0 - b.bbox.y0);
      const blockMeta = sorted.map((block) => {
        const width = block.bbox.x1 - block.bbox.x0;
        const height = block.bbox.y1 - block.bbox.y0;
        const area = Math.max(1, width * height);
        const text = block.text.trim();
        const compact = text.replace(/\s+/g, "");
        const isCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
        const isUpper = /^[A-Z]{2,6}$/.test(compact);
        const isShort = compact.length <= (isCjk ? 2 : 4);
        const aspect = width > 0 && height > 0 ? Math.max(width / height, height / width) : 1;
        const isDecorativeLike = isShort && area > medianArea * 1.6 && (height > medianHeight * 1.4 || aspect >= 2.4) || isUpper && area > medianArea * 1.2;
        return { width, height, area, isDecorativeLike };
      });
      const n = sorted.length;
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
      };
      const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[rb] = ra;
      };
      const isClose = (a, b, metaA, metaB) => {
        const bh = metaB.height;
        const ah = metaA.height;
        const vGap = Math.max(0, Math.max(a.bbox.y0 - b.bbox.y1, b.bbox.y0 - a.bbox.y1));
        const hGap = Math.max(0, Math.max(a.bbox.x0 - b.bbox.x1, b.bbox.x0 - a.bbox.x1));
        const maxH = Math.max(ah, bh);
        const maxW = Math.max(metaA.width, metaB.width);
        const overlap = Math.max(0, Math.min(a.bbox.x1, b.bbox.x1) - Math.max(a.bbox.x0, b.bbox.x0));
        const minW = Math.max(1, Math.min(metaA.width, metaB.width));
        const overlapRatio = overlap / minW;
        const isDecorPair = metaA.isDecorativeLike || metaB.isDecorativeLike;
        if (metaA.isDecorativeLike !== metaB.isDecorativeLike) {
          return false;
        }
        if (isDecorPair) {
          const nearVertDecor = vGap < Math.min(maxH * 0.4, medianHeight * 0.6);
          const nearHorizDecor = overlapRatio >= 0.5 || hGap < maxW * 0.2;
          return nearVertDecor && nearHorizDecor;
        }
        const nearVert = vGap < Math.min(maxH * 0.7, medianHeight * 0.9);
        const nearHoriz = overlapRatio >= 0.3 || hGap < maxW * 0.3;
        return nearVert && nearHoriz;
      };
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (isClose(sorted[i], sorted[j], blockMeta[i], blockMeta[j])) {
            union(i, j);
          }
        }
      }
      const groupMap = /* @__PURE__ */ new Map();
      for (let i = 0; i < n; i++) {
        const root = find(i);
        const block = sorted[i];
        const existing = groupMap.get(root);
        if (!existing) {
          groupMap.set(root, { bbox: { ...block.bbox }, blocks: [block] });
        } else {
          existing.blocks.push(block);
          existing.bbox = {
            x0: Math.min(existing.bbox.x0, block.bbox.x0),
            y0: Math.min(existing.bbox.y0, block.bbox.y0),
            x1: Math.max(existing.bbox.x1, block.bbox.x1),
            y1: Math.max(existing.bbox.y1, block.bbox.y1)
          };
        }
      }
      return Array.from(groupMap.values()).map((g) => {
        const sortedBlocks = g.blocks.sort((a, b) => {
          if (a.bbox.y0 === b.bbox.y0) return a.bbox.x0 - b.bbox.x0;
          return a.bbox.y0 - b.bbox.y0;
        });
        const text = sortedBlocks.map((b) => b.text).join("\n");
        const confidence = sortedBlocks.reduce((sum, b) => sum + b.confidence, 0) / sortedBlocks.length;
        return { text, bbox: g.bbox, confidence, blocks: sortedBlocks };
      });
    }
  }
  class MangaFlow {
    // 已翻译的图片
    constructor() {
      this.floatingBall = null;
      this.settingsPanel = null;
      this.imageDetector = null;
      this.translationController = null;
      this.isInitialized = false;
      this.isTranslating = false;
      this.translatedImages = /* @__PURE__ */ new Set();
      this.init();
    }
    async init() {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.setup());
      } else {
        await this.setup();
      }
    }
    async setup() {
      if (this.isInitialized) return;
      this.isInitialized = true;
      console.log("漫译 MangaFlow 初始化中...");
      this.floatingBall = new FloatingBall({
        onStart: () => this.startTranslation(),
        onPause: () => this.pauseTranslation(),
        onSettings: () => this.openSettings()
      });
      this.settingsPanel = new SettingsPanel({
        onSave: (settings) => this.saveSettings(settings),
        onClose: () => {
          console.log("[MangaFlow] 设置面板已关闭");
        }
      });
      this.imageDetector = new ImageDetector();
      this.translationController = new TranslationController();
      this.imageDetector.setOnNewImage((img) => {
        this.onNewImageDetected(img);
      });
      this.floatingBall.mount();
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        var _a;
        if (message.type === "START_TRANSLATION") {
          this.startTranslation();
          sendResponse({ success: true });
        } else if (message.type === "OPEN_SETTINGS") {
          this.openSettings();
          sendResponse({ success: true });
        } else if (message.type === "CLEAR_CACHE") {
          (_a = this.translationController) == null ? void 0 : _a.clearCache().then(() => {
            this.translatedImages.clear();
            console.log("[MangaFlow] 缓存已清空（OCR/翻译）");
            sendResponse({ success: true });
          }).catch((error) => {
            console.error("[MangaFlow] 清除缓存失败:", error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }
        return true;
      });
      console.log("漫译 MangaFlow 初始化完成");
    }
    // 处理新检测到的图片（懒加载触发）
    async onNewImageDetected(img) {
      var _a;
      if (!this.isTranslating) return;
      const src2 = this.getOriginalSrc(img);
      if (!src2 || img.dataset.mfTranslated === "1" || this.translatedImages.has(src2)) return;
      console.log("[MangaFlow] 检测到新图片，自动翻译:", src2.substring(0, 50));
      this.translatedImages.add(src2);
      try {
        await ((_a = this.translationController) == null ? void 0 : _a.translateSingleImage(img));
      } catch (error) {
        console.error("[MangaFlow] 自动翻译失败:", error);
      }
    }
    async startTranslation() {
      var _a, _b, _c, _d, _e, _f;
      if (!this.imageDetector || !this.translationController) return;
      console.log("开始翻译...");
      this.isTranslating = true;
      (_a = this.floatingBall) == null ? void 0 : _a.setState("translating");
      try {
        const images = this.imageDetector.getComicImages().filter((img) => img.dataset.mfTranslated !== "1");
        console.log(`检测到 ${images.length} 张漫画图片`);
        if (images.length === 0) {
          (_b = this.floatingBall) == null ? void 0 : _b.setState("idle");
          return;
        }
        images.forEach((img) => this.translatedImages.add(this.getOriginalSrc(img)));
        const result = await this.translationController.translateImages(images, (progress) => {
          var _a2;
          (_a2 = this.floatingBall) == null ? void 0 : _a2.updateProgress(progress.current, progress.total);
        });
        if (result.failed === 0) {
          (_c = this.floatingBall) == null ? void 0 : _c.setState("completed");
        } else if (result.success === 0) {
          (_d = this.floatingBall) == null ? void 0 : _d.setState("error");
        } else {
          (_e = this.floatingBall) == null ? void 0 : _e.setState("completed");
        }
      } catch (error) {
        console.error("翻译失败:", error);
        (_f = this.floatingBall) == null ? void 0 : _f.setState("error");
      }
    }
    pauseTranslation() {
      var _a, _b;
      console.log("暂停翻译");
      this.isTranslating = false;
      (_a = this.translationController) == null ? void 0 : _a.pause();
      (_b = this.floatingBall) == null ? void 0 : _b.setState("paused");
    }
    getOriginalSrc(img) {
      const dataSrc = img.dataset.mfOriginalSrc || img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src") || img.getAttribute("data-lazy") || img.getAttribute("data-srcset");
      if (dataSrc && !dataSrc.startsWith("data:image")) {
        return dataSrc;
      }
      return img.src || "";
    }
    openSettings() {
      var _a;
      (_a = this.settingsPanel) == null ? void 0 : _a.show();
    }
    async saveSettings(settings) {
      var _a;
      await chrome.storage.local.set({ settings });
      console.log("设置已保存:", settings);
      DebugOverlayManager.getInstance().applySettings(settings);
      (_a = this.translationController) == null ? void 0 : _a.updateSettings(settings);
    }
  }
  new MangaFlow();
})();
//# sourceMappingURL=index.js.map
