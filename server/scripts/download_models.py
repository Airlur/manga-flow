from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download

# server 根目录。
SERVER_DIR = Path(__file__).resolve().parents[1]

# 默认模型下载目录。
DEFAULT_DET_DIR = SERVER_DIR / 'models' / 'ppocr' / 'det' / 'PP-OCRv5_mobile_det'
DEFAULT_REC_DIR = SERVER_DIR / 'models' / 'ppocr' / 'rec' / 'korean_PP-OCRv5_mobile_rec'


def main() -> None:
    """下载 PaddleOCR 检测模型与韩语识别模型。"""
    parser = argparse.ArgumentParser(description='下载 MangaFlow OCR Server 所需的 PaddleOCR 模型。')
    parser.add_argument('--det-dir', default=str(DEFAULT_DET_DIR), help='检测模型下载目录。')
    parser.add_argument('--rec-dir', default=str(DEFAULT_REC_DIR), help='识别模型下载目录。')
    args = parser.parse_args()

    det_dir = Path(args.det_dir).expanduser().resolve()
    rec_dir = Path(args.rec_dir).expanduser().resolve()

    det_dir.mkdir(parents=True, exist_ok=True)
    rec_dir.mkdir(parents=True, exist_ok=True)

    print(f'[开始] 下载检测模型 -> {det_dir}')
    snapshot_download(
        repo_id='PaddlePaddle/PP-OCRv5_mobile_det',
        local_dir=str(det_dir),
        local_dir_use_symlinks=False,
    )

    print(f'[开始] 下载识别模型 -> {rec_dir}')
    snapshot_download(
        repo_id='PaddlePaddle/korean_PP-OCRv5_mobile_rec',
        local_dir=str(rec_dir),
        local_dir_use_symlinks=False,
    )

    print('[完成] 模型下载完成。')


if __name__ == '__main__':
    main()
