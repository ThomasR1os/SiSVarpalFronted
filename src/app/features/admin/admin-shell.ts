import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, interval, of, startWith, switchMap } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Notificacion, Pagina } from '../../core/models';
import { etiquetaRol, fechaHora, nombrePersona } from '../../core/texto';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="drawer lg:drawer-open">
      <input id="nav-varpal" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex min-h-dvh min-w-0 flex-col bg-base-200">
        <header class="navbar sticky top-0 z-30 min-h-16 border-b border-base-300 bg-base-100/95 px-1 backdrop-blur sm:px-2">
          <div class="flex-none lg:hidden">
            <label for="nav-varpal" class="btn btn-ghost btn-square" aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </label>
          </div>
          <div class="min-w-0 flex-1 px-1 sm:px-2">
            <p class="truncate font-display text-base leading-tight">{{ seccion().titulo }}</p>
            <p class="truncate text-sm text-base-content/60">{{ seccion().detalle }}</p>
          </div>
          <div class="dropdown dropdown-end shrink-0">
            <button type="button" tabindex="0" class="btn btn-ghost gap-2 px-2 sm:px-3" aria-label="Avisos">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
              </svg>
              <span class="hidden sm:inline">Avisos</span>
              @if (sinLeer() > 0) { <span class="badge badge-accent badge-sm">{{ sinLeer() }}</span> }
            </button>
            <ul tabindex="0" class="dropdown-content menu z-50 mt-3 max-h-[min(24rem,70dvh)] w-[min(20rem,calc(100vw-1.25rem))] flex-nowrap overflow-auto rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl">
              @for (aviso of avisos(); track aviso.id) {
                <li>
                  <button type="button" class="flex flex-col items-start gap-1 whitespace-normal text-left" [class.opacity-60]="aviso.leida" (click)="abrirAviso(aviso)">
                    <strong>{{ aviso.titulo }}</strong>
                    <span class="text-sm font-normal">{{ aviso.cuerpo }}</span>
                    <span class="text-xs opacity-70">{{ fechaHora(aviso.creado_en) }}</span>
                  </button>
                </li>
              } @empty {
                <li><span class="opacity-70">No hay avisos.</span></li>
              }
              <li class="mt-1 border-t border-base-300 pt-1"><button type="button" (click)="leerTodas()">Marcar todas como leídas</button></li>
            </ul>
          </div>
        </header>
        <main class="flex flex-1 flex-col gap-4 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
      <div class="drawer-side z-40">
        <label for="nav-varpal" aria-label="Cerrar menú" class="drawer-overlay"></label>
        <aside class="flex min-h-full w-72 max-w-[85vw] flex-col bg-neutral p-4 text-neutral-content">
          <img class="mb-2 h-auto w-48 max-w-full" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
          <p class="mb-4 text-xs font-semibold tracking-[0.14em] text-neutral-content/60 uppercase">Administración</p>
          <ul class="menu shell-nav w-full gap-1 px-0">
            <li><a routerLink="/admin/operacion" routerLinkActive="menu-active" (click)="cerrarMenu()">Operación</a></li>
            <li><a routerLink="/admin/mapa" routerLinkActive="menu-active" (click)="cerrarMenu()">Mapa en vivo</a></li>
            <li><a routerLink="/admin/configuracion" routerLinkActive="menu-active" (click)="cerrarMenu()">Configuración</a></li>
          </ul>
          <div class="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
            <strong class="truncate">{{ nombre() }}</strong>
            <span class="text-sm text-neutral-content/70">{{ rol() }}</span>
            <button type="button" class="btn btn-ghost mt-2 justify-start" (click)="salir()">Cerrar sesión</button>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class AdminShell {
  private readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly avisos = signal<Notificacion[]>([]);
  protected readonly nombre = computed(() => nombrePersona(this.auth.usuario()));
  protected readonly rol = computed(() => etiquetaRol(this.auth.usuario()?.rol ?? ''));
  protected readonly sinLeer = computed(() => this.avisos().filter((a) => !a.leida).length);
  protected readonly fechaHora = fechaHora;
  protected readonly seccion = signal(textoSeccion(''));

  constructor() {
    this.seccion.set(textoSeccion(this.router.url));
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => this.seccion.set(textoSeccion(evento.urlAfterRedirects)));
    interval(25000)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.api.get<Pagina<Notificacion>>('/api/notificaciones/', { page_size: 20 }).pipe(
            catchError(() => of({ count: 0, next: null, previous: null, results: [] as Notificacion[] })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (pagina) => {
          const ordenados = [...pagina.results].sort((a, b) => b.creado_en.localeCompare(a.creado_en));
          this.avisos.set(ordenados);
        },
        error: (err: unknown) => console.error(mensajeError(err)),
      });
  }

  abrirAviso(aviso: Notificacion): void {
    if (!aviso.leida) {
      this.api.post<Notificacion>(`/api/notificaciones/${aviso.id}/leer/`, {}).subscribe({
        next: (actual) => {
          this.avisos.update((lista) => lista.map((item) => (item.id === actual.id ? actual : item)));
        },
      });
    }
    void this.router.navigate(['/admin/operacion'], { queryParams: { ruta: aviso.ruta_id } });
  }

  leerTodas(): void {
    this.api.post<{ actualizadas: number }>('/api/notificaciones/leer-todas/', {}).subscribe({
      next: () => this.avisos.update((lista) => lista.map((item) => ({ ...item, leida: true }))),
    });
  }

  salir(): void {
    this.auth.salir().subscribe(() => void this.router.navigateByUrl('/login'));
  }

  cerrarMenu(): void {
    const menu = document.getElementById('nav-varpal');
    if (menu instanceof HTMLInputElement) menu.checked = false;
  }
}

function textoSeccion(url: string): { titulo: string; detalle: string } {
  if (url.includes('/admin/mapa')) {
    return { titulo: 'Mapa en vivo', detalle: 'Camiones y paradas de rutas ya iniciadas, dentro de Lima.' };
  }
  if (url.includes('/admin/configuracion')) {
    return { titulo: 'Configuración', detalle: 'Empresa, clientes, sedes, usuarios y formatos de Excel.' };
  }
  return { titulo: 'Operación del día', detalle: 'Confirmas la ruta antes de que la vea el conductor.' };
}
