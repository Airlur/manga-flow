# 漫译 MangaFlow - 项目结构说明

**版本**：1.0 | **更新日期**：2026-01-27

---

## 目录结构

```
manga-flow/
├── manifest.json                 # 插件配置文件（Manifest V3）
├── package.json                  # 项目依赖配置
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 构建配置
├── AGENT.md                      # AI 开发规范文件
├── README.md                     # 项目说明
│
├── src/                          # 源代码目录
│   ├── background/               # Service Worker（后台脚本）
│   │   └── service-worker.ts     # API 代理、消息处理
│   │
│   ├── content/                  # 内容脚本（注入漫画页面）
│   │   ├── index.ts              # 入口文件，初始化各模块
│   │   │
│   │   ├── core/                 # 核心功能模块
│   │   │   ├── image-detector.ts # 图片检测 + 懒加载监听
│   │   │   ├── ocr-engine.ts     # OCR 引擎封装
│   │   │   ├── translator.ts     # 翻译引擎封装
│   │   │   ├── image-processor.ts# 背景修复模块
│   │   │   ├── renderer.ts       # 译文渲染模块
│   │   │   └── cache-manager.ts  # 缓存管理模块
│   │   │
│   │   ├── ui/                   # UI 组件
│   │   │   ├── floating-ball.ts  # 悬浮球组件
│   │   │   ├── settings-panel.ts # 设置面板组件
│   │   │   └── progress-bar.ts   # 进度条组件
│   │   │
│   │   └── utils/                # 工具函数
│   │       ├── text-filter.ts    # 文本过滤（拟声词等）
│   │       ├── site-adapter.ts   # 站点适配逻辑
│   │       └── helpers.ts        # 通用工具函数
│   │
│   ├── popup/                    # 弹出页面（点击插件图标）
│   │   ├── popup.html            # 页面结构
│   │   ├── popup.ts              # 页面逻辑
│   │   └── popup.css             # 页面样式
│   │
│   └── types/                    # TypeScript 类型定义
│       └── index.d.ts            # 全局类型定义
│
├── public/                       # 静态资源
│   ├── icons/                    # 插件图标
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── styles/                   # 内容脚本样式
│       └── content.css           # 悬浮球等 UI 样式
│
├── config/                       # 配置文件
│   └── site-adapters.json        # 站点适配配置
│
├── docs/                         # 项目文档
│   ├── PRD.md                    # 产品需求文档
│   ├── TDD.md                    # 技术设计文档
│   └── PROJECT_STRUCTURE.md      # 本文件
│
└── dist/                         # 构建输出目录（git 忽略）
    └── ...
```

---

## 核心文件职责

### manifest.json

插件的核心配置文件，定义权限、脚本入口等。

```json
{
  "manifest_version": 3,
  "name": "漫译 MangaFlow",
  "version": "1.0.0",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["https://*/*"],
  "background": { "service_worker": "..." },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["..."] }],
  "action": { "default_popup": "..." }
}
```

---

### src/content/core/

| 文件 | 职责 | 主要接口 |
|------|------|----------|
| `image-detector.ts` | 检测漫画图片，监听懒加载 | `init()`, `getComicImages()` |
| `ocr-engine.ts` | 封装 Tesseract.js | `init()`, `recognize()` |
| `translator.ts` | 多引擎翻译封装 | `translate()` |
| `image-processor.ts` | 背景复杂度分析 + 修复 | `inpaint()` |
| `renderer.ts` | Canvas 渲染译文 | `render()` |
| `cache-manager.ts` | LocalForage 缓存管理 | `get()`, `set()` |

---

### src/content/ui/

| 文件 | 职责 |
|------|------|
| `floating-ball.ts` | 悬浮球 UI（拖拽、状态切换） |
| `settings-panel.ts` | 设置面板 UI（语言、API Key 等） |
| `progress-bar.ts` | 翻译进度显示 |

---

### src/content/utils/

| 文件 | 职责 |
|------|------|
| `text-filter.ts` | 过滤拟声词、装饰文字等 |
| `site-adapter.ts` | 根据站点返回对应配置 |
| `helpers.ts` | 防抖、图片哈希等工具函数 |

---

### src/background/

| 文件 | 职责 |
|------|------|
| `service-worker.ts` | API 请求代理（绕过 CORS） |

---

### config/site-adapters.json

站点适配配置，定义各站点的图片选择器、懒加载属性等。

支持站点：
- comix.to（韩文）
- toongod.org（英文）
- omegascans.org（英文）
- manhwaread.com（英文）

---

## 模块依赖关系

```
index.ts (入口)
    │
    ├── FloatingBall (UI)
    ├── SettingsPanel (UI)
    │
    └── TranslationController (协调器)
            │
            ├── ImageDetector
            ├── CacheManager
            ├── OCREngine
            ├── TextFilter
            ├── Translator
            ├── ImageProcessor
            └── Renderer
```

---

## 构建说明

### 开发模式

```bash
pnpm dev
# 启动 Vite 开发服务器，支持热更新
# 加载 dist 目录到浏览器扩展
```

### 生产构建

```bash
pnpm build
# 输出到 dist/ 目录
# 可直接打包为 .zip 发布
```

---

## 扩展指南

### 添加新站点适配

1. 在 `config/site-adapters.json` 添加配置
2. 访问站点，使用开发者工具分析 DOM
3. 确定图片选择器、懒加载属性
4. 测试翻译流程

### 添加新翻译引擎

1. 在 `src/content/core/translator.ts` 添加引擎类
2. 实现 `translate()` 方法
3. 在引擎优先级列表中注册
4. 在设置面板添加选项
