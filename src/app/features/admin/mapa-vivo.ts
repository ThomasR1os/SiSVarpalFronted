import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, expand, forkJoin, interval, map, of, reduce, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Destino, EstadoRuta, Geocerca, Pagina, ParadaSeguimiento, Ruta, Seguimiento, TipoServicio } from '../../core/models';
import { etiquetaEstado, etiquetaTipo, fechaCorta, grados } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Mapa } from '../../shared/mapa/mapa';
import { MarcaMapa, lineaGeo, marcasRuta } from '../../shared/mapa/marcas';

@Component({
  selector: 'app-mapa-vivo',
  imports: [Mapa, Badge],
  template: `
    <div class="panel-head">
      <div>
        <h2>Mapa en vivo</h2>
        <p>Solo rutas ya iniciadas y dentro de Lima metropolitana. Se actualiza cada 10 segundos.</p>
      </div>
    </div>
    @if (error()) { <div class="alert alert-error mb-4">{{ error() }}</div> }
    <div class="split-map">
      <div class="lista-rutas">
        @for (ruta of rutas(); track ruta.ruta_id) {
          <article class="ruta-card ruta-card-viva" [class.activo]="seleccion()?.ruta_id === ruta.ruta_id">
            <button type="button" class="ruta-elige" (click)="seleccion.set(ruta)">
              <span class="flex flex-wrap items-center gap-2"><strong>{{ etiqueta(ruta) }}</strong><app-badge [estado]="ruta.estado" /></span>
              <span class="text-sm opacity-70">{{ fechaCorta(ruta.fecha) }} · {{ etiquetaEstado(ruta.estado) }}</span>
              <span class="text-sm opacity-70">{{ ruta.en_vivo ? 'Camión visible' : 'Sin posición en vivo' }}</span>
            </button>
            @if (seleccion()?.ruta_id === ruta.ruta_id) {
              <div class="ruta-destinos">
                <p class="ruta-destinos-titulo">Destinos</p>
                @if (paradasOrdenadas(ruta).length) {
                  <ul>
                    @for (parada of paradasOrdenadas(ruta); track parada.destino_id) {
                      <li class="ruta-destino">
                        <span class="ruta-destino-num" [attr.data-estado]="parada.estado">{{ parada.orden }}</span>
                        <span class="ruta-destino-nombre" [title]="nombreDestino(parada)">{{ nombreDestino(parada) }}</span>
                        <span class="ruta-destino-estado" [attr.data-estado]="parada.estado">{{ etiquetaEstado(parada.estado) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="ruta-destinos-vacio">Esta ruta no tiene destinos.</p>
                }
              </div>
            }
          </article>
        } @empty {
          <p class="vacio-texto">No hay rutas en proceso dentro de Lima.</p>
        }
      </div>
      <div class="mapa-caja alta">
        <app-mapa
          [marcas]="marcas()"
          [geometria]="geometria()"
          [recorrido]="recorrido()"
          [geocerca]="geocerca()"
          [encuadre]="encuadre()"
          (marcaClick)="elegirMarca($event)"
        />
      </div>
    </div>
  `,
})
export class MapaVivo {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly rutas = signal<Seguimiento[]>([]);
  protected readonly seleccion = signal<Seguimiento | null>(null);
  protected readonly geocerca = signal<[number, number][] | null>(null);
  protected readonly error = signal('');
  private readonly salidas = signal<SalidaDia[]>([]);
  private readonly fechasOk = signal<string[]>([]);
  private readonly fechasResueltas = signal<string[]>([]);
  private readonly paradasDia = signal<ReadonlyMap<number, FichaParada>>(new Map());
  private readonly documentos = signal<ReadonlyMap<number, Destino>>(new Map());
  private readonly fichas = computed(() => fusionarFichas(this.rutas(), this.paradasDia(), this.documentos()));
  protected readonly marcas = computed(() => this.armarMarcas());
  protected readonly geometria = computed(() => lineaGeo(this.seleccion()?.geometria));
  protected readonly recorrido = computed(() => (this.seleccion()?.en_vivo ? this.seleccion()?.recorrido ?? [] : []));
  protected readonly encuadre = computed(() => {
    const ruta = this.seleccion();
    const puntos = ruta?.paradas.map((parada) => `${parada.latitud},${parada.longitud}`).join('|') ?? '';
    const origen = ruta?.base_origen ? `${ruta.base_origen.latitud},${ruta.base_origen.longitud}` : '';
    return `${ruta?.ruta_id ?? 'todas'}-${origen}-${puntos}`;
  });
  private salidasTicket = 0;
  private destinosTicket = 0;
  private claveDestinos = '';

