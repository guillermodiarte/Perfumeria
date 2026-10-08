'use client';

import { useEffect, useRef } from 'react';
import { useStockFlowStore } from '@/store/useStockStore';

export default function StoreSyncProvider() {
  const isInitialized = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initSync() {
      try {
        const res = await fetch('/api/store/sync', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json.data && isMounted) {
            // Sincronizar estado desde la base de datos backend al store
            useStockFlowStore.getState().importData(json.data);
          } else if (!json.data && isMounted) {
            // La base de datos aún no tiene catálogo: inicializarla con los datos actuales
            const currentState = useStockFlowStore.getState();
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
            }).catch(e => console.error('Error inicializando catálogo en DB:', e));
          }
        }
      } catch (err) {
        console.warn('No se pudo sincronizar el catálogo con el backend:', err);
      } finally {
        if (isMounted) {
          isInitialized.current = true;
        }
      }
    }

    initSync();

    // Suscribirse a cambios en el store para persistir automáticamente a la base de datos
    const unsubscribe = useStockFlowStore.subscribe((state) => {
      if (!isInitialized.current) return;

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

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
        }).catch(e => console.error('Error en autosync de catálogo a DB:', e));
      }, 1000);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return null;
}
