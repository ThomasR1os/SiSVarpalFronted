import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { etiquetaRol, nombrePersona } from '../../core/texto';

@Component({
  selector: 'app-cliente-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="drawer" [class.lg:drawer-open]="menuFijo()">
      <input id="nav-cliente" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex min-h-dvh min-w-0 flex-col bg-base-200">
        <header class="navbar sticky top-0 z-30 min-h-16 border-b border-base-300 bg-base-100/95 px-1 backdrop-blur sm:px-2">
          <div class="flex-none lg:hidden">
            <label for="nav-cliente" class="btn btn-ghost btn-square" aria-label="Abrir menú">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </label>
          </div>
          @if (!menuFijo()) {
            <div class="hidden flex-none lg:block">
              <button type="button" class="btn btn-ghost btn-square" aria-label="Mostrar menú" (click)="mostrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          }
          <div class="min-w-0 flex-1 px-1 sm:px-2">
            <p class="truncate font-display text-base leading-tight">{{ seccion().titulo }}</p>
            <p class="truncate text-sm text-base-content/60">{{ seccion().detalle }}</p>
          </div>
        </header>
        <main class="flex flex-1 flex-col gap-4 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
      <div class="drawer-side z-40">
        <label for="nav-cliente" aria-label="Cerrar menú" class="drawer-overlay"></label>
        <aside class="flex min-h-full w-72 max-w-[85vw] flex-col bg-neutral p-4 text-neutral-content">
          <img class="mb-2 h-auto w-48 max-w-full" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
          <p class="mb-4 text-xs font-semibold tracking-[0.14em] text-neutral-content/60 uppercase">Cliente</p>
          <ul class="menu shell-nav w-full gap-1 px-0">
            <li>
              <a routerLink="/cliente/seguimiento" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.4-2.2A2 2 0 012 15.9V6.6a2 2 0 011.3-1.9L9 2m0 18l6-2.4M9 20V2m6 15.6l5.4 2.2A2 2 0 0022 17.9V6.1a2 2 0 00-1.3-1.9L15 2m0 15.6V2" /></svg>
                Seguimiento
              </a>
            </li>
            <li>
              <a routerLink="/cliente/dashboard" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 19V5m0 14h16M8 16v-5m4 5V8m4 8v-3" /></svg>
                Dashboard
              </a>
            </li>
            <li>
              <a routerLink="/cliente/reporte" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a2 2 0 011.4.6l4.4 4.4a2 2 0 01.6 1.4V19a2 2 0 01-2 2z" /></svg>
                Reporte
              </a>
            </li>
            <li>
              <a routerLink="/cliente/rutas" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                Rutas programadas
              </a>
            </li>
            <li>
              <a routerLink="/cliente/evidencias" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 7h3.2L9 4.5h6L16.8 7H20a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" /><circle cx="12" cy="13" r="3" /></svg>
                Evidencias
              </a>
            </li>
            <li>
              <a routerLink="/cliente/ayuda" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 18h.01M9.1 9a2.9 2.9 0 115.2 1.7c-.6.8-1.5 1.2-2 1.9-.3.4-.4.9-.4 1.4" /><circle cx="12" cy="12" r="9" /></svg>
                Ayuda
              </a>
            </li>
            <li>
              <a routerLink="/cliente/historial" routerLinkActive="menu-active" (click)="cerrarMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Historial
              </a>
            </li>
          </ul>
          <div class="mt-auto flex flex-col gap-1 border-t border-white/10 pt-4">
            <strong class="truncate">{{ nombre() }}</strong>
            <span class="text-sm text-neutral-content/70">{{ rol() }}</span>
            <button type="button" class="btn btn-ghost mt-2 justify-start" (click)="salir()">Cerrar sesión</button>
            <div class="mt-1 hidden lg:block">
              <button type="button" class="btn btn-ghost btn-square" aria-label="Cerrar menú" (click)="contraerMenu()">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class ClienteShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nombre = computed(() => nombrePersona(this.auth.usuario()));
  protected readonly rol = computed(() => etiquetaRol(this.auth.usuario()?.rol ?? ''));
  protected readonly seccion = signal(textoSeccion(''));
  protected readonly menuFijo = signal(true);

  constructor() {
    this.seccion.set(textoSeccion(this.router.url));
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => this.seccion.set(textoSeccion(evento.urlAfterRedirects)));
  }

  salir(): void {
    this.auth.salir().subscribe(() => void this.router.navigateByUrl('/login'));
  }

  cerrarMenu(): void {
    const menu = document.getElementById('nav-cliente');
    if (menu instanceof HTMLInputElement) menu.checked = false;
  }

  contraerMenu(): void {
    this.menuFijo.set(false);
    this.cerrarMenu();
  }

  mostrarMenu(): void {
    this.menuFijo.set(true);
  }
}

function textoSeccion(url: string): { titulo: string; detalle: string } {
  if (url.includes('/cliente/dashboard')) {
    return { titulo: 'Dashboard', detalle: 'Pedidos, avance y cobertura de tu operación.' };
  }
  if (url.includes('/cliente/reporte')) {
    return { titulo: 'Reporte', detalle: 'Detalle de pedidos, con estado y responsable.' };
  }
  if (url.includes('/cliente/rutas')) {
    return { titulo: 'Rutas programadas', detalle: 'Paradas, unidad y mapa de las rutas publicadas.' };
  }
  if (url.includes('/cliente/evidencias')) {
    return { titulo: 'Evidencias', detalle: 'Fotos de cierre de cada destinatario.' };
  }
  if (url.includes('/cliente/ayuda')) {
    return { titulo: 'Ayuda', detalle: 'Borrador para contactar al equipo de TI.' };
  }
  if (url.includes('/cliente/historial')) {
    return { titulo: 'Historial de rutas', detalle: 'Todas las rutas publicadas, por zona y por fecha.' };
  }
  return { titulo: 'Seguimiento', detalle: 'Rutas de tu RUC y el camión cuando la ruta está en proceso.' };
}