  constructor() {
    this.api.get<Geocerca>('/api/geocerca/').subscribe({
      next: (cerca) => this.geocerca.set(cerca.poligono),
      error: () => undefined,
    });
    interval(10000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.api.get<{ results: Seguimiento[] }>('/api/mapa/rutas/').pipe(
            tap(() => this.error.set('')),
            catchError((err: unknown) => {
              this.error.set(mensajeError(err));
              return of({ results: this.rutas() });
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((respuesta) => {
        this.rutas.set(respuesta.results);
        const actual = this.seleccion();
        if (!actual && respuesta.results[0]) this.seleccion.set(respuesta.results[0]);
        if (actual) this.seleccion.set(respuesta.results.find((ruta) => ruta.ruta_id === actual.ruta_id) ?? null);
        const fechas = fechasDe(respuesta.results);
        this.cargarSalidas(fechas);
        this.cargarDestinos(respuesta.results, fechas);
      });
  }

  protected etiqueta(ruta: Seguimiento): string {
    return etiquetaDiaria(ruta, this.salidas(), this.fechasOk(), this.fechasResueltas(), this.rutas());
  }

  protected paradasOrdenadas(ruta: Seguimiento): ParadaSeguimiento[] {
    return [...ruta.paradas].sort((a, b) => a.orden - b.orden || a.destino_id - b.destino_id);
  }

  protected nombreDestino(parada: ParadaSeguimiento): string {
    return nombreVisible(parada, this.fichas().get(parada.destino_id));
  }

  elegirMarca(id: string): void {
    if (!id.startsWith('camion-')) return;
    const rutaId = Number(id.slice('camion-'.length));
    const ruta = this.rutas().find((item) => item.ruta_id === rutaId);
    if (ruta) this.seleccion.set(ruta);
  }

  private cargarSalidas(fechas: string[]): void {
    const ticket = ++this.salidasTicket;
    if (!fechas.length) {
      this.salidas.set([]);
      this.paradasDia.set(new Map());
      this.fechasOk.set([]);
      this.fechasResueltas.set([]);
      return;
    }
    pedirPorFecha<Ruta>(this.api, '/api/rutas/', fechas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((listas) => {
        if (ticket !== this.salidasTicket) return;
        const salidas: SalidaDia[] = [];
        const fichas = new Map<number, FichaParada>();
        const ok: string[] = [];
        for (const lista of listas) {
          if (!lista.ok) continue;
          ok.push(lista.fecha);
          for (const ruta of lista.items) {
            salidas.push({
              id: ruta.id,
              fecha: (ruta.fecha || lista.fecha).slice(0, 10),
              estado: ruta.estado,
              iniciada_en: ruta.iniciada_en,
            });
            for (const parada of ruta.paradas ?? []) {
              fichas.set(parada.destino_id, {
                nombre: parada.nombre_receptor.trim(),
                apellido: parada.apellido_receptor.trim(),
                documento: '',
                codigo: parada.codigo_externo.trim(),
                tipo: parada.tipo_servicio,
              });
            }
          }
        }
        this.salidas.set(salidas);
        this.paradasDia.set(fichas);
        this.fechasOk.set(ok);
        this.fechasResueltas.set(fechas);
      });
  }

  private cargarDestinos(rutas: Seguimiento[], fechas: string[]): void {
    const ids = rutas
      .flatMap((ruta) => ruta.paradas.map((parada) => parada.destino_id))
      .sort((a, b) => a - b);
    const clave = `${fechas.join(',')}|${ids.join(',')}`;
    if (clave === this.claveDestinos) return;
    this.claveDestinos = clave;
    const ticket = ++this.destinosTicket;
    if (!fechas.length || !ids.length) {
      this.documentos.set(new Map());
      return;
    }
    const interes = new Set(ids);
    pedirPorFecha<Destino>(this.api, '/api/destinos/', fechas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((listas) => {
        if (ticket !== this.destinosTicket) return;
        if (listas.some((lista) => !lista.ok)) this.claveDestinos = '';
        const mapa = new Map<number, Destino>();
        for (const lista of listas) {
          if (!lista.ok) continue;
          for (const destino of lista.items) {
            if (interes.has(destino.id)) mapa.set(destino.id, destino);
          }
        }
        if (listas.some((lista) => lista.ok)) this.documentos.set(mapa);
      });
  }

  private armarMarcas(): MarcaMapa[] {
    const fichas = this.fichas();
    const marcas: MarcaMapa[] = [];
    for (const ruta of this.rutas()) {
      if (ruta.en_vivo && ruta.ultima_posicion) {
        marcas.push({
          id: `camion-${ruta.ruta_id}`,
          lat: grados(ruta.ultima_posicion.latitud),
          lng: grados(ruta.ultima_posicion.longitud),
          tipo: 'camion',
          texto: '',
          titulo: this.etiqueta(ruta),
        });
      }
    }
    const seleccion = this.seleccion();
    if (seleccion) {
      const paradas = marcasRuta({
        paradas: seleccion.paradas,
        origen: seleccion.base_origen,
        final: seleccion.base_final,
      });
      for (const marca of paradas) {
        if (!marca.id.startsWith('parada-')) continue;
        const destinoId = Number(marca.id.slice('parada-'.length));
        const parada = seleccion.paradas.find((item) => item.destino_id === destinoId);
        if (!parada) continue;
        const texto = textoParada(parada, seleccion.paradas, fichas);
        marca.detalle = texto;
        marca.titulo = texto;
      }
      marcas.push(...paradas);
    }
    return marcas;
  }
}

interface SalidaDia {
  id: number;
  fecha: string;
  estado: EstadoRuta;
  iniciada_en: string | null;
}

interface FichaParada {
  nombre: string;
  apellido: string;
  documento: string;
  codigo: string;
  tipo: string;
}

interface ListaFecha<T> {
  fecha: string;
  ok: boolean;
  items: T[];
}

const ORDEN_TIPO: TipoServicio[] = ['RECOJO', 'ENTREGA', 'INTERCAMBIO', 'TRASLADO'];

function fechasDe(rutas: Seguimiento[]): string[] {
  return [...new Set(rutas.map((ruta) => ruta.fecha.slice(0, 10)).filter(Boolean))].sort();
}

function etiquetaDiaria(
  ruta: Seguimiento,
  salidas: SalidaDia[],
  fechasOk: string[],
  fechasResueltas: string[],
  visibles: Seguimiento[],
): string {
  const fecha = fechaCorta(ruta.fecha);
  const dia = ruta.fecha.slice(0, 10);
  if (!fechasResueltas.includes(dia)) return `Ruta ${fecha}`;
  const ids = ordenDelDia(dia, salidas, fechasOk.includes(dia), visibles);
  const indice = ids.indexOf(ruta.ruta_id);
  return indice >= 0 ? `Ruta ${fecha} ${indice + 1}` : `Ruta ${fecha}`;
}

function ordenDelDia(fecha: string, salidas: SalidaDia[], remotaOk: boolean, visibles: Seguimiento[]): number[] {
  const ids: number[] = [];
  if (remotaOk) {
    const delDia = salidas
      .filter((item) => item.fecha.slice(0, 10) === fecha && salio(item))
      .sort(compararSalida);
    for (const item of delDia) {
      if (!ids.includes(item.id)) ids.push(item.id);
    }
  }
  const extra = visibles
    .filter((item) => item.fecha.slice(0, 10) === fecha && !ids.includes(item.ruta_id))
    .sort((a, b) => a.ruta_id - b.ruta_id);
  for (const item of extra) ids.push(item.ruta_id);
  return ids;
}

function salio(ruta: { estado: EstadoRuta; iniciada_en: string | null }): boolean {
  return !!ruta.iniciada_en || ruta.estado === 'EN_PROCESO' || ruta.estado === 'FINALIZADA';
}

function compararSalida(a: SalidaDia, b: SalidaDia): number {
  const horaA = a.iniciada_en ?? '';
  const horaB = b.iniciada_en ?? '';
  if (horaA !== horaB) {
    if (!horaA) return 1;
    if (!horaB) return -1;
    return horaA.localeCompare(horaB);
  }
  return a.id - b.id;
}

function fusionarFichas(
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

function nombreVisible(parada: ParadaSeguimiento, ficha: FichaParada | undefined): string {
  const completo = ficha ? `${ficha.nombre} ${ficha.apellido}`.trim() : parada.nombre_receptor.trim();
  return completo || parada.direccion.trim() || parada.codigo_externo.trim() || 'Sin nombre';
}

function textoParada(
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

function pedirPorFecha<T>(api: Api, url: string, fechas: string[]): Observable<ListaFecha<T>[]> {
  return forkJoin(
    fechas.map((fecha) =>
      listarPorFecha<T>(api, url, fecha).pipe(
        map((items) => ({ fecha, ok: true, items })),
        catchError(() => of({ fecha, ok: false, items: [] as T[] })),
      ),
    ),
  );
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
