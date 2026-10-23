# 📍 Provincias y Localidades de Argentina

Este paquete contiene todos los datos y utilidades para implementar la selección de **Provincias** y **Localidades** en cualquier proyecto web (Frontend, Backend o Base de Datos).

Contiene **todas las 24 provincias** y **más de 3.800 localidades** de la República Argentina.

---

## 📁 Archivos Incluidos

| Archivo | Descripción | Uso Recomendado |
|---|---|---|
| `provincias_localidades_simple.json` (~78 KB) | Objeto plano con formato `{"Provincia": ["Localidad 1", "Localidad 2", ...]}` | **Frontend directo (React / Next.js / Vue / Angular)** sin necesidad de APIs ni base de datos. Pesa muy poco y es ultra rápido. |
| `provincias_y_localidades.json` (~377 KB) | Estructura jerárquica con IDs y Códigos Postales: `[{ id, name, cities: [{ id, name, postal_code }] }]` | Para proyectos con bases de datos relacionales o APIs REST donde se necesitan IDs únicos. |
| `localidades.sql` (~376 KB) | Script SQL estándar (`CREATE TABLE` e `INSERT`) | Para importar directamente en **PostgreSQL, MySQL, SQLite, MariaDB**. |
| `LocationSelector.tsx` | Componente funcional en React (con Tailwind CSS o estilos personalizables) | Copiar en tu carpeta de componentes y usarlo en cualquier formulario. |
| `seed_argentina_api.py` | Script en Python que consulta la API oficial GeoRef del Gobierno Argentino | Si necesitas actualizar o re-descargar los datos en el futuro. |

---

## 🚀 Cómo Usarlo en tu Nuevo Proyecto

### Opción 1: En el Frontend (React / Next.js / Vite) - La más rápida ⚡

Copia el archivo `provincias_localidades_simple.json` a tu proyecto (por ejemplo en `src/data/` o `src/assets/`).

```tsx
import locations from './provincias_localidades_simple.json';
import { useState } from 'react';

export function FormularioRegistro() {
  const [provincia, setProvincia] = useState('');
  const [localidad, setLocalidad] = useState('');

  const provincias = Object.keys(locations).sort((a, b) => a.localeCompare('es'));
  const localidades = provincia ? locations[provincia] || [] : [];

  return (
    <div>
      {/* Selector Provincia */}
      <select 
        value={provincia} 
        onChange={(e) => { setProvincia(e.target.value); setLocalidad(''); }}
      >
        <option value="">Seleccionar Provincia...</option>
        {provincias.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      {/* Selector Localidad */}
      <select 
        value={localidad} 
        onChange={(e) => setLocalidad(e.target.value)}
        disabled={!provincia}
      >
        <option value="">{provincia ? 'Seleccionar Localidad...' : 'Elegí primero provincia'}</option>
        {localidades.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
    </div>
  );
}
```

---

### Opción 2: En la Base de Datos (SQL) 🗄️

Si tu nuevo proyecto tiene su propio backend (Node.js, Python, PHP, Laravel, etc.) y base de datos:

1. Ejecuta el archivo `localidades.sql` en tu motor de base de datos:
   - **PostgreSQL / MySQL / SQLite**: Puedes abrir tu gestor (DBeaver, pgAdmin, DataGrip, phpMyAdmin) y ejecutar el script.
   - O por terminal:
     ```bash
     # Para SQLite
     sqlite3 mi_base.db < localidades.sql

     # Para PostgreSQL
     psql -U usuario -d mi_base -f localidades.sql
     ```
2. Te creará las tablas `provincias` y `cities` con sus relaciones e índices.

---

### Opción 3: Con el componente listo `LocationSelector.tsx` 🎨

Copia `LocationSelector.tsx` y `provincias_localidades_simple.json` juntos en tu proyecto e instáncialo así:

```tsx
<LocationSelector
  selectedProvince={formData.provincia}
  selectedCity={formData.localidad}
  onChange={({ province, city }) => {
    setFormData(prev => ({ ...prev, provincia: province, localidad: city }));
  }}
/>
```
