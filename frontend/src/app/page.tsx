'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image'
import Link from 'next/link'
import { API_URL } from '@/utils/api';
import { useStockFlowStore } from '@/store/useStockStore';

export default function Home() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const productsStore = useStockFlowStore(s => s.products);
  const latestProducts = [...productsStore].reverse().slice(0, 4);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          const settingsMap: Record<string, any> = {};
          data.forEach((item: any) => {
            // Backward compatibility for old banner format
            if (item.key === 'home_banner' && !item.value.slides) {
               settingsMap[item.key] = { slides: [{ title: item.value.title || '', subtitle: item.value.subtitle || '', mediaUrl: item.value.videoUrl || '', link: '/catalog' }] };
            } else {
               settingsMap[item.key] = item.value;
            }
          });
          setSettings(settingsMap);
        }
      } catch (e) {
        console.error("No se pudieron cargar las configuraciones", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [API_URL]);

  const dbBanner = settings['home_banner'];
  const banner = (dbBanner && dbBanner.slides && dbBanner.slides.length > 1) ? dbBanner : {
    slides: [
      {
        title: 'DESCUBRE TU ESENCIA',
        subtitle: 'FRAGANCIAS EXCLUSIVAS',
        mediaUrl: "/uploads/Perfumes/3.jpeg",
        link: "/catalog"
      },
      {
        title: 'ESENCIA FEMENINA',
        subtitle: 'AROMAS QUE ENAMORAN',
        mediaUrl: "/uploads/Perfumes/1.jpeg",
        link: "/catalog?category=Perfumes+de+Mujer"
      },
      {
        title: 'CARÁCTER Y ELEGANCIA',
        subtitle: 'PERFUMES DE HOMBRE',
        mediaUrl: "/uploads/Perfumes/2.jpeg",
        link: "/catalog?category=Perfumes+de+Hombre"
      },
      {
        title: 'DETALLES QUE RESALTAN',
        subtitle: 'LABIALES EXCLUSIVOS',
        mediaUrl: "/uploads/Labiales/1.jpeg",
        link: "/catalog?category=Labios"
      }
    ]
  };

  const slides = banner.slides || [];

  // Auto-advance carousel
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const header = settings['site_header'] || {
    logoUrl: "",
    facebookUrl: "#",
    instagramUrl: "#",
    whatsapp: "5493704048860"
  };

  const footer = settings['site_footer'] || {
    logoUrl: "",
    copyRight: "© 2026 Ciara Bonita. Todos los derechos reservados."
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-900"><div className="animate-spin text-primary material-symbols-outlined text-4xl">autorenew</div></div>;

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">

        <main className="flex flex-col flex-1">
          {/* Hero Section */}
          <section className="px-4 md:px-10 py-6 relative">
            <div className="relative min-h-[600px] w-full overflow-hidden rounded-3xl group">
              {slides.map((slide: any, idx: number) => {
                const isVideo = slide.mediaUrl && slide.mediaUrl.match(/\.(mp4|webm|ogg)$/i);
                
                return (
                  <div 
                    key={idx}
                    className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out flex flex-col items-start justify-end p-8 md:p-16 ${idx === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                  >
                    {isVideo ? (
                      <video
                        src={slide.mediaUrl.startsWith('http') ? slide.mediaUrl : `${API_URL}${slide.mediaUrl}`}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover z-0"
                      />
                    ) : (
                      <div 
                        className="absolute inset-0 w-full h-full bg-cover bg-center z-0" 
                        style={{ backgroundImage: `url('${slide.mediaUrl.startsWith('http') ? slide.mediaUrl : `${API_URL}${slide.mediaUrl}`}')`, backgroundColor: '#1E293B' }}
                      />
                    )}
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-0" />

                    <div className="relative z-10 max-w-2xl flex flex-col gap-6 transform transition-all duration-1000 delay-300">
                      <div className="flex flex-col gap-3">
                        <span className="text-primary font-bold tracking-widest uppercase text-sm">Ciara Bonita Collection</span>
                        <h1 className="text-white text-5xl md:text-7xl font-black leading-[1.1] tracking-tighter drop-shadow-lg">
                          {(slide.title || '').toUpperCase()} <br /> <span className="text-primary italic font-serif">{(slide.subtitle || '').toUpperCase()}</span>
                        </h1>
                        <p className="text-slate-200 text-lg md:text-xl font-medium max-w-lg leading-relaxed drop-shadow-md">
                          Diseñado para resaltar tu personalidad. Perfumes y accesorios que dejan una huella inolvidable en cada paso.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <Link href={slide.link || "/catalog"} className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-full h-14 px-8 bg-primary text-white text-base font-bold hover:scale-105 transition-transform shadow-lg shadow-primary/30">
                          Comprar Colección
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Carousel Indicators */}
              {slides.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3 bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full">
                  {slides.map((_: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-500 ${idx === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-white/50 hover:bg-white/80'}`}
                    />
                  ))}
                </div>
              )}
              
              {/* Carousel Arrows */}
              {slides.length > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 size-12 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button 
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 size-12 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/50 text-white backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Featured Categories */}
          <section className="px-4 md:px-20 py-12">
            <div className="flex items-end justify-between mb-10">
              <div className="flex flex-col gap-2">
                <h2 className="text-slate-900 dark:text-white text-3xl font-extrabold tracking-tight">Comprar por Categoría</h2>
                <div className="h-1 w-20 bg-primary rounded-full"></div>
              </div>
              <Link className="text-primary font-bold flex items-center gap-1 hover:gap-2 transition-all" href="/catalog">
                Ver Todo <span className="material-symbols-outlined">trending_flat</span>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category 1 */}
              <Link href="/catalog?category=Perfumes+de+Mujer" className="group relative aspect-[4/5] overflow-hidden rounded-2xl cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${API_URL}/uploads/Perfumes/1.jpeg')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8">
                  <h3 className="text-white text-2xl font-bold mb-2">Perfumes de Mujer</h3>
                  <p className="text-slate-300 text-sm mb-4">Fragancias que enamoran</p>
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-slate-900 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>
                </div>
              </Link>
              {/* Category 2 */}
              <Link href="/catalog?category=Perfumes+de+Hombre" className="group relative aspect-[4/5] overflow-hidden rounded-2xl cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${API_URL}/uploads/Perfumes/2.jpeg')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8">
                  <h3 className="text-white text-2xl font-bold mb-2">Perfumes de Hombre</h3>
                  <p className="text-slate-300 text-sm mb-4">Carácter y Elegancia</p>
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-slate-900 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>
                </div>
              </Link>
              {/* Category 3 */}
              <Link href="/catalog?category=Labios" className="group relative aspect-[4/5] overflow-hidden rounded-2xl cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url('${API_URL}/uploads/Labiales/1.jpeg')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8">
                  <h3 className="text-white text-2xl font-bold mb-2">Labiales Exclusivos</h3>
                  <p className="text-slate-300 text-sm mb-4">Detalles que resaltan</p>
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white text-slate-900 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </span>
                </div>
              </Link>
            </div>
          </section>

          {/* Latest Arrivals */}
          <section className="px-4 md:px-20 py-16 bg-white dark:bg-slate-900/40">
            <div className="max-w-[1400px] mx-auto">
              <div className="flex flex-col items-center text-center mb-12">
                <span className="text-primary font-bold tracking-widest uppercase text-xs mb-2">Lanzamientos</span>
                <h2 className="text-slate-900 dark:text-white text-4xl font-black tracking-tight mb-4">Últimos Ingresos</h2>
                <p className="text-slate-500 max-w-md">Nuestras fragancias más frescas acaban de llegar. Experimenta la próxima generación de cuidado personal.</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                {latestProducts.length > 0 ? (
                  latestProducts.map((product, idx) => {
                    const uniqueColors = Array.from(new Set(product.variants.map(v => v.color))).filter(Boolean);
                    const colorDesc = uniqueColors.length > 0 ? uniqueColors.join(', ') : 'Varios colores';
                    
                    return (
                      <Link href={`/product/${product.id}`} key={product.id} className="flex flex-col gap-4 group cursor-pointer">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800">
                          {product.imageUrls && product.imageUrls.length > 0 ? (
                            <div
                              className="w-full h-full bg-center bg-cover transition-transform duration-700 group-hover:scale-110"
                              style={{ backgroundImage: `url("${product.imageUrls[0].startsWith('http') ? product.imageUrls[0] : `${API_URL}${product.imageUrls[0]}`}")` }}
                            ></div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 transition-transform duration-500 group-hover:scale-105">
                              <span className="material-symbols-outlined text-4xl opacity-40 mb-2">image</span>
                            </div>
                          )}
                          
                          {idx === 0 && (
                            <div className="absolute top-4 left-4 bg-primary text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">Nuevo</div>
                          )}
                          <button className="absolute bottom-4 right-4 h-10 w-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                            <span className="material-symbols-outlined text-xl">add</span>
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h4 className="text-slate-900 dark:text-white font-bold text-base truncate" title={product.name}>{product.name}</h4>
                          <p className="text-slate-500 dark:text-slate-400 text-sm truncate">{colorDesc}</p>
                          <p className="text-primary font-black mt-1">${product.salePrice.toLocaleString('es-AR')}</p>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-500">
                    Aún no hay productos ingresados.
                  </div>
                )}
              </div>

              <div className="mt-12 flex justify-center">
                <Link href="/catalog" className="inline-flex items-center gap-2 font-bold text-primary hover:text-primary/80 transition-colors">
                  Ver colección completa <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Quality/Features Banner */}
          <section className="px-4 md:px-20 py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">spa</span>
                </div>
                <h3 className="text-xl font-bold">Aromas Duraderos</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Fórmulas avanzadas que perduran todo el día, manteniendo tu fragancia intacta.</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">diamond</span>
                </div>
                <h3 className="text-xl font-bold">Calidad Premium</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Seleccionamos los ingredientes más exquisitos para garantizar productos de primer nivel.</p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">cruelty_free</span>
                </div>
                <h3 className="text-xl font-bold">Cruelty Free</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Nuestros productos son elaborados sin crueldad animal, cuidando de la naturaleza y de ti.</p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-white px-6 md:px-20 pt-16 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-3xl font-bold">spa</span>
                <h2 className="text-white text-2xl font-black italic tracking-tighter">Ciara Bonita</h2>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Resaltando tu belleza a través de fragancias únicas y accesorios de calidad desde 2018.
              </p>
              <div className="flex gap-4">
                <a className="h-10 w-10 rounded-full border border-slate-700 flex items-center justify-center hover:bg-primary hover:border-primary transition-all" href="#">
                  <span className="material-symbols-outlined text-lg">share</span>
                </a>
                <a className="h-10 w-10 rounded-full border border-slate-700 flex items-center justify-center hover:bg-primary hover:border-primary transition-all" href="#">
                  <span className="material-symbols-outlined text-lg">public</span>
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-lg">Tienda</h4>
              <ul className="flex flex-col gap-4 text-slate-400 text-sm">
                <li><a className="hover:text-primary transition-colors" href="#">Más Vendidos</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Perfumes</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Maquillaje</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Accesorios</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-lg">Ayuda</h4>
              <ul className="flex flex-col gap-4 text-slate-400 text-sm">
                <li><a className="hover:text-primary transition-colors" href="#">Política de Envíos</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Cambios y Devoluciones</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Guía de Talles</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">Contáctanos</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-6 text-lg">Únete al Club</h4>
              <p className="text-slate-400 text-sm mb-4">Suscríbete para recibir novedades, ofertas exclusivas y lanzamientos.</p>
              <div className="flex h-12 bg-slate-800 rounded-lg overflow-hidden p-1">
                <input className="bg-transparent border-none flex-1 focus:ring-0 text-sm px-3" placeholder="Correo electrónico" type="email" />
                <button className="bg-primary text-white font-bold px-4 rounded-md text-sm">Unirme</button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
            <p>{footer.copyRight}</p>
            <div className="flex gap-8">
              <a className="hover:text-white transition-colors" href="#">Política de Privacidad</a>
              <a className="hover:text-white transition-colors" href="#">Términos de Servicio</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
