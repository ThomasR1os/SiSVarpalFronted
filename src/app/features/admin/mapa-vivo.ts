import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Geocerca, Seguimiento } from '../../core/models';
import { etiquetaEstado, fechaCorta, grados } from '../../core/texto';
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
          <button type="button" class="ruta-card" [class.activo]="seleccion()?.ruta_id === ruta.ruta_id" (click)="seleccion.set(ruta)">
            <span class="flex flex-wrap items-center gap-2"><strong>Ruta {{ ruta.ruta_id }}</strong><app-badge [estado]="ruta.estado" /></span>
            <span class="text-sm opacity-70">{{ fechaCorta(ruta.fecha) }} · {{ etiquetaEstado(ruta.estado) }}</span>
            <span class="text-sm opacity-70">{{ ruta.en_vivo ? 'Camión visible' : 'Sin posición en vivo' }}</span>
          </button>
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
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly rutas = signal<Seguimiento[]>([]);
  protected readonly seleccion = signal<Seguimiento | null>(null);
  protected readonly geocerca = signal<[number, number][] | null>(null);
  protected readonly error = signal('');
  protected readonly marcas = computed(() => this.armarMarcas());
  protected readonly geometria = computed(() => lineaGeo(this.seleccion()?.geometria));
  protected readonly recorrido = computed(() => (this.seleccion()?.en_vivo ? this.seleccion()?.recorrido ?? [] : []));
  protected readonly encuadre = computed(() => String(this.seleccion()?.ruta_id ?? 'todas'));

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
      });
  }

  elegirMarca(id: string): void {
    if (!id.startsWith('camion-')) return;
    const rutaId = Number(id.slice('camion-'.length));
    const ruta = this.rutas().find((item) => item.ruta_id === rutaId);
    if (ruta) this.seleccion.set(ruta);
  }

  private armarMarcas(): MarcaMapa[] {
    const marcas: MarcaMapa[] = [];
    for (const ruta of this.rutas()) {
      if (ruta.en_vivo && ruta.ultima_posicion) {
        marcas.push({
          id: `camion-${ruta.ruta_id}`,
          lat: grados(ruta.ultima_posicion.latitud),
          lng: grados(ruta.ultima_posicion.longitud),
          tipo: 'camion',
          texto: '',
          titulo: `Ruta ${ruta.ruta_id}`,
        });
      }
    }
    const seleccion = this.seleccion();
    if (seleccion) {
      marcas.push(
        ...marcasRuta({
          paradas: seleccion.paradas,
          origen: seleccion.base_origen,
          final: seleccion.base_final,
        }),
      );
    }
    return marcas;
  }
}
