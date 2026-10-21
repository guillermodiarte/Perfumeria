'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStockFlowStore, Product, SaleRecord } from '@/store/useStockStore';
import { API_URL } from '@/utils/api';

export type ViewId =
  | 'dashboard'
  | 'products'
  | 'combos'
  | 'sections'
  | 'compras'
  | 'ventas'
  | 'pedidos_web'
  | 'ventas_mostrador'
  | 'cobros_pendientes'
  | 'ventas_realizadas'
  | 'users'
  | 'admins'
  | 'finanzas'
  | 'media'
  | 'configuracion';

interface AdminGlobalSearchProps {
  onNavigateView: (view: ViewId, searchFilter?: string) => void;
  users?: any[];
  className?: string;
}

interface SearchResultItem {
  id: string;
  category: 'producto' | 'venta' | 'cliente' | 'imagen' | 'seccion';
  title: string;
  subtitle: string;
  icon: string;
  badgeColor: string;
  badgeLabel: string;
  imageUrl?: string;
  targetView: ViewId;
  searchFilter?: string;
}

const SYSTEM_SECTIONS: { title: string; subtitle: string; icon: string; view: ViewId; keywords: string[] }[] = [
  { title: 'Productos y Stock', subtitle: 'Inventario, precios, variantes y categorías', icon: 'inventory_2', view: 'products', keywords: ['producto', 'stock', 'inventario', 'articulos', 'precio'] },
  { title: 'Armar Combo / Set', subtitle: 'Crear sets de regalo y combos con insumos', icon: 'featured_seasonal_and_gifts', view: 'combos', keywords: ['combo', 'set', 'regalo', 'armar', 'paquete'] },
  { title: 'Compras de Proveedores', subtitle: 'Registrar lotes de compra y costos', icon: 'local_shipping', view: 'compras', keywords: ['compra', 'lote', 'proveedor', 'costo', 'factura'] },
  { title: 'Punto de Venta / Caja', subtitle: 'Caja rápida de mostrador y cobro', icon: 'point_of_sale', view: 'ventas', keywords: ['caja', 'vender', 'pos', 'mostrador', 'cobro', 'ticket'] },
  { title: 'Historial de Ventas', subtitle: 'Ventas realizadas y tickets emitidos', icon: 'receipt_long', view: 'ventas_realizadas', keywords: ['ventas', 'historial', 'tickets', 'facturas'] },
  { title: 'Pedidos Web', subtitle: 'Gestión y despacho de órdenes online', icon: 'shopping_cart_checkout', view: 'pedidos_web', keywords: ['pedidos', 'ordenes', 'web', 'carrito', 'envios'] },
  { title: 'Cobros Pendientes', subtitle: 'Cuentas corrientes y saldos por cobrar', icon: 'pending_actions', view: 'cobros_pendientes', keywords: ['cobros', 'pendientes', 'deuda', 'cuenta corriente', 'fiado'] },
  { title: 'Clientes y Registros', subtitle: 'Base de clientes y solicitudes mayoristas', icon: 'group', view: 'users', keywords: ['clientes', 'usuarios', 'compradores', 'mayoristas', 'cuentas'] },
  { title: 'Finanzas y Balances', subtitle: 'Ingresos, gastos, ganancias y métricas', icon: 'account_balance_wallet', view: 'finanzas', keywords: ['finanzas', 'balance', 'ganancias', 'gastos', 'metricas', 'dinero'] },
  { title: 'Biblioteca de Medios', subtitle: 'Imágenes, banners y fotos subidas', icon: 'photo_library', view: 'media', keywords: ['imagen', 'imagenes', 'fotos', 'banner', 'galeria', 'media'] },
  { title: 'Configuración General', subtitle: 'Ajustes de tienda, moneda y sistema', icon: 'settings', view: 'configuracion', keywords: ['configuracion', 'ajustes', 'dolar', 'moneda', 'porcentajes'] },
];

