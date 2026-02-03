import type { BBox, Settings, TextBlock } from '../../types';
import { DEV_MODE } from '../../config/app-config';

type ImageLike = HTMLImageElement | HTMLCanvasElement;

type BoxType = 'ocr' | 'roi' | 'mask';

interface DebugData {
    ocr?: BBox[];
    roi?: { boxes: BBox[]; labelPrefix?: string };
    mask?: BBox[];
}

export class DebugOverlayManager {
    private static instance: DebugOverlayManager | null = null;

    static getInstance(): DebugOverlayManager {
        if (!DebugOverlayManager.instance) {
            DebugOverlayManager.instance = new DebugOverlayManager();
        }
        return DebugOverlayManager.instance;
    }

    private enabled = true;
    private showOcr = true;
    private showRoi = true;
    private showMask = false;

    private data = new WeakMap<ImageLike, DebugData>();
    private images = new Set<ImageLike>();

    applySettings(settings?: Partial<Settings>): void {
        if (!settings) return;
        const devMode = DEV_MODE ? (settings.devMode ?? true) : false;
        this.setEnabled(!!devMode);
        this.setShowFlags({
            ocr: settings.showOcrBoxes ?? true,
            roi: settings.showRoiBoxes ?? true,
            mask: settings.showMaskBoxes ?? false,
        });
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) return;
        this.enabled = enabled;
        if (!enabled) {
            this.clearAll();
        } else {
            this.renderAll();
        }
    }

    setShowFlags(flags: { ocr: boolean; roi: boolean; mask: boolean }): void {
        this.showOcr = flags.ocr;
        this.showRoi = flags.roi;
        this.showMask = flags.mask;
        if (this.enabled) {
            this.renderAll();
        } else {
            this.clearAll();
        }
    }

    setOcrBoxes(image: ImageLike, blocks: TextBlock[]): void {
        if (!this.enabled) return;
        const boxes = blocks.map((b) => b.bbox);
        const data = this.ensureData(image);
        data.ocr = boxes;
        this.renderImage(image);
    }

    setRoiBoxes(image: ImageLike, boxes: BBox[], labelPrefix?: string): void {
        if (!this.enabled) return;
        const data = this.ensureData(image);
        data.roi = { boxes, labelPrefix };
        this.renderImage(image);
    }

    setMaskBoxes(image: ImageLike, boxes: BBox[]): void {
        if (!this.enabled) return;
        const data = this.ensureData(image);
        data.mask = boxes;
        this.renderImage(image);
    }

    clearOcrBoxes(image?: ImageLike): void {
        this.clearBoxes(image, 'ocr');
    }

    clearRoiBoxes(image?: ImageLike): void {
        this.clearBoxes(image, 'roi');
    }

    clearMaskBoxes(image?: ImageLike): void {
        this.clearBoxes(image, 'mask');
    }

    private ensureData(image: ImageLike): DebugData {
        const existing = this.data.get(image);
        if (existing) return existing;
        const data: DebugData = {};
        this.data.set(image, data);
        this.images.add(image);
        this.ensureDebugId(image);
        return data;
    }

    private ensureDebugId(image: ImageLike): string {
        const dataset = image instanceof HTMLImageElement ? image.dataset : (image as HTMLCanvasElement).dataset;
        if (!dataset) return '';
        if (!dataset.mfDebugId) {
            dataset.mfDebugId = `mf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        }
        return dataset.mfDebugId;
    }

    private renderAll(): void {
        this.images.forEach((image) => this.renderImage(image));
    }

    private renderImage(image: ImageLike): void {
        this.clearBoxes(image);
        if (!this.enabled) return;

        const data = this.data.get(image);
        if (!data) return;

        if (this.showOcr && data.ocr?.length) {
            this.drawBoxes(image, 'ocr', data.ocr);
        }
        if (this.showRoi && data.roi?.boxes?.length) {
            this.drawBoxes(image, 'roi', data.roi.boxes, data.roi.labelPrefix);
        }
        if (this.showMask && data.mask?.length) {
            this.drawBoxes(image, 'mask', data.mask);
        }
    }

    private clearAll(): void {
        this.clearBoxes();
    }

    private clearBoxes(image?: ImageLike, type?: BoxType): void {
        if (image) {
            this.clearBoxesForImage(image, type);
            return;
        }
        const selector = type ? `.manga-flow-${type}-box` : '.manga-flow-ocr-box, .manga-flow-roi-box, .manga-flow-mask-box';
        document.querySelectorAll(selector).forEach((el) => el.remove());
    }

    private clearBoxesForImage(image: ImageLike, type?: BoxType): void {
        const parent = image.parentElement;
        if (!parent) return;
        const id = this.ensureDebugId(image);
        if (!id) return;
        const selector = type
            ? `.manga-flow-${type}-box[data-mf-debug-id="${id}"]`
            : `.manga-flow-ocr-box[data-mf-debug-id="${id}"], .manga-flow-roi-box[data-mf-debug-id="${id}"], .manga-flow-mask-box[data-mf-debug-id="${id}"]`;
        parent.querySelectorAll(selector).forEach((el) => el.remove());
    }

    private drawBoxes(
        image: ImageLike,
        type: BoxType,
        boxes: BBox[],
        labelPrefix?: string
    ): void {
        const parent = image.parentElement;
        if (!parent) return;

        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === 'static') {
            parent.style.position = 'relative';
        }

        const rect = image.getBoundingClientRect();
        const naturalWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
        const naturalHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
        if (!naturalWidth || !naturalHeight) return;

        const scaleX = rect.width / naturalWidth;
        const scaleY = rect.height / naturalHeight;

        const parentRect = parent.getBoundingClientRect();
        const offsetX = rect.left - parentRect.left;
        const offsetY = rect.top - parentRect.top;

        const id = this.ensureDebugId(image);

        boxes.forEach((box, index) => {
            let x0 = box.x0;
            let y0 = box.y0;
            let x1 = box.x1;
            let y1 = box.y1;

            if (type === 'ocr') {
                const w = x1 - x0;
                const h = y1 - y0;
                const px = w * 0.2;
                const py = h * 0.2;
                x0 = Math.max(0, x0 - px);
                y0 = Math.max(0, y0 - py);
                x1 = x1 + px;
                y1 = y1 + py;
            }

            const el = document.createElement('div');
            el.className = `manga-flow-${type}-box`;
            el.dataset.mfDebugId = id;
            el.style.left = `${offsetX + x0 * scaleX}px`;
            el.style.top = `${offsetY + y0 * scaleY}px`;
            el.style.width = `${(x1 - x0) * scaleX}px`;
            el.style.height = `${(y1 - y0) * scaleY}px`;

            if (type === 'ocr' || type === 'roi') {
                const label = document.createElement('span');
                label.className = `manga-flow-${type}-label`;
                if (type === 'roi' && labelPrefix) {
                    label.textContent = `${labelPrefix}-${index + 1}`;
                } else {
                    label.textContent = `${index + 1}`;
                }
                el.appendChild(label);
            }

            parent.appendChild(el);
        });
    }
}
