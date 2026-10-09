import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Pagina, Ruta, Seguimiento } from '../../core/models';
import { distancia, duracion, fechaCorta, pesoRuta } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { etiquetaZona } from './rutas-cliente';

@Component({
  selector: 'app-cliente',
  imports: [Badge, Mapa],
  host: { class: 'flex flex-col gap-4' },
  template: `
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <div class="layout-operacion">
        <section class="card card-body bg-base-100 border border-base-300 shadow-sm">
          <h2>Rutas de tu RUC</h2>
          <p class="ayuda">No ves borradores ni el regreso a la base de Varpal.</p>
          <div class="lista-rutas max-h-[18rem] overflow-auto lg:max-h-[min(72vh,680px)]">
            @for (ruta of rutas(); track ruta.id) {
              <button type="button" class="ruta-card" [class.activo]="seleccionId() === ruta.id" (click)="elegir(ruta.id)">
                <span class="flex w-full flex-wrap items-center gap-2"><strong>{{ fechaCorta(ruta.fecha) }} · Ruta {{ ruta.id }}</strong><app-badge [estado]="ruta.estado" /></span>
                <span class="text-sm opacity-70">{{ etiquetaZona(ruta.dentro_de_lima) }} · {{ ruta.paradas.length }} paradas · {{ distancia(ruta.distancia_metros) }}</span>
              </button>
            } @empty { <p class="vacio-texto">No hay rutas publicadas.</p> }
          </div>
        </section>
        <section class="card card-body bg-base-100 border border-base-300 shadow-sm gap-4">
          @if (seguimiento(); as seguimiento) {
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2>Ruta {{ seguimiento.ruta_id }}</h2>
                <p class="ayuda">{{ fechaCorta(seguimiento.fecha) }} · {{ etiquetaZona(seguimiento.dentro_de_lima) }} · {{ duracion(rutaSeleccionada()?.duracion_segundos) }}</p>
              </div>
              <app-badge [estado]="seguimiento.estado" />
            </div>
            @if (!seguimiento.en_vivo) {
              <div class="alert alert-warning">El camión se muestra solo mientras la ruta está en proceso, dentro de Lima, y queda alguna parada sin cerrar.</div>
            }
            <div class="mapa-caja">
              <app-mapa [marcas]="marcas()" [geometria]="geometria()" [recorrido]="recorrido()" [encuadre]="'cliente-' + seguimiento.ruta_id + '-' + seguimiento.en_vivo" />
            </div>
            <div class="flex flex-col gap-2">
              @for (parada of seguimiento.paradas; track parada.destino_id) {
                <div class="parada">
                  <span class="flex flex-wrap items-center gap-2"><strong>{{ parada.orden }}. {{ parada.codigo_externo }}</strong><app-badge [estado]="parada.estado" /></span>
                  <span>{{ parada.direccion }}, {{ parada.distrito }}</span>
                  <span class="text-sm opacity-70">{{ parada.nombre_receptor }}</span>
                </div>
              }
            </div>
          } @else {
            <p class="vacio-texto">Elige una ruta para ver el orden de las paradas.</p>
          }
        </section>
      </div>
  `,
})
export class ClienteVista {
  private readonly api = inject(Api);
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaZona = etiquetaZona;
  protected readonly distancia = distancia;
  protected readonly duracion = duracion;
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly seleccionId = signal<number | null>(null);
  protected readonly seguimiento = signal<Seguimiento | null>(null);
  protected readonly error = signal('');
  protected readonly rutaSeleccionada = computed(() => this.rutas().find((ruta) => ruta.id === this.seleccionId()) ?? null);
  protected readonly geometria = computed(() => lineaGeo(this.seguimiento()?.geometria));
  protected readonly recorrido = computed(() => (this.seguimiento()?.en_vivo ? this.seguimiento()?.recorrido ?? [] : []));
  protected readonly marcas = computed(() => {
    const seguimiento = this.seguimiento();
    if (!seguimiento) return [];
    return marcasRuta({
      paradas: seguimiento.paradas,
      origen: seguimiento.base_origen,
      camion: seguimiento.en_vivo ? seguimiento.ultima_posicion : null,
      camionId: seguimiento.ruta_id,
    });
  });

  constructor() {
    interval(10000)
      .pipe(
        startWith(0),
        switchMap(() => this.refrescar()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  elegir(id: number): void {
    this.seleccionId.set(id);
    this.leerSeguimiento(id);
  }

  private refrescar() {
    return this.api.get<Pagina<Ruta>>('/api/rutas/', { page_size: 100 }).pipe(
      switchMap((pagina) => {
        const rutas = pagina.results
          .filter((ruta) => ruta.estado !== 'BORRADOR')
          .sort((a, b) => pesoRuta(a.estado) - pesoRuta(b.estado) || b.fecha.localeCompare(a.fecha));
        this.rutas.set(rutas);
        this.error.set('');
        const id = this.seleccionId() ?? rutas[0]?.id ?? null;
        if (id && this.seleccionId() == null) this.seleccionId.set(id);
        if (!id) {
          this.seguimiento.set(null);
          return of(null);
        }
        return this.api.get<Seguimiento>(`/api/rutas/${id}/seguimiento/`).pipe(
          switchMap((seguimiento) => {
            this.seguimiento.set(seguimiento);
            return of(seguimiento);
          }),
        );
      }),
      catchError((err: unknown) => {
        this.error.set(mensajeError(err));
        return of(null);
      }),
    );
  }

  private leerSeguimiento(id: number): void {
    this.api.get<Seguimiento>(`/api/rutas/${id}/seguimiento/`).subscribe({
      next: (seguimiento) => this.seguimiento.set(seguimiento),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
