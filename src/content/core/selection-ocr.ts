import type { BBox, OCRResult, SelectionRegion } from '../../types';
import { OCREngine } from './ocr-engine';
import { TextFilter } from '../utils/text-filter';
import { showToast } from '../ui/toast';

type SelectionCallback = (region: SelectionRegion) => void;
type OCRCompleteCallback = (result: OCRResult | null) => void;

export class SelectionOCR {
    private isSelecting = false;
    private startX = 0;
    private startY = 0;
    private overlay: HTMLDivElement | null = null;
    private selectionBox: HTMLDivElement | null = null;
    private targetImage: HTMLImageElement | null = null;
    private ocrEngine: OCREngine;
    private textFilter: TextFilter;
    private onSelectionComplete: SelectionCallback | null = null;
    private onOCRComplete: OCRCompleteCallback | null = null;
    private boundHandleMouseDown: (event: MouseEvent) => void;
    private boundHandleMouseMove: (event: MouseEvent) => void;
    private boundHandleMouseUp: (event: MouseEvent) => void;
    private boundHandleKeyDown: (event: KeyboardEvent) => void;

    constructor() {
        this.ocrEngine = new OCREngine();
        this.textFilter = new TextFilter();
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    }

    startSelection(targetImage?: HTMLImageElement): void {
        if (this.isSelecting) return;

        this.targetImage = targetImage || null;
        this.isSelecting = true;
        this.createOverlay();
        this.bindEvents();
        showToast('请用鼠标框选要识别区域，按 ESC 取消', 'info', 5000);
    }

    cancelSelection(): void {
        if (!this.isSelecting) return;

        this.isSelecting = false;
        this.removeOverlay();
        this.unbindEvents();
        this.targetImage = null;
    }

    setCallbacks(
        onSelectionComplete: SelectionCallback,
        onOCRComplete?: OCRCompleteCallback
    ): void {
        this.onSelectionComplete = onSelectionComplete;
        this.onOCRComplete = onOCRComplete || null;
    }

    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.id = 'mf-selection-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483646;
            cursor: crosshair;
            background: rgba(0, 0, 0, 0.1);
        `;

        this.selectionBox = document.createElement('div');
        this.selectionBox.id = 'mf-selection-box';
        this.selectionBox.style.cssText = `
            position: absolute;
            border: 2px dashed #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            pointer-events: none;
        `;

        this.overlay.appendChild(this.selectionBox);
        document.body.appendChild(this.overlay);
    }

    private removeOverlay(): void {
        if (this.overlay?.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
        this.selectionBox = null;
    }

    private bindEvents(): void {
        document.addEventListener('mousedown', this.boundHandleMouseDown, true);
        document.addEventListener('mousemove', this.boundHandleMouseMove, true);
        document.addEventListener('mouseup', this.boundHandleMouseUp, true);
        document.addEventListener('keydown', this.boundHandleKeyDown, true);
    }

    private unbindEvents(): void {
        document.removeEventListener('mousedown', this.boundHandleMouseDown, true);
        document.removeEventListener('mousemove', this.boundHandleMouseMove, true);
        document.removeEventListener('mouseup', this.boundHandleMouseUp, true);
        document.removeEventListener('keydown', this.boundHandleKeyDown, true);
    }

    private handleMouseDown(event: MouseEvent): void {
        if (!this.isSelecting) return;

        event.preventDefault();
        event.stopPropagation();

        this.startX = event.clientX;
        this.startY = event.clientY;

        if (this.selectionBox) {
            this.selectionBox.style.left = `${this.startX}px`;
            this.selectionBox.style.top = `${this.startY}px`;
            this.selectionBox.style.width = '0px';
            this.selectionBox.style.height = '0px';
        }
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.isSelecting || !this.selectionBox) return;

        event.preventDefault();
        event.stopPropagation();

        const currentX = event.clientX;
        const currentY = event.clientY;

        const left = Math.min(this.startX, currentX);
        const top = Math.min(this.startY, currentY);
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
    }

    private handleMouseUp(event: MouseEvent): void {
        if (!this.isSelecting) return;

        event.preventDefault();
        event.stopPropagation();

        const endX = event.clientX;
        const endY = event.clientY;

        const left = Math.min(this.startX, endX);
        const top = Math.min(this.startY, endY);
        const width = Math.abs(endX - this.startX);
        const height = Math.abs(endY - this.startY);

        if (width < 10 || height < 10) {
            showToast('选区太小，请重新选择', 'warning');
            return;
        }

        const region: SelectionRegion = {
            x: left,
            y: top,
            width,
            height,
        };

        this.isSelecting = false;
        this.removeOverlay();
        this.unbindEvents();

        if (this.onSelectionComplete) {
            this.onSelectionComplete(region);
        }

        if (this.targetImage) {
            this.performOCROnRegion(region);
        }
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.cancelSelection();
            showToast('已取消选区', 'info');
        }
    }

    private async performOCROnRegion(region: SelectionRegion): Promise<void> {
        if (!this.targetImage) return;

        try {
            showToast('正在识别选区内的文字...', 'info');

            const bbox: BBox = this.convertRegionToImageBBox(region, this.targetImage);

            if (bbox.x0 >= this.targetImage.naturalWidth || bbox.y0 >= this.targetImage.naturalHeight) {
                showToast('选区不在图片范围内', 'warning');
                return;
            }

            const ocrResult = await this.ocrEngine.recognizeRegions(
                this.targetImage,
                [bbox],
                'ko',
                false,
                'selection'
            );

            const filteredBlocks = ocrResult.blocks.filter((block) => {
                const decision = this.textFilter.classify(block.text, block.bbox);
                return decision.keep;
            });

            if (filteredBlocks.length === 0) {
                showToast('选区未检测到有效文字', 'warning');
                if (this.onOCRComplete) {
                    this.onOCRComplete(null);
                }
                return;
            }

            const filteredResult: OCRResult = {
                ...ocrResult,
                blocks: filteredBlocks,
            };

            showToast(`识别到 ${filteredBlocks.length} 个文本区域`, 'success');

            if (this.onOCRComplete) {
                this.onOCRComplete(filteredResult);
            }
        } catch (error) {
            console.error('[MangaFlow] 选区 OCR 失败:', error);
            showToast('识别失败，请重试', 'error');
            if (this.onOCRComplete) {
                this.onOCRComplete(null);
            }
        }
    }

    private convertRegionToImageBBox(region: SelectionRegion, img: HTMLImageElement): BBox {
        const rect = img.getBoundingClientRect();

        const scaleX = (img.naturalWidth || img.width) / rect.width;
        const scaleY = (img.naturalHeight || img.height) / rect.height;

        const x0 = Math.max(0, Math.round((region.x - rect.left) * scaleX));
        const y0 = Math.max(0, Math.round((region.y - rect.top) * scaleY));
        const x1 = Math.min(
            img.naturalWidth || img.width,
            Math.round((region.x + region.width - rect.left) * scaleX)
        );
        const y1 = Math.min(
            img.naturalHeight || img.height,
            Math.round((region.y + region.height - rect.top) * scaleY)
        );

        return { x0, y0, x1, y1 };
    }

    configure(settings: Record<string, unknown>): void {
        this.ocrEngine.configure(settings);
    }
}
