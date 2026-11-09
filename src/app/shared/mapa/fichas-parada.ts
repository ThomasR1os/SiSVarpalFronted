import { EMPTY, Observable, catchError, expand, forkJoin, map, of, reduce } from 'rxjs';
import { Api } from '../../core/api';
import { Destino, Pagina, ParadaSeguimiento, Seguimiento, TipoServicio } from '../../core/models';
import { etiquetaTipo } from '../../core/texto';

export interface FichaParada {
  nombre: string;
  apellido: string;
  documento: string;
  codigo: string;
  tipo: string;
}

export interface ListaFecha<T> {
  fecha: string;
  ok: boolean;
  items: T[];
}

const ORDEN_TIPO: TipoServicio[] = ['RECOJO', 'ENTREGA', 'INTERCAMBIO', 'TRASLADO'];

export function fusionarFichas(
  rutas: Seguimiento[],
  deRutas: ReadonlyMap<number, FichaParada>,
  destinos: ReadonlyMap<number, Destino>,
): Map<number, FichaParada> {
  const mapa = new Map<number, FichaParada>();
  for (const ruta of rutas) {
    for (const parada of ruta.paradas) {
      mapa.set(parada.destino_id, {
        nombre: parada.nombre_receptor.trim(),
        apellido: (parada.apellido_receptor ?? '').trim(),
        documento: (parada.documento_receptor ?? '').trim(),
        codigo: parada.codigo_externo.trim(),
        tipo: parada.tipo_servicio ?? '',
      });
    }
  }
  for (const [id, ficha] of deRutas) {
    const previa = mapa.get(id);
    mapa.set(id, {
      nombre: ficha.nombre || previa?.nombre || '',
      apellido: ficha.apellido || previa?.apellido || '',
      documento: previa?.documento || ficha.documento,
      codigo: ficha.codigo || previa?.codigo || '',
      tipo: ficha.tipo || previa?.tipo || '',
    });
  }
  for (const [id, destino] of destinos) {
    const previa = mapa.get(id);
    mapa.set(id, {
      nombre: destino.nombre_receptor.trim() || previa?.nombre || '',
      apellido: destino.apellido_receptor.trim() || previa?.apellido || '',
      documento: destino.documento_receptor.trim() || previa?.documento || '',
      codigo: destino.codigo_externo.trim() || previa?.codigo || '',
      tipo: destino.tipo_servicio || previa?.tipo || '',
    });
  }
  return mapa;
}

export function nombreVisible(parada: ParadaSeguimiento, ficha: FichaParada | undefined): string {
  const completo = ficha ? `${ficha.nombre} ${ficha.apellido}`.trim() : parada.nombre_receptor.trim();
  return completo || parada.direccion.trim() || parada.codigo_externo.trim() || 'Sin nombre';
}

export function textoParada(
  parada: ParadaSeguimiento,
  paradas: ParadaSeguimiento[],
  fichas: ReadonlyMap<number, FichaParada>,
): string {
  const propia = fichas.get(parada.destino_id);
  const documento = propia?.documento ?? '';
  const codigo = (propia?.codigo || parada.codigo_externo).trim();
  const tipos = new Set<string>();
  if (propia?.tipo) tipos.add(propia.tipo);
  for (const otra of paradas) {
    if (otra.destino_id === parada.destino_id) continue;
    const ficha = fichas.get(otra.destino_id);
    if (!ficha?.tipo || !mismoLugar(parada, otra)) continue;
    const mismoDocumento = !!documento && ficha.documento === documento;
    const mismoCodigo = !!codigo && (ficha.codigo || otra.codigo_externo).trim() === codigo;
    if (mismoDocumento || mismoCodigo) tipos.add(ficha.tipo);
  }
  const conceptos = [...tipos].sort(compararTipo).map((tipo) => etiquetaTipo(tipo)).join(' · ');
  const partes = [nombreEtiqueta(parada, propia)];
  if (codigo) partes.push(codigo);
  if (conceptos) partes.push(conceptos);
  return partes.join('\u00A0-\u00A0');
}

export function pedirPorFecha<T>(api: Api, url: string, fechas: string[]): Observable<ListaFecha<T>[]> {
  return forkJoin(
    fechas.map((fecha) =>
      listarPorFecha<T>(api, url, fecha).pipe(
        map((items) => ({ fecha, ok: true, items })),
        catchError(() => of({ fecha, ok: false, items: [] as T[] })),
      ),
    ),
  );
}

function nombreEtiqueta(parada: ParadaSeguimiento, ficha: FichaParada | undefined): string {
  const completo = ficha ? `${ficha.nombre} ${ficha.apellido}`.trim() : `${parada.nombre_receptor} ${parada.apellido_receptor ?? ''}`.trim();
  return completo || parada.direccion.trim() || 'Sin nombre';
}

function mismoLugar(
  a: { latitud: string; longitud: string; direccion: string },
  b: { latitud: string; longitud: string; direccion: string },
): boolean {
  const latA = Number(a.latitud);
  const latB = Number(b.latitud);
  const lngA = Number(a.longitud);
  const lngB = Number(b.longitud);
  if ([latA, latB, lngA, lngB].every(Number.isFinite)) {
    return Math.abs(latA - latB) < 0.00005 && Math.abs(lngA - lngB) < 0.00005;
  }
  const direccionA = a.direccion.trim().toLowerCase();
  const direccionB = b.direccion.trim().toLowerCase();
  return !!direccionA && direccionA === direccionB;
}

function compararTipo(a: string, b: string): number {
  const ia = ORDEN_TIPO.indexOf(a as TipoServicio);
  const ib = ORDEN_TIPO.indexOf(b as TipoServicio);
  return (ia < 0 ? ORDEN_TIPO.length : ia) - (ib < 0 ? ORDEN_TIPO.length : ib);
}

function listarPorFecha<T>(api: Api, url: string, fecha: string): Observable<T[]> {
  const pedir = (page: number) => api.get<Pagina<T>>(url, { fecha, page, page_size: 100 });
  let actual = 1;
  return pedir(1).pipe(
    expand((pagina) => {
      const siguiente = paginaSiguiente(pagina.next);
      if (pagina.results.length < 100 || siguiente == null || siguiente <= actual) return EMPTY;
      actual = siguiente;
      return pedir(siguiente);
    }),
    reduce((lista, pagina) => lista.concat(pagina.results), [] as T[]),
  );
}

function paginaSiguiente(next: string | null): number | null {
  if (!next) return null;
  const pagina = Number(new URL(next, 'http://local').searchParams.get('page'));
  return Number.isFinite(pagina) && pagina > 0 ? pagina : null;
}
