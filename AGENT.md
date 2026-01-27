# 漫译 MangaFlow - AI 开发规范

> 本文件用于 AI IDE 或终端工具（如 Cursor、Claude Code、Codex、Gemini CLI）初始化项目上下文，请在开发前阅读。

---

## 项目概述

- **项目名称**：漫译 MangaFlow
- **项目类型**：Chrome/Edge 浏览器扩展插件
- **技术规范**：Manifest V3
- **核心功能**：自动识别漫画网页中的图片文字，翻译并无缝渲染
- **目标用户**：需要阅读韩漫/日漫生肉的用户
- **开发语言**：TypeScript（推荐）/ JavaScript
- **UI 框架**：无框架，原生 DOM 操作

---

## 核心开发规范

### 语言规范

> [!IMPORTANT]
> **必须使用简体中文进行所有回复、注释和文档编写。**

- 代码注释使用中文
- Git 提交信息使用中文
- 文档全部使用中文

### 代码风格

```javascript
// ✅ 正确示例
/**
 * 翻译图片中的文字
 * @param {HTMLImageElement} img - 目标图片元素
 * @returns {Promise<TranslationResult>} 翻译结果
 */
async function translateImage(img) {
  // 实现逻辑
}

// ❌ 错误示例
async function translateImage(img) { // translate the image text
  // implementation
}
```

### 文件命名

```
文件/目录命名：kebab-case（小写 + 连字符）
类名：PascalCase
函数/变量：camelCase
常量：UPPER_SNAKE_CASE
```

### Git 提交规范

```
feat: 新增功能
fix: 修复问题
docs: 文档更新
refactor: 代码重构
chore: 构建/工具变更
```

示例：
```
feat: 实现 OCR 引擎封装
fix: 修复懒加载图片检测遗漏问题
docs: 更新 README 安装说明
```

---

## 技术栈详情

### 核心依赖

| 模块 | 技术选型 | 用途 |
|------|----------|------|
| OCR | Tesseract.js v5 | 本地文字识别（韩/日/英） |
| 翻译 | DeepL / DeepSeek / Google | 多引擎翻译 |
| 缓存 | LocalForage | 浏览器本地存储 |
| 渲染 | Canvas API | 图像处理与文字渲染 |

### 构建工具

```
包管理器：pnpm（推荐）/ npm
构建工具：Vite + CRXJS（可选，用于热更新开发）
代码检查：ESLint + Prettier
类型检查：TypeScript（可选但推荐）
```

### 运行环境

```
Node.js: v18+
浏览器: Chrome 88+ / Edge 88+（Manifest V3 支持）
操作系统: Windows 10/11
```

---

## 项目结构

```
manga-flow/
├── manifest.json                 # 插件配置文件
├── package.json                  # 项目依赖配置
├── tsconfig.json                 # TypeScript 配置
│
├── src/
│   ├── background/
│   │   └── service-worker.ts     # 后台脚本（API 代理）
│   │
│   ├── content/
│   │   ├── index.ts              # 内容脚本入口
│   │   ├── core/
│   │   │   ├── image-detector.ts # 图片检测模块
│   │   │   ├── ocr-engine.ts     # OCR 引擎封装
│   │   │   ├── translator.ts     # 翻译引擎封装
│   │   │   ├── image-processor.ts # 背景修复模块
│   │   │   ├── renderer.ts       # 译文渲染模块
│   │   │   └── cache-manager.ts  # 缓存管理模块
│   │   ├── ui/
│   │   │   ├── floating-ball.ts  # 悬浮球组件
│   │   │   └── settings-panel.ts # 设置面板组件
│   │   └── utils/
│   │       ├── text-filter.ts    # 文本过滤工具
│   │       └── helpers.ts        # 通用工具函数
│   │
│   └── popup/
│       ├── popup.html            # 弹出页面
│       └── popup.ts              # 弹出页面逻辑
│
├── public/
│   ├── icons/                    # 插件图标
│   └── styles/                   # CSS 样式
│
├── config/
│   └── site-adapters.json        # 站点适配配置
│
├── docs/                         # 项目文档
│   ├── PRD.md                    # 产品需求文档
│   ├── TDD.md                    # 技术设计文档
│   └── PROJECT_STRUCTURE.md      # 项目结构说明
│
└── AGENT.md                      # 本文件
```

---

## 关键配置

### manifest.json 基础配置

```json
{
  "manifest_version": 3,
  "name": "漫译 MangaFlow",
  "version": "1.0.0",
  "description": "漫画网页自动翻译插件",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://comix.to/*",
    "https://www.toongod.org/*",
    "https://omegascans.org/*",
    "https://manhwaread.com/*",
    "https://api-free.deepl.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.js"],
      "css": ["public/styles/content.css"]
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "public/icons/icon16.png",
      "48": "public/icons/icon48.png",
      "128": "public/icons/icon128.png"
    }
  }
}
```

### 适配站点配置

```json
{
  "comix.to": {
    "imageSelector": "img.chapter-img, img[data-src]",
    "containerSelector": ".chapter-content",
    "lazyLoadAttr": "data-src",
    "language": "ko"
  },
  "toongod.org": {
    "imageSelector": ".wp-manga-chapter-img",
    "containerSelector": ".reading-content",
    "lazyLoadAttr": "data-src",
    "language": "en"
  }
}
```

---

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（热更新）
pnpm dev

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 类型检查
pnpm type-check
```

---

## 本地测试步骤

### 电脑端（Chrome/Edge）

1. 打开浏览器扩展页面：`chrome://extensions` 或 `edge://extensions`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目 `dist` 目录（构建后）或项目根目录
5. 打开目标漫画网站进行测试

### 手机端（推荐 Kiwi Browser）

1. 在 Android 设备安装 Kiwi Browser
2. 打开 `kiwi://extensions`
3. 开启「开发者模式」
4. 加载扩展文件（需先将文件传输到手机）

---

## 关键设计约束

### 性能要求

- 单张图片处理时间 ≤ 8 秒（目标 5 秒）
- 批量处理每批 3 张，处理完立即显示
- 支持懒加载图片检测
- 翻译结果本地缓存（30 天有效）

### 兼容性要求

- 支持 Chrome 88+ / Edge 88+
- 支持上下滚动阅读模式
- 支持图片懒加载
- 支持韩文/日文/英文 → 中文翻译

### 功能边界

- ✅ 翻译对话气泡、旁白、心理描写
- ❌ 不翻译拟声词、装饰文字
- ❌ 不支持批量下载翻译后的漫画
- ❌ 不支持离线翻译（云端 API 依赖网络）

---

## 常见问题

### Q: 跨域请求如何处理？

通过 Service Worker 代理：

```javascript
// background/service-worker.ts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'API_REQUEST') {
    fetch(request.url, request.options)
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // 保持消息通道开放
  }
});
```

### Q: 如何调试内容脚本？

1. 打开目标网页
2. 按 F12 打开开发者工具
3. 在 Console 中可以看到内容脚本的日志
4. 在 Sources 面板中找到扩展的脚本进行断点调试

### Q: 图片跨域如何处理？

漫画图片通常允许跨域访问。如遇到 CORS 问题：
1. 通过 Service Worker 代理图片请求
2. 或使用 `<img>` 的 `crossOrigin` 属性

---

## 参考资源

- [Chrome Extension 文档](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Tesseract.js 文档](https://tesseract.projectnaptha.com/)
- [LocalForage 文档](https://localforage.github.io/localForage/)
