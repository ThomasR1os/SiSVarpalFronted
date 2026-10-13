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
    <div class="drawer" [class.lg:drawer-open]="menuFijo()">
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
        <aside class="erp-side relative flex min-h-full w-[16.25rem] max-w-[85vw] flex-col text-white">
          <div class="flex items-center gap-3 px-5 pt-5 pb-4">
            <svg class="h-9 w-11 shrink-0 text-sky-300" viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" d="M2 9h7M2 14h5M2 19h7" />
              <path stroke-linejoin="round" d="M14 7h16v12H14z" />
              <path stroke-linejoin="round" d="M30 11h6l6 5v3H30" />
              <circle cx="20" cy="22.5" r="2.3" fill="currentColor" stroke="none" />
              <circle cx="36" cy="22.5" r="2.3" fill="currentColor" stroke="none" />
            </svg>
            <div class="leading-none">
              <p class="font-display text-[1.35rem] font-bold tracking-wide text-white">VARPAL</p>
              <p class="mt-1 text-xs font-semibold tracking-[0.22em] text-sky-200">ERP</p>
            </div>
          </div>
          <ul class="menu erp-nav min-h-0 w-full flex-1 gap-0.5 overflow-y-auto py-1 pr-10 pb-3 pl-3">
            @for (item of menu; track item.ruta) {
              <li>
                <a [routerLink]="item.ruta" routerLinkActive="menu-active" (click)="cerrarMenu()">
                  @switch (item.icono) {
                    @case ('inicio') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" /></svg>
                    }
                    @case ('indicadores') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 19h16M7 16V10m5 6V6m5 10v-4" /></svg>
                    }
                    @case ('clientes') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 19v-1.1A3.4 3.4 0 0 0 13.2 14.6M12.2 19v-1.2A3.6 3.6 0 0 0 8.6 14.2 3.6 3.6 0 0 0 5 17.8V19" /><circle cx="8.8" cy="8.2" r="2.3" /><circle cx="15.6" cy="9" r="1.9" /></svg>
                    }
                    @case ('programacion') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 3.5v3M16 3.5v3M4.5 9h15" /><rect x="4.5" y="5" width="15" height="14.5" rx="2" /></svg>
                    }
                    @case ('seguimiento') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
                    }
                    @case ('evidencias') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" stroke-width="1.8" /><circle cx="9" cy="10" r="1.3" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m7 16 3.1-3.1a1 1 0 0 1 1.4 0L15.5 17" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m13.5 14.2 1.2-1.2a1 1 0 0 1 1.4 0L19 15.8" /></svg>
                    }
                    @case ('servicios') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 3.5h6.2L19 8.2V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M14 3.5V8h4.5M9 13h6M9 16.5h6" /></svg>
                    }
                    @case ('planilla') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-width="1.8" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 7.6v8.8M14.6 9.3c-.4-.8-1.3-1.2-2.3-1.2-1.4 0-2.3.7-2.3 1.7 0 2.2 4.7 1.1 4.7 3.4 0 1.1-1 1.8-2.5 1.8-1.2 0-2.1-.5-2.5-1.3" /></svg>
                    }
                    @case ('flota') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 8h11v7H3zM14 11h4l3 3v1h-7" /><circle cx="7" cy="17.5" r="1.4" /><circle cx="17" cy="17.5" r="1.4" /></svg>
                    }
                    @case ('usuarios') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 19v-1.1A3.4 3.4 0 0 0 13.2 14.6M12.2 19v-1.2A3.6 3.6 0 0 0 8.6 14.2 3.6 3.6 0 0 0 5 17.8V19" /><circle cx="8.8" cy="8.2" r="2.3" /><circle cx="15.6" cy="9" r="1.9" /></svg>
                    }
                    @case ('tickets') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 13a8 8 0 0 1 16 0" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 13v3.5A2.5 2.5 0 0 0 6.5 19H8v-6H6.5A2.5 2.5 0 0 0 4 15.5zM20 13v3.5A2.5 2.5 0 0 1 17.5 19H16v-6h1.5A2.5 2.5 0 0 1 20 15.5zM10 19.2a2.2 2.2 0 0 0 2 1.8h1" /></svg>
                    }
                    @case ('configuracion') {
                      <svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke-width="1.8" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3.5v2M12 18.5v2M4.8 6.2l1.5 1.5M17.7 16.3l1.5 1.5M3.5 12h2M18.5 12h2M4.8 17.8l1.5-1.5M17.7 7.7l1.5-1.5" /></svg>
                    }
                  }
                  {{ item.nombre }}
                </a>
              </li>
            }
          </ul>
          <div class="mt-auto flex flex-col gap-1 border-t border-white/10 px-4 py-4">
            <strong class="truncate">{{ nombre() }}</strong>
            <span class="text-sm text-white/70">{{ rol() }}</span>
            <button type="button" class="btn btn-ghost mt-2 justify-start text-white" (click)="salir()">Cerrar sesión</button>
          </div>
          <button type="button" class="erp-colapsar" aria-label="Cerrar menú" (click)="contraerMenu()">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
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
  protected readonly menuFijo = signal(true);
  protected readonly menu: { ruta: string; nombre: string; icono: string }[] = [
    { ruta: '/admin/inicio', nombre: 'Inicio', icono: 'inicio' },
    { ruta: '/admin/indicadores', nombre: 'Indicadores VARPAL', icono: 'indicadores' },
    { ruta: '/admin/clientes', nombre: 'Clientes', icono: 'clientes' },
    { ruta: '/admin/programacion', nombre: 'Programación', icono: 'programacion' },
    { ruta: '/admin/seguimiento', nombre: 'Seguimiento', icono: 'seguimiento' },
    { ruta: '/admin/evidencias', nombre: 'Evidencias', icono: 'evidencias' },
    { ruta: '/admin/servicios', nombre: 'Servicios internos', icono: 'servicios' },
    { ruta: '/admin/planilla', nombre: 'Planilla', icono: 'planilla' },
    { ruta: '/admin/flota', nombre: 'Flota', icono: 'flota' },
    { ruta: '/admin/usuarios', nombre: 'Usuarios', icono: 'usuarios' },
    { ruta: '/admin/tickets', nombre: 'Tickets', icono: 'tickets' },
    { ruta: '/admin/configuracion', nombre: 'Configuración', icono: 'configuracion' },
  ];

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
    void this.router.navigate(['/admin/programacion'], { queryParams: { ruta: aviso.ruta_id } });
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

  contraerMenu(): void {
    this.menuFijo.set(false);
    this.cerrarMenu();
  }

  mostrarMenu(): void {
    this.menuFijo.set(true);
  }
}

