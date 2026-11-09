import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, interval, of, startWith, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Geocerca, Posicion, Ruta, Seguimiento } from '../../core/models';
import { grados, nombrePersona } from '../../core/texto';
import { pedirPorFecha } from '../../shared/mapa/fichas-parada';
import { Mapa } from '../../shared/mapa/mapa';
import { LineaMapa, MarcaMapa } from '../../shared/mapa/marcas';

@Component({
  selector: 'app-mapa-vivo',
  imports: [Mapa],
  template: `
    @if (error()) { <div class="alert alert-error mb-4">{{ error() }}</div> }
    <div class="mapa-caja completa">
      <app-mapa [marcas]="marcas()" [lineas]="recorridos()" [geocerca]="geocerca()" [encuadre]="encuadre()" />
    </div>
    @if (!error() && !cargando() && marcas().length === 0) {
      <p class="ayuda">No hay vehículos con posición en vivo.</p>
    }
  `,
})
export class MapaVivo {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rutas = signal<Seguimiento[]>([]);
  private readonly fichas = signal<ReadonlyMap<number, FichaUnidad>>(new Map());
  protected readonly geocerca = signal<[number, number][] | null>(null);
  protected readonly error = signal('');
  protected readonly cargando = signal(true);
  protected readonly marcas = computed(() => this.armarMarcas());
  protected readonly recorridos = computed(() => this.armarRecorridos());
  protected readonly encuadre = computed(() =>
    this.rutas()
      .filter((ruta) => ruta.en_vivo && ruta.ultima_posicion)
      .map((ruta) => ruta.ruta_id)
      .sort((a, b) => a - b)
      .join(',') || 'vacio',
  );
  private fichaTicket = 0;
  private claveFichas = '';

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
        this.cargando.set(false);
        this.cargarFichas(respuesta.results);
      });
  }

  private cargarFichas(rutas: Seguimiento[]): void {
    const fechas = [...new Set(rutas.map((ruta) => ruta.fecha.slice(0, 10)).filter(Boolean))].sort();
    const clave = `${fechas.join(',')}|${rutas.map((ruta) => ruta.ruta_id).sort((a, b) => a - b).join(',')}`;
    if (clave === this.claveFichas) return;
    this.claveFichas = clave;
    const ticket = ++this.fichaTicket;
    if (!fechas.length) {
      this.fichas.set(new Map());
      return;
    }
    pedirPorFecha<Ruta>(this.api, '/api/rutas/', fechas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((listas) => {
        if (ticket !== this.fichaTicket) return;
        if (listas.some((lista) => !lista.ok)) this.claveFichas = '';
        const mapa = new Map<number, FichaUnidad>();
        for (const lista of listas) {
          if (!lista.ok) continue;
          for (const ruta of lista.items) {
            mapa.set(ruta.id, {
              nombre: nombrePersona(ruta.conductor),
              placa: ruta.vehiculo?.placa?.trim() || 'Sin placa',
            });
          }
        }
        if (listas.some((lista) => lista.ok)) this.fichas.set(mapa);
      });
  }

  private armarMarcas(): MarcaMapa[] {
    const fichas = this.fichas();
    const marcas: MarcaMapa[] = [];
    for (const ruta of this.rutas()) {
      if (!ruta.en_vivo || !ruta.ultima_posicion) continue;
      const ficha = fichas.get(ruta.ruta_id);
      const nombre = ficha?.nombre && ficha.nombre !== '—' ? ficha.nombre : 'Conductor';
      const placa = ficha?.placa || 'Sin placa';
      const etiqueta = `${nombre} · ${placa}`;
      marcas.push({
        id: `camion-${ruta.ruta_id}`,
        lat: grados(ruta.ultima_posicion.latitud),
        lng: grados(ruta.ultima_posicion.longitud),
        tipo: 'camion',
        texto: etiqueta,
        titulo: etiqueta,
        detalle: etiqueta,
      });
    }
    return marcas;
  }

  private armarRecorridos(): LineaMapa[] {
    const lineas: LineaMapa[] = [];
    for (const ruta of this.rutas()) {
      if (!ruta.en_vivo) continue;
      const coords = coordsDe(ruta.recorrido);
      if (coords.length > 1) lineas.push({ coords, color: '#2c9ef6' });
    }
    return lineas;
  }
}

interface FichaUnidad {
  nombre: string;
  placa: string;
}

function coordsDe(recorrido: Posicion[]): [number, number][] {
  const coords: [number, number][] = [];
  for (const punto of recorrido) {
    const lat = grados(punto.latitud);
    const lng = grados(punto.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    coords.push([lng, lat]);
  }
  return coords;
}
