import React, { useState, useRef } from 'react';
import { BillRecord, BuildingSettings } from '../types';
import {
  formatCurrency,
  formatNum,
  formatMonthName,
  FLOOR_NAMES_BN,
  amountInBengaliWords,
  buildWhatsAppUrl,
  SUPPORT_PHONES_DISPLAY,
} from '../constants';
import { Printer, X, MessageCircle, Copy, Check, FileText, FileDown, Loader2, Lock, ImageDown, Share2, CheckCircle2 } from 'lucide-react';
import {
  downloadA4BatchPdf,
  exportA4BatchGalleryImages,
  saveOrShareGalleryImage,
  triggerBlobDownload,
  isIOSDevice,
  GalleryImageItem,
} from '../utils/pdfExport';

interface BatchPrintModalProps {
  bills: BillRecord[];
  settings: BuildingSettings;
  selectedMonth: string;
  isOwner?: boolean;
  onClose: () => void;
}

export const BatchPrintModal: React.FC<BatchPrintModalProps> = ({
  bills,
  settings,
  selectedMonth,
  isOwner = false,
  onClose,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImageItem[]>([]);
  const [galleryNotice, setGalleryNotice] = useState<string | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const useBn = settings.useBengaliDigits;
  const monthDisplay = formatMonthName(selectedMonth, useBn);

  const monthBills = bills
    .filter((b) => b.month === selectedMonth)
    .sort((a, b) => a.roomNo - b.roomNo);

  // Split bills into pages of exactly 4 A6 bills per A4 sheet (2x2 grid = 4 x A6 on 1 A4)
  const pagesOfFour: BillRecord[][] = [];
  for (let i = 0; i < monthBills.length; i += 4) {
    pagesOfFour.push(monthBills.slice(i, i + 4));
  }

  // Strictly Admin-Only enforcement per specification
  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900">
            শুধুমাত্র এডমিনের জন্য সংরক্ষিত
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            একটি A4 পেজে ৪টি A6 বিল একসাথে প্রিন্ট ও PDF ডাউনলোড শুধুমাত্র কর্তৃপক্ষ (এডমিন) করতে পারবেন। ভাড়াটিয়ারা তাদের নিজস্ব রুমের রসিদ A6 সাইজে ডাউনলোড করতে পারবেন।
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    );
  }

  const buildSingleBillText = (bill: BillRecord) => {
    const floorName = FLOOR_NAMES_BN[bill.floor] || `${bill.floor} তলা`;
    return `*${settings.buildingName} — বাড়ি ভাড়া ও বিদ্যুৎ বিলের রশিদ*
------------------------------------
রুম: ${formatNum(bill.roomNo, useBn)} (${floorName})
ভাড়াটিয়া: ${bill.tenantName || '—'} (${bill.tenantPhone || 'ফোন নম্বর নেই'})
বিলের মাস: ${monthDisplay}

১. মাসিক ঘর ভাড়া: ${formatCurrency(bill.rent, useBn)}
২. নিজস্ব বিদ্যুৎ (${formatNum(bill.units, useBn)} ইউনিট @ ${formatCurrency(bill.rate, useBn)}): ${formatCurrency(bill.electricityCost, useBn)}
   [আগের রিডিং: ${formatNum(bill.prev, useBn)} | বর্তমান: ${formatNum(bill.now, useBn)}]
৩. ডাইনিং মিটার ভাগ: ${formatCurrency(bill.sharedElectricity, useBn)}
${bill.other > 0 ? `৪. অন্যান্য (${bill.note || 'চার্জ'}): ${formatCurrency(bill.other, useBn)}\n` : ''}------------------------------------
*সর্বমোট বিল: ${formatCurrency(bill.total, useBn)}*
*জমা: ${formatCurrency(bill.paid, useBn)}*
*বকেয়া: ${formatCurrency(bill.due, useBn)}*
------------------------------------
ধন্যবাদান্তে,
${settings.landlordName} (${settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'})
ফোন: ${settings.landlordPhone || SUPPORT_PHONES_DISPLAY}`;
  };

  const buildPageOrAllSummaryText = (subsetBills: BillRecord[], label: string) => {
    const header = `*${settings.buildingName} — বিলের রশিদ (${monthDisplay})*\n*${label}*\n================================`;
    const body = subsetBills
      .map((b) => {
        const fl = FLOOR_NAMES_BN[b.floor] || `${b.floor} তলা`;
        return `🏠 *রুম ${formatNum(b.roomNo, useBn)}* (${fl}) — ${b.tenantName || 'ভাড়াটিয়া'}
   ভাড়া: ${formatCurrency(b.rent, useBn)} | বিদ্যুৎ: ${formatCurrency(b.electricityCost, useBn)} | ডাইনিং: ${formatCurrency(b.sharedElectricity, useBn)}${b.other > 0 ? ` | অন্যান্য: ${formatCurrency(b.other, useBn)}` : ''}
   মোট: *${formatCurrency(b.total, useBn)}* | জমা: ${formatCurrency(b.paid, useBn)} | বকেয়া: ${formatCurrency(b.due, useBn)}`;
      })
      .join('\n--------------------------------\n');
    const footer = `\n================================\n${settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'}: ${settings.landlordName}\nফোন: ${settings.landlordPhone || SUPPORT_PHONES_DISPLAY}`;
    return `${header}\n${body}${footer}`;
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadA4Pdf = async () => {
    const elements = pageRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (elements.length === 0 || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadA4BatchPdf(
        elements,
        `AlamKhan_Bills_${selectedMonth}_A4_4xA6.pdf`
      );
    } catch (err) {
      console.error('A4 Batch PDF export failed:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveGalleryImages = async () => {
    const elements = pageRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (elements.length === 0 || downloadingImages) return;
    setDownloadingImages(true);
    setGalleryNotice(null);
    try {
      const items = await exportA4BatchGalleryImages(elements, selectedMonth, true);
      setGalleryImages(items);
      if (items.length > 0) {
        setGalleryNotice(
          isIOSDevice()
            ? `মোট ${formatNum(items.length, useBn)}টি A4 (৪×A6) রসিদ ছবি তৈরি হয়েছে। নিচের 'Photos-এ সেভ করুন' বাটনে ট্যাপ করুন বা ছবিতে চেপে ধরে Save to Photos দিন।`
            : `${formatNum(items.length, useBn)}টি A4 (৪×A6) রসিদ ছবি গ্যালারির জন্য ডাউনলোড শুরু হয়েছে! ডাউনলোড ফোল্ডার / ফোনের গ্যালারি চেক করুন।`
        );
      }
    } catch (err) {
      console.error('A4 Gallery export failed:', err);
      setGalleryNotice('ছবি তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setDownloadingImages(false);
    }
  };

  const handleSaveSinglePageToGallery = async (pageIdx: number) => {
    const el = pageRefs.current[pageIdx];
    if (!el || downloadingImages) return;
    setDownloadingImages(true);
    try {
      const items = await exportA4BatchGalleryImages([el], selectedMonth, false);
      if (items[0]) {
        const fixedItem: GalleryImageItem = {
          ...items[0],
          pageNo: pageIdx + 1,
          filename: `AlamKhan_Bills_${selectedMonth}_Page${pageIdx + 1}_A4_4xA6.jpg`,
        };
        setGalleryImages((prev) => {
          const others = prev.filter((p) => p.pageNo !== fixedItem.pageNo);
          return [...others, fixedItem].sort((a, b) => a.pageNo - b.pageNo);
        });
        await saveOrShareGalleryImage(
          fixedItem,
          `আলম খান বিল্ডিং - ${monthDisplay} (পৃষ্ঠা ${pageIdx + 1})`
        );
        setGalleryNotice(
          `A4 পৃষ্ঠা #${formatNum(pageIdx + 1, useBn)} (৪×A6) গ্যালারিতে সেভের জন্য প্রস্তুত!`
        );
      }
    } catch (err) {
      console.error('Single page gallery save error:', err);
    } finally {
      setDownloadingImages(false);
    }
  };

  const allSummaryWaUrl = buildWhatsAppUrl(
    '',
    buildPageOrAllSummaryText(monthBills, `মোট ${formatNum(monthBills.length, useBn)}টি রুম`)
  );

  return (
    <div className="print-modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="print-modal-shell relative w-full max-w-6xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[93vh] flex flex-col">

        {/* Modal Top Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>
                এডমিন A4 প্রিন্ট ও PDF — প্রতি A4 পৃষ্ঠায় ৪টি A6 বিল ({monthDisplay})
              </span>
            </h3>
            <span className="text-xs text-slate-300">
              মোট {formatNum(monthBills.length, useBn)}টি রুম · {formatNum(pagesOfFour.length, useBn)}টি A4 পৃষ্ঠা · প্রতিটি পৃষ্ঠায় ২×২ গ্রিডে ৪টি A6 (১০৫×১৪৮ মি.মি.) রশিদ
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {monthBills.length > 0 && (
              <>
                <button
                  onClick={handleSaveGalleryImages}
                  disabled={downloadingImages}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  title="সকল রসিদ A4 (৪×A6) ছবি হিসেবে ফোনের গ্যালারিতে সেভ করুন"
                >
                  {downloadingImages ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageDown className="w-4 h-4" />
                  )}
                  <span>{downloadingImages ? 'ছবি তৈরি হচ্ছে...' : 'গ্যালারিতে সেভ (৪×A6 ছবি)'}</span>
                </button>
                <button
                  onClick={handleDownloadA4Pdf}
                  disabled={downloadingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>{downloadingPdf ? 'PDF তৈরি হচ্ছে...' : 'A4 PDF (৪×A6)'}</span>
                </button>
                <a
                  href={allSummaryWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp শেয়ার</span>
                </a>
              </>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>A4 প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Area with 4 x A6 Bills per A4 Page */}
        <div className="print-scroll-body overflow-y-auto p-3 sm:p-5 space-y-6 bg-slate-100 flex-1">
          {/* Gallery Export Notice & Saved Images Preview */}
          {(galleryNotice || galleryImages.length > 0) && (
            <div className="no-print bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 text-xs text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      {galleryNotice || 'A4 (৪×A6) গ্যালারি ছবি প্রস্তুত রয়েছে'}
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      iPhone / Android গ্যালারিতে সরাসরি রাখতে নিচের যেকোনো পৃষ্ঠায় <strong>&ldquo;গ্যালারি / Photos-এ সেভ&rdquo;</strong> বাটনে চাপ দিন অথবা ছবিতে চেপে ধরে <strong>Save to Photos</strong> নির্বাচন করুন।
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGalleryImages([]);
                    setGalleryNotice(null);
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-950 font-semibold px-2 py-1"
                >
                  বন্ধ করুন
                </button>
              </div>

              {galleryImages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {galleryImages.map((img) => (
                    <div
                      key={img.filename}
                      className="bg-white border border-emerald-200 rounded-xl p-2.5 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                        <span>A4 পৃষ্ঠা #{formatNum(img.pageNo, useBn)} (৪×A6)</span>
                        <span className="text-[10px] font-mono text-emerald-700">JPG HD</span>
                      </div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 max-h-56 flex items-center justify-center">
                        <img
                          src={img.dataUrl}
                          alt={`A4 Page ${img.pageNo}`}
                          className="w-full h-auto max-h-56 object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            saveOrShareGalleryImage(
                              img,
                              `আলম খান - ${monthDisplay} (পৃষ্ঠা ${img.pageNo})`
                            )
                          }
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>গ্যালারি / Photos-এ সেভ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerBlobDownload(img.blob, img.filename)}
                          className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                          title="ফাইল ডাউনলোড (.JPG)"
                        >
                          <ImageDown className="w-3 h-3" />
                          <span>.JPG</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {monthBills.length === 0 ? (
            <div className="bg-white p-8 text-center rounded-xl text-slate-500">
              {monthDisplay} মাসে এখনও কোনো বিল তৈরি হয়নি। আগে বিলিং পেজ থেকে বিল তৈরি করুন।
            </div>
          ) : (
            pagesOfFour.map((pageBills, pageIdx) => {
              const pageWaText = buildPageOrAllSummaryText(
                pageBills,
                `A4 পৃষ্ঠা ${formatNum(pageIdx + 1, useBn)} (রুম: ${pageBills.map((b) => formatNum(b.roomNo, useBn)).join(', ')})`
              );
              const pageWaUrl = buildWhatsAppUrl('', pageWaText);

              return (
                <div key={`a4-page-${pageIdx}`} className="space-y-2">
                  {/* Per-page screen header bar */}
                  <div className="no-print flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs">
                    <span className="font-bold text-slate-800">
                      📄 A4 পৃষ্ঠা #{formatNum(pageIdx + 1, useBn)} — {formatNum(pageBills.length, useBn)}টি A6 রশিদ (রুম {pageBills.map((b) => formatNum(b.roomNo, useBn)).join(', ')})
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveSinglePageToGallery(pageIdx)}
                        disabled={downloadingImages}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold transition-colors"
                      >
                        <ImageDown className="w-3.5 h-3.5" />
                        <span>গ্যালারিতে সেভ (৪×A6)</span>
                      </button>
                      <a
                        href={pageWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded-md text-[11px] font-bold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>এই ৪টি রুম WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`page-${pageIdx}`, pageWaText)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-[11px] font-semibold border border-slate-300"
                      >
                        {copiedId === `page-${pageIdx}` ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === `page-${pageIdx}` ? 'কপি হয়েছে' : 'কপি'}</span>
                      </button>
                    </div>
                  </div>

                  {/* A4 2x2 Grid Page (Each cell is A6-proportioned 105x148mm) */}
                  <div
                    ref={(el) => {
                      pageRefs.current[pageIdx] = el;
                    }}
                    className="a4-four-grid-page grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white p-3 rounded-xl border border-slate-200"
                  >
                    {pageBills.map((bill) => {
                      const floorName = FLOOR_NAMES_BN[bill.floor] || `${bill.floor} তলা`;
                      const singleText = buildSingleBillText(bill);
                      const singleWaUrl = buildWhatsAppUrl(bill.tenantPhone, singleText);

                      return (
                        <div
                          key={bill.id}
                          className="a4-compact-card bg-white p-3.5 rounded-lg border-2 border-dashed border-slate-400 font-sans flex flex-col justify-between min-h-[340px]"
                        >
                          <div>
                            {/* Per-card WhatsApp quick bar (Screen only) */}
                            <div className="no-print flex items-center justify-between gap-1.5 pb-1.5 mb-1.5 border-b border-slate-100">
                              <span className="text-[11px] font-bold text-indigo-800">
                                A6 রশিদ · রুম {formatNum(bill.roomNo, useBn)}
                              </span>
                              <div className="flex items-center gap-1">
                                <a
                                  href={singleWaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded text-[10px] font-bold transition-colors"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(bill.id, singleText)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-medium border border-slate-200"
                                >
                                  {copiedId === bill.id ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Compact A6 Header */}
                            <div className="text-center pb-1.5 border-b border-slate-800">
                              <h2 className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
                                {settings.buildingName}
                              </h2>
                              <p className="text-[10px] text-slate-600 leading-tight">
                                {settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'}: {settings.landlordName} ({settings.landlordPhone || SUPPORT_PHONES_DISPLAY})
                              </p>
                              <div className="inline-block mt-1 px-2 py-0.2 border border-slate-800 rounded font-bold text-[10px]">
                                ভাড়া ও বিদ্যুৎ রশিদ (A6) — {monthDisplay}
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-1.5 py-1.5 text-[11px] border-b border-slate-200">
                              <div>
                                <p>
                                  <span className="text-slate-500">রুম:</span>{' '}
                                  <strong className="text-slate-900">
                                    {formatNum(bill.roomNo, useBn)} ({floorName})
                                  </strong>
                                </p>
                                <p className="truncate">
                                  <span className="text-slate-500">নাম:</span>{' '}
                                  <strong className="text-slate-900">{bill.tenantName || '—'}</strong>
                                </p>
                              </div>
                              <div className="text-right">
                                <p>
                                  <span className="text-slate-500">তারিখ:</span>{' '}
                                  <span className="font-mono">{new Date().toLocaleDateString('bn-BD')}</span>
                                </p>
                                <p>
                                  <span className="text-slate-500">ফোন:</span>{' '}
                                  <span className="font-mono">{bill.tenantPhone || '—'}</span>
                                </p>
                              </div>
                            </div>

                            {/* Itemized Table */}
                            <table className="w-full text-[11px] mt-1.5 border-collapse">
                              <thead>
                                <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                                  <th className="py-1 px-1.5 text-left">বিবরণ</th>
                                  <th className="py-1 px-1.5 text-center">ইউনিট</th>
                                  <th className="py-1 px-1.5 text-right">টাকা</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                <tr>
                                  <td className="py-1 px-1.5 font-medium">১. মাসিক বাড়ি ভাড়া</td>
                                  <td className="py-1 px-1.5 text-center text-slate-500">—</td>
                                  <td className="py-1 px-1.5 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(bill.rent, useBn)}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1 px-1.5">
                                    <div className="font-medium">২. নিজস্ব বিদ্যুৎ বিল</div>
                                    <div className="text-[9.5px] text-slate-500 font-mono">
                                      বর্তমান {formatNum(bill.now, useBn)} · পূর্ব {formatNum(bill.prev, useBn)}
                                    </div>
                                  </td>
                                  <td className="py-1 px-1.5 text-center font-mono">
                                    {formatNum(bill.units, useBn)} u
                                  </td>
                                  <td className="py-1 px-1.5 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(bill.electricityCost, useBn)}
                                  </td>
                                </tr>
                                <tr>
                                  <td className="py-1 px-1.5 font-medium">৩. ডাইনিং সাব-মিটার ভাগ</td>
                                  <td className="py-1 px-1.5 text-center text-slate-500">সমান ভাগ</td>
                                  <td className="py-1 px-1.5 text-right font-mono font-bold tabular-nums">
                                    {formatCurrency(bill.sharedElectricity, useBn)}
                                  </td>
                                </tr>
                                {bill.other > 0 && (
                                  <tr>
                                    <td className="py-1 px-1.5 font-medium">
                                      ৪. অন্যান্য ({bill.note || 'চার্জ'})
                                    </td>
                                    <td className="py-1 px-1.5 text-center text-slate-500">—</td>
                                    <td className="py-1 px-1.5 text-right font-mono font-bold tabular-nums">
                                      {formatCurrency(bill.other, useBn)}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold">
                                  <td colSpan={2} className="py-1 px-1.5 text-right">সর্বমোট বিল:</td>
                                  <td className="py-1 px-1.5 text-right font-mono tabular-nums">
                                    {formatCurrency(bill.total, useBn)}
                                  </td>
                                </tr>
                                <tr className="border-t border-slate-200">
                                  <td colSpan={2} className="py-0.5 px-1.5 text-right text-emerald-800 font-semibold">
                                    জমা:
                                  </td>
                                  <td className="py-0.5 px-1.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                                    {formatCurrency(bill.paid, useBn)}
                                  </td>
                                </tr>
                                <tr className="border-t border-slate-300 font-bold bg-amber-50/60">
                                  <td colSpan={2} className="py-0.5 px-1.5 text-right text-amber-900">
                                    বকেয়া:
                                  </td>
                                  <td className="py-0.5 px-1.5 text-right font-mono tabular-nums text-red-600">
                                    {formatCurrency(bill.due, useBn)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          <div>
                            <div className="mt-1.5 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-1 rounded border border-slate-200 truncate">
                              কথায়: <strong>{amountInBengaliWords(bill.total)}</strong>
                            </div>

                            {/* Compact Signatures */}
                            <div className="mt-5 pt-2 flex justify-between items-end text-[10px]">
                              <div className="text-center w-28 border-t border-dashed border-slate-600 pt-0.5">
                                ভাড়াটিয়ার স্বাক্ষর
                              </div>
                              <div className="text-center w-32 border-t border-dashed border-slate-600 pt-0.5 font-medium">
                                {settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'} স্বাক্ষর
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="no-print p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs">
          <span className="text-slate-600">
            মোট {formatNum(monthBills.length, useBn)}টি রসিদ · প্রতি A4 পেজে ৪টি A6 বিল ({formatNum(pagesOfFour.length, useBn)}টি A4 পৃষ্ঠা)
          </span>
          <div className="flex flex-wrap gap-2">
            {monthBills.length > 0 && (
              <>
                <button
                  onClick={handleSaveGalleryImages}
                  disabled={downloadingImages}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  {downloadingImages ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageDown className="w-4 h-4" />
                  )}
                  <span>{downloadingImages ? 'ছবি তৈরি হচ্ছে...' : 'গ্যালারিতে সেভ (A4 ৪×A6 ছবি)'}</span>
                </button>
                <button
                  onClick={handleDownloadA4Pdf}
                  disabled={downloadingPdf}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold flex items-center gap-1.5"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>{downloadingPdf ? 'তৈরি হচ্ছে...' : 'A4 PDF ডাউনলোড'}</span>
                </button>
                <a
                  href={allSummaryWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded-lg font-bold flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              </>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg font-medium"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
