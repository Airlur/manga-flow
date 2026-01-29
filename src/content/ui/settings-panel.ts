// 漫译 MangaFlow - 设置面板组件
// 黑白简洁风格的设置界面，支持多翻译引擎

import type { Settings } from '../../types';

interface SettingsPanelOptions {
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export class SettingsPanel {
  private element: HTMLElement | null = null;
  private options: SettingsPanelOptions;
  private isVisible = false;

  constructor(options: SettingsPanelOptions) {
    this.options = options;
    this.createElement();
  }

  private createElement(): void {
    this.element = document.createElement('div');
    this.element.id = 'manga-flow-settings';
    this.element.className = 'manga-flow-settings';
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
              <label for="mf-font-size">译文字体大小: <span id="mf-font-size-value">14</span>px</label>
              <input type="range" id="mf-font-size" min="10" max="24" value="14" />
            </div>
            <div class="manga-flow-settings__field">
              <label for="mf-font-color">译文字体颜色</label>
              <input type="color" id="mf-font-color" value="#000000" />
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
    this.bindEvents();
    this.loadSettings();
  }

  private bindEvents(): void {
    if (!this.element) return;

    // 关闭按钮
    const closeBtn = this.element.querySelector('.manga-flow-settings__close');
    const cancelBtn = this.element.querySelector('.manga-flow-settings__btn--cancel');
    const overlay = this.element.querySelector('.manga-flow-settings__overlay');

    closeBtn?.addEventListener('click', () => this.hide());
    cancelBtn?.addEventListener('click', () => this.hide());
    overlay?.addEventListener('click', () => this.hide());

    // 保存按钮
    const saveBtn = this.element.querySelector('.manga-flow-settings__btn--save');
    saveBtn?.addEventListener('click', () => this.save());

    // 测试按钮
    const testBtn = this.element.querySelector('#mf-test-btn');
    testBtn?.addEventListener('click', () => this.testService());

    // 翻译引擎切换
    const engineSelect = this.element.querySelector('#mf-translate-engine') as HTMLSelectElement;
    const testResult = this.element.querySelector('#mf-test-result') as HTMLElement;
    engineSelect?.addEventListener('change', () => {
      this.toggleEngineSettings(engineSelect.value);
      // 切换引擎时清除测试结果
      if (testResult) {
        testResult.textContent = '';
      }
    });

    // OCR 引擎切换
    const ocrSelect = this.element.querySelector('#mf-ocr-engine') as HTMLSelectElement;
    const cloudOcrField = this.element.querySelector('.manga-flow-settings__field--cloud-ocr') as HTMLElement;
    ocrSelect?.addEventListener('change', () => {
      cloudOcrField.style.display = ocrSelect.value === 'cloud' ? 'block' : 'none';
    });

    // 获取模型列表按钮
    const fetchModelsBtn = this.element.querySelector('#mf-fetch-models') as HTMLButtonElement;
    fetchModelsBtn?.addEventListener('click', () => this.fetchModelList());

    // 模型下拉框同步到手动输入框
    const modelSelect = this.element.querySelector('#mf-model-select') as HTMLSelectElement;
    const modelInput = this.element.querySelector('#mf-model') as HTMLInputElement;
    modelSelect?.addEventListener('change', () => {
      if (modelSelect.value) {
        modelInput.value = modelSelect.value;
      }
    });

    // 字体大小滑块
    const fontSizeInput = this.element.querySelector('#mf-font-size') as HTMLInputElement;
    const fontSizeValue = this.element.querySelector('#mf-font-size-value');
    fontSizeInput?.addEventListener('input', () => {
      if (fontSizeValue) fontSizeValue.textContent = fontSizeInput.value;
    });

    // 密码显示/隐藏按钮
    const togglePwdBtns = this.element.querySelectorAll('.manga-flow-settings__toggle-pwd');
    togglePwdBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = (btn as HTMLElement).dataset.target;
        if (!targetId) return;
        const input = this.element?.querySelector(`#${targetId}`) as HTMLInputElement;
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🔒';
        } else {
          input.type = 'password';
          btn.textContent = '👁';
        }
      });
    });
  }

  private toggleEngineSettings(engine: string): void {
    if (!this.element) return;

    const openaiSection = this.element.querySelector('.manga-flow-settings__section--openai') as HTMLElement;
    const deeplxSection = this.element.querySelector('.manga-flow-settings__section--deeplx') as HTMLElement;
    const deeplSection = this.element.querySelector('.manga-flow-settings__section--deepl') as HTMLElement;

    // 隐藏所有配置区域
    if (openaiSection) openaiSection.style.display = 'none';
    if (deeplxSection) deeplxSection.style.display = 'none';
    if (deeplSection) deeplSection.style.display = 'none';

    // 显示对应的配置区域
    switch (engine) {
      case 'openai':
        if (openaiSection) openaiSection.style.display = 'block';
        break;
      case 'deeplx':
        if (deeplxSection) deeplxSection.style.display = 'block';
        break;
      case 'deepl':
        if (deeplSection) deeplSection.style.display = 'block';
        break;
      // microsoft 和 google 不需要配置
    }
  }

  private async testService(): Promise<void> {
    if (!this.element) return;

    const resultEl = this.element.querySelector('#mf-test-result') as HTMLElement;
    const testBtn = this.element.querySelector('#mf-test-btn') as HTMLButtonElement;

    if (!resultEl || !testBtn) return;

    testBtn.disabled = true;
    resultEl.textContent = '测试中...';
    resultEl.style.color = '#666';

    try {
      // 获取当前设置
      const engine = (this.element.querySelector('#mf-translate-engine') as HTMLSelectElement).value;
      const testText = 'Hello';

      // 发送测试翻译请求
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_TRANSLATION',
        engine,
        text: testText,
        settings: this.getCurrentSettings(),
      });

      if (response?.success) {
        resultEl.textContent = `✓ 测试成功: "${response.translated}"`;
        resultEl.style.color = '#2e7d32';
      } else {
        resultEl.textContent = `✗ 测试失败: ${response?.error || '未知错误'}`;
        resultEl.style.color = '#c62828';
      }
    } catch (error) {
      resultEl.textContent = `✗ 测试失败: ${(error as Error).message}`;
      resultEl.style.color = '#c62828';
    } finally {
      testBtn.disabled = false;
    }
  }

  /**
   * 获取模型列表
   */
  private async fetchModelList(): Promise<void> {
    if (!this.element) return;

    const modelSelect = this.element.querySelector('#mf-model-select') as HTMLSelectElement;
    const fetchBtn = this.element.querySelector('#mf-fetch-models') as HTMLButtonElement;
    const apiBase = (this.element.querySelector('#mf-api-base') as HTMLInputElement).value;
    const apiKey = (this.element.querySelector('#mf-api-key') as HTMLInputElement).value;

    if (!modelSelect || !fetchBtn) return;

    if (!apiBase || !apiKey) {
      alert('请先填写 API 地址和 API Key');
      return;
    }

    fetchBtn.disabled = true;
    fetchBtn.textContent = '获取中...';

    try {
      const baseUrl = apiBase.replace(/\/$/, '');
      const response = await chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        url: `${baseUrl}/models`,
        options: {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        },
      });

      if (!response.success) {
        throw new Error(response.error || '获取模型列表失败');
      }

      const models = response.data?.data || [];

      // 清空并填充下拉框
      modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';

      if (models.length === 0) {
        modelSelect.innerHTML = '<option value="">-- 未找到模型 --</option>';
        return;
      }

      // 按模型ID排序
      models.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

      for (const model of models) {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        modelSelect.appendChild(option);
      }

      console.log(`[MangaFlow] 获取到 ${models.length} 个模型`);
    } catch (error) {
      console.error('[MangaFlow] 获取模型列表失败:', error);
      alert(`获取模型列表失败: ${(error as Error).message}`);
      modelSelect.innerHTML = '<option value="">-- 获取失败 --</option>';
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = '获取列表';
    }
  }

  private getCurrentSettings(): Partial<Settings> {
    if (!this.element) return {};

    return {
      translateEngine: (this.element.querySelector('#mf-translate-engine') as HTMLSelectElement).value as Settings['translateEngine'],
      apiBaseUrl: (this.element.querySelector('#mf-api-base') as HTMLInputElement).value,
      apiKey: (this.element.querySelector('#mf-api-key') as HTMLInputElement).value,
      model: (this.element.querySelector('#mf-model') as HTMLInputElement).value,
      deeplxUrl: (this.element.querySelector('#mf-deeplx-url') as HTMLInputElement).value,
      deeplApiKey: (this.element.querySelector('#mf-deepl-key') as HTMLInputElement).value,
    };
  }

  private async loadSettings(): Promise<void> {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as Settings | undefined;
    if (!settings || !this.element) return;

    // 填充设置值
    (this.element.querySelector('#mf-source-lang') as HTMLSelectElement).value = settings.sourceLang || 'ko';
    (this.element.querySelector('#mf-target-lang') as HTMLSelectElement).value = settings.targetLang || 'zh';
    (this.element.querySelector('#mf-translate-engine') as HTMLSelectElement).value = settings.translateEngine || 'microsoft';
    (this.element.querySelector('#mf-api-base') as HTMLInputElement).value = settings.apiBaseUrl || '';
    (this.element.querySelector('#mf-api-key') as HTMLInputElement).value = settings.apiKey || '';
    (this.element.querySelector('#mf-model') as HTMLInputElement).value = settings.model || 'gpt-4o-mini';
    (this.element.querySelector('#mf-deeplx-url') as HTMLInputElement).value = settings.deeplxUrl || '';
    (this.element.querySelector('#mf-deepl-key') as HTMLInputElement).value = settings.deeplApiKey || '';
    (this.element.querySelector('#mf-ocr-engine') as HTMLSelectElement).value = settings.ocrEngine || 'local';
    (this.element.querySelector('#mf-cloud-ocr-key') as HTMLInputElement).value = settings.cloudOcrKey || '';
    (this.element.querySelector('#mf-font-size') as HTMLInputElement).value = String(settings.fontSize || 14);
    (this.element.querySelector('#mf-font-size-value') as HTMLElement).textContent = String(settings.fontSize || 14);
    (this.element.querySelector('#mf-font-color') as HTMLInputElement).value = settings.fontColor || '#000000';

    // 显示对应的翻译引擎设置
    this.toggleEngineSettings(settings.translateEngine || 'microsoft');

    // 更新云端 OCR 字段显示
    const cloudOcrField = this.element.querySelector('.manga-flow-settings__field--cloud-ocr') as HTMLElement;
    if (cloudOcrField) {
      cloudOcrField.style.display = settings.ocrEngine === 'cloud' ? 'block' : 'none';
    }

    // 初始化模型下拉框（如果有已保存的模型）
    const modelSelect = this.element.querySelector('#mf-model-select') as HTMLSelectElement;
    const savedModel = settings.model || '';
    if (modelSelect && savedModel) {
      // 检查是否已存在该选项
      const existingOption = Array.from(modelSelect.options).find(opt => opt.value === savedModel);
      if (!existingOption) {
        // 添加一个临时选项
        const option = document.createElement('option');
        option.value = savedModel;
        option.textContent = savedModel;
        option.selected = true;
        modelSelect.insertBefore(option, modelSelect.firstChild);
      } else {
        modelSelect.value = savedModel;
      }
    }
  }

  private save(): void {
    if (!this.element) return;

    const settings: Settings = {
      sourceLang: (this.element.querySelector('#mf-source-lang') as HTMLSelectElement).value as Settings['sourceLang'],
      targetLang: 'zh',
      translateEngine: (this.element.querySelector('#mf-translate-engine') as HTMLSelectElement).value as Settings['translateEngine'],
      apiBaseUrl: (this.element.querySelector('#mf-api-base') as HTMLInputElement).value,
      apiKey: (this.element.querySelector('#mf-api-key') as HTMLInputElement).value,
      model: (this.element.querySelector('#mf-model') as HTMLInputElement).value,
      deeplxUrl: (this.element.querySelector('#mf-deeplx-url') as HTMLInputElement).value,
      deeplApiKey: (this.element.querySelector('#mf-deepl-key') as HTMLInputElement).value,
      ocrEngine: (this.element.querySelector('#mf-ocr-engine') as HTMLSelectElement).value as Settings['ocrEngine'],
      cloudOcrKey: (this.element.querySelector('#mf-cloud-ocr-key') as HTMLInputElement).value,
      fontSize: parseInt((this.element.querySelector('#mf-font-size') as HTMLInputElement).value),
      fontColor: (this.element.querySelector('#mf-font-color') as HTMLInputElement).value,
    };

    this.options.onSave(settings);
    this.hide();
  }

  show(): void {
    this.loadSettings();
    this.element?.classList.add('manga-flow-settings--visible');
    this.isVisible = true;
  }

  hide(): void {
    this.element?.classList.remove('manga-flow-settings--visible');
    this.isVisible = false;
    this.options.onClose();
  }
}
