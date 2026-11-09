import { Component, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, reduce } from 'rxjs';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Cliente, Destino, EstadoDestino, Pagina, Ruta } from '../../core/models';
import { TAMANO_CATALOGO, etiquetaEstado, etiquetaTipo, fechaCorta, fechaHora, nombrePersona, textoMotivo } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Paginacion } from '../../shared/paginacion';

const POR_PAGINA = 10;

interface FilaReporte {
  id: number;
  fecha: string;
  clienteId: number;
  cliente: string;
  codigo: string;
  documento: string;
  destinatario: string;
  distrito: string;
  operacion: string;
  estado: EstadoDestino;
  motivo: string;
  actualizado: string;
  conductor: string;
  comentario: string;
  zona: 'lima' | 'provincia';
}

@Component({
  selector: 'app-reporte-admin',
  imports: [Badge, Paginacion],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="prog flex flex-col gap-4">
      <header class="prog-encabezado">
        <div>
          <p class="prog-miga">Operación <span aria-hidden="true">›</span> Reportes</p>
          <h1>Reportes</h1>
          <p>Pedidos de las rutas publicadas, con estado, motivo y responsable.</p>
        </div>
        <div class="prog-chip" [class.lista]="!enCurso()">
          <span>{{ filtrados().length }} {{ filtrados().length === 1 ? 'pedido' : 'pedidos' }}</span>
          <strong>{{ enCurso() ? 'En curso' : zona() === 'lima' ? 'Local' : 'Provincia' }}</strong>
        </div>
      </header>

      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (cargando()) { <p class="vacio-texto">Cargando el reporte…</p> }

      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        @for (tarjeta of tarjetas(); track tarjeta.id) {
          <article class="prog-card p-4">
            <p class="text-sm text-base-content/60">{{ tarjeta.etiqueta }}</p>
            <p class="mt-1 font-display text-3xl leading-none">{{ tarjeta.valor }}</p>
            <p class="mt-1 text-xs font-semibold text-base-content/60">{{ tarjeta.detalle }}</p>
          </article>
        }
      </section>

      <section class="prog-card p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base">Filtros</h2>
            <p class="ayuda">Pedidos de {{ zona() === 'lima' ? 'Lima metropolitana' : 'provincia' }}.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="limpiar()">Limpiar filtros</button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          <label class="prog-campo">Distrito
            <select [value]="distrito()" (change)="cambiarDistrito($event)">
              <option value="">Todos</option>
              @for (item of distritos(); track item) {
                <option [value]="item">{{ item }}</option>
              }
            </select>
          </label>
          <label class="prog-campo">Estado
            <select [value]="estado()" (change)="cambiarEstado($event)">
              <option value="">Todos</option>
              <option value="NO_INICIADO">No iniciado</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="PENDIENTE">Evidencia pendiente</option>
              <option value="EXITOSO">Exitoso</option>
              <option value="FALLIDO">Fallido</option>
              <option value="REPROGRAMADO">Reprogramado</option>
            </select>
          </label>
          <label class="prog-campo">Responsable
            <select [value]="responsable()" (change)="cambiarResponsable($event)">
              <option value="">Todos</option>
              @for (item of responsables(); track item) {
                <option [value]="item">{{ item }}</option>
              }
            </select>
          </label>
          <label class="prog-campo">Buscar
            <input type="search" placeholder="Código, documento, destinatario o motivo" [value]="buscar()" (input)="cambiarBuscar($event)" />
          </label>
        </div>
      </section>

      <section class="prog-card p-4">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 class="text-base">Detalle de pedidos</h2>
            <p class="ayuda">{{ filtrados().length }} pedidos en esta vista.</p>
          </div>
          <button type="button" class="btn btn-outline btn-sm" (click)="exportar()" [disabled]="filtrados().length === 0">Exportar</button>
        </div>
        <div class="data-table overflow-auto">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Código</th>
                <th>Destinatario</th>
                <th>Distrito</th>
                <th>Operación</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th>Responsable</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              @for (pedido of paginaActual(); track pedido.id) {
                <tr>
                  <td data-label="Fecha">{{ fechaCorta(pedido.fecha) }}</td>
                  <td data-label="Cliente">{{ pedido.cliente }}</td>
                  <td data-label="Código">{{ pedido.codigo }}</td>
                  <td data-label="Destinatario">
                    <strong class="block">{{ pedido.destinatario }}</strong>
                    <span class="text-xs text-base-content/60">{{ pedido.documento }}</span>
                  </td>
                  <td data-label="Distrito">{{ pedido.distrito }}</td>
                  <td data-label="Operación">{{ pedido.operacion }}</td>
                  <td data-label="Estado"><app-badge [estado]="pedido.estado" /></td>
                  <td class="max-w-xs whitespace-normal" data-label="Motivo">{{ pedido.motivo }}</td>
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
    </div>
  `,
})
export class ReporteAdmin {
  private readonly api = inject(Api);
  protected readonly fechaCorta = fechaCorta;
  protected readonly porPagina = POR_PAGINA;
  protected readonly clientes = signal<Cliente[]>([]);
  private readonly base = signal<FilaReporte[]>([]);
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly clienteId = signal<number | null>(null);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly distrito = signal('');
  protected readonly estado = signal<'' | EstadoDestino>('');
  protected readonly responsable = signal('');
  protected readonly buscar = signal('');
  protected readonly pagina = signal(1);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  private readonly deZona = computed(() => {
    const clienteId = this.clienteId();
    return this.base().filter((pedido) => pedido.zona === this.zona() && (clienteId == null || pedido.clienteId === clienteId));
  });
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
        const bolsa = `${pedido.codigo} ${pedido.documento} ${pedido.destinatario} ${pedido.motivo} ${pedido.cliente}`.toLowerCase();
        return bolsa.includes(texto);
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo));
  });
  protected readonly paginaActual = computed(() => {
    const inicio = (this.pagina() - 1) * POR_PAGINA;
    return this.filtrados().slice(inicio, inicio + POR_PAGINA);
  });
  protected readonly enCurso = computed(() => this.filtrados().some((pedido) => pedido.estado === 'EN_PROCESO'));
  protected readonly tarjetas = computed(() => {
    const lista = this.filtrados();
    const total = lista.length;
    const entregados = lista.filter((pedido) => pedido.estado === 'EXITOSO').length;
    const enRuta = lista.filter((pedido) => pedido.estado === 'EN_PROCESO').length;
    const pendientes = lista.filter((pedido) => pedido.estado === 'NO_INICIADO').length;
    const incidencias = lista.filter((pedido) => pedido.estado === 'FALLIDO' || pedido.estado === 'REPROGRAMADO').length;
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
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
      error: () => undefined,
    });
    forkJoin({
      rutas: listarTodo<Ruta>(this.api, '/api/rutas/'),
      destinos: listarTodo<Destino>(this.api, '/api/destinos/'),
    }).subscribe({
      next: ({ rutas, destinos }) => {
        this.base.set(filasDe(destinos, rutas));
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

  cambiarCliente(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    this.clienteId.set(id > 0 ? id : null);
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
    if (valor === '' || valor === 'NO_INICIADO' || valor === 'EN_PROCESO' || valor === 'PENDIENTE' || valor === 'EXITOSO' || valor === 'FALLIDO' || valor === 'REPROGRAMADO') {
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
    this.clienteId.set(null);
    this.pagina.set(1);
  }

  exportar(): void {
    const encabezado = ['Fecha', 'Cliente', 'Código', 'Documento', 'Destinatario', 'Distrito', 'Operación', 'Estado', 'Motivo', 'Actualización', 'Responsable', 'Observación'];
    const filas = this.filtrados().map((pedido) => [
      fechaCorta(pedido.fecha),
      pedido.cliente,
      pedido.codigo,
      pedido.documento,
      pedido.destinatario,
      pedido.distrito,
      pedido.operacion,
      etiquetaEstado(pedido.estado),
      pedido.motivo,
      fechaHora(pedido.actualizado),
      pedido.conductor,
      pedido.comentario,
    ]);
    const csv = [encabezado, ...filas].map((columnas) => columnas.map((valor) => `"${valor.replaceAll('"', '""')}"`).join(',')).join('\n');
    guardarBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `reporte-${this.zona()}.csv`);
  }
}

