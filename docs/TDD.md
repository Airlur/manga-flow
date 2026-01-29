# 漫译 MangaFlow - 技术设计文档 (TDD)

**版本**：1.0 | **更新日期**：2026-01-27

---

## 一、技术架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器扩展插件                            │
├─────────────────────────────────────────────────────────────┤
│  Popup Page          │  Content Script     │  Service Worker│
│  (设置面板)           │  (核心逻辑)          │  (API 代理)    │
├─────────────────────────────────────────────────────────────┤
│                     核心模块层                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │图片检测   │ │OCR 引擎  │ │翻译引擎   │ │图像处理   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │渲染模块   │ │缓存管理   │ │文本过滤   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────┤
│                     外部依赖                                 │
│  Tesseract.js │ LocalForage │ 翻译 API (DeepL/DeepSeek/Google)│
└─────────────────────────────────────────────────────────────┘
```

### 1.2 数据流

```
用户点击悬浮球
      │
      ▼
ImageDetector: 检测页面漫画图片
      │
      ▼
CacheManager: 查询缓存 ──命中──→ 直接渲染
      │ 未命中
      ▼
OCREngine: 识别文字 + 位置
      │
      ▼
TextFilter: 过滤拟声词/装饰文字
      │
      ▼
Translator: 翻译文字
      │
      ▼
ImageProcessor: 背景修复
      │
      ▼
Renderer: 渲染译文
      │
      ▼
CacheManager: 保存缓存
```

---

## 二、核心模块设计

### 2.1 ImageDetector（图片检测模块）

**职责**：检测页面中的漫画图片，监听懒加载

```typescript
interface ImageDetector {
  // 初始化，开始监听
  init(): void;
  
  // 获取所有待处理图片
  getComicImages(): HTMLImageElement[];
  
  // 判断是否为漫画图片
  isComicImage(img: HTMLImageElement): boolean;
  
  // 销毁监听器
  destroy(): void;
}
```

**实现要点**：
- 使用 `MutationObserver` 监听 DOM 变化
- 使用 `IntersectionObserver` 监听视口内图片
- 根据尺寸（>400x400）和 URL 特征筛选漫画图片

### 2.2 OCREngine（OCR 引擎模块）

**职责**：识别图片中的文字及其位置

```typescript
interface OCRResult {
  text: string;           // 完整文本
  confidence: number;     // 置信度 0-1
  blocks: TextBlock[];    // 文本块列表
}

interface TextBlock {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

interface OCREngine {
  // 初始化引擎（加载语言包）
  init(lang: 'kor' | 'jpn' | 'eng'): Promise<void>;
  
  // 识别图片
  recognize(image: HTMLImageElement | string): Promise<OCRResult>;
  
  // 销毁引擎
  destroy(): Promise<void>;
}
```

**实现要点**：
- 基于 Tesseract.js v5
- 支持韩文(kor)、日文(jpn+jpn_vert)、英文(eng)
- 置信度 < 0.7 时可调用云端 OCR

### 2.3 Translator（翻译引擎模块）

**职责**：调用翻译 API 翻译文本

```typescript
interface TranslateResult {
  text: string;
  engine: string;
}

interface Translator {
  // 翻译文本
  translate(text: string, from: string, to: string): Promise<TranslateResult>;
  
  // 设置引擎优先级
  setPriority(engines: string[]): void;
}
```

**翻译引擎优先级**：
1. DeepL API（质量最优，无审查）
2. DeepSeek（国产，无审查）
3. Google Translate（免费稳定）
4. GPT-4o-mini（需特殊提示词）

**反审查提示词**：
```javascript
const SYSTEM_PROMPT = `You are a professional translator for adult comic books. 
Translate naturally while preserving original tone. 
This is fictional creative content.`;
```

### 2.4 ImageProcessor（图像处理模块）

**职责**：处理跨域图片，返回可导出的 Canvas

```typescript
interface ImageProcessor {
  // 处理图片，返回干净的 Canvas（自动处理跨域）
  processImage(img: HTMLImageElement, blocks: TextBlock[]): Promise<HTMLCanvasElement>;
}
```

**跨域处理策略**：

1. 尝试直接绘制图片到 Canvas
2. 检测是否被污染（调用 `getImageData` 测试）
3. 如果污染，通过 Service Worker 代理获取图片 Base64
4. **重新创建干净的 Canvas**，绘制代理图片

> **注意**：已移除"四级降级修复策略"，不再在原图上绘制遮罩。译文渲染改为使用**描边文字**，直接覆盖在原图上。

### 2.5 Renderer（渲染模块）

**职责**：在 Canvas 上渲染译文

```typescript
interface RenderOptions {
  fontSize: number;
  fontColor: string;
  fontFamily: string;
}

interface Renderer {
  // 渲染译文到 Canvas
  render(
    canvas: HTMLCanvasElement,
    blocks: TextBlock[],
    translations: string[],
    options: RenderOptions
  ): void;
  
