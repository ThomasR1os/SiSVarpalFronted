import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Ruta } from '../../core/models';
import { fechaCorta, hoy } from '../../core/texto';
import { Badge } from '../../shared/badge';
import {
  PedidoVista,
  etiquetaDia,
  etiquetaMes,
  mesAnterior,
  pedidosDe,
  porDistrito,
  serieDiaria,
  ultimosMeses,
} from './tablero-cliente';
import { finDeMes, listarDestinosCliente, listarRutasCliente, restarDias } from './rutas-cliente';

@Component({
  selector: 'app-cliente-dashboard',
  imports: [RouterLink, Badge],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (cargando()) { <p class="vacio-texto">Cargando el dashboard…</p> }

    <section class="relative min-h-64 overflow-hidden rounded-2xl bg-neutral text-neutral-content">
      <img class="absolute inset-0 h-full w-full object-cover object-[72%_center]" src="camion-varpal.jpg" alt="" />
      <div class="absolute inset-0 bg-gradient-to-r from-neutral via-neutral/88 to-neutral/25"></div>
      <div class="relative flex min-h-64 flex-col justify-center gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-xl">
          <p class="text-sm text-neutral-content/70">Portal del cliente @if (empresa()) { · {{ empresa() }} }</p>
          <h2 class="mt-1 text-3xl text-white sm:text-4xl">Bienvenido, {{ nombre }}</h2>
          <p class="mt-2 max-w-md text-sm text-neutral-content/75">Monitorea tus pedidos, rutas y el estado de las entregas.</p>
          <div class="mt-4 flex flex-wrap items-end gap-3">
            <div class="flex flex-wrap gap-2" role="group" aria-label="Zona">
              @for (opcion of zonas; track opcion.id) {
                <button
                  type="button"
                  class="btn btn-sm"
                  [class.bg-white]="zona() === opcion.id"
                  [class.text-primary]="zona() === opcion.id"
                  [class.bg-white/10]="zona() !== opcion.id"
                  [class.text-white]="zona() !== opcion.id"
                  [class.border-white/20]="zona() !== opcion.id"
                  (click)="zona.set(opcion.id)"
                >{{ opcion.nombre }}</button>
              }
            </div>
            <label class="control min-w-44 text-neutral-content/80">Periodo
              <select class="bg-white text-base-content" [value]="mes()" (change)="cambiarMes($event)">
                <option value="">12 meses</option>
                @for (item of meses; track item) {
                  <option [value]="item">{{ etiquetaMes(item) }}</option>
                }
              </select>
            </label>
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

    <section class="grid grid-cols-2 gap-3 xl:grid-cols-5">
      @for (tarjeta of tarjetas(); track tarjeta.id) {
        <article class="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <span class="grid size-11 shrink-0 place-items-center rounded-xl" [class]="icono(tarjeta.tono)">
            @switch (tarjeta.id) {
              @case ('prog') {
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              }
              @case ('ok') {
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              }
              @case ('ruta') {
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6H5.5A2.5 2.5 0 003 8.5V16m10 0H9m4 0h2.5l2-4H13" /></svg>
              }
              @case ('pend') {
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              }
              @default {
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01M10.3 4.3l-7.4 12.8A2 2 0 004.6 20h14.8a2 2 0 001.7-2.9L13.7 4.3a2 2 0 00-3.4 0z" /></svg>
              }
            }
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm text-base-content/60">{{ tarjeta.etiqueta }}</p>
            <p class="font-display text-3xl leading-none">{{ tarjeta.valor }}</p>
            <p class="mt-1 text-xs font-semibold" [class]="detalle(tarjeta.tono)">{{ tarjeta.detalle }}</p>
          </div>
        </article>
      }
    </section>

    <section>
      <h2 class="text-base">Accesos rápidos</h2>
      <p class="ayuda mb-3">Pasa al seguimiento en vivo o al historial de rutas.</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <a class="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/30" routerLink="/cliente/seguimiento">
          <span class="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.4-2.2A2 2 0 012 15.9V6.6a2 2 0 011.3-1.9L9 2m0 18l6-2.4M9 20V2m6 15.6l5.4 2.2A2 2 0 0022 17.9V6.1a2 2 0 00-1.3-1.9L15 2m0 15.6V2" /></svg>
          </span>
          <span class="min-w-0 flex-1">
            <strong class="block">Seguimiento</strong>
            <span class="text-sm text-base-content/60">El camión y las paradas cuando la ruta está en proceso.</span>
          </span>
        </a>
        <a class="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/30" routerLink="/cliente/historial">
          <span class="grid size-11 place-items-center rounded-xl bg-accent/15 text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a2 2 0 011.4.6l4.4 4.4a2 2 0 01.6 1.4V19a2 2 0 01-2 2z" /></svg>
          </span>
          <span class="min-w-0 flex-1">
            <strong class="block">Historial</strong>
            <span class="text-sm text-base-content/60">Rutas separadas entre Lima metropolitana y provincia.</span>
          </span>
        </a>
      </div>
    </section>

    <section class="grid gap-3 xl:grid-cols-2">
      @for (bloque of operaciones(); track bloque.zona) {
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg">{{ bloque.titulo }}</h2>
              <p class="ayuda">{{ bloque.detalle }}</p>
            </div>
            <a class="btn btn-ghost btn-sm" [routerLink]="['/cliente/historial']" [queryParams]="consultaZona(bloque.zona)">Ver detalle</a>
          </div>
          <div class="flex flex-wrap items-center gap-5">
            <div class="relative grid size-28 place-items-center">
              <svg viewBox="0 0 36 36" class="size-28 -rotate-90" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" class="fill-none stroke-base-300" stroke-width="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  class="fill-none"
                  [class.stroke-primary]="bloque.zona === 'lima'"
                  [class.stroke-accent]="bloque.zona === 'provincia'"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="97.4"
                  [attr.stroke-dashoffset]="arco(bloque.avance)"
                />
              </svg>
              <span class="absolute text-center">
                <strong class="block font-display text-xl leading-none">{{ bloque.avance }}%</strong>
              </span>
            </div>
            <div class="min-w-40 flex-1">
              <p class="text-sm text-base-content/60">Avance de entregas</p>
              <p class="font-semibold">{{ bloque.exitosos }} de {{ bloque.pedidos }} pedidos</p>
              <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><dt class="text-base-content/60">Vehículos en ruta</dt><dd class="font-display text-xl">{{ bloque.vehiculos }}</dd></div>
                <div><dt class="text-base-content/60">Conductores en ruta</dt><dd class="font-display text-xl">{{ bloque.conductores }}</dd></div>
                <div><dt class="text-base-content/60">En ruta</dt><dd class="font-display text-xl">{{ bloque.enRuta }}</dd></div>
                <div><dt class="text-base-content/60">Distritos</dt><dd class="font-display text-xl">{{ bloque.distritos }}</dd></div>
              </dl>
            </div>
          </div>
        </article>
      }
    </section>

    <section class="grid items-stretch gap-3 xl:grid-cols-3">
      <article class="flex h-full flex-col rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 class="text-base">Programaciones por fecha</h2>
        <p class="ayuda">Pedidos del periodo y cuántos se entregaron.</p>
        <p class="mt-3 flex flex-wrap gap-3 text-xs">
          <span class="inline-flex items-center gap-1"><span class="inline-block size-2.5 rounded-sm bg-primary"></span> Programados</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block size-2.5 rounded-sm bg-success"></span> Entregados</span>
        </p>
        <div class="mt-3 flex min-h-52 flex-1 items-end overflow-x-auto overflow-y-hidden">
          @if (serie().length) {
            <div class="flex h-full min-h-52 w-full items-end gap-2">
              @for (dia of serie(); track dia.fecha) {
                <div class="flex min-w-8 flex-1 flex-col items-center justify-end">
                  <div class="flex h-40 items-end gap-1">
                    <span class="w-2.5 rounded-t bg-primary" [style.height.px]="barra(dia.total)"></span>
                    <span class="w-2.5 rounded-t bg-success" [style.height.px]="barra(dia.exitosas)"></span>
                  </div>
                  <span class="mt-1 text-[10px] leading-none text-base-content/70">{{ etiquetaDia(dia.fecha) }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="vacio-texto w-full">No hay pedidos en este periodo.</p>
          }
        </div>
      </article>

      <article class="flex h-full flex-col rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 class="text-base">Estados de entrega</h2>
        <p class="ayuda">Distribución de los pedidos del periodo.</p>
        <div class="mt-3 flex min-h-52 flex-1 flex-wrap items-center justify-center gap-4">
          <div class="relative grid size-40 shrink-0 place-items-center">
            <div class="size-40 rounded-full" [style.background]="dona()"></div>
            <div class="absolute grid size-24 place-items-center rounded-full bg-base-100 text-center">
              <strong class="font-display text-2xl leading-none">{{ visibles().length }}</strong>
              <span class="text-[11px] text-base-content/60">pedidos</span>
            </div>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            @for (item of leyenda(); track item.nombre) {
              <li class="flex items-center gap-2">
                <span class="size-2.5 rounded-full" [style.background]="item.color"></span>
                <span>{{ item.nombre }}</span>
                <strong>{{ item.valor }}</strong>
              </li>
            }
          </ul>
        </div>
      </article>

      <article class="flex h-full flex-col rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 class="text-base">Pedidos por distrito</h2>
        <p class="ayuda">Los distritos con más pedidos en el periodo.</p>
        <div class="mt-3 flex min-h-52 flex-1 flex-col justify-center gap-3">
          @for (barra of distritos(); track barra.nombre) {
            <div class="grid grid-cols-[minmax(6.5rem,1fr)_minmax(0,1.4fr)_1.5rem] items-center gap-2 text-xs">
              <span class="truncate" [title]="barra.nombre">{{ barra.nombre }}</span>
              <span class="h-2.5 overflow-hidden rounded-full bg-base-200">
                <span class="block h-full rounded-full bg-accent" [style.width.%]="barra.ancho"></span>
              </span>
              <span class="text-right font-semibold">{{ barra.total }}</span>
            </div>
          } @empty {
            <p class="vacio-texto">No hay pedidos en este periodo.</p>
          }
        </div>
      </article>
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-base">Últimas programaciones</h2>
          <p class="ayuda">Pedidos del periodo. El código abre la ruta en el historial.</p>
        </div>
        <a class="btn btn-ghost btn-sm" routerLink="/cliente/historial">Ver todas</a>
      </div>
      <div class="data-table max-h-[28rem] overflow-auto">
        <table class="table table-sm table-pin-rows">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Código</th>
              <th>Distrito</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Placa</th>
            </tr>
          </thead>
          <tbody>
            @for (pedido of recientes(); track pedido.id) {
              <tr>
                <td data-label="Fecha">{{ fechaCorta(pedido.fecha) }}</td>
                <td data-label="Código">
                  @if (pedido.rutaId) {
                    <a class="link link-hover" [routerLink]="['/cliente/historial']" [queryParams]="consultaPedido(pedido)">{{ pedido.codigo }}</a>
                  } @else {
                    {{ pedido.codigo }}
                  }
                </td>
                <td data-label="Distrito">{{ pedido.distrito }}</td>
                <td class="max-w-xs whitespace-normal" data-label="Descripción">{{ pedido.servicio }}</td>
                <td data-label="Estado"><app-badge [estado]="pedido.estado" /></td>
                <td data-label="Placa">{{ pedido.placa }}</td>
              </tr>
            } @empty {
              <tr class="fila-vacia"><td colspan="6">No hay pedidos en este periodo.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class ClienteDashboard {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly hoyIso = hoy();
  private readonly base = signal<PedidoVista[]>([]);
  private readonly rutas = signal<Ruta[]>([]);
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaDia = etiquetaDia;
  protected readonly etiquetaMes = etiquetaMes;
  protected readonly meses = ultimosMeses(this.hoyIso);
  protected readonly nombre = this.auth.usuario()?.nombre || 'cliente';
  protected readonly zonas: { id: 'lima' | 'provincia'; nombre: string }[] = [
    { id: 'lima', nombre: 'Local' },
    { id: 'provincia', nombre: 'Provincia' },
  ];
  protected readonly mes = signal('');
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly empresa = computed(() => this.rutas().find((ruta) => ruta.cliente_nombre)?.cliente_nombre ?? '');
  protected readonly delPeriodo = computed(() => this.base().filter((pedido) => this.enVentana(pedido.fecha)));
  protected readonly visibles = computed(() => this.delPeriodo().filter((pedido) => this.enZona(pedido.zona)));
  protected readonly serie = computed(() => {
    const dias = serieDiaria(this.visibles());
    return this.mes() ? dias : dias.slice(-12);
  });
  protected readonly distritos = computed(() => porDistrito(this.visibles()).slice(0, 8));
  protected readonly recientes = computed(() =>
    [...this.visibles()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.codigo.localeCompare(b.codigo)).slice(0, 8),
  );
  protected readonly enCurso = computed(() =>
    this.rutas().some((ruta) => ruta.estado === 'EN_PROCESO' && this.enZona(ruta.dentro_de_lima ? 'lima' : 'provincia')),
  );
  protected readonly maximoDia = computed(() => Math.max(...this.serie().map((dia) => dia.total), 1));
  protected readonly tarjetas = computed(() => {
    const lista = this.visibles();
    const total = lista.length;
    const entregados = lista.filter((pedido) => pedido.estado === 'EXITOSO').length;
    const enRuta = lista.filter((pedido) => pedido.estado === 'EN_PROCESO').length;
    const pendientes = lista.filter((pedido) => pedido.estado === 'NO_INICIADO').length;
    const incidencias = lista.filter((pedido) => pedido.estado === 'FALLIDO').length;
    return [
      { id: 'prog', etiqueta: 'Pedidos programados', valor: total, detalle: this.variacion() ?? 'En el periodo', tono: 'primary' },
      { id: 'ok', etiqueta: 'Pedidos entregados', valor: entregados, detalle: porcentaje(entregados, total), tono: 'success' },
      { id: 'ruta', etiqueta: 'Pedidos en ruta', valor: enRuta, detalle: porcentaje(enRuta, total), tono: 'info' },
      { id: 'pend', etiqueta: 'Pedidos pendientes', valor: pendientes, detalle: porcentaje(pendientes, total), tono: 'warning' },
      { id: 'fail', etiqueta: 'Incidencias', valor: incidencias, detalle: porcentaje(incidencias, total), tono: 'error' },
    ];
  });
  protected readonly leyenda = computed(() => {
    const lista = this.visibles();
    return [
      { nombre: 'Entregados', valor: lista.filter((pedido) => pedido.estado === 'EXITOSO').length, color: 'var(--color-success)' },
      { nombre: 'En ruta', valor: lista.filter((pedido) => pedido.estado === 'EN_PROCESO').length, color: 'var(--color-info)' },
      { nombre: 'Pendientes', valor: lista.filter((pedido) => pedido.estado === 'NO_INICIADO').length, color: 'var(--color-warning)' },
      { nombre: 'Incidencias', valor: lista.filter((pedido) => pedido.estado === 'FALLIDO').length, color: 'var(--color-error)' },
    ];
  });
  protected readonly operaciones = computed(() => [
    this.resumenZona('lima', 'Operación local', 'Lima metropolitana'),
    this.resumenZona('provincia', 'Operación provincia', 'Puntos fuera de Lima metropolitana'),
  ]);

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

  icono(tono: string): string {
    if (tono === 'success') return 'bg-success/10 text-success';
    if (tono === 'info') return 'bg-info/15 text-info';
    if (tono === 'warning') return 'bg-warning/15 text-warning';
    if (tono === 'error') return 'bg-error/10 text-error';
    return 'bg-primary/10 text-primary';
  }

  detalle(tono: string): string {
    if (tono === 'success') return 'text-success';
    if (tono === 'info') return 'text-info';
    if (tono === 'warning') return 'text-warning';
    if (tono === 'error') return 'text-error';
    return 'text-base-content/60';
  }

  barra(valor: number): number {
    return Math.max(valor > 0 ? 4 : 0, Math.round((valor / this.maximoDia()) * 140));
  }

  arco(avance: number): number {
    return 97.4 * (1 - Math.min(100, Math.max(0, avance)) / 100);
  }

  dona(): string {
    const lista = this.visibles();
    const total = lista.length;
    if (!total) return 'var(--color-base-300)';
    const entregados = (lista.filter((pedido) => pedido.estado === 'EXITOSO').length / total) * 100;
    const enRuta = (lista.filter((pedido) => pedido.estado === 'EN_PROCESO').length / total) * 100;
    const pendientes = (lista.filter((pedido) => pedido.estado === 'NO_INICIADO').length / total) * 100;
    const a = entregados;
    const b = a + enRuta;
    const c = b + pendientes;
    return `conic-gradient(var(--color-success) 0 ${a}%, var(--color-info) ${a}% ${b}%, var(--color-warning) ${b}% ${c}%, var(--color-error) ${c}% 100%)`;
  }

  cambiarMes(evento: Event): void {
    this.mes.set((evento.target as HTMLSelectElement).value);
  }

  consultaZona(zona: 'lima' | 'provincia'): Record<string, string> {
    const ventana = this.ventana();
    return { zona, desde: ventana.desde, hasta: ventana.hasta };
  }

  consultaPedido(pedido: PedidoVista): Record<string, string> {
    const params: Record<string, string> = {
      ruta: String(pedido.rutaId),
      desde: pedido.fecha,
      hasta: pedido.fecha,
    };
    if (pedido.zona) params['zona'] = pedido.zona;
    return params;
  }

  private resumenZona(zona: 'lima' | 'provincia', titulo: string, detalle: string) {
    const pedidos = this.delPeriodo().filter((pedido) => pedido.zona === zona);
    const exitosos = pedidos.filter((pedido) => pedido.estado === 'EXITOSO').length;
    const rutas = this.rutas().filter(
      (ruta) => this.enVentana(ruta.fecha) && ruta.dentro_de_lima === (zona === 'lima') && ruta.estado === 'EN_PROCESO',
    );
    return {
      zona,
      titulo,
      detalle,
      pedidos: pedidos.length,
      exitosos,
      avance: pedidos.length ? Math.round((exitosos / pedidos.length) * 100) : 0,
      enRuta: pedidos.filter((pedido) => pedido.estado === 'EN_PROCESO').length,
      vehiculos: new Set(rutas.map((ruta) => ruta.vehiculo?.id).filter((id) => id != null)).size,
      conductores: new Set(rutas.map((ruta) => ruta.conductor?.id).filter((id) => id != null)).size,
      distritos: new Set(pedidos.map((pedido) => pedido.distrito)).size,
    };
  }

  private variacion(): string | null {
    const anterior = this.anterior();
    if (anterior == null || anterior === 0) return null;
    const delta = Math.round(((this.visibles().length - anterior) / anterior) * 100);
    const signo = delta > 0 ? '+' : '';
    return `${signo}${delta}% vs periodo anterior`;
  }

  private anterior(): number | null {
    const elegido = this.mes();
    const desde = elegido ? `${mesAnterior(`${elegido}-01`)}-01` : `${ultimosMeses(restarDias(`${this.meses[0]}-01`, 1))[0]}-01`;
    const hasta = elegido ? finDeMes(desde) : restarDias(`${this.meses[0]}-01`, 1);
    return this.base().filter((pedido) => pedido.fecha >= desde && pedido.fecha <= hasta && this.enZona(pedido.zona)).length;
  }

  private ventana(): { desde: string; hasta: string } {
    if (this.mes()) return { desde: `${this.mes()}-01`, hasta: finDeMes(`${this.mes()}-01`) };
    return { desde: `${this.meses[0]}-01`, hasta: finDeMes(this.hoyIso) };
  }

  private enVentana(fecha: string): boolean {
    const ventana = this.ventana();
    return fecha >= ventana.desde && fecha <= ventana.hasta;
  }

  private enZona(zona: 'lima' | 'provincia' | null): boolean {
    return zona === this.zona();
  }
}

function porcentaje(parte: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}%`;
}
