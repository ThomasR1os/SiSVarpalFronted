import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Pagina, Ruta } from '../../core/models';
import { coordenadaGps, etiquetaRol, fechaCorta, nombrePersona, pesoRuta } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { RutaDetalle } from '../ruta/ruta-detalle';

@Component({
  selector: 'app-conductor',
  imports: [Badge, RutaDetalle, RouterLink, RouterLinkActive],
  template: `
    <div class="drawer lg:drawer-open">
      <input id="nav-conductor" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex min-h-dvh min-w-0 flex-col bg-base-200">
        <header class="navbar sticky top-0 z-30 min-h-16 border-b border-base-300 bg-base-100/95 px-1 backdrop-blur sm:px-2">
          <div class="flex-none lg:hidden">
            <label for="nav-conductor" class="btn btn-ghost btn-square" aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </label>
          </div>
          <div class="min-w-0 flex-1 px-1 sm:px-2">
            <p class="truncate font-display text-base leading-tight">Mis rutas</p>
            <p class="truncate text-sm text-base-content/60">Rutas confirmadas. Solo una puede estar en proceso.</p>
          </div>
        </header>
        <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
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
            <div class="lista-rutas">
              @for (ruta of rutas(); track ruta.id) {
                <button type="button" class="ruta-card" (click)="abrir(ruta.id)">
                  <span class="flex w-full flex-wrap items-center gap-2"><strong>{{ fechaCorta(ruta.fecha) }} · {{ ruta.cliente_nombre }}</strong><app-badge [estado]="ruta.estado" /></span>
                  <span class="text-sm opacity-70">{{ ruta.vehiculo?.placa || 'Sin vehículo' }} · {{ ruta.paradas.length }} paradas</span>
                </button>
              } @empty { <p class="vacio-texto">No tienes rutas confirmadas.</p> }
            </div>
          }
        </main>
      </div>
      <div class="drawer-side z-40">
        <label for="nav-conductor" aria-label="Cerrar menú" class="drawer-overlay"></label>
        <aside class="flex min-h-full w-72 max-w-[85vw] flex-col bg-neutral p-4 text-neutral-content">
          <img class="mb-2 h-auto w-48 max-w-full" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
          <p class="mb-4 text-xs font-semibold tracking-[0.14em] text-neutral-content/60 uppercase">Conductor</p>
          <ul class="menu shell-nav w-full gap-1 px-0">
            <li><a routerLink="/conductor" routerLinkActive="menu-active" (click)="cerrarMenu()">Mis rutas</a></li>
          </ul>
          <div class="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
            <strong class="truncate">{{ nombre }}</strong>
            <span class="text-sm text-neutral-content/70">{{ rol }}</span>
            <button type="button" class="btn btn-ghost mt-2 justify-start" (click)="salir()">Cerrar sesión</button>
          </div>
        </aside>
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
  protected readonly rol = etiquetaRol(this.auth.usuario()?.rol ?? '');
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

  cerrarMenu(): void {
    const menu = document.getElementById('nav-conductor');
    if (menu instanceof HTMLInputElement) menu.checked = false;
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
