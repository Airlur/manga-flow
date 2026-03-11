# MangaFlow 漫译

一个面向漫画阅读场景的浏览器扩展，自动识别图片中的文本并翻译后回渲到原图，目标是减少跳出阅读和手工复制翻译的成本。

## 核心能力

- 面向漫画页的图片检测与懒加载监听
- OCR 识别（本地 Tesseract + 云端 Google Vision）
- 文本过滤与分组（对白优先、拟声词/装饰文本过滤）
- 分组翻译（Google / OpenAI 兼容 / DeepLX / DeepL）
- 组级擦除与渲染（遮罩、描边、字号自适应）
- 调试可视化（ROI / OCR / Mask 多层框）

## 渲染策略概览

1. OCR 文本块按几何关系聚类为组。
2. 每个组进行背景复杂度与气泡特征分析。
3. 决策分流：
- 短文本：不擦除，仅遮罩/描边。
- 气泡且非复杂背景：优先擦除后渲染。
- 复杂背景：保守遮罩 + 强描边，避免脏块。

## 技术栈

- `TypeScript`
- `Chrome Extension Manifest V3`
- `Vite`
- `Canvas API`
- `Tesseract.js`
- `LocalForage`

## 快速开始

### 环境要求

- `Node.js >= 18`
- `pnpm >= 9`

### 安装依赖

```bash
pnpm install
```

### 开发构建

```bash
pnpm dev
```

### 生产构建

```bash
pnpm build
```

## 扩展加载方式

1. 执行 `pnpm build`。
2. 打开 Chrome/Edge 扩展管理页面，开启开发者模式。
3. 选择“加载已解压的扩展程序”，指向项目根目录。
4. 打开漫画站点后使用悬浮球开始翻译。

## 常用脚本

```bash
pnpm dev         # 内容脚本+扩展资源监听构建
pnpm build       # 完整构建
pnpm lint        # 代码检查
pnpm type-check  # TS 类型检查
```

## 项目结构

```text
manga-flow/
├─ src/
│  ├─ background/          # Service Worker
│  ├─ content/
│  │  ├─ core/             # OCR/翻译/图像处理/渲染核心流程
│  │  ├─ ui/               # 悬浮球与设置面板
│  │  └─ utils/            # 站点适配与文本过滤
│  ├─ popup/               # 浏览器操作面板
│  ├─ styles/
│  └─ types/
├─ docs/                   # PRD/TDD/结构文档
├─ manifest.json
└─ vite.config.ts
```

## 关键配置项

- `sourceLang`: OCR 源语言（`ko/ja/en/auto`）
- `targetLang`: 目标语言（当前为 `zh`）
- `translateEngine`: 翻译引擎选择
- `ocrEngine`: `local` 或 `cloud` [❌暂不支持]
- `fontScale`: 渲染字号倍率 [❌暂不支持]
- `fontColor`: 译文颜色 [❌暂不支持]
- `maskOpacity`: 遮罩透明度 [❌暂不支持]

## 调试能力

- 开发模式阶段控制：`ROI`、`OCR`、`Translate`、`Full`
- 框层开关：`OCR 红框`、`ROI 橙框`、`Mask 绿框`
- 控制台输出 OCR 文本块、翻译结果与时序日志

## 文档索引

- [`docs/PRD.md`](docs/PRD.md)
- [`docs/TDD.md`](docs/TDD.md)
- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)
- [`plan.md`](plan.md)
- [`task.md`](task.md)
- [`issues.md`](issues.md)

## 路线图

- 气泡判定阈值与渲染一致性持续调优
- 设置项渲染生效链路收敛
- 更多站点适配与性能优化
- 可选交互编辑能力（per-block）

## 许可证

MIT License
