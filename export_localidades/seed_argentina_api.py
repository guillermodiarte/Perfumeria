"""
Script independiente para descargar y consultar todas las Provincias y Localidades
desde la API Oficial del Gobierno Argentino (GeoRef AR).

Requisitos:
    pip install requests

Uso:
    python seed_argentina_api.py
"""

import json
import requests

def fetch_all_argentina_locations():
    print("1/2 Descargando lista de Provincias...")
    prov_res = requests.get("https://apis.datos.gob.ar/georef/api/provincias")
    if prov_res.status_code != 200:
        raise Exception("Error al consultar la API de provincias")

    provincias_raw = prov_res.json().get("provincias", [])
    # Ordenar alfabéticamente
    provincias_raw.sort(key=lambda x: x["nombre"])

    dataset = []
    simple_dict = {}

    print(f"Encontradas {len(provincias_raw)} provincias. Descargando localidades...")
    for idx, prov in enumerate(provincias_raw, 1):
        prov_id = prov["id"]
        prov_name = prov["nombre"]
        print(f"[{idx}/{len(provincias_raw)}] {prov_name}...")

        loc_res = requests.get(f"https://apis.datos.gob.ar/georef/api/localidades?provincia={prov_id}&max=5000")
        if loc_res.status_code == 200:
            localidades_raw = loc_res.json().get("localidades", [])
            
            # Evitar duplicados por nombre dentro de la misma provincia
            seen = set()
            cities = []
            cities_simple = []

            for loc in localidades_raw:
                c_name = loc["nombre"]
                if c_name not in seen:
                    seen.add(c_name)
                    cities.append({
                        "id": loc.get("id"),
                        "name": c_name
                    })
                    cities_simple.append(c_name)

            cities.sort(key=lambda x: x["name"])
            cities_simple.sort()

            dataset.append({
                "id": prov_id,
                "name": prov_name,
                "cities": cities
            })
            simple_dict[prov_name] = cities_simple

    # Guardar en JSON
    with open("provincias_y_localidades.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    with open("provincias_localidades_simple.json", "w", encoding="utf-8") as f:
        json.dump(simple_dict, f, ensure_ascii=False, indent=2)

    print("\n¡Listo! Archivos generados con éxito.")

if __name__ == "__main__":
    fetch_all_argentina_locations()