function textoSeccion(url: string): { titulo: string; detalle: string } {
  if (url.includes('/admin/indicadores')) {
    return { titulo: 'Indicadores VARPAL', detalle: 'Resultados de la operación.' };
  }
  if (url.includes('/admin/clientes')) {
    return { titulo: 'Clientes', detalle: 'Empresas, RUC y dirección principal.' };
  }
  if (url.includes('/admin/programacion') || url.includes('/admin/operacion')) {
    return { titulo: 'Programación', detalle: 'Planifica y asigna rutas por cliente, operación y servicio.' };
  }
  if (url.includes('/admin/seguimiento') || url.includes('/admin/mapa')) {
    return { titulo: 'Seguimiento', detalle: 'Camiones y paradas de rutas ya iniciadas, dentro de Lima.' };
  }
  if (url.includes('/admin/evidencias')) {
    return { titulo: 'Evidencias', detalle: 'Fotos de cierre de cada parada.' };
  }
  if (url.includes('/admin/servicios')) {
    return { titulo: 'Servicios internos', detalle: 'Servicios de la operación interna.' };
  }
  if (url.includes('/admin/planilla')) {
    return { titulo: 'Planilla', detalle: 'Pagos y liquidación de la operación.' };
  }
  if (url.includes('/admin/flota')) {
    return { titulo: 'Flota', detalle: 'Unidades, placas y capacidad.' };
  }
  if (url.includes('/admin/usuarios')) {
    return { titulo: 'Usuarios', detalle: 'Accesos de administradores, conductores y auxiliares.' };
  }
  if (url.includes('/admin/tickets')) {
    return { titulo: 'Tickets', detalle: 'Solicitudes de soporte.' };
  }
  if (url.includes('/admin/configuracion')) {
    return { titulo: 'Configuración', detalle: 'Empresa, sedes, motivos y formatos de Excel.' };
  }
  return { titulo: 'Inicio', detalle: 'Panel principal del administrador.' };
}
