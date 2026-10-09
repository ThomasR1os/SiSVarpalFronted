import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { Api } from '../../core/api';
import { Destino, Pagina, Ruta } from '../../core/models';

export type ZonaFiltro = 'todas' | 'lima' | 'provincia';
export type PeriodoDashboard = 'hoy' | '7' | '30' | 'mes' | 'todo';

export interface ResumenRutas {
  rutas: number;
  enProceso: number;
  finalizadas: number;
  canceladas: number;
  noIniciadas: number;
  paradas: number;
  exitosas: number;
  fallidas: number;
  pendientes: number;
  distanciaMetros: number;
}

export const RESUMEN_VACIO: ResumenRutas = {
  rutas: 0,
  enProceso: 0,
  finalizadas: 0,
  canceladas: 0,
  noIniciadas: 0,
  paradas: 0,
  exitosas: 0,
  fallidas: 0,
  pendientes: 0,
  distanciaMetros: 0,
};

export function etiquetaZona(dentroDeLima: boolean): string {
  return dentroDeLima ? 'Lima metropolitana' : 'Provincia';
}

export function codigoRuta(ruta: { id: number; dentro_de_lima: boolean }): string {
  return `RUTA-${ruta.dentro_de_lima ? 'LIM' : 'PRO'}-${String(ruta.id).padStart(3, '0')}`;
}

export function resumirRutas(rutas: readonly Ruta[]): ResumenRutas {
  const resumen: ResumenRutas = { ...RESUMEN_VACIO, rutas: rutas.length };
  for (const ruta of rutas) {
    if (ruta.estado === 'EN_PROCESO') resumen.enProceso += 1;
    else if (ruta.estado === 'FINALIZADA') resumen.finalizadas += 1;
    else if (ruta.estado === 'CANCELADA') resumen.canceladas += 1;
    else if (ruta.estado === 'NO_INICIADA') resumen.noIniciadas += 1;
    if (ruta.distancia_metros != null) resumen.distanciaMetros += ruta.distancia_metros;
    for (const parada of ruta.paradas) {
      resumen.paradas += 1;
      if (parada.estado === 'EXITOSO') resumen.exitosas += 1;
      else if (parada.estado === 'FALLIDO') resumen.fallidas += 1;
      else resumen.pendientes += 1;
    }
  }
  return resumen;
}

export function tasaExito(resumen: ResumenRutas): string {
  const cerradas = resumen.exitosas + resumen.fallidas;
  if (cerradas === 0) return '—';
  return `${Math.round((resumen.exitosas / cerradas) * 100)} %`;
}

export function restarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() - dias);
  return fechaIso(fecha);
}

export function finDeMes(iso: string): string {
  const [anio, mes] = iso.split('-').map(Number);
  return fechaIso(new Date(anio, mes, 0));
}

export function enPeriodo(fecha: string, periodo: PeriodoDashboard, hoyIso: string): boolean {
  const rango = rangoPeriodo(periodo, hoyIso);
  if (!rango) return true;
  return fecha >= rango.desde && fecha <= rango.hasta;
}

export function rangoPeriodo(
  periodo: PeriodoDashboard,
  hoyIso: string,
): { desde: string; hasta: string } | null {
  if (periodo === 'todo') return null;
  if (periodo === 'hoy') return { desde: hoyIso, hasta: hoyIso };
  if (periodo === 'mes') return { desde: `${hoyIso.slice(0, 7)}-01`, hasta: finDeMes(hoyIso) };
  const dias = periodo === '7' ? 6 : 29;
  return { desde: restarDias(hoyIso, dias), hasta: hoyIso };
}

export function listarRutasCliente(api: Api): Observable<Ruta[]> {
  return listarTodo<Ruta>(api, '/api/rutas/');
}

export function listarDestinosCliente(api: Api): Observable<Destino[]> {
  return listarTodo<Destino>(api, '/api/destinos/');
}

function listarTodo<T>(api: Api, url: string): Observable<T[]> {
  const pedir = (page: number) => api.get<Pagina<T>>(url, { page, page_size: 100, ordering: '-fecha' });
  let paginaActual = 1;
  return pedir(1).pipe(
    expand((pagina) => {
      const siguiente = paginaSiguiente(pagina.next);
      if (pagina.results.length < 100 || siguiente == null || siguiente <= paginaActual) return EMPTY;
      paginaActual = siguiente;
      return pedir(siguiente);
    }),
    reduce((acumulado, pagina) => acumulado.concat(pagina.results), [] as T[]),
  );
}

function paginaSiguiente(next: string | null): number | null {
  if (!next) return null;
  const pagina = Number(new URL(next, 'http://local').searchParams.get('page'));
  return Number.isFinite(pagina) && pagina > 0 ? pagina : null;
}

function fechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
