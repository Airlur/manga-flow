# MangaFlow 漫译

面向韩漫/日漫网页阅读场景的浏览器扩展：识别图片文字、翻译并回渲到原图，减少切应用和手工复制翻译。

## 功能概览

- 漫画图片检测与懒加载监听
- OCR（本地 `Tesseract.js` / 云端 `Google Cloud Vision`）
- 文本过滤与分组翻译（按组翻译，按组擦除与渲染）
- 渲染策略分流（擦除 / 遮罩 / 描边）
- 调试可视化（ROI/OCR/Mask）

## 当前可用性（重要）

| 模块 | 选项 | 是否可用 | 是否需要配置 | 备注 |
|---|---|---|---|---|
| OCR | `local` | 可用 | 否 | 默认选项，基于 `Tesseract.js` |
| OCR | `cloud` | 可用 | 是（`cloudOcrKey`） | 未配置 Key 时会回退本地 OCR |
| 翻译 | `google` | 可用 | 否 | 走 `translate.googleapis.com` 非官方接口，可能限流 |
| 翻译 | `microsoft` | 部分可用 | 否 | 当前实现会回退到 Google，不是独立微软通道 |
| 翻译 | `openai` | 可用 | 是（`apiBaseUrl` + `apiKey`） | 支持 OpenAI 兼容服务 |
| 翻译 | `deeplx` | 可用 | 是（`deeplxUrl`） | 依赖你自己的 DeepLX 服务 |
| 翻译 | `deepl` | 可用 | 是（`deeplApiKey`） | 调用 DeepL Free API |

## 快速开始

### 1) 安装与构建

```bash
pnpm install
pnpm build
```

### 2) 加载扩展

1. 打开 Chrome/Edge 扩展管理页，开启开发者模式
2. 选择“加载已解压的扩展程序”
3. 选择本项目根目录

### 3) 首次配置（建议）

1. 打开漫画站点页面
2. 点悬浮球进入设置
3. 选择 OCR 引擎：
- `local`：直接可用
- `cloud`：需填写 `Google Cloud Vision API Key`
4. 选择翻译引擎：
- `google`：开箱可用（不稳定时换 OpenAI/DeepL）
- `openai`：填写 `API Base URL`、`API Key`、`Model`
- `deeplx`：填写 `DeepLX URL`
- `deepl`：填写 `DeepL API Key`
5. 保存设置后开始翻译

## 渲染策略（当前逻辑）

1. OCR 块先分组（同气泡/同段落）
2. 组级背景分析，判断气泡特征和复杂度
3. 按组决策：
- 短文本：不擦除，走遮罩/描边
- 气泡且背景不复杂：优先擦除
- 复杂背景：保守遮罩 + 强描边

## 设置项说明

- `sourceLang`：OCR 源语言（`ko/ja/en/auto`）
- `targetLang`：目标语言（当前固定 `zh`）
- `translateEngine`：翻译引擎选择
- `ocrEngine`：`local` 或 `cloud`
- `fontScale`：字体倍率（已接入，仍有页面生效一致性问题待优化）
- `fontColor`：字体颜色（已接入，仍有页面生效一致性问题待优化）
- `maskOpacity`：遮罩透明度（已接入，仍有页面生效一致性问题待优化）

## 已知限制

- `microsoft` 目前不是独立翻译实现，实际回退到 Google
- Google 翻译通道基于非官方接口，存在波动和限流风险
- 显示设置（字体倍率/颜色/遮罩透明度）在部分页面存在生效不稳定，详见 `issues.md`
- 内容脚本匹配范围与构建产物路径仍有收敛空间（见 `issues.md`）

## 调试模式

- 阶段：`roi` / `ocr` / `translate` / `full`
- 叠层开关：OCR 红框 / ROI 橙框 / Mask 绿框
- 控制台可查看 OCR 块与翻译日志

## 开发脚本

```bash
pnpm dev         # 监听构建
pnpm build       # 完整构建
pnpm lint        # 代码检查
pnpm type-check  # 类型检查
```

## 目录结构

```text
manga-flow/
├─ src/
│  ├─ background/
│  ├─ content/
│  │  ├─ core/
│  │  ├─ ui/
│  │  └─ utils/
│  ├─ popup/
│  ├─ styles/
│  └─ types/
├─ docs/
├─ plan.md
├─ task.md
├─ issues.md
└─ manifest.json
```

## 参考文档

- `docs/PRD.md`
- `docs/TDD.md`
- `docs/PROJECT_STRUCTURE.md`
- `plan.md`
- `task.md`
- `issues.md`

## License

MIT
