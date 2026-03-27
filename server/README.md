# MangaFlow 本地 OCR 服务

这是 MangaFlow 的本地 OCR 服务端，当前基于 PaddleOCR，默认使用以下模型：

- `PP-OCRv5_mobile_det`
- `korean_PP-OCRv5_mobile_rec`
- `GET /health`
- `POST /ocr`
- `POST /ocr/batch`

当前目标是先把**韩漫识别链路稳定跑通**，并为后续接入插件里的**本地 OCR 引擎**做准备。

## 目录结构

```text
server/
├─ app/
├─ models/
│  └─ ppocr/
│     ├─ det/PP-OCRv5_mobile_det/
│     └─ rec/korean_PP-OCRv5_mobile_rec/
├─ scripts/
├─ .env.example
├─ requirements.txt
└─ README.md
```

## 1. 创建虚拟环境

```powershell
cd server
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -U pip
```

## 2. 安装依赖

### GPU 版本

```powershell
python -m pip install paddlepaddle-gpu==3.2.2 -i https://www.paddlepaddle.org.cn/packages/stable/cu129/
pip install -r requirements.txt
```

### CPU 版本

```powershell
python -m pip install paddlepaddle==3.2.2 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
pip install -r requirements.txt
```

## 3. 下载模型

默认模型目录：

- `server/models/ppocr/det/PP-OCRv5_mobile_det`
- `server/models/ppocr/rec/korean_PP-OCRv5_mobile_rec`

如果你还没下载模型，可以执行：

```powershell
pip install huggingface_hub
python scripts/download_models.py
```

## 4. 启动服务

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 18733 --reload
```

## 5. 接口说明

### 健康检查

- `GET /health`

返回信息包含：
- Python 版本
- Paddle / PaddleOCR 版本
- GPU 是否可用
- 当前实际使用设备
- det / rec 模型路径

### 单图 OCR

- `POST /ocr`

表单字段：
- `file`：单张图片文件，支持 `jpg/png/webp/bmp`

### 批量 OCR

- `POST /ocr/batch`

表单字段：
- `files`：多张图片文件

## 6. curl 示例

```powershell
curl.exe -X POST "http://127.0.0.1:18733/ocr" -F "file=@E:\test\page-1.jpg"
```

## 当前阶段说明

当前已完成：
- 本地服务骨架
- det + rec 模型接入
- 健康检查 / 单图 OCR / 批量 OCR
- 为插件接入预留稳定接口

后续计划：
- 本地效果验证与对比
- 插件侧 OCR 引擎接入
- LaMa / 修复服务预研
- 本地服务配置项接入设置面板