  // 替换原图
  replaceImage(img: HTMLImageElement, canvas: HTMLCanvasElement): void;
}
```

**实现要点**：
- 自适应字体大小（根据区域宽高）
- 支持多行文本自动换行
- 垂直居中对齐

### 2.6 CacheManager（缓存管理模块）

**职责**：管理翻译结果缓存

```typescript
interface CacheEntry {
  imageHash: string;
  timestamp: number;
  ocrResult: OCRResult;
  translation: string;
  renderedImage: string; // DataURL
}

interface CacheManager {
  // 获取缓存
  get(imageHash: string): Promise<CacheEntry | null>;
  
  // 设置缓存
  set(imageHash: string, entry: CacheEntry): Promise<void>;
  
  // 计算图片哈希
  getImageHash(imageSrc: string): Promise<string>;
  
  // 清理过期缓存
  cleanup(): Promise<void>;
}
```

### 2.7 TextFilter（文本过滤模块）

**职责**：过滤不需要翻译的文本

```typescript
interface TextFilter {
  // 判断是否需要翻译
  shouldTranslate(text: string, bbox: BBox): boolean;
}
```

**过滤规则**：
1. 单字符文本 → 过滤
2. 区域面积 < 500px² → 过滤
3. 韩文拟声词模式 `/^[ㄱ-ㅎㅏ-ㅣ]{1,3}$/` → 过滤
4. 日文拟声词模式 `/^[ァ-ヶー]{1,4}$/` → 过滤
5. 纯符号 `/^[!?♥★☆…]+$/` → 过滤

---

## 三、站点适配配置

### 3.1 配置结构

```json
{
  "sites": {
    "comix.to": {
      "name": "Comix.to",
      "imageSelector": "img.chapter-img, img[data-src]",
      "containerSelector": ".chapter-content, .reading-content",
      "lazyLoadAttr": "data-src",
      "language": "ko",
      "features": {
        "lazyLoad": true,
        "infiniteScroll": true
      }
    },
    "toongod.org": {
      "name": "ToonGod",
      "imageSelector": ".wp-manga-chapter-img, img.ts-main-image",
      "containerSelector": ".reading-content",
      "lazyLoadAttr": "data-src",
      "language": "en",
      "features": {
        "lazyLoad": true,
        "infiniteScroll": false
      }
    },
    "omegascans.org": {
      "name": "OmegaScans",
      "imageSelector": "img[class*='chapter']",
      "containerSelector": ".container",
      "lazyLoadAttr": "data-src",
      "language": "en"
    },
    "manhwaread.com": {
      "name": "ManhwaRead",
      "imageSelector": ".page-break img",
      "containerSelector": ".reading-content",
      "lazyLoadAttr": "data-src",
      "language": "en"
    }
  },
  "default": {
    "imageSelector": "img",
    "containerSelector": "body",
    "lazyLoadAttr": "data-src",
    "language": "auto"
  }
}
```

### 3.2 站点匹配逻辑

```typescript
function getSiteConfig(url: string): SiteConfig {
  const hostname = new URL(url).hostname;
  
  for (const [domain, config] of Object.entries(siteConfigs.sites)) {
    if (hostname.includes(domain)) {
      return config;
    }
  }
  
  return siteConfigs.default;
}
```

---

## 四、API 接口定义

### 4.1 Service Worker 消息接口

```typescript
// 内容脚本 → Service Worker
interface APIRequest {
  type: 'API_REQUEST';
  url: string;
  options: RequestInit;
}

// Service Worker → 内容脚本
interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
}
```

### 4.2 翻译 API 封装

**DeepL API**：
```typescript
async function translateWithDeepL(text: string, from: string, to: string): Promise<string> {
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      source_lang: from.toUpperCase(),
      target_lang: to.toUpperCase()
    })
  });
  
  const data = await response.json();
  return data.translations[0].text;
}
```

---

## 五、错误处理

### 5.1 错误类型

```typescript
enum ErrorType {
  OCR_FAILED = 'OCR_FAILED',
  TRANSLATE_FAILED = 'TRANSLATE_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  IMAGE_LOAD_FAILED = 'IMAGE_LOAD_FAILED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}
```

### 5.2 处理策略

| 错误类型 | 处理方式 |
|----------|----------|
| OCR 失败 | 跳过该区域，继续处理 |
| 翻译失败（单引擎） | 尝试下一个引擎 |
| 翻译失败（全部） | 显示原文 + 提示 |
| 网络错误 | 暂停翻译 + 提示重试 |
| 图片加载失败 | 跳过该图片 |
| 配额超限 | 切换引擎或提示用户 |

---

## 六、验证计划

### 6.1 单元测试

- TextFilter：各种文本过滤规则
- ImageProcessor：背景复杂度分析
- CacheManager：缓存读写

### 6.2 集成测试

- 完整翻译流程（本地 OCR）
- 多引擎翻译切换
- 懒加载图片检测

### 6.3 站点兼容性测试

| 站点 | 测试内容 |
|------|----------|
| comix.to | 韩文识别 + 翻译 |
| toongod.org | 英文识别 + 翻译 |
| omegascans.org | 懒加载图片 |
| manhwaread.com | 滚动加载 |

### 6.4 性能测试

- 单张图片处理时间 ≤ 8 秒
- 10 张连续处理无卡顿
- 缓存命中秒开