export default function AdminGlobalSearch({ onNavigateView, users = [], className = '' }: AdminGlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const products = useStockFlowStore((s) => s.products);
  const sales = useStockFlowStore((s) => s.sales);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+K or Ctrl+K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute search results across all entities
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const list: SearchResultItem[] = [];

    // 1. Secciones del sistema
    SYSTEM_SECTIONS.forEach((sec) => {
      const matchTitle = sec.title.toLowerCase().includes(q);
      const matchKeywords = sec.keywords.some((k) => k.includes(q));
      if (matchTitle || matchKeywords) {
        list.push({
          id: `sec-${sec.view}`,
          category: 'seccion',
          title: sec.title,
          subtitle: sec.subtitle,
          icon: sec.icon,
          badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          badgeLabel: 'Sección',
          targetView: sec.view,
        });
      }
    });

    // 2. Productos
    let prodMatches = 0;
    for (const p of products) {
      if (prodMatches >= 8) break;
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku && p.sku.toLowerCase().includes(q);
      const matchCat = p.categoryId && p.categoryId.toLowerCase().includes(q);
      const matchTag = p.tag && p.tag.toLowerCase().includes(q);

      if (matchName || matchSku || matchCat || matchTag) {
        prodMatches++;
        const totalStock = p.variants?.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0) || 0;
        const img = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls[0] : undefined;
        list.push({
          id: `prod-${p.id}`,
          category: 'producto',
          title: p.name,
          subtitle: `SKU: ${p.sku || 'S/D'} • Cat: ${p.categoryId} • Stock: ${totalStock} un. • $${(p.salePrice || 0).toLocaleString('es-AR')}`,
          icon: 'inventory_2',
          badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          badgeLabel: p.isBundle ? 'Combo / Set' : 'Producto',
          imageUrl: img ? (img.startsWith('http') ? img : `${API_URL}${img}`) : undefined,
          targetView: 'products',
          searchFilter: p.name,
        });
      }
    }

    // 3. Clientes / Usuarios
    let userMatches = 0;
    for (const u of users) {
      if (userMatches >= 5) break;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();

      if (name.includes(q) || email.includes(q) || phone.includes(q)) {
        userMatches++;
        list.push({
          id: `user-${u.id || u.email}`,
          category: 'cliente',
          title: u.name || u.email,
          subtitle: `${u.email} • Tel: ${u.phone || 'S/D'} • ${u.is_wholesale ? 'Mayorista' : u.role === 'admin' ? 'Admin' : 'Minorista'}`,
          icon: 'person',
          badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          badgeLabel: 'Cliente',
          targetView: 'users',
          searchFilter: u.name || u.email,
        });
      }
    }

    // 4. Ventas
    let saleMatches = 0;
    for (const s of sales) {
      if (saleMatches >= 5) break;
      const ticket = (s.ticketId || '').toLowerCase();
      const prodName = (s.productName || '').toLowerCase();
      const client = (s.clientName || '').toLowerCase();

      if (ticket.includes(q) || prodName.includes(q) || client.includes(q)) {
        saleMatches++;
        const dateStr = s.date ? new Date(s.date).toLocaleDateString('es-AR') : '';
        list.push({
          id: `sale-${s.id}-${s.ticketId}`,
          category: 'venta',
          title: `Ticket #${s.ticketId} — ${s.productName}`,
          subtitle: `${dateStr} • Cant: ${s.quantity} • Total: $${(s.totalSalePrice || (s.unitSalePrice || 0) * (s.quantity || 1)).toLocaleString('es-AR')}`,
          icon: 'receipt_long',
          badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          badgeLabel: 'Venta',
          targetView: 'ventas_realizadas',
          searchFilter: s.ticketId,
        });
      }
    }

    // 5. Imágenes / Fotos de Productos
    let imgMatches = 0;
    for (const p of products) {
      if (imgMatches >= 4) break;
      if (p.imageUrls && p.imageUrls.length > 0) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchUrl = p.imageUrls.some((u) => u.toLowerCase().includes(q));
        if (matchName || matchUrl) {
          imgMatches++;
          const img = p.imageUrls[0];
          list.push({
            id: `img-${p.id}`,
            category: 'imagen',
            title: `Foto de: ${p.name}`,
            subtitle: `Archivo: ${img.split('/').pop() || 'imagen.webp'} • Biblioteca de medios`,
            icon: 'image',
            badgeColor: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800',
            badgeLabel: 'Imagen',
            imageUrl: img.startsWith('http') ? img : `${API_URL}${img}`,
            targetView: 'media',
            searchFilter: p.name,
          });
        }
      }
    }

    return list;
  }, [query, products, sales, users]);

  const handleSelectResult = (item: SearchResultItem) => {
    onNavigateView(item.targetView, item.searchFilter);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Bar */}
      <div className="relative flex items-center w-full">
        <span className="material-symbols-outlined text-slate-400 absolute left-3 text-lg pointer-events-none select-none">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Buscar producto, venta, cliente, imagen..."
          className="w-full pl-9 pr-8 sm:pr-14 py-1.5 sm:py-2 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-full text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
            title="Borrar búsqueda"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        ) : (
          <span className="hidden sm:inline-block absolute right-2.5 text-[10px] font-bold text-slate-400 bg-slate-200/80 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 pointer-events-none">
            ⌘K
          </span>
        )}
      </div>

      {/* Dropdown Floating Results Modal */}
      {isOpen && (
        <div className="fixed sm:absolute top-16 sm:top-full left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] mt-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[75vh] flex flex-col">
          {/* Header summary of search */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">travel_explore</span>
              <span>Búsqueda Global en Sistema</span>
            </span>
            {query && (
              <span className="text-[11px] text-slate-400 font-medium">
                {results.length} coincidencia(s)
              </span>
            )}
          </div>

          {/* Results list */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {!query ? (
              <div className="p-5 text-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">manage_search</span>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Escribe para buscar en todo el sistema
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">📦 Productos y SKU</span>
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">🧾 Tickets y Ventas</span>
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">👤 Clientes</span>
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">🖼️ Fotos e Imágenes</span>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">search_off</span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No se encontraron coincidencias para &ldquo;{query}&rdquo;
                </p>
                <p className="text-[11px] text-slate-400">
                  Intenta buscar por nombre de producto, SKU, cliente, ticket o sección.
                </p>
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectResult(item)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left cursor-pointer group"
                >
                  {/* Thumbnail or Icon */}
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg group-hover:text-primary transition-colors">
                        {item.icon}
                      </span>
                    )}
                  </div>

                  {/* Title & subtitle */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>

                  {/* Badge */}
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 ${item.badgeColor}`}>
                    {item.badgeLabel}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
