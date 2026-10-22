"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export type Direccion = { direccion: string; lat: number | null; lng: number | null; place_id: string | null };

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
let configurado = false;

// Autocompletado de Google Places (+ "usar mi ubicación"). Sin clave de Maps queda un
// campo de texto simple (sin coordenadas), para poder desarrollar sin Google.
export default function DireccionInput({
  value,
  onChange,
  permitirUbicacion = false,
}: {
  value: Direccion;
  onChange: (d: Direccion) => void;
  permitirUbicacion?: boolean;
}) {
  const cont = useRef<HTMLDivElement>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!KEY || !cont.current) return;
    const el = cont.current;
    let cancelado = false;
    (async () => {
      if (!configurado) {
        setOptions({ key: KEY, v: "weekly", language: "es", region: "AR" });
        configurado = true;
      }
      const { PlaceAutocompleteElement } = (await importLibrary("places")) as google.maps.PlacesLibrary;
      if (cancelado) return;
      const auto = new PlaceAutocompleteElement({ includedRegionCodes: ["ar"] });
      auto.addEventListener("gmp-select", async (ev) => {
        const { placePrediction } = ev as unknown as { placePrediction: google.maps.places.PlacePrediction };
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location", "id"] });
        cb.current({
          direccion: place.formattedAddress ?? "",
          lat: place.location?.lat() ?? null,
          lng: place.location?.lng() ?? null,
          place_id: place.id ?? null,
        });
      });
      el.replaceChildren(auto);
    })().catch(() => setError("No se pudo cargar Google Maps."));
    return () => {
      cancelado = true;
      el.replaceChildren();
    };
  }, []);

  function usarUbicacion() {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { Geocoder } = (await importLibrary("geocoding")) as google.maps.GeocodingLibrary;
          const r = await new Geocoder().geocode({ location: { lat: coords.latitude, lng: coords.longitude } });
          const top = r.results[0];
          onChange({
            direccion: top?.formatted_address ?? `${coords.latitude}, ${coords.longitude}`,
            lat: coords.latitude,
            lng: coords.longitude,
            place_id: top?.place_id ?? null,
          });
        } catch {
          setError("No pudimos obtener la dirección de tu ubicación.");
        }
      },
      () => setError("No pudimos acceder a tu ubicación. Escribí la dirección."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {KEY ? (
        <div ref={cont} />
      ) : (
        <input
          placeholder="Dirección"
          value={value.direccion}
          onChange={(e) => onChange({ direccion: e.target.value, lat: null, lng: null, place_id: null })}
          className="rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}
      {KEY && permitirUbicacion && (
        <button type="button" onClick={usarUbicacion} className="w-fit text-sm underline">
          Usar mi ubicación actual
        </button>
      )}
      {value.direccion && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Seleccionada: {value.direccion}
          {KEY && value.lat == null && " (elegí una opción de la lista para guardar el punto en el mapa)"}
        </p>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}
