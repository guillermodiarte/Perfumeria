'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/utils/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  // Update local store if logged in
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No se proporcionó un token de verificación.');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetchApi(`/api/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(res.message || 'Correo verificado correctamente.');
        
        if (user) {
          setUser({ ...user, email_verified: true });
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Error al verificar el correo.');
      }
    };

    verify();
  }, [token, user, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
      <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 w-full max-w-md text-center">
        
        {status === 'loading' && (
          <>
            <span className="material-symbols-outlined text-6xl text-slate-300 animate-spin mb-4 block">sync</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Verificando...</h1>
            <p className="text-slate-500 mt-2">Por favor, espera un momento.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="size-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Correo Verificado!</h1>
            <p className="text-slate-500 mb-8">{message}</p>
            <Link href="/catalog" className="w-full inline-block bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors">
              Ir a la tienda
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="size-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">error</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Error de Verificación</h1>
            <p className="text-slate-500 mb-8">{message}</p>
            <Link href="/login" className="w-full inline-block bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
