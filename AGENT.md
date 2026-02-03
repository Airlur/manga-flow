# 漫译 MangaFlow - AI 开发规范

> 供 AI IDE/终端工具初始化项目上下文使用。开发前请先阅读。

---

## 项目概述

- **项目名称**：漫译 MangaFlow
- **项目类型**：Chrome/Edge 浏览器扩展（Manifest V3）
- **核心功能**：识别网页漫画图片文字，翻译并渲染到原图
- **目标用户**：韩漫/日漫阅读者
- **语言**：TypeScript
- **UI**：原生 DOM

---

## 语言与提交规范

> 必须使用中文输出、中文注释、中文文档。

- 代码注释使用中文
- 文档使用中文
- Git 提交信息使用中文，格式：
  - `feat: 中文描述...`
  - `fix: 中文描述...`
  - `docs: 中文描述...`
  - `refactor: 中文描述...`

---

## 代码与命名规范

- 文件/目录命名：`kebab-case`
- 类名：`PascalCase`
- 变量/函数：`camelCase`
- 常量：`UPPER_SNAKE_CASE`

---

## 核心依赖

| 模块 | 技术选型 | 用途 |
|------|----------|------|
| OCR | Google Cloud Vision / Tesseract.js | 云端识别 + 本地备用 |
| ROI | TextDetector | 候选区域裁剪识别 |
| 翻译 | OpenAI 兼容 / Google / DeepL / DeepLX | 多引擎翻译 |
| 过滤 | TextFilter | 水印/拟声词/短词过滤 |
| 缓存 | LocalForage | OCR/翻译缓存 |
| 渲染 | Canvas API | 背景擦除 + 译文渲染 |
| 调试 | DebugOverlay | ROI/OCR/Mask 可视化 |

---

## 构建与运行

```
pnpm install
pnpm dev
pnpm build
```

- DevTools Console 查看 OCR/ROI/Mask 调试日志
- 设置面板包含开发模式与调试开关

---

## 项目结构

```
manga-flow/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ background/
│  │  └─ service-worker.ts
│  ├─ config/
│  │  └─ app-config.ts
│  ├─ content/
│  │  ├─ index.ts
│  │  ├─ core/
│  │  │  ├─ cache-manager.ts
│  │  │  ├─ debug-overlay.ts
│  │  │  ├─ image-detector.ts
│  │  │  ├─ image-processor.ts
│  │  │  ├─ ocr-engine.ts
│  │  │  ├─ renderer.ts
│  │  │  ├─ text-detector.ts
│  │  │  ├─ translation-controller.ts
│  │  │  └─ translator.ts
│  │  ├─ ui/
│  │  │  ├─ floating-ball.ts
│  │  │  ├─ settings-panel.ts
│  │  │  └─ toast.ts
│  │  └─ utils/
│  │     ├─ site-adapter.ts
│  │     └─ text-filter.ts
│  ├─ popup/
│  │  ├─ popup.html
│  │  └─ popup.ts
│  ├─ styles/
│  │  └─ content.css
│  └─ types/
│     └─ index.ts
└─ docs/
   ├─ PRD.md
   ├─ TDD.md
   └─ PROJECT_STRUCTURE.md
```

---

## 适配站点

- 站点选择器维护在 `src/content/utils/site-adapter.ts`。
- 新增/修改站点时同步更新文档。

---

## 关键约束

- 云端 OCR/翻译请求通过 Service Worker 代理。
- OCR 置信度（Cloud）目前为固定值，仅作日志参考。
- 未引入气泡检测模型，语义分类需启发式规则实现。

---

## 常见问题

### Q: 跨域图片如何处理？
通过 Service Worker 代理拉取，再重绘到新 Canvas。

### Q: 为什么 Cloud OCR 置信度恒定？
Google Vision `textAnnotations` 未返回置信度，当前代码固定默认值。

### Q: 如何调试内容脚本？
打开页面 DevTools，在 Console/Sources 中查看日志和断点。
