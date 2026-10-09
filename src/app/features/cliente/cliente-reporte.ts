import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { EstadoDestino, Ruta } from '../../core/models';
import { etiquetaEstado, fechaCorta, fechaHora } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Paginacion } from '../../shared/paginacion';
import { PedidoVista, pedidosDe } from './tablero-cliente';
import { listarDestinosCliente, listarRutasCliente } from './rutas-cliente';

const POR_PAGINA = 10;

@Component({
  selector: 'app-cliente-reporte',
  imports: [RouterLink, Badge, Paginacion],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (cargando()) { <p class="vacio-texto">Cargando el reporte...</p> }

    <section class="relative min-h-56 overflow-hidden rounded-2xl bg-neutral text-neutral-content">
      <img class="absolute inset-0 h-full w-full object-cover object-[72%_center]" src="camion-varpal.jpg" alt="" />
      <div class="absolute inset-0 bg-gradient-to-r from-neutral via-neutral/88 to-neutral/25"></div>
      <div class="relative flex min-h-56 flex-col justify-center gap-4 px-5 py-6 sm:px-7">
        <div class="max-w-xl">
          <h2 class="text-3xl text-white sm:text-4xl">Reporte</h2>
          <p class="mt-2 max-w-md text-sm text-neutral-content/75">Consulta el detalle de tus pedidos, con estado, distrito y responsable.</p>
          <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Zona">
            @for (opcion of zonas; track opcion.id) {
              <button
                type="button"
                class="btn btn-sm"
                [class.bg-white]="zona() === opcion.id"
                [class.text-primary]="zona() === opcion.id"
                [class.bg-white/10]="zona() !== opcion.id"
                [class.text-white]="zona() !== opcion.id"
                [class.border-white/20]="zona() !== opcion.id"
                (click)="cambiarZona(opcion.id)"
              >{{ opcion.nombre }}</button>
            }
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

    <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      @for (tarjeta of tarjetas(); track tarjeta.id) {
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <p class="text-sm text-base-content/60">{{ tarjeta.etiqueta }}</p>
          <p class="mt-1 font-display text-3xl leading-none">{{ tarjeta.valor }}</p>
          <p class="mt-1 text-xs font-semibold text-base-content/60">{{ tarjeta.detalle }}</p>
        </article>
      }
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-base">Filtros de búsqueda</h2>
          <p class="ayuda">Pedidos de {{ zona() === 'lima' ? 'Lima metropolitana' : 'provincia' }}.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="limpiar()">Limpiar filtros</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="control">Desde
          <input type="date" [value]="desde()" [max]="hasta() || undefined" (change)="cambiarDesde($event)" />
        </label>
        <label class="control">Hasta
          <input type="date" [value]="hasta()" [min]="desde() || undefined" (change)="cambiarHasta($event)" />
        </label>
        <label class="control">Distrito
          <select [value]="distrito()" (change)="cambiarDistrito($event)">
            <option value="">Todos</option>
            @for (item of distritos(); track item) {
              <option [value]="item">{{ item }}</option>
            }
          </select>
        </label>
        <label class="control">Estado
          <select [value]="estado()" (change)="cambiarEstado($event)">
            <option value="">Todos</option>
            <option value="NO_INICIADO">No iniciado</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="EXITOSO">Exitoso</option>
            <option value="FALLIDO">Fallido</option>
          </select>
        </label>
        <label class="control">Responsable
          <select [value]="responsable()" (change)="cambiarResponsable($event)">
            <option value="">Todos</option>
            @for (item of responsables(); track item) {
              <option [value]="item">{{ item }}</option>
            }
          </select>
        </label>
        <label class="control xl:col-span-5">Buscar pedido
          <input type="search" placeholder="Código, documento o destinatario" [value]="buscar()" (input)="cambiarBuscar($event)" />
        </label>
      </div>
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-base">Detalle de pedidos</h2>
          <p class="ayuda">{{ filtrados().length }} pedidos en esta vista.</p>
        </div>
        <button type="button" class="btn btn-sm btn-outline" (click)="exportar()" [disabled]="filtrados().length === 0">Exportar</button>
      </div>
      <div class="data-table overflow-auto">
        <table class="table table-sm table-pin-rows">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código</th>
              <th>Documento</th>
              <th>Destinatario</th>
              <th>Distrito</th>
              <th>Operación</th>
              <th>Estado</th>
              <th>Actualización</th>
              <th>Responsable</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            @for (pedido of paginaActual(); track pedido.id) {
              <tr>
                <td data-label="Fecha">{{ fechaCorta(pedido.fecha) }}</td>
                <td data-label="Código">
                  @if (pedido.rutaId) {
                    <a class="link link-hover" [routerLink]="['/cliente/historial']" [queryParams]="consulta(pedido)">{{ pedido.codigo }}</a>
                  } @else {
                    {{ pedido.codigo }}
                  }
                </td>
                <td data-label="Documento">{{ pedido.documento }}</td>
                <td data-label="Destinatario">{{ pedido.destinatario }}</td>
                <td data-label="Distrito">{{ pedido.distrito }}</td>
                <td data-label="Operación">{{ pedido.operacion }}</td>
                <td data-label="Estado"><app-badge [estado]="pedido.estado" /></td>
                <td data-label="Actualización">{{ fechaHora(pedido.actualizado) }}</td>
                <td data-label="Responsable">{{ pedido.conductor }}</td>
                <td class="max-w-xs whitespace-normal" data-label="Observación">{{ pedido.comentario }}</td>
              </tr>
            } @empty {
              <tr class="fila-vacia"><td colspan="10">No hay pedidos con estos filtros.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-paginacion [pagina]="pagina()" [tamano]="porPagina" [total]="filtrados().length" (paginaChange)="pagina.set($event)" />
    </section>
  `,
})
export class ClienteReporte {
  private readonly api = inject(Api);
  private readonly base = signal<PedidoVista[]>([]);
  private readonly rutas = signal<Ruta[]>([]);
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly porPagina = POR_PAGINA;
  protected readonly zonas: { id: 'lima' | 'provincia'; nombre: string }[] = [
    { id: 'lima', nombre: 'Local' },
    { id: 'provincia', nombre: 'Provincia' },
  ];
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly distrito = signal('');
  protected readonly estado = signal<'' | EstadoDestino>('');
  protected readonly responsable = signal('');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly deZona = computed(() => this.base().filter((pedido) => pedido.zona === this.zona()));
  protected readonly distritos = computed(() => unicos(this.deZona().map((pedido) => pedido.distrito)));
  protected readonly responsables = computed(() => unicos(this.deZona().map((pedido) => pedido.conductor).filter((nombre) => nombre !== '—')));
  protected readonly filtrados = computed(() => {
    const texto = this.buscar().trim().toLowerCase();
    return this.deZona()
      .filter((pedido) => {
        if (this.desde() && pedido.fecha < this.desde()) return false;
        if (this.hasta() && pedido.fecha > this.hasta()) return false;
        if (this.distrito() && pedido.distrito !== this.distrito()) return false;
        if (this.estado() && pedido.estado !== this.estado()) return false;
        if (this.responsable() && pedido.conductor !== this.responsable()) return false;
        if (!texto) return true;
        const bolsa = `${pedido.codigo} ${pedido.documento} ${pedido.destinatario}`.toLowerCase();
        return bolsa.includes(texto);
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo));
  });
  protected readonly paginaActual = computed(() => {
    const inicio = (this.pagina() - 1) * POR_PAGINA;
    return this.filtrados().slice(inicio, inicio + POR_PAGINA);
  });
  protected readonly enCurso = computed(() =>
    this.rutas().some((ruta) => ruta.estado === 'EN_PROCESO' && ruta.dentro_de_lima === (this.zona() === 'lima')),
  );
  protected readonly tarjetas = computed(() => {
    const lista = this.filtrados();
    const total = lista.length;
    const entregados = lista.filter((pedido) => pedido.estado === 'EXITOSO').length;
    const enRuta = lista.filter((pedido) => pedido.estado === 'EN_PROCESO').length;
    const pendientes = lista.filter((pedido) => pedido.estado === 'NO_INICIADO').length;
    const incidencias = lista.filter((pedido) => pedido.estado === 'FALLIDO').length;
    const distritos = new Set(lista.map((pedido) => pedido.distrito)).size;
    const zona = this.zona() === 'lima' ? 'Lima metropolitana' : 'Provincia';
    return [
      { id: 'prog', etiqueta: 'Pedidos programados', valor: total, detalle: zona },
      { id: 'ok', etiqueta: 'Pedidos entregados', valor: entregados, detalle: porcentaje(entregados, total) },
      { id: 'ruta', etiqueta: 'Pedidos en ruta', valor: enRuta, detalle: porcentaje(enRuta, total) },
      { id: 'pend', etiqueta: 'Pedidos pendientes', valor: pendientes, detalle: porcentaje(pendientes, total) },
      { id: 'fail', etiqueta: 'Incidencias', valor: incidencias, detalle: porcentaje(incidencias, total) },
      { id: 'dist', etiqueta: 'Distritos cubiertos', valor: distritos, detalle: 'Con pedidos en la vista' },
    ];
  });

  constructor() {
    forkJoin({
      rutas: listarRutasCliente(this.api),
      destinos: listarDestinosCliente(this.api),
    }).subscribe({
      next: ({ rutas, destinos }) => {
        this.rutas.set(rutas);
        this.base.set(pedidosDe(destinos, rutas));
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
    this.distrito.set('');
    this.responsable.set('');
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

  cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'NO_INICIADO' || valor === 'EN_PROCESO' || valor === 'EXITOSO' || valor === 'FALLIDO') {
      this.estado.set(valor);
    }
    this.pagina.set(1);
  }

  cambiarResponsable(evento: Event): void {
    this.responsable.set((evento.target as HTMLSelectElement).value);
    this.pagina.set(1);
  }

  cambiarBuscar(evento: Event): void {
    this.buscar.set((evento.target as HTMLInputElement).value);
    this.pagina.set(1);
  }

  limpiar(): void {
    this.desde.set('');
    this.hasta.set('');
    this.distrito.set('');
    this.estado.set('');
    this.responsable.set('');
    this.buscar.set('');
    this.pagina.set(1);
  }

  consulta(pedido: PedidoVista): Record<string, string> {
    return {
      zona: pedido.zona ?? 'lima',
      ruta: String(pedido.rutaId),
      desde: pedido.fecha,
      hasta: pedido.fecha,
    };
  }

  exportar(): void {
    const encabezado = ['Fecha', 'Código', 'Documento', 'Destinatario', 'Distrito', 'Operación', 'Estado', 'Actualización', 'Responsable', 'Observación'];
    const filas = this.filtrados().map((pedido) => [
      fechaCorta(pedido.fecha),
      pedido.codigo,
      pedido.documento,
      pedido.destinatario,
      pedido.distrito,
      pedido.operacion,
      etiquetaEstado(pedido.estado),
      fechaHora(pedido.actualizado),
      pedido.conductor,
      pedido.comentario,
    ]);
    const csv = [encabezado, ...filas].map((columnas) => columnas.map(celdaCsv).join(',')).join('\n');
    guardarBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `reporte-${this.zona()}.csv`);
  }
}

function porcentaje(parte: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}% del total`;
}

function unicos(valores: string[]): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
}

function celdaCsv(valor: string): string {
  return `"${valor.replaceAll('"', '""')}"`;
}
