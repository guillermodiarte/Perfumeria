'use client';

import { useEffect, useRef } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';

/**
 * StoreSyncProvider
 *
 * PROBLEMA RESUELTO:
 * El store Zustand persiste en localStorage, que es LOCAL a cada dispositivo.
 * Si el admin cargaba datos desde la PC, el celular NO los veía porque tiene
 * su propio localStorage vacío o desactualizado.
 *
 * SOLUCIÓN:
 * 1. Al montar, SIEMPRE pide los datos al servidor (fuente de verdad).
 * 2. Si el servidor tiene datos, los importa al store LOCAL (override del localStorage).
 * 3. Solo cuando el servidor NO tiene datos Y hay datos locales, inicializa la DB.
 * 4. La suscripción solo se activa DESPUÉS de que la carga inicial terminó,
 *    evitando la race condition donde el móvil sobreescribía la DB con datos vacíos.
 */
export default function StoreSyncProvider() {
  const isInitialized = useRef(false);
  const isLoading = useRef(false);
  const isSyncing = useRef(false);
  const pendingSyncState = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function doSync(stateToSync: any) {
      if (!isMounted) return;
      if (isSyncing.current) {
        pendingSyncState.current = stateToSync;
        return;
      }
      isSyncing.current = true;
      try {
        await fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: stateToSync.products,
            categoriesConfig: stateToSync.categoriesConfig,
            variantGroupsConfig: stateToSync.variantGroupsConfig,
            perfumeTypesConfig: stateToSync.perfumeTypesConfig,
            purchases: stateToSync.purchases,
            sales: stateToSync.sales,
            globalMarkupPrc: stateToSync.globalMarkupPrc,
            wholesaleConfig: stateToSync.wholesaleConfig,
          }),
        });
      } catch (e: any) {
        if (e.name !== 'AbortError' && e.code !== 'ECONNRESET') {
          console.warn('[StoreSyncProvider] Aviso en autosync:', e);
        }
      } finally {
        isSyncing.current = false;
        if (pendingSyncState.current && isMounted) {
          const nextState = pendingSyncState.current;
          pendingSyncState.current = null;
          doSync(nextState);
        }
      }
    }

    async function initSync() {
      if (isLoading.current) return;
      isLoading.current = true;

      try {
        const res = await fetch('/api/store/sync', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
        });

        if (!isMounted) return;

        if (res.ok) {
          const json = await res.json();

          if (json.data && json.data.products !== undefined) {
            // ✅ El servidor tiene datos: usarlos como fuente de verdad absoluta.
            useStockFlowStore.getState().importData(json.data);
          } else {
            // BD vacía: solo subir datos locales si existen (primera carga)
            const currentState = useStockFlowStore.getState();
            const hasLocalData =
              (currentState.products?.length || 0) > 0 ||
              (currentState.purchases?.length || 0) > 0 ||
              (currentState.sales?.length || 0) > 0;

            if (hasLocalData) {
              doSync(currentState);
            }
          }
        }
      } catch (err) {
        console.warn('[StoreSyncProvider] No se pudo sincronizar con el backend:', err);
      } finally {
        if (isMounted) {
          isInitialized.current = true;
          isLoading.current = false;
        }
      }
    }

    // Esperar un tick para que Zustand termine de rehidratar el localStorage
    const initTimer = setTimeout(initSync, 200);

    // Suscribirse a cambios del store para persistir automáticamente a la BD.
    const unsubscribe = useStockFlowStore.subscribe((state) => {
      if (!isInitialized.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        doSync(state);
      }, 1500);
    });

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return null;
}
