import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে।',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application boundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200 shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">
                অ্যাপটি লোড করতে সাময়িক সমস্যা হয়েছে
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                চিন্তার কারণ নেই — আপনার সংরক্ষিত হিসাব নিরাপদ রয়েছে। নিচের বোতামে চাপ দিয়ে অ্যাপটি পুনরায় চালু করুন।
              </p>
              {this.state.errorMessage && (
                <div className="mt-2 p-2.5 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-600 break-words">
                  {this.state.errorMessage}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>পুনরায় লোড করুন</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
