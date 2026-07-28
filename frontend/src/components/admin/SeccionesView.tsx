'use client';
import React, { useState, useEffect } from 'react';

export default function SeccionesView({ apiKey, apiUrl, showAlert }: { apiKey: string, apiUrl: string, showAlert: (m: string) => void }) {
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // States for banner editor
  const [bannerSlides, setBannerSlides] = useState<any[]>([]);

  // States for categories editor
  const [categoryCards, setCategoryCards] = useState<any[]>([]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/api/settings`);
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
      if (bannerData && bannerData.slides) {
        setBannerSlides(bannerData.slides);
      } else if (bannerData && !bannerData.slides) {
         setBannerSlides([{ title: bannerData.title || '', subtitle: bannerData.subtitle || '', mediaUrl: bannerData.videoUrl || '', link: '/catalog' }]);
      } else {
        setBannerSlides([
          { title: 'DESCUBRE TU ESENCIA', subtitle: 'FRAGANCIAS EXCLUSIVAS', mediaUrl: "/uploads/Perfumes/3.jpeg", link: "/catalog" }
        ]);
      }
    } else if (section === 'home_categories') {
      const catData = settings['home_categories'];
      if (catData && catData.categories) {
        setCategoryCards(catData.categories);
      } else {
        setCategoryCards([
          { title: 'Perfumes de Mujer', subtitle: 'Fragancias que enamoran', mediaUrl: "/uploads/Perfumes/1.jpeg", link: "/catalog?category=Perfumes+de+Mujer" },
          { title: 'Perfumes de Hombre', subtitle: 'Carácter y Elegancia', mediaUrl: "/uploads/Perfumes/2.jpeg", link: "/catalog?category=Perfumes+de+Hombre" },
          { title: 'Labiales Exclusivos', subtitle: 'Detalles que resaltan', mediaUrl: "/uploads/Labiales/1.jpeg", link: "/catalog?category=Labios" }
        ]);
      }
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
    }
  };

  const saveSettings = async (key: string, value: any) => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        showAlert("Sección actualizada con éxito");
        fetchSettings();
        setActiveEditor(null);
      } else {
        showAlert("Error al actualizar la sección");
      }
    } catch (e) {
      showAlert("Error de red");
    }
  };

  const renderBannerEditor = () => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">view_carousel</span> Editar Banner Principal
        </h2>
        <button onClick={() => setActiveEditor(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="space-y-6">
        {bannerSlides.map((slide, idx) => (
          <div key={idx} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl relative">
            <button onClick={() => { const newSlides = [...bannerSlides]; newSlides.splice(idx, 1); setBannerSlides(newSlides); }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-lg">
              <span className="material-symbols-outlined">delete</span>
            </button>
            <h4 className="font-bold mb-4 text-slate-700 dark:text-slate-300">Slide {idx + 1}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Título</label>
                <input type="text" value={slide.title} onChange={e => { const n = [...bannerSlides]; n[idx].title = e.target.value; setBannerSlides(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Subtítulo</label>
                <input type="text" value={slide.subtitle} onChange={e => { const n = [...bannerSlides]; n[idx].subtitle = e.target.value; setBannerSlides(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Enlace del Botón</label>
                <input type="text" value={slide.link} onChange={e => { const n = [...bannerSlides]; n[idx].link = e.target.value; setBannerSlides(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Imagen Actual (URL)</label>
                <div className="flex gap-2">
                  <input type="text" value={slide.mediaUrl} onChange={e => { const n = [...bannerSlides]; n[idx].mediaUrl = e.target.value; setBannerSlides(n); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm" />
                  <label className="cursor-pointer bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-lg text-sm flex items-center">
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    <input type="file" className="hidden" accept="image/*,video/*" onChange={async (e) => {
                      const url = await handleFileUpload(e, 'Banners');
                      if (url) {
                        const n = [...bannerSlides]; n[idx].mediaUrl = url; setBannerSlides(n);
                      }
                    }} />
                  </label>
                </div>
              </div>
            </div>
            {slide.mediaUrl && (
              <div className="mt-4 h-32 rounded-lg bg-cover bg-center border border-slate-200" style={{ backgroundImage: `url(${slide.mediaUrl.startsWith('http') ? slide.mediaUrl : apiUrl + slide.mediaUrl})` }}></div>
            )}
          </div>
        ))}
        <button onClick={() => setBannerSlides([...bannerSlides, { title: '', subtitle: '', mediaUrl: '', link: '/catalog' }])} className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
          <span className="material-symbols-outlined text-[18px]">add</span> Añadir Slide
        </button>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button onClick={() => setActiveEditor(null)} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
        <button onClick={() => saveSettings('home_banner', { slides: bannerSlides })} className="px-4 py-2 font-bold bg-primary text-white hover:bg-primary/90 rounded-lg">Guardar Cambios</button>
      </div>
    </div>
  );

  const renderCategoriesEditor = () => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
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
        <button onClick={() => setActiveEditor(null)} className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
        <button onClick={() => saveSettings('home_categories', { categories: categoryCards })} className="px-4 py-2 font-bold bg-primary text-white hover:bg-primary/90 rounded-lg">Guardar Cambios</button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-12 text-center text-slate-500"><span className="material-symbols-outlined animate-spin text-4xl">autorenew</span></div>;
  }

  if (activeEditor === 'home_banner') return renderBannerEditor();
  if (activeEditor === 'home_categories') return renderCategoriesEditor();

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
        <div onClick={() => showAlert("Edición de Cabecera y Menú no implementada aún.")} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden flex flex-col items-start gap-4">
          <div className="size-12 bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined">dock_to_bottom</span>
          </div>
          <div>
            <h3 className="font-bold text-lg dark:text-white mb-1 group-hover:text-primary transition-colors">Cabecera y Menú</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Modifica el logotipo, las etiquetas del menú de navegación, y los elaces a tus perfiles de redes sociales.</p>
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
