import { EstadoDestino, LineStringGeo, Posicion, PuntoRuta } from '../../core/models';
import { grados } from '../../core/texto';

export interface MarcaMapa {
  id: string;
  lat: number;
  lng: number;
  tipo: 'parada' | 'origen' | 'final' | 'camion';
  texto: string;
  titulo: string;
  estado?: string;
}

export function lineaGeo(linea: LineStringGeo | null | undefined): [number, number][] | null {
  if (!linea?.coordinates?.length) return null;
  const coords: [number, number][] = [];
  for (const punto of linea.coordinates) {
    const lng = Number(punto[0]);
    const lat = Number(punto[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    coords.push([lng, lat]);
  }
  return coords.length > 1 ? coords : null;
}

export function marcasRuta(opciones: {
  paradas: {
    destino_id: number;
    orden: number;
    latitud: string;
    longitud: string;
    direccion: string;
    estado?: string;
    codigo_externo?: string;
  }[];
  origen?: PuntoRuta | null;
  final?: PuntoRuta | null;
  camion?: Posicion | null;
  camionId?: number;
}): MarcaMapa[] {
  const marcas: MarcaMapa[] = [];
  const origen = marcaSiValida(opciones.origen);
  if (origen && opciones.origen) {
    marcas.push({
      id: `origen-${opciones.origen.id}`,
      lat: origen.lat,
      lng: origen.lng,
      tipo: 'origen',
      texto: 'O',
      titulo: `Origen · ${opciones.origen.nombre}`,
    });
  }
  for (const parada of opciones.paradas) {
    const punto = marcaSiValida(parada);
    if (!punto) continue;
    marcas.push({
      id: `parada-${parada.destino_id}`,
      lat: punto.lat,
      lng: punto.lng,
      tipo: 'parada',
      texto: String(parada.orden),
      titulo: `${parada.orden}. ${parada.codigo_externo ?? ''} ${parada.direccion}`.trim(),
      estado: parada.estado,
    });
  }
  const final = marcaSiValida(opciones.final);
  if (final && opciones.final) {
    marcas.push({
      id: `final-${opciones.final.id}`,
      lat: final.lat,
      lng: final.lng,
      tipo: 'final',
      texto: 'V',
      titulo: `Base Varpal · ${opciones.final.nombre}`,
    });
  }
  const camion = marcaSiValida(opciones.camion);
  if (camion) {
    marcas.push({
      id: `camion-${opciones.camionId ?? 'x'}`,
      lat: camion.lat,
      lng: camion.lng,
      tipo: 'camion',
      texto: '',
      titulo: 'Camión',
    });
  }
  return marcas;
}

function marcaSiValida(
  punto: { latitud: string | number | null | undefined; longitud: string | number | null | undefined } | null | undefined,
): { lat: number; lng: number } | null {
  if (!punto) return null;
  const lat = grados(punto.latitud);
  const lng = grados(punto.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function colorEstado(estado: EstadoDestino | string | undefined): string {
  switch (estado) {
    case 'EN_PROCESO':
      return '#2c9ef6';
    case 'EXITOSO':
      return '#1f7a45';
    case 'FALLIDO':
      return '#b42318';
    default:
      return '#00275a';
  }
}
