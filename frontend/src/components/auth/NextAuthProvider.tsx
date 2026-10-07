'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { fetchApi } from '@/utils/api';

function AuthSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setToken = useAuthStore(s => s.setToken);
  const setUser = useAuthStore(s => s.setUser);
  const closeModal = useAuthModalStore(s => s.closeModal);
  const executePendingAction = useAuthModalStore(s => s.executePendingAction);
  const isSyncing = useRef(false);

  useEffect(() => {
    const isLoggedOut = typeof window !== 'undefined' && localStorage.getItem('auth_logged_out') === 'true';

    // When NextAuth is authenticated, but the user is not loaded in our custom store and hasn't logged out
    if (status === 'authenticated' && session?.user && (!user || !token) && !isLoggedOut && !isSyncing.current) {
      isSyncing.current = true;
      fetchApi('/api/auth/oauth-callback', { method: 'POST' })
        .then(async (data) => {
          setToken(data.access_token);
          const userProfile = await fetchApi('/api/auth/me', {
            headers: { 'X-API-KEY': data.access_token },
          });
          setUser(userProfile);
          closeModal();
          executePendingAction();
        })
        .catch((err) => {
          console.error('Error sincronizando sesión OAuth:', err);
        })
        .finally(() => {
          isSyncing.current = false;
        });
    }
  }, [status, session, user, token, setToken, setUser, closeModal, executePendingAction]);

  return <>{children}</>;
}

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthSync>{children}</AuthSync>
    </SessionProvider>
  );
}
