'use client';

import Link from 'next/link';
import { MapPin, Phone, MessageCircle, Mail, Clock, HeartHandshake, ShieldCheck, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function DondeEstamosPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white dark:bg-slate-900">
      
      {/* Hero Section */}
      <section className="relative h-[400px] md:h-[500px] w-full flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: "url('http://localhost:8001/uploads/Perfumes/3.jpeg')" }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 z-10" />
        
        <div className="relative z-20 text-center px-6 flex flex-col gap-4 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg">
            ¿Dónde estamos?
          </h1>
          <p className="text-lg md:text-xl font-medium text-slate-200 drop-shadow-md">
            Conocé nuestro showroom y descubrí nuestras fragancias en persona.
          </p>
        </div>
      </section>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-16 flex flex-col gap-24">
        
        {/* Sobre Essence Perfumería */}
        <section className="flex flex-col items-center text-center max-w-4xl mx-auto gap-6">
          <span className="text-primary font-bold tracking-widest uppercase text-sm">Nuestra Historia</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">Sobre Essence Perfumería</h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
            En Essence Perfumería creemos que cada fragancia cuenta una historia. Nos especializamos en ofrecer perfumes originales y de excelente calidad para quienes buscan destacar su personalidad con aromas únicos. Nuestro objetivo es brindar una experiencia de compra cercana, confiable y personalizada.
          </p>
        </section>

        {/* Contacto & Mapa Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-8 items-start">
          
          {/* Info Column */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Información de Contacto</h3>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-8">
              
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección</span>
                  <p className="text-slate-900 dark:text-white font-medium text-lg">Av. Siempre Viva 1234</p>
                  <p className="text-slate-500">Córdoba Capital, Argentina</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Horario</span>
                  <p className="text-slate-900 dark:text-white font-medium">Lunes a Viernes</p>
                  <p className="text-slate-500 text-sm mb-2">09:00 - 18:00 hs</p>
                  <p className="text-slate-900 dark:text-white font-medium">Sábados</p>
                  <p className="text-slate-500 text-sm">09:00 - 13:00 hs</p>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">+54 351 123-4567</span>
                </div>
                <div className="flex items-center gap-4">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">+54 9 351 123-4567</span>
                </div>
                <div className="flex items-center gap-4">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">contacto@essenceperfumeria.com</span>
                </div>
              </div>

            </div>
          </div>

          {/* Map Column */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="w-full h-[450px] bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative group">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108920.80373268805!2d-64.26909405626233!3d-31.402283038622144!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9432985f478f5b69%3A0xb0a24f9a5366b092!2zQ8OzcmRvYmEsIENvbWluYSBkZSBDw7NyZG9iYQ!5e0!3m2!1ses-419!2sar!4v1700000000000!5m2!1ses-419!2sar"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="https://maps.google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
              >
                <MapPin className="w-5 h-5" />
                Cómo llegar
              </a>
              <a 
                href="https://wa.me/5493511234567" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#25D366]/20 hover:scale-[1.02] transition-transform"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar WhatsApp
              </a>
              <a 
                href="mailto:contacto@essenceperfumeria.com"
                className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold shadow-lg shadow-slate-900/10 hover:scale-[1.02] transition-transform"
              >
                <Mail className="w-5 h-5" />
                Enviar Email
              </a>
            </div>
          </div>
        </section>

        {/* Por qué visitarnos */}
        <section className="flex flex-col gap-12 mt-8">
          <div className="text-center">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">¿Por qué visitarnos?</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:shadow-xl hover:shadow-primary/5 transition-shadow">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-primary shadow-sm mb-2">
                <HeartHandshake className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">Atención personalizada</h4>
              <p className="text-slate-500">Te ayudamos a encontrar la fragancia ideal, con recomendaciones adaptadas a tu estilo.</p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:shadow-xl hover:shadow-primary/5 transition-shadow">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-primary shadow-sm mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">Perfumes originales</h4>
              <p className="text-slate-500">Trabajamos únicamente con productos de calidad, 100% auténticos y garantizados.</p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center gap-4 hover:shadow-xl hover:shadow-primary/5 transition-shadow">
              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-primary shadow-sm mb-2">
                <UserCheck className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">Asesoramiento</h4>
              <p className="text-slate-500">Respondemos todas tus consultas antes y después de la compra para tu tranquilidad.</p>
            </div>

          </div>
        </section>

      </main>

      {/* Footer minimalista para mantener la estética si la página lo requiere */}
      <footer className="mt-16 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-primary grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all">
            <span className="material-symbols-outlined text-2xl font-bold">spa</span>
            <span className="font-bold tracking-widest uppercase text-sm">Essence</span>
          </Link>
          <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Essence Perfumería. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
