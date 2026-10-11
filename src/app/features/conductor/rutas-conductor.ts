import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { Ruta } from '../../core/models';
import { fechaCorta, horarioParadas, hoy } from '../../core/texto';
import { Mapa } from '../../shared/mapa/mapa';
import { LineaMapa, MarcaMapa, lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { Icono } from './icono';
import { Modo, RutaConductor, chipRuta, resumenParadas } from './ruta-conductor';

export type SeleccionRuta = number | 'todas';

const PALETA = ['#1769e0', '#7c3aed', '#ea580c', '#0d9488', '#db2777', '#ca8a04', '#0891b2', '#65a30d'];

@Component({
  selector: 'app-rutas-conductor',
  imports: [NgTemplateOutlet, Mapa, Icono, RutaConductor],
  template: `
    @if (rutaElegida(); as ruta) {
      <app-ruta-conductor
        [ruta]="ruta"
        [color]="color(ruta)"
        [puedeIniciar]="puedeIniciar()"
        [posicionHoy]="posicionHoy(ruta)"
        [(modo)]="modo"
        (cambio)="cambio.emit($event)"
        (cerrada)="volver.emit()"
      >
        <ng-container *ngTemplateOutlet="selector" />
      </app-ruta-conductor>
    } @else {
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <button type="button" class="btn btn-circle shrink-0 border-0 bg-base-100 shadow-sm" (click)="volver.emit()" aria-label="Volver al inicio">
            <app-icono nombre="izquierda" class="size-5" />
          </button>
          <div class="min-w-0 flex-1">
            <h2 class="truncate">{{ rutas().length ? 'Todas mis rutas' : 'Ruta asignada' }}</h2>
            <p class="truncate text-sm text-base-content/60">{{ subtitulo() }}</p>
          </div>
        </div>

        @if (!rutas().length) {
          <div class="cd-card items-center py-10 text-center">
            <span class="grid size-12 place-items-center rounded-full bg-base-200 text-base-content/50"><app-icono nombre="mapa" class="size-6" /></span>
            <div>
              <p class="font-display text-base font-semibold">Sin rutas asignadas</p>
              <p class="text-sm text-base-content/60">Cuando la empresa confirme tus rutas aparecerán aquí.</p>
            </div>
          </div>
        } @else {
          <ng-container *ngTemplateOutlet="selector" />

          <div class="grid grid-cols-3 gap-2 sm:gap-3">
            @for (item of resumen(); track item.texto) {
              <div class="flex items-center gap-2 rounded-box border p-2.5 sm:gap-3 sm:p-3.5" [class]="item.caja">
                <span class="hidden size-10 shrink-0 place-items-center rounded-full min-[380px]:grid sm:size-11" [class]="item.burbuja">
                  <app-icono [nombre]="item.icono" class="size-6" />
                </span>
                <span class="min-w-0">
                  <strong class="block font-display text-2xl leading-none" [class]="item.color">{{ item.valor }}</strong>
                  <span class="block text-sm font-semibold" [class]="item.color">{{ item.texto }}</span>
                  <span class="block text-[11px] leading-tight text-base-content/55">de {{ totalDestinos() }} destinos</span>
                </span>
              </div>
            }
          </div>

          <div class="grid grid-cols-2 gap-1 rounded-xl bg-base-100 p-1 shadow-sm lg:mx-auto lg:w-96" role="tablist">
            <button type="button" role="tab" class="btn btn-sm h-10 gap-2 rounded-lg border-0 shadow-none" [class]="modo() === 'listado' ? 'bg-azul text-white' : 'bg-transparent text-base-content/70'" [attr.aria-selected]="modo() === 'listado'" (click)="modo.set('listado')">
              <app-icono nombre="lista" class="size-5" /> Listado
            </button>
            <button type="button" role="tab" class="btn btn-sm h-10 gap-2 rounded-lg border-0 shadow-none" [class]="modo() === 'mapa' ? 'bg-azul text-white' : 'bg-transparent text-base-content/70'" [attr.aria-selected]="modo() === 'mapa'" (click)="modo.set('mapa')">
              <app-icono nombre="mapa" class="size-5" /> Mapa
            </button>
          </div>

          @if (modo() === 'listado') {
            <div class="grid gap-3 md:grid-cols-2">
              @for (ruta of rutas(); track ruta.id) {
                <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: ruta }" />
              }
            </div>
          } @else {
            <div class="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
              <div class="relative z-0 h-[44vh] min-h-64 overflow-hidden rounded-box border border-base-300/70 shadow-sm lg:h-[min(72vh,640px)]">
                <app-mapa [marcas]="marcas()" [lineas]="lineas()" [encuadre]="encuadre()" (marcaClick)="elegirMarca($event)" />
                <button type="button" class="btn btn-circle btn-sm absolute top-3 right-3 z-[500] border-0 bg-base-100 shadow" (click)="centrado.update((n) => n + 1)" aria-label="Centrar mapa">
                  <app-icono nombre="ubicacion" class="size-5 text-base-content/70" />
                </button>
              </div>
              <div class="flex flex-col gap-3 lg:max-h-[min(72vh,640px)] lg:overflow-y-auto">
                <p class="text-sm text-base-content/60">Toca una ruta o un destino del mapa para ver su detalle.</p>
                @for (ruta of rutas(); track ruta.id) {
                  <ng-container *ngTemplateOutlet="tarjeta; context: { $implicit: ruta }" />
                }
              </div>
            </div>
          }
        }
      </div>
    }

    <ng-template #selector>
      @if (rutas().length > 1) {
        <div class="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible" role="tablist" aria-label="Mis rutas">
          <button
            type="button"
            role="tab"
            class="flex min-h-14 shrink-0 snap-start items-center gap-2 rounded-xl border bg-base-100 px-3 py-2 text-left shadow-sm transition active:scale-[0.98]"
            [class]="seleccion() === 'todas' ? 'border-azul ring-2 ring-azul/20' : 'border-base-300/70'"
            [attr.aria-selected]="seleccion() === 'todas'"
            (click)="elegir.emit('todas')"
          >
            <span class="flex -space-x-1">
              @for (ruta of rutas().slice(0, 3); track ruta.id) {
                <span class="size-3.5 rounded-full ring-2 ring-base-100" [style.background]="color(ruta)"></span>
              }
            </span>
            <span class="leading-tight">
              <strong class="block text-sm">Todas</strong>
              <span class="block text-xs text-base-content/60">{{ rutas().length }} rutas</span>
            </span>
          </button>
          @for (ruta of rutas(); track ruta.id) {
            @let activa = seleccion() === ruta.id;
            <button
              type="button"
              role="tab"
              class="flex min-h-14 max-w-72 shrink-0 snap-start items-center gap-2.5 rounded-xl border bg-base-100 px-3 py-2 text-left shadow-sm transition active:scale-[0.98]"
              [class.border-base-300/70]="!activa"
              [style.border-color]="activa ? color(ruta) : null"
              [style.box-shadow]="activa ? '0 0 0 2px ' + color(ruta) + '33' : null"
              [attr.aria-selected]="activa"
              (click)="elegir.emit(ruta.id)"
            >
              <span class="h-9 w-1.5 shrink-0 rounded-full" [style.background]="color(ruta)"></span>
              <span class="min-w-0 leading-tight">
                <strong class="block truncate text-sm">{{ fechaCorta(ruta.fecha).slice(0, 5) }} · {{ ruta.cliente_nombre }}</strong>
                <span class="flex items-center gap-1.5 text-xs text-base-content/60">
                  {{ ruta.paradas.length }} {{ ruta.paradas.length === 1 ? 'destino' : 'destinos' }}
                  <span class="badge badge-soft badge-xs font-semibold" [class]="chip(ruta).clase">{{ chip(ruta).texto }}</span>
                </span>
              </span>
            </button>
          }
        </div>
      }
    </ng-template>

    <ng-template #tarjeta let-ruta>
      @let conteo = resumenRuta(ruta);
      <button
        type="button"
        class="cd-card w-full gap-3 border-l-4 text-left transition hover:shadow-md active:scale-[0.99]"
        [style.border-left-color]="color(ruta)"
        (click)="elegir.emit(ruta.id)"
      >
        <span class="flex w-full items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-2">
            <span class="size-3 shrink-0 rounded-full" [style.background]="color(ruta)"></span>
            <span class="truncate text-sm font-semibold text-base-content/70">{{ fechaCorta(ruta.fecha) }}</span>
          </span>
          <span class="badge badge-soft gap-1 font-semibold" [class]="chip(ruta).clase">
            @if (chip(ruta).check) { <app-icono nombre="check" class="size-3.5" /> }
            {{ chip(ruta).texto }}
          </span>
        </span>
        <span class="flex items-center gap-2.5">
          <app-icono nombre="edificio" class="size-6 text-primary" />
          <strong class="min-w-0 truncate font-display text-lg leading-tight">{{ ruta.cliente_nombre }}</strong>
        </span>
        <span class="grid w-full grid-cols-3 gap-2 text-sm">
          <span class="cd-dato"><app-icono nombre="camion" class="size-5" /><span class="min-w-0"><span class="cd-dato-label">Placa</span><span class="block truncate">{{ ruta.vehiculo?.placa || '—' }}</span></span></span>
          <span class="cd-dato"><app-icono nombre="pin" class="size-5" /><span class="min-w-0"><span class="cd-dato-label">Destinos</span>{{ ruta.paradas.length }}</span></span>
          <span class="cd-dato"><app-icono nombre="reloj" class="size-5" /><span class="min-w-0"><span class="cd-dato-label">Horario</span><span class="block truncate">{{ horario(ruta) }}</span></span></span>
        </span>
        <span class="flex w-full items-center gap-2 border-t border-base-300/70 pt-3">
          @for (item of conteo; track item.texto) {
            <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="item.burbuja">
              <app-icono [nombre]="item.icono" class="size-3.5" /> {{ item.valor }} {{ item.texto }}
            </span>
          }
          <app-icono nombre="derecha" class="ml-auto size-5 text-base-content/40" />
        </span>
      </button>
    </ng-template>
  `,
})
export class RutasConductor {
  readonly rutas = input.required<Ruta[]>();
  readonly seleccion = input.required<SeleccionRuta>();
  readonly puedeIniciar = input(false);
  readonly elegir = output<SeleccionRuta>();
  readonly cambio = output<Ruta>();
  readonly volver = output<void>();

  protected readonly fechaCorta = fechaCorta;
  protected readonly chip = chipRuta;
  protected readonly resumenRuta = (ruta: Ruta) => resumenParadas(ruta.paradas);
  protected readonly modo = signal<Modo>('listado');
  protected readonly centrado = signal(0);

  protected readonly rutaElegida = computed(() => {
    const seleccion = this.seleccion();
    return seleccion === 'todas' ? null : (this.rutas().find((ruta) => ruta.id === seleccion) ?? null);
  });
  protected readonly colores = computed(() => {
    const ids = this.rutas().map((ruta) => ruta.id).sort((a, b) => a - b);
    return new Map(ids.map((id, i) => [id, PALETA[i % PALETA.length]]));
  });
  protected readonly deHoy = computed(() => this.rutas().filter((ruta) => ruta.fecha.slice(0, 10) === hoy()));
  protected readonly resumen = computed(() => resumenParadas(this.rutas().flatMap((ruta) => ruta.paradas)));
  protected readonly totalDestinos = computed(() => this.rutas().reduce((n, ruta) => n + ruta.paradas.length, 0));
  protected readonly subtitulo = computed(() => {
    const total = this.rutas().length;
    if (!total) return 'No tienes rutas confirmadas';
    const hoyN = this.deHoy().length;
    const base = `${total} ${total === 1 ? 'ruta asignada' : 'rutas asignadas'}`;
    return hoyN ? `${base} · ${hoyN} para hoy` : base;
  });
  protected readonly lineas = computed<LineaMapa[]>(() =>
    this.rutas().flatMap((ruta) => {
      const coords = lineaGeo(ruta.geometria_empresa);
      return coords ? [{ coords, color: this.color(ruta) }] : [];
    }),
  );
  protected readonly marcas = computed(() => {
    const todas: MarcaMapa[] = [];
    const vistas = new Map<string, MarcaMapa>();
    for (const ruta of this.rutas()) {
      const paradas = [...ruta.paradas].sort((a, b) => a.orden - b.orden).map((parada, i) => ({ ...parada, orden: i + 1 }));
      const latitud = ruta.ultima_latitud;
      const longitud = ruta.ultima_longitud;
      for (const marca of marcasRuta({
        paradas,
        origen: ruta.base_origen,
        final: ruta.base_final,
        camion: ruta.estado === 'EN_PROCESO' && latitud && longitud ? { latitud, longitud } : null,
        camionId: ruta.id,
        color: this.color(ruta),
      })) {
        const previa = vistas.get(marca.id);
        if (previa) {
          if (previa.color !== marca.color) previa.color = undefined;
          continue;
        }
        vistas.set(marca.id, marca);
        todas.push(marca);
      }
    }
    return todas;
  });
  protected readonly encuadre = computed(() => `todas-${this.rutas().map((ruta) => ruta.id).join(',')}-${this.centrado()}`);

  color(ruta: Ruta): string {
    return this.colores().get(ruta.id) ?? PALETA[0];
  }

  posicionHoy(ruta: Ruta): { indice: number; total: number } | null {
    const lista = this.deHoy();
    const indice = lista.findIndex((item) => item.id === ruta.id);
    return indice < 0 ? null : { indice: indice + 1, total: lista.length };
  }

  horario(ruta: Ruta): string {
    return horarioParadas(ruta.paradas);
  }

  elegirMarca(id: string): void {
    const [tipo, valor] = [id.slice(0, id.indexOf('-')), Number(id.slice(id.indexOf('-') + 1))];
    const ruta =
      tipo === 'camion'
        ? this.rutas().find((item) => item.id === valor)
        : tipo === 'parada'
          ? this.rutas().find((item) => item.paradas.some((parada) => parada.destino_id === valor))
          : undefined;
    if (ruta) this.elegir.emit(ruta.id);
  }
}
