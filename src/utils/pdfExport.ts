import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface GalleryImageItem {
  pageNo: number;
  filename: string;
  dataUrl: string;
  blob: Blob;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Trigger cross-platform file download (Android Chrome, Apple iOS Safari, Desktop)
 */
function triggerPdfSave(doc: jsPDF, filename: string) {
  if (isIOSDevice()) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return;
  }

  doc.save(filename);
}

/**
 * Trigger an image (.jpg) download so Android Photo Gallery indexes it directly
 */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * Convert HTMLCanvasElement to JPEG Blob + DataURL cleanly
 */
function canvasToJpeg(canvas: HTMLCanvasElement, quality: number = 0.95): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve({ blob, dataUrl });
        else reject(new Error('Failed to create image blob'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Capture an A4 2x2 grid element forcing exact A4 (210x297mm -> 794x1123px) 2x2 layout
 * even when triggered from a narrow Android/iPhone screen.
 */
async function captureA4GridCanvas(el: HTMLElement, scale: number = 2.4): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 1024,
    ignoreElements: (node) => node.classList.contains('no-print'),
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.width = '794px';
      clonedEl.style.minWidth = '794px';
      clonedEl.style.maxWidth = '794px';
      clonedEl.style.minHeight = '1123px';
      clonedEl.style.display = 'grid';
      clonedEl.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      clonedEl.style.gridAutoRows = 'minmax(525px, 1fr)';
      clonedEl.style.gap = '14px';
      clonedEl.style.padding = '16px';
      clonedEl.style.backgroundColor = '#ffffff';
      clonedEl.style.border = 'none';
      clonedEl.style.borderRadius = '0px';
    },
  });
}

/**
 * Export a single receipt element to an exact A6 (105mm x 148mm) PDF file
 */
export async function downloadA6ReceiptPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    ignoreElements: (el) => el.classList.contains('no-print'),
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6', // 105mm x 148mm
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 105mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 148mm
  const margin = 4;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  const renderW = canvas.width * ratio;
  const renderH = canvas.height * ratio;
  const offsetX = (pageWidth - renderW) / 2;
  const offsetY = margin;

  doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
  triggerPdfSave(doc, filename);
}

/**
 * Export a single A6 receipt as a crisp JPEG image for Android/iPhone Phone Gallery
 */
export async function exportA6ReceiptGalleryImage(
  element: HTMLElement,
  filename: string
): Promise<GalleryImageItem> {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    ignoreElements: (el) => el.classList.contains('no-print'),
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.width = '420px';
      clonedEl.style.minWidth = '420px';
      clonedEl.style.backgroundColor = '#ffffff';
    },
  });

  const { blob, dataUrl } = await canvasToJpeg(canvas, 0.96);
  if (!isIOSDevice()) {
    triggerBlobDownload(blob, filename);
  }
  return { pageNo: 1, filename, dataUrl, blob };
}

/**
 * Export an array of A4 grid pages (each containing up to 4 A6-sized bills in 2x2 layout)
 * to a multi-page A4 (210mm x 297mm) PDF file.
 */
export async function downloadA4BatchPdf(pageElements: HTMLElement[], filename: string): Promise<void> {
  if (!pageElements || pageElements.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210mm x 297mm
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 5;
  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i];
    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }

    const canvas = await captureA4GridCanvas(el, 2.2);
    const imgData = canvas.toDataURL('image/png', 0.96);
    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
    const renderW = canvas.width * ratio;
    const renderH = canvas.height * ratio;
    const offsetX = (pageWidth - renderW) / 2;
    const offsetY = margin;

    doc.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
  }

  triggerPdfSave(doc, filename);
}

/**
 * Export an array of A4 (4xA6) pages as high-resolution JPEG images for phone Gallery.
 * Auto-downloads on Android/Desktop and returns image data/blobs for iOS Photos preview & Share.
 */
export async function exportA4BatchGalleryImages(
  pageElements: HTMLElement[],
  selectedMonth: string,
  autoDownload: boolean = true
): Promise<GalleryImageItem[]> {
  if (!pageElements || pageElements.length === 0) return [];

  const items: GalleryImageItem[] = [];
  for (let i = 0; i < pageElements.length; i++) {
    const canvas = await captureA4GridCanvas(pageElements[i], 2.4);
    const { blob, dataUrl } = await canvasToJpeg(canvas, 0.95);
    const filename = `AlamKhan_Bills_${selectedMonth}_Page${i + 1}_A4_4xA6.jpg`;
    items.push({
      pageNo: i + 1,
      filename,
      dataUrl,
      blob,
    });
  }

  if (autoDownload && !isIOSDevice()) {
    for (let i = 0; i < items.length; i++) {
      triggerBlobDownload(items[i].blob, items[i].filename);
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 320));
      }
    }
  }

  return items;
}

/**
 * Native mobile Web Share (lets Apple iOS & Android users tap "Save Image" straight to Photos/Gallery)
 * with graceful download fallback.
 */
export async function saveOrShareGalleryImage(item: GalleryImageItem, title: string): Promise<'shared' | 'downloaded'> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof File !== 'undefined') {
      const file = new File([item.blob], item.filename, { type: 'image/jpeg' });
      const canShareFiles =
        typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : false;
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title,
        });
        return 'shared';
      }
    }
  } catch (err) {
    // User cancelled share sheet or platform threw -> fall through to download
    if (err instanceof Error && err.name === 'AbortError') {
      return 'shared';
    }
  }

  triggerBlobDownload(item.blob, item.filename);
  return 'downloaded';
}
