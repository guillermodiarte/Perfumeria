'use client';

import { useToastStore } from '@/store/useToastStore';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : Info;
        
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 w-80 p-4 rounded-xl shadow-2xl transition-all duration-300 transform translate-y-0 opacity-100 ${
              isSuccess ? 'bg-white text-slate-900 border-l-4 border-green-500' :
              isError ? 'bg-white text-slate-900 border-l-4 border-red-500' :
              'bg-slate-900 text-white'
            }`}
          >
            <Icon className={`w-6 h-6 ${isSuccess ? 'text-green-500' : isError ? 'text-red-500' : 'text-blue-400'}`} />
            <p className="flex-1 text-sm font-semibold">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
