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
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

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
            // Esto garantiza que PC, móvil y cualquier dispositivo vean lo mismo.
            useStockFlowStore.getState().importData(json.data);
          } else {
            // BD vacía: solo subir datos locales si existen (primera carga)
            const currentState = useStockFlowStore.getState();
            const hasLocalData =
              currentState.products?.length > 0 ||
              currentState.purchases?.length > 0 ||
              currentState.sales?.length > 0;

            if (hasLocalData) {
              fetch('/api/store/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  products: currentState.products,
                  categoriesConfig: currentState.categoriesConfig,
                  variantGroupsConfig: currentState.variantGroupsConfig,
                  purchases: currentState.purchases,
                  sales: currentState.sales,
                  globalMarkupPrc: currentState.globalMarkupPrc,
                  wholesaleConfig: currentState.wholesaleConfig,
                }),
              }).catch(e => console.error('[StoreSyncProvider] Error inicializando catálogo en DB:', e));
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
    // antes de activar la suscripción de autosync
    const initTimer = setTimeout(initSync, 200);

    // Suscribirse a cambios del store para persistir automáticamente a la BD.
    // CRÍTICO: solo guarda si ya terminó la carga inicial (isInitialized = true).
    const unsubscribe = useStockFlowStore.subscribe((state) => {
      if (!isInitialized.current) return;

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        fetch('/api/store/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            products: state.products,
            categoriesConfig: state.categoriesConfig,
            variantGroupsConfig: state.variantGroupsConfig,
            purchases: state.purchases,
            sales: state.sales,
            globalMarkupPrc: state.globalMarkupPrc,
            wholesaleConfig: state.wholesaleConfig,
          }),
        }).catch(e => console.error('[StoreSyncProvider] Error en autosync:', e));
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