function filasDe(destinos: readonly Destino[], rutas: readonly Ruta[]): FilaReporte[] {
  const porRuta = new Map(rutas.map((ruta) => [ruta.id, ruta]));
  const filas: FilaReporte[] = [];
  for (const destino of destinos) {
    if (destino.ruta_id == null) continue;
    const ruta = porRuta.get(destino.ruta_id);
    if (!ruta || ruta.estado === 'BORRADOR' || ruta.estado === 'CANCELADA') continue;
    filas.push({
      id: destino.id,
      fecha: destino.fecha.slice(0, 10),
      clienteId: destino.cliente_id,
      cliente: ruta.cliente_nombre || 'Sin cliente',
      codigo: destino.codigo_externo,
      documento: destino.documento_receptor.trim() || '—',
      destinatario: `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim() || '—',
      distrito: destino.distrito.trim() || 'Sin distrito',
      operacion: etiquetaTipo(destino.tipo_servicio),
      estado: destino.estado,
      motivo: textoMotivo(destino),
      actualizado: destino.actualizado_en,
      conductor: ruta.conductor ? nombrePersona(ruta.conductor) : '—',
      comentario: destino.observacion_cierre.trim() || destino.observaciones.trim() || '—',
      zona: ruta.dentro_de_lima ? 'lima' : 'provincia',
    });
  }
  return filas;
}

function porcentaje(parte: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}% del total`;
}

function unicos(valores: string[]): string[] {
  return [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es'));
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
