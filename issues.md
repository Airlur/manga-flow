# Issues 清单（MangaFlow）

> 记录已发现的问题、原因与建议方案。处理完成请勾选 [x]。
> 复检日期：2026-02-03（基于当前代码与实现逻辑重新核对）
> 说明：当前以云端 OCR 为主，本清单优先覆盖“云端 OCR + 裁剪 + 渲染”相关问题。

## 主要问题（必须优先处理）

- [x] P0 跨域图片无法导出，导致整张翻译失败
  - 修复点：`ImageProcessor.processImage` 在检测 taint 后 **重新创建 Canvas** 再绘制代理图片。
  - 备注：当前阶段2模式未渲染图像，但渲染恢复后该问题应已解决。
  - 影响文件：`src/content/core/image-processor.ts`。

- [x] P1 目标语言设置不生效
  - 现象：设置面板/Popup 改目标语言后，翻译仍固定为 `zh`。
  - 解决：已改为使用 `settings.targetLang`。
  - 影响文件：`src/content/core/translation-controller.ts`。

- [ ] P1 构建产物路径不一致，可能导致打包后失效
  - 现象：`manifest.json` 引用 `src/popup/popup.html` 与 `src/styles/content.css`，脚本在 `dist/`。
  - 风险：仅发布 `dist/` 时 Popup/CSS 无法加载。
  - 建议方案：统一资源路径到 `dist/` 或通过构建复制静态资源并更新 manifest。
  - 影响文件：`manifest.json`, `vite.config.ts`, `src/popup/popup.html`。

- [ ] P1 站点适配配置“文档与实现”不一致
  - 现象：`config/site-adapters.json` 未被读取，实际配置硬编码在 `site-adapter.ts`。
  - 风险：后续维护难、文档与实现脱节。
  - 建议方案：改为读取 JSON 配置，或删除冗余配置并更新文档。
  - 影响文件：`src/content/utils/site-adapter.ts`, `config/site-adapters.json`, `docs/TDD.md`。

- [ ] P1 ROI 过度合并为整页大框
  - 现象：阶段 A/B 出现大面积橙框，ROI 覆盖整页或大块区域。
  - 影响：裁剪 OCR 过大，水印/正文混入同一块，翻译与擦除质量下降。
  - 建议方案：调整 ROI 合并策略（气泡/文本块级）；必要时临时关闭 ROI。
  - 影响文件：`src/content/core/text-detector.ts`。

- [x] P1 OCR 文本日志缺失
  - 现象：控制台只输出 OCR 完成数量，无法核对识别文本是否正确。
  - 解决：缓存命中与否均输出文本块日志。
  - 影响文件：`src/content/core/translation-controller.ts`, `src/content/core/ocr-engine.ts`。

- [x] P1 缓存命中时 OCR 红框不重绘
  - 现象：阶段 B 仅显示 ROI 橙框，OCR 红框缺失。
  - 解决：缓存命中仍触发绘制逻辑。
  - 影响文件：`src/content/core/translation-controller.ts`, `src/content/core/ocr-engine.ts`。

- [x] P1 清除缓存按钮无效
  - 现象：Popup 的“清除缓存”后，OCR/翻译仍提示命中。
  - 解决：清除 `ocr-cache` / `translation-cache`。
  - 影响文件：`src/popup/popup.ts`, `src/content/core/cache-manager.ts`。

- [ ] P1 气泡/复杂背景误判
  - 现象：非白色气泡被判定为复杂背景，走遮罩/描边而非擦除。
  - 影响：气泡对白不干净、观感不一致。
  - 现状：已接入“色彩集中度 + 边缘密度”的保守判定，但仍需阈值验证。
  - 建议：继续调参，优先降低误判率（可容忍漏判）。
  - 影响文件：`src/content/core/image-processor.ts`, `src/content/core/renderer.ts`。

- [ ] P1 遮罩宽度不稳定
  - 现象：遮罩随译文长度扩展，出现过长/过短。
  - 影响：遮罩溢出或漏盖原文。
  - 现状：已改为组级遮罩，但仍需验证不同气泡尺寸的稳定性。
  - 建议：气泡类遮罩跟随组 bbox，非气泡按译文宽度 + 上限。
  - 影响文件：`src/content/core/renderer.ts`。

- [ ] P1 ID/昵称语义翻译
  - 现象：短标签被语义翻译（如 ID/昵称）。
  - 建议：ID/昵称检测 + 保留原文/音译；提示词仅作辅助。
  - 影响文件：`src/content/core/translation-controller.ts`, `src/content/core/translator.ts`。

- [ ] P1 拟声词/装饰文本误翻译
  - 现象：拟声词被识别为对白，进入翻译/渲染流程。
  - 现状：硬过滤 + 大面积短词/孤立块上下文规则已加入，但仍有漏判。
  - 建议：补充更稳定的视觉规则（位置/大小/描边）。
  - 影响文件：`src/content/utils/text-filter.ts`。

