import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Pagina, Ruta } from '../../core/models';
import { coordenadaGps, fechaCorta, nombrePersona, pesoRuta } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { RutaDetalle } from '../ruta/ruta-detalle';

@Component({
  selector: 'app-conductor',
  imports: [Badge, RutaDetalle],
  template: `
    <div class="min-h-dvh bg-base-200">
    <header class="navbar sticky top-0 z-20 min-h-14 bg-neutral px-2 pt-[env(safe-area-inset-top)] text-neutral-content">
      <div class="min-w-0 flex-1 gap-3">
        <img class="h-8 w-auto shrink-0 sm:h-10" src="logo-varpal.png" alt="Varpal" />
        <span class="truncate text-sm text-neutral-content/70">Conductor · {{ nombre }}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm shrink-0" (click)="salir()">Salir</button>
    </header>
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
      @if (gpsAviso()) { <div class="alert alert-info">{{ gpsAviso() }}</div> }
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (abierta(); as ruta) {
        <section class="card card-body bg-base-100 border border-base-300 shadow-sm">
          <app-ruta-detalle
            [ruta]="ruta"
            modo="conductor"
            [puedeIniciar]="puedeIniciar()"
            (cambio)="actualizar($event)"
            (cerrada)="abierta.set(null)"
          />
        </section>
      } @else {
        <div>
          <h2>Mis rutas</h2>
          <p class="ayuda">Solo ves rutas confirmadas. Puedes tener varias el mismo día, pero solo una en proceso.</p>
        </div>
        <div class="lista-rutas">
          @for (ruta of rutas(); track ruta.id) {
            <button type="button" class="ruta-card" (click)="abrir(ruta.id)">
              <span class="flex w-full flex-wrap items-center gap-2"><strong>{{ fechaCorta(ruta.fecha) }} · {{ ruta.cliente_nombre }}</strong><app-badge [estado]="ruta.estado" /></span>
              <span class="text-sm opacity-70">{{ ruta.vehiculo?.placa || 'Sin vehículo' }} · {{ ruta.paradas.length }} paradas</span>
            </button>
          } @empty { <p class="vacio-texto">No tienes rutas confirmadas.</p> }
        </div>
      }
    </div>
    </div>
  `,
})
export class Conductor {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private gpsRutaId: number | null = null;
  private timer: number | null = null;
  private watchId: number | null = null;
  private ultima: GeolocationPosition | null = null;
  protected readonly nombre = nombrePersona(this.auth.usuario());
  protected readonly fechaCorta = fechaCorta;
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly abierta = signal<Ruta | null>(null);
  protected readonly error = signal('');
  protected readonly gpsAviso = signal('');

  constructor() {
    this.cargar();
    effect(() => {
      const activa = this.rutas().find((ruta) => ruta.estado === 'EN_PROCESO');
      this.sincronizarGps(activa?.id ?? null);
    });
    this.destroyRef.onDestroy(() => this.detenerGps());
    const reloj = window.setInterval(() => this.cargar(), 20000);
    this.destroyRef.onDestroy(() => window.clearInterval(reloj));
  }

  protected readonly puedeIniciar = computed(
    () => !this.rutas().some((ruta) => ruta.estado === 'EN_PROCESO'),
  );

  abrir(id: number): void {
    this.api.get<Ruta>(`/api/rutas/${id}/`).subscribe({
      next: (ruta) => this.abierta.set(ruta),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  actualizar(ruta: Ruta): void {
    this.abierta.set(ruta);
    this.cargar();
  }

  salir(): void {
    this.auth.salir().subscribe(() => void this.router.navigateByUrl('/login'));
  }

  private cargar(): void {
    this.api.get<Pagina<Ruta>>('/api/rutas/', { page_size: 100 }).subscribe({
      next: (pagina) => {
        const rutas = pagina.results
          .filter((ruta) => ruta.estado !== 'BORRADOR')
          .sort((a, b) => pesoRuta(a.estado) - pesoRuta(b.estado) || a.fecha.localeCompare(b.fecha));
        this.rutas.set(rutas);
        const abierta = this.abierta();
        if (abierta) {
          const nueva = rutas.find((ruta) => ruta.id === abierta.id);
          if (nueva && nueva.estado !== abierta.estado) this.abrir(nueva.id);
        }
      },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private sincronizarGps(id: number | null): void {
    if (id === this.gpsRutaId) return;
    this.detenerGps();
    if (id != null) this.comenzarGps(id);
  }

  private comenzarGps(rutaId: number): void {
    this.gpsRutaId = rutaId;
    if (!navigator.geolocation) {
      this.gpsAviso.set('Este navegador no comparte la ubicación.');
      return;
    }
    this.gpsAviso.set('Compartiendo la ubicación cada 12 segundos mientras la ruta está en proceso.');
    this.watchId = navigator.geolocation.watchPosition(
      (posicion) => {
        this.ultima = posicion;
      },
      () => this.gpsAviso.set('Activa el permiso de ubicación para que la empresa vea el camión.'),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    this.enviarPosicion(rutaId);
    this.timer = window.setInterval(() => this.enviarPosicion(rutaId), 12000);
  }

  private enviarPosicion(rutaId: number): void {
    const publicar = (posicion: GeolocationPosition) => {
      this.ultima = posicion;
      const cuerpo: Record<string, string | number> = {
        latitud: coordenadaGps(posicion.coords.latitude),
        longitud: coordenadaGps(posicion.coords.longitude),
      };
      if (Number.isFinite(posicion.coords.accuracy)) cuerpo['precision_metros'] = Math.round(posicion.coords.accuracy);
      if (posicion.coords.speed != null && posicion.coords.speed >= 0) {
        cuerpo['velocidad_kmh'] = Math.round(posicion.coords.speed * 3.6);
      }
      if (posicion.coords.heading != null && posicion.coords.heading >= 0 && posicion.coords.heading <= 360) {
        cuerpo['rumbo'] = Math.round(posicion.coords.heading);
      }
      this.api.post(`/api/rutas/${rutaId}/posiciones/`, cuerpo).subscribe({
        error: (err: unknown) => this.gpsAviso.set(mensajeError(err)),
      });
    };
    if (this.ultima) {
      publicar(this.ultima);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      publicar,
      () => this.gpsAviso.set('Activa el permiso de ubicación para que la empresa vea el camión.'),
      { enableHighAccuracy: true },
    );
  }

  private detenerGps(): void {
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.gpsRutaId = null;
    this.ultima = null;
  }
}
