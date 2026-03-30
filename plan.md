# MangaFlow 方案与改进计划

## 版本概览
- v0.8.0（当前进行中）：本地 PaddleOCR 服务接入、Popup / 设置面板收尾、渲染与擦除优化
- v0.7.3：设置面板侧边栏化、OpenAI 多 Provider 管理、模型自动拉取与手动补模
- v0.7.2：Popup / 设置面板局部 React 化、统一 UI Token、自定义下拉与字体收口
- v0.7.1：贴边悬浮球交互收敛、原图/译图切换、阶段耗时反馈
- v0.7.0：明确 `server/`、PaddleOCR、本地服务、WebDAV 等路线
- v0.6.x 及更早：完成 ROI、聚类、过滤、缓存、组级擦除/渲染等基础能力

---

## 当前架构快照
1. 插件主链路保持不变：图片检测 → ROI → OCR → 文本过滤 → 翻译 → 擦除/渲染 → 替换原图。
2. UI 层已局部 React 化：
   - Popup 主控制面板
   - 设置面板
3. 核心业务接口仍沿用原协议：
   - content script 主流程
   - background 消息协议
   - OCR / 翻译 / 渲染基础接口
4. 本地 OCR 服务已独立到 `server/`，与插件前端分离。

---

## v0.8.0 当前状态

### 已完成
#### 本地 PaddleOCR 服务
- 建立 `server/` 目录与 FastAPI 服务骨架
- 完成接口：
  - `GET /health`
  - `POST /ocr`
  - `POST /ocr/batch`
  - `POST /ocr/json`
- 接入模型：
  - `PP-OCRv5_mobile_det`
  - `korean_PP-OCRv5_mobile_rec`
- 支持相对路径与绝对路径模型目录
- 完成 GPU / 健康检查 / README 基础说明
- 修复 PaddleOCR 并发推理崩溃问题
- 修复 PaddleOCR polygon / bbox 映射错误，OCR 坐标已恢复可用

#### 插件侧接入
- OCR provider 已支持：
  - `local`（Tesseract）
  - `cloud`（Google Vision）
  - `paddle_local`（本地 PaddleOCR 服务）
- 设置面板已接入 Paddle 本地服务地址与健康检查
- OCR 选择器已增加对应图标

#### UI 收尾
- Popup 主控制面板 React 化并收敛布局
- 设置面板 React 化并改为侧边栏 tab 结构
- OpenAI 多 Provider 管理已落地：
  - 新增 / 删除 / 启停
  - 优先级调整
  - 自动拉取模型
  - 手动补充模型
- Popup 已增加站点级悬浮球开关
- OpenAI 路线已做并发与超时收敛：
  - 图片并发降到 2
  - `/chat/completions` 超时提到 30 秒
  - 支持按 `requestDelay` 控制批次间隔

### 进行中
- 设置面板缓存入口拆分为：
  - OCR 缓存
  - 翻译缓存
- Provider 区域按钮、图标、对齐等细节继续微调
- Popup 下拉与空间表现继续按最终视觉收口

### 当前核心问题
#### P0
- 渲染 / 擦除质量仍需优化：
  - 擦除区域精度
  - 竖排 / 横排排版
  - 字号、换行、遮罩策略
- 需要继续验证不同 OCR 来源下的渲染一致性：
  - Google Vision
  - Tesseract
  - PaddleOCR

#### P1
- 翻译限流仍需结合服务商 RPM 继续调参
- 缓存管理入口与说明还可继续细化
- 小屏 / 移动端体验仍有收尾空间

#### P2
- WebDAV 同步仅有占位，未正式实现
- 暗色主题、账号体系、更多统计信息暂缓

---

## v0.8.0 下一步顺序
1. 完成设置面板缓存入口拆分与 UI 细节修正
2. 进入渲染 / 擦除优化：
   - 组级擦除区域
   - 排版方向判断
   - 字号与换行策略
3. 回头做 Popup 与设置面板剩余视觉微调
4. 继续预留 WebDAV / 同步能力，但暂不展开实现

---

## 中长期路线（保留）

### v0.8.1：局部修正与重渲染
- 新增截图裁剪 / 手动画框模式
- 支持选区重新 OCR、重新翻译、重新渲染
- 保存局部修正 bbox / provider / render 元数据
- 为原文 / 译文切换补齐必要缓存与数据结构
- 支持手动微调 bbox、标记必翻 / 可选翻 / 忽略
- 增加局部重跑日志与耗时
- 预留 per-block 文本编辑与图层可视化管理

### v0.9.0：LaMa / 复杂背景修复
- 评估 LaMa / LiteLama / AnimeMangaInpainting 的可行性
- 在 `server/` 增加 `/inpaint` 接口
- 插件接入 `inpaint-provider`
- 保留当前纯色擦除 / 遮罩 / 描边方案作为 fallback
- 对比现有擦除方案与 LaMa 的质量 / 耗时 / 占用
- 设计复杂背景场景下的自动切换策略
- 增加 inpaint 结果缓存与失败回退

### v0.9.1：站点策略 / 运行策略 / 同步
- 增加站点白名单 / 黑名单 / 仅列表站点运行
- 增加漫画站识别与图片评分机制
- 规范批量翻译策略：并发数、批次大小、RPM 风险控制
- 记录每张图的阶段耗时与批次日志
- 增加 WebDAV 配置同步
- 支持配置导入 / 导出、冲突处理与版本迁移

---

## 历史版本归档（精简）
### v0.7.3
- 设置面板侧边栏化
- OpenAI 多 Provider 管理落地
- 图标资源目录统一，修复路径问题

### v0.7.2
- Popup / 设置面板局部 React 化
- 统一字体、控件、状态样式
- 新增 `dist-extension/` 最小加载目录

### v0.7.1
- 贴边悬浮球、阶段耗时、原图/译图切换落地
- 非漫画页 / 无漫画图 toast 提示补齐

### v0.7.0
- 确定 `server/` 路线
- 确定 PaddleOCR 作为本地 OCR 主方向
- 确定 UI 先收敛，再推进模型链路

### v0.6.x 及更早
- 完成 ROI、聚类、缓存、过滤、组级擦除/渲染等基础能力
- 细节历史以 git 记录为准，不再在本文件展开
