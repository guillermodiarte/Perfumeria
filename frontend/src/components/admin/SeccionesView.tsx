'use client';
import React, { useState, useEffect } from 'react';
import { useSiteSettingsStore } from '@/store/useSiteSettingsStore';

export default function SeccionesView({ apiKey, apiUrl, showAlert }: { apiKey: string, apiUrl: string, showAlert: (m: string) => void }) {
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // States for banner editor
  const [bannerSlides, setBannerSlides] = useState<any[]>([]);
  const [bannerInterval, setBannerInterval] = useState<number>(6);

  // States for categories editor
  const [categoryCards, setCategoryCards] = useState<any[]>([]);

  // States for header & logo editor
  const [headerSettings, setHeaderSettingsState] = useState({
    logoUrl: '/uploads/Logo/logo.webp',
    logoHeight: 48,
    showSocials: true,
    facebookUrl: '#',
    instagramUrl: '#',
    whatsapp: '5493704747426',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');

  const [uploadingSlideIdx, setUploadingSlideIdx] = useState<number | null>(null);
  const [uploadingCatIdx, setUploadingCatIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const getMediaSrc = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const clean = url.startsWith('/') ? url : `/${url}`;
    return `${apiUrl}${clean}`;
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/settings`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const settingsMap: Record<string, any> = {};
        data.forEach((item: any) => {
          settingsMap[item.key] = item.value;
        });
        setSettings(settingsMap);
      }
    } catch (e) {
      console.error(e);
      showAlert("Error al cargar configuraciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [apiUrl]);

  const handleEditSection = (section: string) => {
    setActiveEditor(section);
    if (section === 'home_banner') {
      const bannerData = settings['home_banner'];
      setBannerInterval(bannerData?.interval ? Number(bannerData.interval) : 6);
      if (bannerData && bannerData.slides && bannerData.slides.length > 0) {
        setBannerSlides(bannerData.slides.map((s: any) => ({
          tagline: s.tagline !== undefined ? s.tagline : 'CIARA BONITA COLLECTION',
          title: s.title || '',
          highlightTitle: s.highlightTitle !== undefined 
            ? s.highlightTitle 
            : (s.subtitle && s.subtitle.length < 40 ? s.subtitle : ''),
          description: s.description !== undefined 
            ? s.description 
            : (s.subtitle && s.subtitle.length >= 40 
                ? s.subtitle 
                : 'Diseñado para resaltar tu personalidad. Perfumes y accesorios que dejan una huella inolvidable en cada paso.'),
          buttonText: s.buttonText || 'Comprar Colección',
          link: s.link || '/catalog',
          mediaUrl: s.mediaUrl || ''
        })));
      } else if (bannerData && !bannerData.slides) {
        setBannerSlides([{
          tagline: 'CIARA BONITA COLLECTION',
          title: bannerData.title || 'DESCUBRE TU ESENCIA',
          highlightTitle: bannerData.subtitle || 'FRAGANCIAS EXCLUSIVAS',
          description: 'Diseñado para resaltar tu personalidad. Perfumes y accesorios que dejan una huella inolvidable en cada paso.',
          buttonText: 'Comprar Colección',
          link: '/catalog',
          mediaUrl: bannerData.videoUrl || bannerData.mediaUrl || '/uploads/Banners/1.webp'
        }]);
      } else {
        setBannerSlides([
          {
            tagline: 'CIARA BONITA COLLECTION',
            title: 'DESCUBRE TU ESENCIA',
            highlightTitle: 'FRAGANCIAS EXCLUSIVAS',
            description: 'Diseñado para resaltar tu personalidad. Perfumes y accesorios que dejan una huella inolvidable en cada paso.',
            buttonText: 'Comprar Colección',
            link: '/catalog',
            mediaUrl: "/uploads/Banners/1.webp"
          }
        ]);
      }
    } else if (section === 'home_categories') {
      const catData = settings['home_categories'];
      if (catData && catData.categories) {
        setCategoryCards(catData.categories);
      } else {
        setCategoryCards([
          { title: 'Perfumes de Mujer', subtitle: 'Fragancias que enamoran', mediaUrl: "/uploads/Perfumes/1.webp", link: "/catalog?category=Perfumes+de+Mujer" },
          { title: 'Perfumes de Hombre', subtitle: 'Carácter y Elegancia', mediaUrl: "/uploads/Perfumes/2.webp", link: "/catalog?category=Perfumes+de+Hombre" },
          { title: 'Labiales Exclusivos', subtitle: 'Detalles que resaltan', mediaUrl: "/uploads/Labiales/1.webp", link: "/catalog?category=Labios" }
        ]);
      }
    } else if (section === 'site_header') {
      const currentHeader = settings['site_header'] || {};
      setHeaderSettingsState({
        logoUrl: currentHeader.logoUrl || '/uploads/Logo/logo.webp',
        logoHeight: Number(currentHeader.logoHeight) || 48,
        showSocials: currentHeader.showSocials !== undefined ? currentHeader.showSocials : true,
        facebookUrl: currentHeader.facebookUrl ?? '#',
        instagramUrl: currentHeader.instagramUrl ?? '#',
        whatsapp: currentHeader.whatsapp ?? '5493704747426',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, folder: string) => {
    if (!e.target.files || e.target.files.length === 0) return null;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${apiUrl}/api/admin/media?category=${folder}`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      } else {
        showAlert('Error al subir imagen');
        return null;
      }
    } catch (err) {
      showAlert('Error de red al subir imagen');
      return null;
    } finally {
      e.target.value = '';
    }
  };

  const saveSettings = async (key: string, value: any) => {
    try {
      setSaving(true);
      setSaveSuccess(null);
      const res = await fetch(`${apiUrl}/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        if (key === 'site_header') {
          useSiteSettingsStore.getState().setHeaderSettings(value);
        }
        await fetchSettings();
        setSaveSuccess('¡Cambios guardados exitosamente! La sección fue actualizada.');
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        showAlert("Error al actualizar la sección");
      }
    } catch (e) {
      showAlert("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const renderBannerEditor = () => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Success Banner */}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-6 py-4 bg-emerald-500 text-white font-semibold text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          {saveSuccess}
          <button type="button" onClick={() => setSaveSuccess(null)} className="ml-auto text-white/80 hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
      <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">view_carousel</span> Editar Banner Principal
        </h2>
        <button onClick={() => setActiveEditor(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Control de Tiempo entre Diapositivas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">timer</span>
            Tiempo de transición entre imágenes
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Define cuántos segundos permanece visible cada diapositiva antes de pasar automáticamente a la siguiente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={2}
            max={60}
            value={bannerInterval}
            onChange={(e) => setBannerInterval(Math.max(2, parseInt(e.target.value) || 6))}
            className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-bold text-center text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">segundos</span>
        </div>
      </div>

      <div className="space-y-6">
        {bannerSlides.map((slide, idx) => (
          <div key={idx} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl relative bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="size-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-black">{idx + 1}</span>
                Slide {idx + 1}
              </h4>
              <button
                type="button"
                onClick={() => { const newSlides = [...bannerSlides]; newSlides.splice(idx, 1); setBannerSlides(newSlides); }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded-lg transition"
                title="Eliminar Slide"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Texto Superior (Etiqueta)
                </label>
                <input
                  type="text"
                  placeholder="Ej: CIARA BONITA COLLECTION"
                  value={slide.tagline ?? ''}
                  onChange={e => { const n = [...bannerSlides]; n[idx].tagline = e.target.value; setBannerSlides(n); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Título Principal (en blanco)
                </label>
                <input
                  type="text"
                  placeholder="Ej: DESCUBRE TU ESENCIA"
                  value={slide.title ?? ''}
                  onChange={e => { const n = [...bannerSlides]; n[idx].title = e.target.value; setBannerSlides(n); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Título Destacado (en color / cursiva)
                </label>
                <input
                  type="text"
                  placeholder="Ej: FRAGANCIAS EXCLUSIVAS"
                  value={slide.highlightTitle ?? ''}
                  onChange={e => { const n = [...bannerSlides]; n[idx].highlightTitle = e.target.value; setBannerSlides(n); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Subtítulo / Descripción
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Diseñado para resaltar tu personalidad. Perfumes y accesorios que dejan una huella inolvidable en cada paso."
                value={slide.description ?? ''}
                onChange={e => { const n = [...bannerSlides]; n[idx].description = e.target.value; setBannerSlides(n); }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Texto del Botón
                </label>
                <input
                  type="text"
                  placeholder="Ej: Comprar Colección"
                  value={slide.buttonText ?? ''}
                  onChange={e => { const n = [...bannerSlides]; n[idx].buttonText = e.target.value; setBannerSlides(n); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Enlace del Botón
                </label>
                <input
                  type="text"
                  placeholder="Ej: /catalog"
                  value={slide.link ?? ''}
                  onChange={e => { const n = [...bannerSlides]; n[idx].link = e.target.value; setBannerSlides(n); }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Imagen / Video sin mostrar la URL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Imagen o Video de Fondo
                </label>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3.5 py-1.5 rounded-lg text-xs transition">
                  {uploadingSlideIdx === idx ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                      <span>Subiendo archivo...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      <span>{slide.mediaUrl ? 'Cambiar archivo' : 'Subir imagen o video'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    disabled={uploadingSlideIdx !== null}
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={async (e) => {
                      setUploadingSlideIdx(idx);
                      const url = await handleFileUpload(e, 'Banners');
                      if (url) {
                        const n = [...bannerSlides];
                        n[idx].mediaUrl = url;
                        setBannerSlides(n);
                      }
                      setUploadingSlideIdx(null);
                    }}
                  />
                </label>
              </div>

              {slide.mediaUrl ? (
                <div className="relative h-44 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 group shadow-inner">
                  {slide.mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                    <video src={getMediaSrc(slide.mediaUrl)} className="w-full h-full object-cover" controls muted />
                  ) : (
                    <div
                      className="w-full h-full bg-cover bg-center"
                      style={{ backgroundImage: `url('${getMediaSrc(slide.mediaUrl)}')` }}
                    />
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 shadow">
                    <span className="material-symbols-outlined text-sm text-emerald-400">check_circle</span>
                    Archivo listo
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-400 bg-white/50 dark:bg-slate-900/50">
                  No has seleccionado ninguna imagen o video. Haz clic en "Subir imagen o video" arriba para añadir uno.
                </div>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setBannerSlides([...bannerSlides, {
            tagline: 'CIARA BONITA COLLECTION',
            title: '',
            highlightTitle: '',
            description: '',
            buttonText: 'Comprar Colección',
            link: '/catalog',
            mediaUrl: ''
          }])}
          className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Añadir Slide
        </button>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button onClick={() => setActiveEditor(null)} disabled={saving} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50">← Volver a Secciones</button>
        <button onClick={() => saveSettings('home_banner', { slides: bannerSlides, interval: bannerInterval })} disabled={saving} className="px-4 py-2 font-bold bg-primary text-white hover:bg-primary/90 rounded-lg disabled:opacity-50 flex items-center gap-2">
          {saving && <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>}
          Guardar Cambios
        </button>
      </div>
      </div>
    </div>
  );

  const renderCategoriesEditor = () => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Success Banner */}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-6 py-4 bg-emerald-500 text-white font-semibold text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          {saveSuccess}
          <button type="button" onClick={() => setSaveSuccess(null)} className="ml-auto text-white/80 hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
      <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-500">category</span> Editar Categorías Destacadas
        </h2>
        <button onClick={() => setActiveEditor(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="space-y-6">
        {categoryCards.map((cat, idx) => (
          <div key={idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl relative">
            <button onClick={() => { const newCats = [...categoryCards]; newCats.splice(idx, 1); setCategoryCards(newCats); }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-lg">
              <span className="material-symbols-outlined">delete</span>
            </button>
            <h4 className="font-bold mb-4 text-slate-700 dark:text-slate-300">Categoría {idx + 1}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Título</label>
                <input type="text" value={cat.title} onChange={e => { const n = [...categoryCards]; n[idx].title = e.target.value; setCategoryCards(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo</label>
                <input type="text" value={cat.subtitle} onChange={e => { const n = [...categoryCards]; n[idx].subtitle = e.target.value; setCategoryCards(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Enlace</label>
                <input type="text" value={cat.link} onChange={e => { const n = [...categoryCards]; n[idx].link = e.target.value; setCategoryCards(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Imagen (URL)</label>
                <div className="flex gap-2">
                  <input type="text" value={cat.mediaUrl} onChange={e => { const n = [...categoryCards]; n[idx].mediaUrl = e.target.value; setCategoryCards(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                  <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-lg text-sm flex items-center">
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                      const url = await handleFileUpload(e, 'Banners');
                      if (url) {
                        const n = [...categoryCards]; n[idx].mediaUrl = url; setCategoryCards(n);
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>
            {cat.mediaUrl && (
              <div className="mt-4 h-32 w-32 rounded-lg bg-cover bg-center border border-slate-200" style={{ backgroundImage: `url(${cat.mediaUrl.startsWith('http') ? cat.mediaUrl : apiUrl + cat.mediaUrl})` }}></div>
            )}
          </div>
        ))}
        <button onClick={() => setCategoryCards([...categoryCards, { title: '', subtitle: '', mediaUrl: '', link: '/catalog' }])} className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
          <span className="material-symbols-outlined text-[18px]">add</span> Añadir Categoría
        </button>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button onClick={() => setActiveEditor(null)} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">← Volver a Secciones</button>
        <button onClick={() => saveSettings('home_categories', { categories: categoryCards })} className="px-4 py-2 font-bold bg-primary text-white hover:bg-primary/90 rounded-lg">Guardar Cambios</button>
      </div>
      </div>
    </div>
  );

  const renderHeaderEditor = () => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-0 overflow-hidden">
      {/* Success Banner */}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-6 py-4 bg-emerald-500 text-white font-semibold text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          {saveSuccess}
          <button type="button" onClick={() => setSaveSuccess(null)} className="ml-auto text-white/80 hover:text-white">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}
      <div className="p-6 md:p-8 space-y-8">
      {/* Header Bar */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-pink-500">dock_to_bottom</span>
            Editar Logotipo y Cabecera
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Personaliza el logotipo principal de la tienda, ajusta su tamaño exacto y gestiona enlaces de redes sociales.
          </p>
        </div>
        <button
          onClick={() => setActiveEditor(null)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* BLOQUE 1: LOGOTIPO */}
      <div className="p-6 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">image</span>
              Logotipo Principal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Las imágenes subidas se optimizan y convierten automáticamente a WebP de alta velocidad.
            </p>
          </div>
          {/* Theme switcher for preview */}
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                previewTheme === 'light'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">light_mode</span> Claro
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                previewTheme === 'dark'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">dark_mode</span> Oscuro
            </button>
          </div>
        </div>

        {/* Live Preview Container */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Previsualización en tiempo real</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              Altura: {headerSettings.logoHeight}px (Ancho proporcional automático)
            </span>
          </div>

          <div
            className={`w-full min-h-[140px] rounded-2xl p-6 flex items-center justify-center border transition-colors ${
              previewTheme === 'light'
                ? 'bg-gradient-to-b from-white to-slate-100 border-slate-200'
                : 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800'
            }`}
          >
            {headerSettings.logoUrl ? (
              <img
                src={getMediaSrc(headerSettings.logoUrl)}
                alt="Previsualización Logo"
                style={{
                  height: `${headerSettings.logoHeight}px`,
                  width: 'auto',
                  maxHeight: '120px',
                }}
                className="object-contain select-none transition-all duration-200 drop-shadow-md"
              />
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl mb-1">image_not_supported</span>
                <p>No hay logotipo configurado</p>
              </div>
            )}
          </div>
        </div>

        {/* Upload & Logo Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Subir nueva imagen para el logotipo
            </label>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:bg-primary/90 transition shadow-sm">
                <span className={`material-symbols-outlined text-lg ${uploadingLogo ? 'animate-spin' : ''}`}>
                  {uploadingLogo ? 'progress_activity' : 'cloud_upload'}
                </span>
                <span>{uploadingLogo ? 'Comprimiendo a WebP...' : 'Seleccionar Imagen (PNG / JPG / WebP)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLogo}
                  className="hidden"
                  onChange={async (e) => {
                    setUploadingLogo(true);
                    try {
                      const url = await handleFileUpload(e, 'Logo');
                      if (url) {
                        setHeaderSettingsState((prev) => ({ ...prev, logoUrl: url }));
                        showAlert('✓ Nuevo logotipo cargado y optimizado a WebP exitosamente');
                      }
                    } finally {
                      setUploadingLogo(false);
                    }
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => setHeaderSettingsState((prev) => ({ ...prev, logoUrl: '/uploads/Logo/logo.webp' }))}
                title="Restablecer logo predeterminado"
                className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Recomendado: fondo transparente. Se redimensiona y comprime al vuelo.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              O ingresar URL / Ruta del archivo
            </label>
            <input
              type="text"
              value={headerSettings.logoUrl}
              onChange={(e) => setHeaderSettingsState((prev) => ({ ...prev, logoUrl: e.target.value }))}
              placeholder="/uploads/Logo/logo.webp o https://..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Control de Tamaño (Slider + Input numérico + Presets) */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">aspect_ratio</span>
              Tamaño del Logotipo (Altura)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={24}
                max={100}
                value={headerSettings.logoHeight}
                onChange={(e) => {
                  const val = Math.max(20, Math.min(120, parseInt(e.target.value) || 48));
                  setHeaderSettingsState((prev) => ({ ...prev, logoHeight: val }));
                }}
                className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-900 dark:text-white"
              />
              <span className="text-xs font-bold text-slate-400">px</span>
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={28}
            max={90}
            step={2}
            value={headerSettings.logoHeight}
            onChange={(e) =>
              setHeaderSettingsState((prev) => ({ ...prev, logoHeight: parseInt(e.target.value) }))
            }
            className="w-full accent-primary cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
          />

          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-slate-400">Preajustes rápidos:</span>
            {[
              { label: 'Chico (36px)', val: 36 },
              { label: 'Estándar (48px)', val: 48 },
              { label: 'Mediano (56px)', val: 56 },
              { label: 'Grande (68px)', val: 68 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setHeaderSettingsState((prev) => ({ ...prev, logoHeight: preset.val }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  headerSettings.logoHeight === preset.val
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BLOQUE 2: REDES SOCIALES DE CABECERA */}
      <div className="p-6 bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-500 text-xl">share</span>
            Redes Sociales y Contacto en Cabecera
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enlaces mostrados en el menú y accesos directos de la tienda.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              WhatsApp (Número con cód. país)
            </label>
            <input
              type="text"
              placeholder="Ej: 5493704747426"
              value={headerSettings.whatsapp || ''}
              onChange={(e) => setHeaderSettingsState((prev) => ({ ...prev, whatsapp: e.target.value }))}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              Instagram (URL o Perfil)
            </label>
            <input
              type="text"
              placeholder="https://instagram.com/tu_cuenta"
              value={headerSettings.instagramUrl || ''}
              onChange={(e) => setHeaderSettingsState((prev) => ({ ...prev, instagramUrl: e.target.value }))}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              Facebook (URL o Página)
            </label>
            <input
              type="text"
              placeholder="https://facebook.com/tu_pagina"
              value={headerSettings.facebookUrl || ''}
              onChange={(e) => setHeaderSettingsState((prev) => ({ ...prev, facebookUrl: e.target.value }))}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>
      </div>

      {/* Botones Guardar / Cancelar */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => setActiveEditor(null)}
          className="px-5 py-2.5 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
        >
          ← Volver a Secciones
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => saveSettings('site_header', headerSettings)}
          className="px-6 py-2.5 font-bold text-xs bg-primary text-white hover:bg-primary/90 rounded-xl transition flex items-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
            {saving ? 'progress_activity' : 'save'}
          </span>
          <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
      </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-12 text-center text-slate-500"><span className="material-symbols-outlined animate-spin text-4xl">autorenew</span></div>;
  }

  if (activeEditor === 'home_banner') return renderBannerEditor();
  if (activeEditor === 'home_categories') return renderCategoriesEditor();
  if (activeEditor === 'site_header') return renderHeaderEditor();

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Panel de Secciones</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Selecciona una sección para editar el contenido dinámico de la tienda web.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Banner Principal */}
        <div onClick={() => handleEditSection('home_banner')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
          <div className="size-12 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">view_carousel</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Banner Principal</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Sube imágenes o videos para el carrusel de inicio, cambia el texto destacado y el botón de llamada a la acción.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            <span className="w-8 h-1.5 rounded-full bg-blue-500"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
          </div>
          <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </div>

        {/* Comprar por Categoría */}
        <div onClick={() => handleEditSection('home_categories')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
          <div className="size-12 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">category</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Categorías Destacadas</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Elige qué colecciones y categorías mostrar en la cuadrícula de acceso rápido de la página principal.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            <span className="w-8 h-1.5 rounded-full bg-purple-500"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
          </div>
          <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </div>

        {/* Últimos Ingresos */}
        <div onClick={() => showAlert("Edición de Últimos Ingresos no implementada aún.")} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
          <div className="size-12 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">new_releases</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Últimos Ingresos</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Configura qué productos se muestran en la sección de novedades (automáticos o seleccionados a mano).</p>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            <span className="w-8 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
          </div>
          <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </div>

        {/* Cabecera MENU */}
        <div onClick={() => handleEditSection('site_header')} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
          <div className="size-12 bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">dock_to_bottom</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Logotipo y Cabecera</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Personaliza el logotipo principal, modifica su tamaño interactivamente y gestiona las redes sociales.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            <span className="w-8 h-1.5 rounded-full bg-pink-500"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
          </div>
          <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </div>

        {/* Pie de Página */}
        <div onClick={() => showAlert("Edición de Pie de Página no implementada aún.")} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4 opacity-75">
          <div className="size-12 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">space_dashboard</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Pie de Página (Footer)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Personaliza el logotipo invertido, la información de contacto y enlaces legales del pie de página.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-2">
            <span className="w-8 h-1.5 rounded-full bg-slate-500"></span>
            <span className="w-8 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></span>
          </div>
          <span className="material-symbols-outlined absolute right-6 top-6 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
        </div>
      </div>
    </div>
  );
}
