import React, { useState, useRef } from 'react';
import { BillRecord, Room, BuildingSettings } from '../types';
import {
  formatCurrency,
  formatNum,
  formatMonthName,
  amountInBengaliWords,
  FLOOR_NAMES_BN,
  buildWhatsAppUrl,
  SUPPORT_PHONES_DISPLAY,
} from '../constants';
import { Printer, Copy, Check, X, Send, MessageCircle, FileDown, Loader2, ImageDown, Share2 } from 'lucide-react';
import {
  downloadA6ReceiptPdf,
  exportA6ReceiptGalleryImage,
  saveOrShareGalleryImage,
  isIOSDevice,
  GalleryImageItem,
} from '../utils/pdfExport';

interface ReceiptModalProps {
  bill: BillRecord;
  room?: Room;
  settings: BuildingSettings;
  onClose: () => void;
  onUpdatePayment?: (billId: string, paidAmount: number) => void;
  isOwner?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  bill,
  room,
  settings,
  onClose,
  onUpdatePayment,
  isOwner = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [savedGalleryImg, setSavedGalleryImg] = useState<GalleryImageItem | null>(null);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentInput, setPaymentInput] = useState(bill.paid.toString());
  const receiptRef = useRef<HTMLDivElement>(null);

  const useBn = settings.useBengaliDigits;
  const floorName = FLOOR_NAMES_BN[bill.floor] || `${bill.floor} তলা`;
  const monthDisplay = formatMonthName(bill.month, useBn);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadA6Pdf = async () => {
    if (!receiptRef.current || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadA6ReceiptPdf(
        receiptRef.current,
        `AlamKhan_Room_${bill.roomNo}_${bill.month}_A6.pdf`
      );
    } catch (e) {
      console.error('A6 PDF export error:', e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveA6ToGallery = async () => {
    if (!receiptRef.current || downloadingImage) return;
    setDownloadingImage(true);
    try {
      const item = await exportA6ReceiptGalleryImage(
        receiptRef.current,
        `AlamKhan_Room_${bill.roomNo}_${bill.month}_A6.jpg`
      );
      setSavedGalleryImg(item);
      if (isIOSDevice()) {
        await saveOrShareGalleryImage(
          item,
          `রুম ${bill.roomNo} বিলের রসিদ (${monthDisplay})`
        );
      }
    } catch (e) {
      console.error('A6 Gallery image export error:', e);
    } finally {
      setDownloadingImage(false);
    }
  };

  const generateWhatsAppText = () => {
    return `*বাড়ি ভাড়া ও বিদ্যুৎ বিলের রশিদ*
${settings.buildingName} · ${settings.buildingAddress}
------------------------------------
রুম: ${bill.roomNo} (${floorName})
ভাড়াটিয়া: ${bill.tenantName} (${bill.tenantPhone || 'ফোন নম্বর নেই'})
বিলের মাস: ${monthDisplay}

১. মাসিক ঘর ভাড়া: ${formatCurrency(bill.rent, useBn)}
২. নিজস্ব বিদ্যুৎ (${formatNum(bill.units, useBn)} ইউনিট @ ${formatCurrency(bill.rate, useBn)}): ${formatCurrency(bill.electricityCost, useBn)}
   [আগের রিডিং: ${formatNum(bill.prev, useBn)} | বর্তমান: ${formatNum(bill.now, useBn)}]
৩. ডাইনিং মিটার ভাগ: ${formatCurrency(bill.sharedElectricity, useBn)}
${bill.other > 0 ? `৪. অন্যান্য (${bill.note || 'সার্ভিস চার্জ'}): ${formatCurrency(bill.other, useBn)}\n` : ''}
------------------------------------
*সর্বমোট প্রদেয়: ${formatCurrency(bill.total, useBn)}*
*পরিশোধিত জমা: ${formatCurrency(bill.paid, useBn)}*
*বর্তমান বকেয়া: ${formatCurrency(bill.due, useBn)}*
------------------------------------
ধন্যবাদান্তে,
${settings.landlordName} (${settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'})
মোবাইল: ${settings.landlordPhone || SUPPORT_PHONES_DISPLAY}`;
  };

  const tenantPhoneTarget = bill.tenantPhone || room?.phone || '';
  const whatsappShareUrl = buildWhatsAppUrl(tenantPhoneTarget, generateWhatsAppText());

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(paymentInput) || 0;
    if (onUpdatePayment) {
      onUpdatePayment(bill.id, val);
    }
    setIsEditingPayment(false);
  };

  return (
    <div className="print-modal-backdrop fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="print-modal-shell relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4">

        {/* Top Modal Controls (Hidden in Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div>
            <span className="font-semibold text-sm sm:text-base block leading-tight">
              রসিদ প্রিভিউ — রুম {formatNum(bill.roomNo, useBn)}
            </span>
            <span className="text-[11px] text-slate-300">
              A6 পেপার সাইজ (১০৫×১৪৮ মি.মি.) PDF ডাউনলোড সুবিধা
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleSaveA6ToGallery}
              disabled={downloadingImage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              title="ছবি হিসেবে ফোনের গ্যালারিতে সেভ করুন"
            >
              {downloadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageDown className="w-3.5 h-3.5" />
              )}
              <span>{downloadingImage ? 'তৈরি হচ্ছে...' : 'গ্যালারি (ছবি)'}</span>
            </button>
            <button
              onClick={handleDownloadA6Pdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              title="A6 সাইজে PDF রসিদ ডাউনলোড করুন"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{downloadingPdf ? 'তৈরি হচ্ছে...' : 'A6 PDF'}</span>
            </button>
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-xs"
              title="সরাসরি WhatsApp-এ রসিদ পাঠান"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট</span>
            </button>
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
              title="মেসেজ কপি করুন"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gallery Image Saved Strip */}
        {savedGalleryImg && (
          <div className="no-print px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <span className="font-semibold">
              রসিদের ছবি (.JPG) প্রস্তুত! iPhone হলে &ldquo;Photos-এ সেভ&rdquo; বাটনে চাপ দিন।
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  saveOrShareGalleryImage(
                    savedGalleryImg,
                    `রুম ${bill.roomNo} বিলের রসিদ (${monthDisplay})`
                  )
                }
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold inline-flex items-center gap-1 text-[11px]"
              >
                <Share2 className="w-3 h-3" />
                <span>গ্যালারি / Photos-এ সেভ</span>
              </button>
              <button
                type="button"
                onClick={() => setSavedGalleryImg(null)}
                className="text-emerald-700 hover:underline text-[11px]"
              >
                লুকান
              </button>
            </div>
          </div>
        )}

        {/* Printable A6 Receipt Paper */}
        <div
          id="receipt-printable"
          ref={receiptRef}
          className="receipt-container a6-receipt-sheet p-5 sm:p-6 bg-white text-slate-900 font-sans mx-auto max-w-[440px]"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-slate-900">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              {settings.buildingName}
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {settings.buildingAddress} · হেল্পলাইন: {settings.landlordPhone || SUPPORT_PHONES_DISPLAY}
            </p>
            <div className="inline-block mt-1.5 px-3 py-0.5 border border-slate-900 rounded font-bold text-[11px] tracking-wider uppercase">
              বাড়ি ভাড়া ও বিদ্যুৎ বিলের রশিদ (A6)
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 py-2.5 text-xs border-b border-slate-200">
            <div>
              <p>
                <span className="text-slate-500">আইডি:</span>{' '}
                <span className="font-mono font-medium">{bill.id.slice(0, 12)}</span>
              </p>
              <p className="mt-0.5">
                <span className="text-slate-500">রুম:</span>{' '}
                <strong className="text-slate-900">রুম {formatNum(bill.roomNo, useBn)} ({floorName})</strong>
              </p>
              <p className="mt-0.5">
                <span className="text-slate-500">ভাড়াটিয়া:</span>{' '}
                <strong className="text-slate-900">{bill.tenantName}</strong>
              </p>
            </div>
            <div className="text-right">
              <p>
                <span className="text-slate-500">তারিখ:</span>{' '}
                <span className="font-mono">{new Date().toLocaleDateString('bn-BD')}</span>
              </p>
              <p className="mt-0.5">
                <span className="text-slate-500">মাস:</span>{' '}
                <strong className="text-blue-800">{monthDisplay}</strong>
              </p>
              <p className="mt-0.5">
                <span className="text-slate-500">মোবাইল:</span>{' '}
                <span className="font-mono">{bill.tenantPhone || '—'}</span>
              </p>
            </div>
          </div>

          {/* Itemized Bill Table */}
          <table className="w-full text-xs mt-3 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 text-slate-700">
                <th className="py-1.5 px-2 text-left w-8">ক্র.</th>
                <th className="py-1.5 px-2 text-left">বিবরণ</th>
                <th className="py-1.5 px-2 text-center">ইউনিট</th>
                <th className="py-1.5 px-2 text-right">টাকা</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-1.5 px-2 text-left font-mono">{formatNum(1, useBn)}</td>
                <td className="py-1.5 px-2 font-medium">মাসিক বাড়ি ভাড়া</td>
                <td className="py-1.5 px-2 text-center text-slate-500">—</td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(bill.rent, useBn)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-left font-mono">{formatNum(2, useBn)}</td>
                <td className="py-1.5 px-2">
                  <div className="font-medium">নিজস্ব সাব-মিটার বিদ্যুৎ</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    বর্তমান {formatNum(bill.now, useBn)} | পূর্ব {formatNum(bill.prev, useBn)} | @{formatCurrency(bill.rate, useBn)}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-center font-mono font-medium tabular-nums">
                  {formatNum(bill.units, useBn)} u
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(bill.electricityCost, useBn)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 text-left font-mono">{formatNum(3, useBn)}</td>
                <td className="py-1.5 px-2">
                  <div className="font-medium">ডাইনিং সাব-মিটার ভাগ</div>
                  <div className="text-[10px] text-slate-500">তলার ডাইনিং মিটার অংশ</div>
                </td>
                <td className="py-1.5 px-2 text-center text-slate-500">সমান</td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums">
                  {formatCurrency(bill.sharedElectricity, useBn)}
                </td>
              </tr>
              {bill.other > 0 && (
                <tr>
                  <td className="py-1.5 px-2 text-left font-mono">{formatNum(4, useBn)}</td>
                  <td className="py-1.5 px-2">
                    <div className="font-medium">অন্যান্য চার্জ</div>
                    <div className="text-[10px] text-slate-500">{bill.note || 'পরিচ্ছন্নতা / বিবিধ'}</div>
                  </td>
                  <td className="py-1.5 px-2 text-center text-slate-500">—</td>
                  <td className="py-1.5 px-2 text-right font-mono font-semibold tabular-nums">
                    {formatCurrency(bill.other, useBn)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                <td colSpan={3} className="py-2 px-2 text-right">সর্বমোট বিল:</td>
                <td className="py-2 px-2 text-right font-mono text-sm tabular-nums text-slate-900">
                  {formatCurrency(bill.total, useBn)}
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td colSpan={3} className="py-1.5 px-2 text-right text-emerald-800 font-semibold">জমা / পরিশোধ:</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold tabular-nums text-emerald-700">
                  {formatCurrency(bill.paid, useBn)}
                </td>
              </tr>
              <tr className="border-t border-slate-300 font-bold bg-amber-50/60">
                <td colSpan={3} className="py-1.5 px-2 text-right text-amber-900">অবশিষ্ট বকেয়া:</td>
                <td className="py-1.5 px-2 text-right font-mono text-sm tabular-nums text-red-600">
                  {formatCurrency(bill.due, useBn)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* In Words */}
          <div className="mt-2.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
            <span>কথায়: </span>
            <strong className="text-slate-800">{amountInBengaliWords(bill.total)}</strong>
          </div>

          {/* Signatures */}
          <div className="mt-10 pt-3 flex justify-between items-end text-[11px]">
            <div className="text-center">
              <div className="w-32 border-t border-dashed border-slate-600 pt-1">
                ভাড়াটিয়ার স্বাক্ষর
              </div>
            </div>
            <div className="text-center">
              <div className="w-36 border-t border-dashed border-slate-600 pt-1 font-medium">
                {settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'} স্বাক্ষর
              </div>
              <div className="text-[9.5px] text-slate-500 mt-0.5">
                {settings.landlordName} ({settings.landlordPhone || SUPPORT_PHONES_DISPLAY})
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Controls (no-print) */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-500">স্ট্যাটাস: </span>
            {bill.due <= 0 ? (
              <span className="font-semibold text-emerald-700">✓ সম্পূর্ণ পরিশোধিত</span>
            ) : bill.paid > 0 ? (
              <span className="font-semibold text-amber-700">
                আংশিক জমা ({formatCurrency(bill.paid, useBn)}) · বকেয়া {formatCurrency(bill.due, useBn)}
              </span>
            ) : (
              <span className="font-semibold text-red-600">অপরিশোধিত বকেয়া</span>
            )}
          </div>

          {isEditingPayment && isOwner ? (
            <form onSubmit={handleSavePayment} className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={bill.total}
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
                className="w-28 px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                placeholder="জমা টাকা"
                autoFocus
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
              >
                সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPayment(false)}
                className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300"
              >
                বাতিল
              </button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveA6ToGallery}
                disabled={downloadingImage}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                <ImageDown className="w-3.5 h-3.5" />
                <span>{downloadingImage ? 'সেভ হচ্ছে...' : 'গ্যালারিতে সেভ'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadA6Pdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{downloadingPdf ? 'ডাউনলোড হচ্ছে...' : 'A6 PDF ডাউনলোড'}</span>
              </button>
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-950 bg-[#25D366] hover:bg-[#1fb857] rounded-lg"
              >
                <Send className="w-3 h-3" />
                <span>WhatsApp</span>
              </a>
              {isOwner && onUpdatePayment && (
                <button
                  type="button"
                  onClick={() => setIsEditingPayment(true)}
                  className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  জমা আপডেট
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
              >
                বন্ধ
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
