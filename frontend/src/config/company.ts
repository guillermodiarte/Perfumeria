// ============================================================
//  CONFIGURACIÓN GLOBAL DE LA EMPRESA — VALORES POR DEFECTO
//  Este archivo es el fallback cuando la BD no tiene datos.
//  Los valores reales se gestionan desde el Admin → Empresa.
// ============================================================

export const COMPANY_DEFAULTS = {
  // Identidad
  name: 'Ciara Bonita',
  tagline: 'Fragancias que cuentan historias',
  description:
    'En Ciara Bonita creemos que cada fragancia cuenta una historia. Nos especializamos en ofrecer perfumes originales y de excelente calidad para quienes buscan destacar su personalidad con aromas únicos.',

  // Ubicación
  address: 'Av. Antártida Argentina 1035',
  city: 'Formosa',
  province: 'Formosa',
  postalCode: '3600',
  googleMapsEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108920.80373268805!2d-64.26909405626233!3d-31.402283038622144!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9432985f478f5b69%3A0xb0a24f9a5366b092!2zQ8OzcmRvYmEsIENvbWluYSBkZSBDw7NyZG9iYQ!5e0!3m2!1ses-419!2sar!4v1700000000000!5m2!1ses-419!2sar',
  googleMapsLink: 'https://maps.google.com',

  // Contacto
  whatsapp: '5493704747426',
  phone: '+54 9 3704 74-7426',
  email: 'contacto@ciarabonita.com',

  // Redes sociales
  instagramUrl: '#',
  facebookUrl: '#',

  // Horarios
  scheduleWeekdays: '09:00 - 18:00 hs',
  scheduleSaturday: '09:00 - 13:00 hs',

  // Mensajes de WhatsApp
  whatsappMsgGreeting: '¡Hola! Quiero confirmar un pedido 🛒',
  whatsappMsgFooter: '',

  // Creador de la página
  creatorName: '',
  creatorUrl: '',
};

export type CompanyInfo = typeof COMPANY_DEFAULTS;
