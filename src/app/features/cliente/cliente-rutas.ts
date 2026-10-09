import { Component, computed, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Destino, Ruta } from '../../core/models';
import { duracion, etiquetaEstado, etiquetaTipo, fechaCorta, horaCorta, nombrePersona } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { Paginacion } from '../../shared/paginacion';
import { codigoRuta, etiquetaZona, listarDestinosCliente, listarRutasCliente } from './rutas-cliente';

const POR_PAGINA = 10;

@Component({
  selector: 'app-cliente-rutas',
  imports: [Badge, Mapa, Paginacion],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (cargando()) { <p class="vacio-texto">Cargando las rutas…</p> }

    <section class="relative min-h-56 overflow-hidden rounded-2xl bg-neutral text-neutral-content">
      <img class="absolute inset-0 h-full w-full object-cover object-[72%_center]" src="camion-varpal.jpg" alt="" />
      <div class="absolute inset-0 bg-gradient-to-r from-neutral via-neutral/88 to-neutral/25"></div>
      <div class="relative flex min-h-56 flex-col justify-center gap-4 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-xl">
          <h2 class="text-3xl text-white sm:text-4xl">Rutas programadas</h2>
          <p class="mt-2 max-w-md text-sm text-neutral-content/75">
            @if (zona() === 'lima') {
              Consulta el detalle de cada ruta, sus destinatarios y el avance.
            } @else {
              Consulta los destinos programados fuera de Lima metropolitana.
            }
          </p>
          <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Zona">
            <button type="button" class="btn btn-sm" [class.bg-white]="zona() === 'lima'" [class.text-primary]="zona() === 'lima'" [class.bg-white/10]="zona() !== 'lima'" [class.text-white]="zona() !== 'lima'" [class.border-white/20]="zona() !== 'lima'" (click)="cambiarZona('lima')">Local</button>
            <button type="button" class="btn btn-sm" [class.bg-white]="zona() === 'provincia'" [class.text-primary]="zona() === 'provincia'" [class.bg-white/10]="zona() !== 'provincia'" [class.text-white]="zona() !== 'provincia'" [class.border-white/20]="zona() !== 'provincia'" (click)="cambiarZona('provincia')">Provincia</button>
          </div>
        </div>
        @if (enCurso()) {
          <span class="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-success">
            <span class="size-2 rounded-full bg-success"></span>
            Operación en curso
          </span>
        }
      </div>
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="control">Desde
          <input type="date" [value]="desde()" [max]="hasta() || undefined" (change)="cambiarDesde($event)" />
        </label>
        <label class="control">Hasta
          <input type="date" [value]="hasta()" [min]="desde() || undefined" (change)="cambiarHasta($event)" />
        </label>
        @if (zona() === 'provincia') {
          <label class="control">Distrito
            <select [value]="distrito()" (change)="cambiarDistrito($event)">
              <option value="">Todos</option>
              @for (item of distritos(); track item) {
                <option [value]="item">{{ item }}</option>
              }
            </select>
          </label>
        } @else {
          <label class="control">Código de ruta o pedido
            <input type="search" placeholder="RUTA-LIM-001 o código" [value]="codigo()" (input)="cambiarCodigo($event)" />
          </label>
        }
        <div class="flex items-end">
          <button type="button" class="btn btn-ghost btn-sm" (click)="limpiar()">Limpiar filtros</button>
        </div>
      </div>
    </section>

    @if (zona() === 'lima') {
      @if (rutaActual(); as ruta) {
        <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="text-lg">{{ codigoRuta(ruta) }}</h2>
              <p class="ayuda">{{ fechaCorta(ruta.fecha) }} · {{ etiquetaZona(true) }}</p>
            </div>
            @if (rutasLocal().length > 1) {
              <label class="control min-w-52">Ruta
                <select [value]="rutaId() ?? ''" (change)="cambiarRuta($event)">
                  @for (item of rutasLocal(); track item.id) {
                    <option [value]="item.id">{{ codigoRuta(item) }} · {{ fechaCorta(item.fecha) }}</option>
                  }
                </select>
              </label>
            }
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

        <section class="grid items-start gap-3 xl:grid-cols-2">
          <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 class="text-base">Destinatarios de la ruta</h2>
                <p class="ayuda">Paradas publicadas de {{ codigoRuta(ruta) }}.</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" (click)="exportarLocal()" [disabled]="paradasLocal().length === 0">Exportar</button>
            </div>
            <div class="data-table overflow-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Código</th>
                    <th>Destinatario</th>
                    <th>Dirección</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (parada of paradasPagina(); track parada.destino_id) {
                    <tr>
                      <td data-label="Hora">{{ horaCorta(parada.hora_estimada) }}</td>
                      <td data-label="Código">{{ parada.codigo_externo }}</td>
                      <td data-label="Destinatario">{{ nombreParada(parada) }}</td>
                      <td data-label="Dirección">{{ parada.direccion }}, {{ parada.distrito }}</td>
                      <td data-label="Estado"><app-badge [estado]="parada.estado" /></td>
                    </tr>
                  } @empty {
                    <tr class="fila-vacia"><td colspan="5">No hay paradas con este filtro.</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <app-paginacion [pagina]="pagina()" [tamano]="porPagina" [total]="paradasLocal().length" (paginaChange)="pagina.set($event)" />
          </article>

          <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <h2 class="text-base">Mapa de la ruta</h2>
            <p class="ayuda mb-3">Recorrido publicado y paradas de {{ codigoRuta(ruta) }}.</p>
            <div class="mapa-caja">
              <app-mapa [marcas]="marcasLocal()" [geometria]="geometriaLocal()" [encuadre]="'ruta-local-' + ruta.id" />
            </div>
            @if (unidadVisible(ruta)) {
              <div class="mt-3 rounded-xl border border-base-300 p-3">
                <p class="text-sm font-semibold">Unidad en ruta</p>
                <p>{{ ruta.vehiculo?.placa || 'Sin placa' }} · {{ textoUnidad(ruta) }}</p>
                <p class="text-sm text-base-content/60">Última posición {{ horaCorta(ruta.ultima_posicion_en) }} · Tiempo de ruta {{ duracion(ruta.duracion_segundos) }}</p>
              </div>
            } @else {
              <p class="ayuda mt-3">La unidad se muestra cuando la ruta está en proceso, dentro de Lima, y queda alguna parada abierta.</p>
            }
          </article>
        </section>
      } @else if (!cargando()) {
        <p class="vacio-texto">No hay rutas locales en este filtro.</p>
      }
    } @else {
      <section class="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <p class="text-sm text-base-content/60">Destinos programados</p>
          <p class="font-display text-3xl leading-none">{{ destinosProvincia().length }}</p>
        </article>
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <p class="text-sm text-base-content/60">Distritos</p>
          <p class="font-display text-3xl leading-none">{{ distritosCubiertos() }}</p>
        </article>
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <p class="text-sm text-base-content/60">Entregados</p>
          <p class="font-display text-3xl leading-none">{{ conteoEstado('EXITOSO') }} <span class="text-base text-success">{{ porcentaje(conteoEstado('EXITOSO'), destinosProvincia().length) }}</span></p>
        </article>
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <p class="text-sm text-base-content/60">Pendientes</p>
          <p class="font-display text-3xl leading-none">{{ conteoEstado('NO_INICIADO') }} <span class="text-base text-warning">{{ porcentaje(conteoEstado('NO_INICIADO'), destinosProvincia().length) }}</span></p>
        </article>
      </section>

      <section class="grid items-start gap-3 xl:grid-cols-2">
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 class="text-base">Destinatarios programados</h2>
              <p class="ayuda">Pedidos asignados a rutas de provincia.</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" (click)="exportarProvincia()" [disabled]="destinosProvincia().length === 0">Descargar</button>
          </div>
          <div class="data-table overflow-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Destinatario</th>
                  <th>Distrito</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (destino of destinosPagina(); track destino.id) {
                  <tr>
                    <td data-label="Destinatario">
                      <strong class="block">{{ nombreDestino(destino) }}</strong>
                      <span class="text-xs text-base-content/60">{{ destino.codigo_externo }}</span>
                    </td>
                    <td data-label="Distrito">{{ destino.distrito || 'Sin distrito' }}</td>
                    <td data-label="Tipo">{{ etiquetaTipo(destino.tipo_servicio) }}</td>
                    <td data-label="Estado"><app-badge [estado]="destino.estado" /></td>
                  </tr>
                } @empty {
                  <tr class="fila-vacia"><td colspan="4">No hay destinos en este filtro.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [tamano]="porPagina" [total]="destinosProvincia().length" (paginaChange)="pagina.set($event)" />
        </article>

        <article class="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div>
            <h2 class="text-base">Mapa de destinos</h2>
            <p class="ayuda mb-3">Puntos programados en provincia.</p>
            <div class="mapa-caja">
              <app-mapa [marcas]="marcasProvincia()" [encuadre]="'ruta-provincia-' + destinosProvincia().length + '-' + distrito()" />
            </div>
          </div>
          <div>
            <h2 class="text-base">Destinos por distrito</h2>
            <div class="mt-3 flex max-h-64 flex-col gap-2 overflow-auto">
              @for (barra of barras(); track barra.nombre) {
                <div class="grid grid-cols-[minmax(6rem,1fr)_minmax(0,1.4fr)_1.5rem] items-center gap-2 text-xs">
                  <span class="truncate" [title]="barra.nombre">{{ barra.nombre }}</span>
                  <span class="h-2.5 overflow-hidden rounded-full bg-base-200">
                    <span class="block h-full rounded-full bg-primary" [style.width.%]="barra.ancho"></span>
                  </span>
                  <span class="text-right font-semibold">{{ barra.total }}</span>
                </div>
              } @empty {
                <p class="vacio-texto">No hay destinos en este filtro.</p>
              }
            </div>
          </div>
        </article>
      </section>
    }
  `,
})
export class ClienteRutas {
  private readonly api = inject(Api);
  protected readonly porPagina = POR_PAGINA;
  protected readonly fechaCorta = fechaCorta;
  protected readonly horaCorta = horaCorta;
  protected readonly duracion = duracion;
  protected readonly nombrePersona = nombrePersona;
  protected readonly etiquetaZona = etiquetaZona;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly codigoRuta = codigoRuta;
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly distrito = signal('');
  protected readonly codigo = signal('');
  protected readonly pagina = signal(1);
  protected readonly rutaId = signal<number | null>(null);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  private readonly enFecha = computed(() => {
    const zona = this.zona();
    const desde = this.desde();
    const hasta = this.hasta();
    const rutas = this.rutas().filter((ruta) => {
      if ((zona === 'lima') !== ruta.dentro_de_lima) return false;
      if (desde && ruta.fecha < desde) return false;
      if (hasta && ruta.fecha > hasta) return false;
      return true;
    });
    const ids = new Set(rutas.map((ruta) => ruta.id));
    const destinos = this.destinos().filter((destino) => destino.ruta_id != null && ids.has(destino.ruta_id));
    return { rutas, destinos };
  });
  protected readonly rutasLocal = computed(() => {
    const codigo = this.codigo().trim().toLowerCase();
    return this.enFecha().rutas.filter((ruta) => {
      if (!codigo) return true;
      if (codigoRuta(ruta).toLowerCase().includes(codigo) || String(ruta.id).includes(codigo)) return true;
      return ruta.paradas.some((parada) =>
        `${parada.codigo_externo} ${parada.nombre_receptor} ${parada.apellido_receptor}`.toLowerCase().includes(codigo),
      );
    });
  });
  protected readonly rutaActual = computed(() => this.rutasLocal().find((ruta) => ruta.id === this.rutaId()) ?? null);
  protected readonly paradasLocal = computed(() => {
    const ruta = this.rutaActual();
    if (!ruta) return [];
    const codigo = this.codigo().trim().toLowerCase();
    const buscaRuta = !codigo || codigoRuta(ruta).toLowerCase().includes(codigo) || String(ruta.id) === codigo;
    return ruta.paradas.filter((parada) => {
      if (buscaRuta) return true;
      return `${parada.codigo_externo} ${parada.nombre_receptor} ${parada.apellido_receptor}`.toLowerCase().includes(codigo);
    });
  });
  protected readonly paradasPagina = computed(() => {
    const inicio = (this.pagina() - 1) * POR_PAGINA;
    return this.paradasLocal().slice(inicio, inicio + POR_PAGINA);
  });
  protected readonly destinosProvincia = computed(() => {
    const distrito = this.distrito();
    return this.enFecha().destinos.filter((destino) => !distrito || destino.distrito === distrito);
  });
  protected readonly destinosPagina = computed(() => {
    const inicio = (this.pagina() - 1) * POR_PAGINA;
    return this.destinosProvincia().slice(inicio, inicio + POR_PAGINA);
  });
  protected readonly distritos = computed(() =>
    [...new Set(this.enFecha().destinos.map((destino) => destino.distrito.trim() || 'Sin distrito'))].sort((a, b) => a.localeCompare(b, 'es')),
  );
  protected readonly distritosCubiertos = computed(() => new Set(this.destinosProvincia().map((destino) => destino.distrito || 'Sin distrito')).size);
  protected readonly barras = computed(() => {
    const grupos = new Map<string, number>();
    for (const destino of this.destinosProvincia()) {
      const nombre = destino.distrito.trim() || 'Sin distrito';
      grupos.set(nombre, (grupos.get(nombre) ?? 0) + 1);
    }
    const filas = [...grupos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
    const maximo = Math.max(...filas.map((fila) => fila[1]), 1);
    return filas.slice(0, 8).map(([nombre, total]) => ({ nombre, total, ancho: Math.round((total / maximo) * 100) }));
  });
  protected readonly enCurso = computed(() => this.enFecha().rutas.some((ruta) => ruta.estado === 'EN_PROCESO'));
  protected readonly marcasLocal = computed(() => {
    const ruta = this.rutaActual();
    if (!ruta) return [];
    return marcasRuta({
      paradas: ruta.paradas,
      origen: ruta.base_origen,
      camion: this.unidadVisible(ruta) ? { latitud: ruta.ultima_latitud ?? '', longitud: ruta.ultima_longitud ?? '' } : null,
      camionId: ruta.id,
    });
  });
  protected readonly geometriaLocal = computed(() => lineaGeo(this.rutaActual()?.geometria_cliente));
  protected readonly marcasProvincia = computed(() =>
    marcasRuta({
      paradas: this.destinosProvincia().map((destino, indice) => ({
        destino_id: destino.id,
        orden: indice + 1,
        latitud: destino.latitud,
        longitud: destino.longitud,
        direccion: destino.direccion,
        estado: destino.estado,
        codigo_externo: destino.codigo_externo,
      })),
    }),
  );

  constructor() {
    effect(() => {
      const lista = this.rutasLocal();
      const actual = this.rutaId();
      if (actual != null && lista.some((ruta) => ruta.id === actual)) return;
      this.rutaId.set(lista[0]?.id ?? null);
    });
    forkJoin({
      rutas: listarRutasCliente(this.api),
      destinos: listarDestinosCliente(this.api),
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
    this.rutaId.set(null);
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

  cambiarRuta(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    this.rutaId.set(id > 0 ? id : null);
    this.pagina.set(1);
  }

  limpiar(): void {
    this.desde.set('');
    this.hasta.set('');
    this.distrito.set('');
    this.codigo.set('');
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

  unidadVisible(ruta: Ruta): boolean {
    return ruta.dentro_de_lima
      && ruta.estado === 'EN_PROCESO'
      && ruta.paradas.some((parada) => parada.estado === 'EN_PROCESO')
      && !!ruta.ultima_latitud
      && !!ruta.ultima_longitud;
  }

  textoUnidad(ruta: Ruta): string {
    const vehiculo = ruta.vehiculo;
    if (!vehiculo) return 'Sin vehículo asignado';
    return [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || vehiculo.tipo || 'Unidad';
  }

  nombreParada(parada: Ruta['paradas'][number]): string {
    return `${parada.nombre_receptor} ${parada.apellido_receptor}`.trim() || '—';
  }

  nombreDestino(destino: Destino): string {
    return `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim() || '—';
  }

  conteoEstado(estado: Destino['estado']): number {
    return this.destinosProvincia().filter((destino) => destino.estado === estado).length;
  }

  porcentaje(parte: number, total: number): string {
    if (!total) return '0%';
    return `${Math.round((parte / total) * 100)}%`;
  }

  exportarLocal(): void {
    const ruta = this.rutaActual();
    if (!ruta) return;
    const encabezado = ['Hora', 'Código', 'Destinatario', 'Dirección', 'Distrito', 'Estado'];
    const filas = this.paradasLocal().map((parada) => [
      horaCorta(parada.hora_estimada),
      parada.codigo_externo,
      this.nombreParada(parada),
      parada.direccion,
      parada.distrito,
      etiquetaEstado(parada.estado),
    ]);
    descargarCsv(`ruta-${codigoRuta(ruta)}.csv`, encabezado, filas);
  }

  exportarProvincia(): void {
    const encabezado = ['Código', 'Destinatario', 'Distrito', 'Tipo', 'Estado', 'Dirección'];
    const filas = this.destinosProvincia().map((destino) => [
      destino.codigo_externo,
      this.nombreDestino(destino),
      destino.distrito,
      etiquetaTipo(destino.tipo_servicio),
      etiquetaEstado(destino.estado),
      destino.direccion,
    ]);
    descargarCsv('rutas-provincia.csv', encabezado, filas);
  }
}

function descargarCsv(nombre: string, encabezado: string[], filas: string[][]): void {
  const csv = [encabezado, ...filas].map((columnas) => columnas.map((valor) => `"${valor.replaceAll('"', '""')}"`).join(',')).join('\n');
  guardarBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), nombre);
}
