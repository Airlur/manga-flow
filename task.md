# Task 清单（MangaFlow）

> 只保留当前仍有参考价值的任务；过旧版本改为归档摘要，避免文档继续膨胀。

## 当前版本
- v0.8.0（进行中）：本地 PaddleOCR 服务接入 + UI 收尾 + 渲染/擦除优化

---

## v0.8.0 任务列表

### P0（当前优先）
- [x] 建立 `server/` 本地 OCR 服务目录与 FastAPI 骨架
- [x] 完成 `/health`、`/ocr`、`/ocr/batch`、`/ocr/json`
- [x] 接入 `PP-OCRv5_mobile_det + korean_PP-OCRv5_mobile_rec`
- [x] 支持模型目录相对路径 / 绝对路径配置
- [x] 插件 OCR provider 接入 `paddle_local`
- [x] 设置面板接入 Paddle 本地服务地址与健康检查
- [x] 修复 PaddleOCR 并发推理崩溃问题
- [x] 修复 PaddleOCR bbox / polygon 坐标映射问题
- [x] Popup 主控制面板收敛到当前结构
- [x] 设置面板改为侧边栏 tab 结构
- [x] OpenAI 多 Provider 管理落地
- [x] OpenAI 路线图片并发从 3 调整到 2
- [x] OpenAI `/chat/completions` 超时提高到 30 秒
- [x] 支持按 `requestDelay` 控制 OpenAI 批次间隔
- [x] 增加本地服务健康检查与错误提示
- [x] 设置面板缓存入口拆分为“清除 OCR 缓存 / 清除翻译缓存”并完成最终 UI 校验
- [x] 修正 AI 服务商区域按钮对齐等细节问题
- [ ] 开始渲染 / 擦除优化第一轮

### P1（重要优化）
- [ ] 评估是否补方向模型：`PP-LCNet_x0_25_textline_ori`
- [ ] 评估高精度组合：`PP-OCRv5_server_det + korean_PP-OCRv5_mobile_rec`
- [ ] 接入 `baidu-cloud` OCR provider
- [ ] 输出 Paddle / Google / 百度云 OCR 的对比记录
- [ ] Provider 级重试、超时、失败回退
- [ ] 调整渲染区域与遮罩策略，提升擦除精度
- [ ] 优化竖排 / 横排排版与字号计算
- [ ] 继续调优翻译限流，适配服务商 RPM 限制
- [ ] 细化缓存管理入口与提示文案
- [ ] 收尾 Popup / 设置面板小屏体验

### P2（后续预留）
- [ ] OCR 预处理参数可调（灰度 / 对比度 / 缩放）
- [ ] Provider 调试页
- [ ] OCR 结果缓存按 provider 与参数维度细分
- [ ] WebDAV 同步正式实现
- [ ] 账号体系 / 登录占位接入真实逻辑
- [ ] Provider 维度统计（失败次数、延迟等）

---

## v0.8.1 任务列表（局部修正与重渲染）

### P0（必须先做）
- [ ] 新增截图裁剪 / 手动画框模式
- [ ] 支持选区重新 OCR、重新翻译、重新渲染
- [ ] 保存局部修正 bbox / provider / render 元数据
- [ ] 为原文 / 译文切换补齐必要缓存与数据结构

### P1（重要优化）
- [ ] 支持手动微调 bbox
- [ ] 支持标记“必翻 / 可选翻 / 忽略”
- [ ] 增加局部重跑日志与耗时

### P2（可延后）
- [ ] per-block 文本编辑面板
- [ ] ROI / OCR / group / mask / render 图层可视化管理

---

## v0.9.0 任务列表（LaMa / 复杂背景修复）

### P0（必须先做）
- [ ] 评估 LaMa / LiteLama / AnimeMangaInpainting 的可行性
- [ ] 在 `server/` 增加 `/inpaint` 接口
- [ ] 插件接入 `inpaint-provider`
- [ ] 保留当前纯色擦除 / 遮罩 / 描边方案作为 fallback

### P1（重要优化）
- [ ] 对比现有擦除方案与 LaMa 的质量 / 耗时 / 占用
- [ ] 设计复杂背景场景下的自动切换策略
- [ ] 增加 inpaint 结果缓存与失败回退

### P2（可延后）
- [ ] 评估更适合漫画场景的微调修复模型
- [ ] 增加“高质量修复模式”开关

---

## v0.9.1 任务列表（站点策略 / 运行策略 / 同步）

### P0（必须先做）
- [ ] 增加站点白名单 / 黑名单 / 仅列表站点运行
- [ ] 增加漫画站识别与图片评分机制
- [ ] 规范批量翻译策略：并发数、批次大小、RPM 风险控制
- [ ] 记录每张图的阶段耗时与批次日志
- [ ] 增加 WebDAV 配置同步

### P1（重要优化）
- [ ] 同步 provider 列表、站点策略、显示设置
- [ ] 增加配置导入 / 导出
- [ ] 增加配置冲突与版本迁移策略

### P2（可延后）
- [ ] 多设备同步冲突处理
- [ ] 站点适配诊断页

---

## 已完成里程碑（归档摘要）

### v0.7.3
- [x] 设置面板侧边栏化
- [x] OpenAI 多 Provider 管理、模型自动拉取、手动补模
- [x] 图标资源目录统一，修复 popup / content 路径问题

### v0.7.2
- [x] Popup / 设置面板局部 React 化
- [x] 统一字体、UI Token、自定义控件
- [x] 构建产物路径收敛到 `dist-extension/`

### v0.7.1
- [x] 贴边悬浮球交互收敛
- [x] 原图 / 译图切换
- [x] 阶段耗时反馈与无漫画图 toast

### v0.7.0
- [x] 明确 `server/` 路线与 PaddleOCR 方向
- [x] 确定 UI 先收口、再推进本地 OCR 服务

### v0.6.x 及更早
- [x] 完成 ROI、聚类、缓存、过滤、组级擦除/渲染等基础能力
- [ ] 渲染策略长期优化仍持续到 v0.8.0