- [ ] P1 渲染策略混用导致观感不一致
  - 现象：同一页面出现擦除/半透明遮罩/仅描边混用。
  - 根因：仅依赖背景复杂度判断，缺少语义类型优先级。
  - 建议：继续完善“语义优先 + 组级擦除”的策略分流。
  - 影响文件：`src/content/core/image-processor.ts`, `src/content/core/renderer.ts`。

- [ ] P1 设置面板显示设置未生效
  - 现象：字体倍率/颜色/遮罩透明度调整后，渲染效果仍无明显变化。
  - 备注：已尝试渲染端修正，实测仍未生效，需进一步定位设置保存/读取/渲染链路。
  - 影响文件：`src/content/ui/settings-panel.ts`, `src/content/core/translation-controller.ts`, `src/content/core/renderer.ts`。

- [ ] P1 组级渲染仍需验证字号/遮罩覆盖
  - 现象：字号与遮罩已改为组级，但需要验证不同气泡/背景下的稳定性。
  - 建议：统一以组 bbox 作为排版与遮罩基准，必要时加上最小/最大约束。
  - 影响文件：`src/content/core/translation-controller.ts`, `src/content/core/image-processor.ts`, `src/content/core/renderer.ts`。

## 其他风险与优化建议（可延后）

- [ ] P2 微软翻译默认不可用，实际依赖 Google 回退
  - 根因：微软翻译未提供有效鉴权，`Authorization: 'Bearer'` 为空。
  - 建议：默认引擎改为 Google；或补齐 Azure Key/Token 获取流程；或移除“微软翻译”选项。
  - 影响文件：`src/content/core/translator.ts`, `src/background/service-worker.ts`。

- [ ] P2 缓存大小限制未执行
  - 现象：`MAX_CACHE_SIZE` 定义但未使用；清理只在构造时触发。
  - 建议：定期清理 + 基于大小的淘汰策略（LRU）。
  - 影响文件：`src/content/core/cache-manager.ts`。

- [ ] P2 OCR 置信度无实际意义（Cloud）
  - 现象：日志中 Cloud OCR 置信度恒为 95%。
  - 根因：Google Vision `textAnnotations` 未返回置信度，代码中固定写死。
  - 建议：改用 `fullTextAnnotation` 结构或引入伪置信度。
  - 影响文件：`src/content/core/ocr-engine.ts`。

- [ ] P2 图片哈希仅基于 URL
  - 风险：同 URL 内容变化会复用旧缓存。
  - 建议：使用图片内容 hash（blob/arrayBuffer）或结合 `ETag/Last-Modified`。
  - 影响文件：`src/content/core/cache-manager.ts`。

- [ ] P2 Tesseract.js 初始化签名需核对
  - 风险：v5 API 与当前 `createWorker(tessLang, 1)` 可能不一致。
  - 建议：按 v5 官方流程 `createWorker()` + `loadLanguage()` + `initialize()`。
  - 影响文件：`src/content/core/ocr-engine.ts`。

- [x] P2 图片比例过滤可能误杀长条图
  - 修复点：已移除基于 `aspectRatio` 的硬过滤，改为“容器/选择器/尺寸/URL 模式”综合判断。
  - 影响文件：`src/content/core/image-detector.ts`。

- [ ] P2 内容脚本注入范围过宽
  - 风险：`<all_urls>` + `https://*/*` 影响体验与审核。
  - 建议：收敛到支持站点或加白名单。
  - 影响文件：`manifest.json`。

- [ ] P2 翻译/识别缓存未被命中使用
  - 现象：`translateSingleImage()` 未读取 OCR/翻译缓存，重复 OCR 与翻译。
  - 建议：阶段3启用缓存读取；或在阶段2也缓存 OCR 结果用于复用。
  - 影响文件：`src/content/core/translation-controller.ts`, `src/content/core/cache-manager.ts`。

- [ ] P2 调试红框默认开启
  - 现象：OCR 调试框默认绘制，影响阅读。
  - 建议：默认关闭，增加设置或快捷开关。
  - 影响文件：`src/content/core/ocr-engine.ts`。

- [ ] P2 云端 OCR 直连内容脚本（后续）
  - 风险：内容脚本 `fetch` 可能受 CORS/CSP 影响。
  - 建议：云端 OCR 请求也通过 `service-worker` 代理统一转发。
  - 影响文件：`src/content/core/ocr-engine.ts`, `src/background/service-worker.ts`。

## 你反馈的问题定位（截图相关）

- [ ] 1) “微软翻译降级到 Google”
  - 结论：目前属于预期行为（微软翻译未认证）。
  - 解决方案：
    - 如果要保留微软翻译，需配置 Azure Key 或获取有效 token；
    - 否则建议将默认引擎改为 Google，并在 UI 标注“微软翻译需配置”。

- [x] 2) “DeepLX 仍失败”
  - 原因：当时的失败点是 **跨域画布被污染**，与翻译引擎无关。
  - 现状：已通过“重建 Canvas + 代理图片重绘”修复（见 P0）。

---

备注：以上问题未做代码修改，仅记录与分析，后续每完成一项请勾选。
