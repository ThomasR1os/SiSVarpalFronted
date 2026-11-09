import { Component, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, reduce } from 'rxjs';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Cliente, Destino, Pagina, Ruta } from '../../core/models';
import { TAMANO_CATALOGO, etiquetaEstado, fechaCorta, horaCorta, nombrePersona, textoMotivo } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { MapaSeguimiento, RutaMapa } from '../../shared/mapa/mapa-seguimiento';
import { Paginacion } from '../../shared/paginacion';

const POR_PAGINA = 10;
const PUBLICADAS = new Set(['NO_INICIADA', 'EN_PROCESO', 'FINALIZADA']);
const COLORES = ['#1769e0', '#c2410c', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#0369a1', '#4d7c0f'];

@Component({
  selector: 'app-rutas-programadas',
  imports: [Badge, MapaSeguimiento, Paginacion],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="prog flex flex-col gap-4">
      <header class="prog-encabezado">
        <div>
          <p class="prog-miga">Operación <span aria-hidden="true">›</span> Rutas programadas</p>
          <h1>Rutas programadas</h1>
          <p>Paradas, unidad y el mapa de seguimiento de las rutas publicadas.</p>
        </div>
        <div class="prog-chip" [class.lista]="!enCurso()">
          <span>{{ rutasVisibles().length }} {{ rutasVisibles().length === 1 ? 'ruta' : 'rutas' }}</span>
          <strong>{{ enCurso() ? 'En curso' : zona() === 'lima' ? 'Local' : 'Provincia' }}</strong>
        </div>
      </header>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }

      <section class="prog-card p-4">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <label class="prog-campo">Cliente
            <select [value]="clienteId() ?? ''" (change)="cambiarCliente($event)">
              <option value="">Todos los clientes</option>
              @for (cliente of clientes(); track cliente.id) {
                <option [value]="cliente.id">{{ cliente.nombre_comercial || cliente.razon_social }}</option>
              }
            </select>
          </label>
          <div class="prog-campo">Operación
            <div class="prog-segmento" role="group" aria-label="Zona">
              <button type="button" [class.activo]="zona() === 'lima'" (click)="cambiarZona('lima')">Local</button>
              <button type="button" [class.activo]="zona() === 'provincia'" (click)="cambiarZona('provincia')">Provincia</button>
            </div>
          </div>
          <label class="prog-campo">Desde
            <input type="date" [value]="desde()" [max]="hasta() || undefined" (change)="cambiarDesde($event)" />
          </label>
          <label class="prog-campo">Hasta
            <input type="date" [value]="hasta()" [min]="desde() || undefined" (change)="cambiarHasta($event)" />
          </label>
          <label class="prog-campo">{{ zona() === 'provincia' ? 'Distrito' : 'Código de ruta o pedido' }}
            @if (zona() === 'provincia') {
              <select [value]="distrito()" (change)="cambiarDistrito($event)">
                <option value="">Todos</option>
                @for (item of distritos(); track item) {
                  <option [value]="item">{{ item }}</option>
                }
              </select>
            } @else {
              <input type="search" placeholder="RUTA-LIM-001 o código" [value]="codigo()" (input)="cambiarCodigo($event)" />
            }
          </label>
          <div class="flex items-end">
            <button type="button" class="btn btn-ghost btn-sm" (click)="limpiar()">Limpiar filtros</button>
          </div>
        </div>
      </section>

      @if (cargando()) {
        <p class="vacio-texto">Cargando las rutas…</p>
      } @else if (rutasVisibles().length) {
        <section class="prog-card p-4">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 class="text-base">Rutas encontradas</h2>
              <p class="ayuda">Elige una ruta para revisar su información. Activa el mapa de las que quieras comparar.</p>
            </div>
            @if (seleccionadas().length) {
              <button type="button" class="btn btn-ghost btn-sm" (click)="limpiarMapa()">Quitar del mapa</button>
            }
          </div>
          <div class="selector-rutas" role="tablist" aria-label="Rutas programadas">
            @for (ruta of rutasVisibles(); track ruta.id) {
              <article
                class="selector-ruta"
                [class.en-foco]="enFoco(ruta.id)"
                [class.en-mapa]="activa(ruta.id)"
                [style.--ruta-color]="colorRuta(ruta.id)"
              >
                <button type="button" class="selector-ruta-detalle" role="tab" [attr.aria-selected]="enFoco(ruta.id)" (click)="enfocar(ruta.id)">
                  <span class="selector-ruta-codigo">{{ codigoRuta(ruta) }}</span>
                  <span class="selector-ruta-fecha">{{ fechaCorta(ruta.fecha) }} · {{ ruta.cliente_nombre }}</span>
                  <span class="selector-ruta-resumen">{{ resumen(ruta).total }} pedidos · {{ resumen(ruta).exitosos }} entregados</span>
                </button>
                <button
                  type="button"
                  class="selector-ruta-mapa"
                  [class.activa]="activa(ruta.id)"
                  [attr.aria-pressed]="activa(ruta.id)"
                  [attr.aria-label]="(activa(ruta.id) ? 'Quitar ' : 'Mostrar ') + codigoRuta(ruta) + ' en el mapa'"
                  (click)="alternar(ruta.id)"
                >
                  <span class="unidad-punto" aria-hidden="true"></span>
                  <span>
                    <small>Placa</small>
                    <strong>{{ ruta.vehiculo?.placa || 'Sin unidad' }}</strong>
                    <small>{{ activa(ruta.id) ? 'Visible' : 'Mostrar' }}</small>
                  </span>
                </button>
              </article>
            }
          </div>
        </section>

        @if (rutaDetalle(); as ruta) {
          <section class="prog-card p-4">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="text-lg">{{ codigoRuta(ruta) }} · {{ ruta.cliente_nombre }}</h2>
                <p class="ayuda">{{ fechaCorta(ruta.fecha) }} · {{ ruta.dentro_de_lima ? 'Lima metropolitana' : 'Provincia' }}</p>
              </div>
              <app-badge [estado]="ruta.estado" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article class="rounded-xl bg-base-200/60 p-3">
                <p class="text-sm text-base-content/60">Conductor</p>
                <p class="font-semibold">{{ nombrePersona(ruta.conductor) }}</p>
                <p class="text-xs text-base-content/60">{{ ruta.conductor?.documento || 'Sin documento' }}</p>
              </article>
              <article class="rounded-xl bg-base-200/60 p-3">
                <p class="text-sm text-base-content/60">Unidad</p>
                <p class="font-semibold">{{ ruta.vehiculo?.placa || 'Sin unidad' }}</p>
                <p class="text-xs text-base-content/60">{{ textoUnidad(ruta) }}</p>
              </article>
              <article class="rounded-xl bg-base-200/60 p-3">
                <p class="text-sm text-base-content/60">Pedidos programados</p>
                <p class="font-display text-3xl leading-none">{{ resumen(ruta).total }}</p>
              </article>
              <article class="rounded-xl bg-base-200/60 p-3">
                <p class="text-sm text-base-content/60">Entregados</p>
                <p class="font-display text-3xl leading-none">{{ resumen(ruta).exitosos }} <span class="text-base text-success">{{ porcentaje(resumen(ruta).exitosos, resumen(ruta).total) }}</span></p>
                <p class="mt-1 text-xs text-base-content/60">En ruta {{ resumen(ruta).enRuta }} · Pendientes {{ resumen(ruta).pendientes }}</p>
              </article>
            </div>
          </section>
        }

        <section class="grid items-start gap-3 xl:grid-cols-2">
          <article class="prog-card p-4">
            <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 class="text-base">Destinatarios</h2>
                <p class="ayuda">{{ textoParadas() }}</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" (click)="exportar()" [disabled]="paradasFiltradas().length === 0">Exportar</button>
            </div>
            <div class="data-table overflow-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Código</th>
                    <th>Destinatario</th>
                    <th>Dirección</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of paradasPagina(); track fila.parada.destino_id) {
                    <tr>
                      <td data-label="Hora">{{ horaCorta(fila.parada.hora_estimada) }}</td>
                      <td data-label="Código">{{ fila.parada.codigo_externo }}</td>
                      <td data-label="Destinatario">{{ nombreParada(fila.parada) }}</td>
                      <td data-label="Dirección">{{ fila.parada.direccion }}, {{ fila.parada.distrito }}</td>
                      <td class="max-w-xs whitespace-normal" data-label="Motivo">{{ motivoDe(fila.parada.destino_id) }}</td>
                      <td data-label="Estado"><app-badge [estado]="fila.parada.estado" /></td>
                    </tr>
                  } @empty {
                    <tr class="fila-vacia"><td colspan="6">Esta ruta no tiene paradas con el filtro actual.</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-paginacion [pagina]="pagina()" [tamano]="porPagina" [total]="paradasFiltradas().length" (paginaChange)="pagina.set($event)" />
          </article>

          <article class="prog-card p-4">
            <h2 class="text-base">Mapa</h2>
            <p class="ayuda mb-3">Pulsa la placa para mostrar la ruta. Vuelve a pulsar para quitarla. Cada camino usa un color distinto.</p>
            <app-mapa-seguimiento [rutas]="rutasMapa()" />
            @if (rutasElegidas().length) {
              <ul class="mapa-leyenda">
                @for (ruta of rutasElegidas(); track ruta.id) {
                  <li>
                    <span [style.background]="colorRuta(ruta.id)"></span>
                    {{ codigoRuta(ruta) }} · {{ ruta.vehiculo?.placa || 'Sin placa' }}
                  </li>
                }
              </ul>
            }
          </article>
        </section>
      } @else {
        <p class="vacio-texto">No hay rutas programadas en este filtro.</p>
      }
    </div>
  `,
})
export class RutasProgramadas {
  private readonly api = inject(Api);
  protected readonly porPagina = POR_PAGINA;
  protected readonly fechaCorta = fechaCorta;
  protected readonly horaCorta = horaCorta;
  protected readonly nombrePersona = nombrePersona;
  protected readonly codigoRuta = codigoRuta;
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly clienteId = signal<number | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly distrito = signal('');
  protected readonly codigo = signal('');
  protected readonly pagina = signal(1);
  protected readonly seleccionadas = signal<number[]>([]);
  protected readonly rutaDetalleId = signal<number | null>(null);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  private readonly enFiltro = computed(() => {
    const zona = this.zona();
    const clienteId = this.clienteId();
    const desde = this.desde();
    const hasta = this.hasta();
    return this.rutas().filter((ruta) => {
      if (!PUBLICADAS.has(ruta.estado)) return false;
      if ((zona === 'lima') !== ruta.dentro_de_lima) return false;
      if (clienteId != null && ruta.cliente_id !== clienteId) return false;
      const fecha = ruta.fecha.slice(0, 10);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    });
  });
  protected readonly distritos = computed(() =>
    [...new Set(this.enFiltro().flatMap((ruta) => ruta.paradas.map((parada) => parada.distrito.trim() || 'Sin distrito')))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    ),
  );
  protected readonly rutasVisibles = computed(() => {
    const codigo = this.zona() === 'lima' ? this.codigo().trim().toLowerCase() : '';
    const distrito = this.zona() === 'provincia' ? this.distrito() : '';
    return this.enFiltro()
      .filter((ruta) => {
        if (distrito && !ruta.paradas.some((parada) => (parada.distrito.trim() || 'Sin distrito') === distrito)) return false;
        if (!codigo) return true;
        if (codigoRuta(ruta).toLowerCase().includes(codigo) || String(ruta.id).includes(codigo)) return true;
        if (ruta.cliente_nombre.toLowerCase().includes(codigo)) return true;
        return ruta.paradas.some((parada) =>
          `${parada.codigo_externo} ${parada.nombre_receptor} ${parada.apellido_receptor}`.toLowerCase().includes(codigo),
        );
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  });
  protected readonly rutasElegidas = computed(() => {
    const ids = new Set(this.seleccionadas());
    return this.rutasVisibles().filter((ruta) => ids.has(ruta.id));
  });
  protected readonly rutaDetalle = computed(() => this.rutasVisibles().find((ruta) => ruta.id === this.rutaDetalleId()) ?? null);
  protected readonly rutasMapa = computed<RutaMapa[]>(() => this.rutasElegidas().map((ruta) => ({ ruta, color: this.colorRuta(ruta.id) })));
  protected readonly paradasFiltradas = computed(() => {
    const ruta = this.rutaDetalle();
    if (!ruta) return [];
    const codigo = this.zona() === 'lima' ? this.codigo().trim().toLowerCase() : '';
    const distrito = this.zona() === 'provincia' ? this.distrito() : '';
    const filas: { ruta: Ruta; parada: Ruta['paradas'][number] }[] = [];
    const buscaRuta = !codigo || codigoRuta(ruta).toLowerCase().includes(codigo) || String(ruta.id) === codigo || ruta.cliente_nombre.toLowerCase().includes(codigo);
    for (const parada of ruta.paradas) {
      if (distrito && (parada.distrito.trim() || 'Sin distrito') !== distrito) continue;
      if (!buscaRuta && !`${parada.codigo_externo} ${parada.nombre_receptor} ${parada.apellido_receptor}`.toLowerCase().includes(codigo)) continue;
      filas.push({ ruta, parada });
    }
    return filas;
  });
  protected readonly paradasPagina = computed(() => {
    const inicio = (this.pagina() - 1) * POR_PAGINA;
    return this.paradasFiltradas().slice(inicio, inicio + POR_PAGINA);
  });
  protected readonly enCurso = computed(() => this.enFiltro().some((ruta) => ruta.estado === 'EN_PROCESO'));
  private readonly motivos = computed(() => {
    const mapa = new Map<number, string>();
    for (const destino of this.destinos()) mapa.set(destino.id, textoMotivo(destino));
    return mapa;
  });

  constructor() {
    effect(() => {
      const visibles = this.rutasVisibles();
      const validas = new Set(visibles.map((ruta) => ruta.id));
      const actual = this.seleccionadas();
      const siguientes = actual.filter((id) => validas.has(id));
      if (siguientes.length !== actual.length) this.seleccionadas.set(siguientes);
      const detalle = this.rutaDetalleId();
      if (detalle == null || !validas.has(detalle)) {
        const primera = visibles[0]?.id ?? null;
        this.rutaDetalleId.set(primera);
        if (primera != null && siguientes.length === 0) this.seleccionadas.set([primera]);
      }
    });
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
      error: () => undefined,
    });
    forkJoin({
      rutas: listarTodo<Ruta>(this.api, '/api/rutas/'),
      destinos: listarTodo<Destino>(this.api, '/api/destinos/'),
    }).subscribe({
      next: ({ rutas, destinos }) => {
        this.rutas.set(rutas);
        this.destinos.set(destinos);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  cambiarZona(zona: 'lima' | 'provincia'): void {
    this.zona.set(zona);
    this.pagina.set(1);
  }

  cambiarCliente(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    this.clienteId.set(id > 0 ? id : null);
    this.pagina.set(1);
  }

  cambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  cambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  cambiarDistrito(evento: Event): void {
    this.distrito.set((evento.target as HTMLSelectElement).value);
    this.pagina.set(1);
  }

  cambiarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  alternar(id: number): void {
    this.seleccionadas.update((lista) => (lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id]));
    this.pagina.set(1);
  }

  enfocar(id: number): void {
    this.rutaDetalleId.set(id);
    this.pagina.set(1);
  }

  enFoco(id: number): boolean {
    return this.rutaDetalleId() === id;
  }

  limpiarMapa(): void {
    this.seleccionadas.set([]);
  }

  activa(id: number): boolean {
    return this.seleccionadas().includes(id);
  }

  colorRuta(id: number): string {
    const indice = this.rutasVisibles().findIndex((ruta) => ruta.id === id);
    return COLORES[(indice < 0 ? 0 : indice) % COLORES.length];
  }

  textoParadas(): string {
    const ruta = this.rutaDetalle();
    return ruta ? `Paradas de ${codigoRuta(ruta)}.` : 'Selecciona una ruta para ver sus paradas.';
  }

  limpiar(): void {
    this.desde.set('');
    this.hasta.set('');
    this.distrito.set('');
    this.codigo.set('');
    this.clienteId.set(null);
    this.pagina.set(1);
  }

  resumen(ruta: Ruta): { total: number; exitosos: number; enRuta: number; pendientes: number } {
    const paradas = ruta.paradas;
    return {
      total: paradas.length,
      exitosos: paradas.filter((parada) => parada.estado === 'EXITOSO').length,
      enRuta: paradas.filter((parada) => parada.estado === 'EN_PROCESO').length,
      pendientes: paradas.filter((parada) => parada.estado === 'NO_INICIADO').length,
    };
  }

  textoUnidad(ruta: Ruta): string {
    const vehiculo = ruta.vehiculo;
    if (!vehiculo) return 'Sin vehículo asignado';
    return [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || vehiculo.tipo || 'Unidad';
  }

  nombreParada(parada: Ruta['paradas'][number]): string {
    return `${parada.nombre_receptor} ${parada.apellido_receptor}`.trim() || '—';
  }

  motivoDe(destinoId: number): string {
    return this.motivos().get(destinoId) ?? '—';
  }

  porcentaje(parte: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((parte / total) * 100)}%`;
  }

  exportar(): void {
    const filas = this.paradasFiltradas();
    if (!filas.length) return;
    const encabezado = ['Hora', 'Código', 'Destinatario', 'Dirección', 'Distrito', 'Motivo', 'Estado'];
    const datos = filas.map((fila) => [
      horaCorta(fila.parada.hora_estimada),
      fila.parada.codigo_externo,
      this.nombreParada(fila.parada),
      fila.parada.direccion,
      fila.parada.distrito,
      this.motivoDe(fila.parada.destino_id),
      etiquetaEstado(fila.parada.estado),
    ]);
    const csv = [encabezado, ...datos].map((columnas) => columnas.map((valor) => `"${valor.replaceAll('"', '""')}"`).join(',')).join('\n');
    const nombre = this.rutaDetalle() ? `ruta-${codigoRuta(this.rutaDetalle()!)}.csv` : 'ruta.csv';
    guardarBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), nombre);
  }
}

function codigoRuta(ruta: { id: number; dentro_de_lima: boolean }): string {
  return `RUTA-${ruta.dentro_de_lima ? 'LIM' : 'PRO'}-${String(ruta.id).padStart(3, '0')}`;
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
