'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  viewName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminErrorBoundary] Capturado error en componente:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const viewTitle = this.props.viewName || 'esta sección';
      const errorMessage = this.state.error?.message || 'Error desconocido';

      return (
        <div className="max-w-2xl mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-slate-800 rounded-3xl border border-red-200 dark:border-red-900/60 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
          <div className="size-16 mx-auto rounded-2xl bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
            <span className="material-symbols-outlined text-3xl">error_outline</span>
          </div>

          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Ocurrió un error al cargar {viewTitle}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Se detectó un problema en la vista. Podés reintentar cargarla o recargar la página.
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-950/40 p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 text-left text-xs font-mono text-red-800 dark:text-red-300 overflow-x-auto max-h-40">
            <span className="font-bold">Detalle técnico: </span>
            {errorMessage}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleRetry}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              Reintentar
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/admin?view=dashboard';
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">space_dashboard</span>
              Ir al Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

