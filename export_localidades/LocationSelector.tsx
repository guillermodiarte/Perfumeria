import React, { useState } from 'react';
// Si importas el JSON simple (78KB):
import locationsData from './provincias_localidades_simple.json';

interface LocationSelectorProps {
  selectedProvince?: string;
  selectedCity?: string;
  onChange: (data: { province: string; city: string }) => void;
  className?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedProvince = '',
  selectedCity = '',
  onChange,
  className = '',
}) => {
  const provinces = Object.keys(locationsData).sort((a, b) => a.localeCompare('es'));
  const cities = selectedProvince ? (locationsData as Record<string, string[]>)[selectedProvince] || [] : [];

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const province = e.target.value;
    onChange({ province, city: '' });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    onChange({ province: selectedProvince, city });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Selector de Provincia */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Provincia
        </label>
        <select
          value={selectedProvince}
          onChange={handleProvinceChange}
          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Seleccionar Provincia...</option>
          {provinces.map((prov) => (
            <option key={prov} value={prov}>
              {prov}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de Localidad */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Localidad
        </label>
        <select
          value={selectedCity}
          onChange={handleCityChange}
          disabled={!selectedProvince}
          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {!selectedProvince ? 'Primero seleccioná una provincia' : 'Seleccionar Localidad...'}
          </option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default LocationSelector;
