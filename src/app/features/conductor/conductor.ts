import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { Pagina, PersonaRuta, Ruta } from '../../core/models';
import {
  coordenadaGps,
  etiquetaRol,
  etiquetaTipo,
  fechaCorta,
  horarioParadas,
  hoy,
  nombrePersona,
  pesoRuta,
  textoAuxiliares,
} from '../../core/texto';
import { Icono, NombreIcono } from './icono';
import { chipRuta } from './ruta-conductor';
import { RutasConductor, SeleccionRuta } from './rutas-conductor';

type Vista = 'inicio' | 'servicio' | 'ruta' | 'perfil';

const MENU: { vista: Vista; texto: string; icono: NombreIcono }[] = [
  { vista: 'inicio', texto: 'Inicio', icono: 'inicio' },
  { vista: 'servicio', texto: 'Servicio', icono: 'servicio' },
  { vista: 'ruta', texto: 'Ruta', icono: 'mapa' },
  { vista: 'perfil', texto: 'Perfil', icono: 'perfil' },
];

const PASOS_SERVICIO = ['Inicio de operaciones', 'Inicio de ruta', 'Fin de ruta', 'Fin de operaciones'];

@Component({
  selector: 'app-conductor',
  imports: [RutasConductor, Icono],
  template: `
    <div class="flex min-h-dvh flex-col bg-base-200">
      <header class="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div class="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
          <button type="button" class="flex min-w-0 shrink-0 flex-col items-start" (click)="ir('inicio')" aria-label="Ir al inicio">
            <img class="h-8 w-auto sm:h-9" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
            <span class="pl-[22%] text-xs font-semibold text-secondary">App Conductor</span>
          </button>
          <nav class="mx-auto hidden items-center gap-1 lg:flex" aria-label="Secciones">
            @for (item of menu; track item.vista) {
              <button type="button" class="btn btn-ghost gap-2 rounded-xl" [class.cd-tab-activa]="vista() === item.vista" (click)="ir(item.vista)">
                <app-icono [nombre]="item.icono" class="size-5" />
                {{ item.texto }}
              </button>
            }
          </nav>
          <button type="button" class="ml-auto flex min-w-0 items-center gap-2.5 text-left lg:ml-0" (click)="ir('perfil')">
            <span class="grid size-11 shrink-0 place-items-center rounded-full bg-primary font-display text-base font-semibold text-primary-content ring-2 ring-base-100 shadow">{{ iniciales() }}</span>
            <span class="min-w-0">
              <strong class="block max-w-36 truncate font-display text-base leading-tight sm:max-w-52">{{ nombre() }}</strong>
              <span class="text-sm text-base-content/60">{{ rol() }}</span>
            </span>
          </button>
        </div>
      </header>

      <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 lg:pt-6 lg:pb-8">
        @if (gpsAviso()) { <div class="alert alert-info text-sm">{{ gpsAviso() }}</div> }
        @if (error()) { <div class="alert alert-error text-sm">{{ error() }}</div> }

        @switch (vista()) {
          @case ('inicio') {
            <section class="flex items-center gap-3 rounded-box border border-base-300/70 bg-base-100 px-4 py-3 shadow-sm">
              <span class="size-3.5 shrink-0 rounded-full ring-4" [class]="enLinea() ? 'bg-success ring-success/20' : 'bg-error ring-error/20'"></span>
              <div class="min-w-0 flex-1">
                <p class="font-semibold leading-tight" [class]="enLinea() ? 'text-success' : 'text-error'">{{ enLinea() ? 'Conectado' : 'Sin conexión' }}</p>
                <p class="truncate text-sm text-base-content/60">{{ estadoTexto() }}</p>
              </div>
              <div class="flex items-center gap-2 border-l border-base-300 pl-3 text-sm text-base-content/80">
                <app-icono nombre="calendario" class="size-5 text-secondary" />
                <span class="max-w-32 leading-tight sm:max-w-none">{{ fechaHoy }}</span>
              </div>
            </section>

            <div class="grid grid-cols-2 gap-3">
              <button type="button" class="cd-accion bg-linear-to-br from-primary to-secondary" (click)="ir('servicio')">
                <app-icono nombre="camion" class="pointer-events-none absolute -bottom-3 -left-3 size-28 text-white/10" />
                <span class="flex items-center gap-2.5">
                  <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15"><app-icono nombre="servicio" class="size-6" /></span>
                  <strong class="font-display text-lg leading-tight">Registrar servicio</strong>
                </span>
                <span class="relative text-xs leading-snug text-white/80 sm:text-sm">Inicio de operaciones, inicio de ruta, fin de ruta y fin de operaciones.</span>
                <span class="cd-accion-flecha text-primary"><app-icono nombre="derecha" class="size-4" /></span>
              </button>
              <button type="button" class="cd-accion bg-linear-to-br from-accent to-azul" (click)="verRutaAsignada()">
                <app-icono nombre="pin" class="pointer-events-none absolute -bottom-3 -left-2 size-24 text-white/15" />
                <span class="flex items-center gap-2.5">
                  <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20"><app-icono nombre="pin" class="size-6" /></span>
                  <strong class="font-display text-lg leading-tight">Ruta asignada</strong>
                </span>
                <span class="relative text-xs leading-snug text-white/85 sm:text-sm">Tus rutas asignadas: destinos, evidencias, iniciar y finalizar ruta.</span>
                <span class="cd-accion-flecha text-azul"><app-icono nombre="derecha" class="size-4" /></span>
              </button>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1">
              <h2 class="flex items-center gap-2 text-lg"><app-icono nombre="barras" class="size-5 text-primary" /> Tu estado de hoy</h2>
              <button type="button" class="btn btn-sm gap-1 rounded-full border-base-300 bg-base-100 font-semibold shadow-sm" (click)="ir('ruta')">
                Ver detalles <app-icono nombre="derecha" class="size-4" />
              </button>
            </div>

            <div class="grid gap-3 lg:grid-cols-2">
              <article class="cd-card">
                <div class="flex items-center justify-between gap-2">
                  <span class="cd-etiqueta bg-azul/10 text-azul">Servicio interno</span>
                  <span class="badge badge-soft badge-warning gap-1 font-semibold"><app-icono nombre="reloj" class="size-3.5" /> Pendiente</span>
                </div>
                <div class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-3">
                  <ol class="flex flex-col">
                    @for (paso of pasos; track paso; let primero = $first, ultimo = $last) {
                      <li class="relative flex gap-2.5 pb-3 last:pb-0">
                        @if (!ultimo) { <span class="absolute top-5 bottom-0 left-[7px] border-l-2 border-dotted border-base-300"></span> }
                        <span class="shrink-0 rounded-full" [class]="primero ? 'mt-0.5 size-4 border-[3px] border-azul bg-base-100 ring-3 ring-azul/15' : 'mt-1 ml-0.5 size-3 bg-base-300'"></span>
                        <span class="min-w-0">
                          <span class="block text-sm font-semibold leading-tight">{{ paso }}</span>
                          <span class="text-xs text-base-content/50">Por registrar</span>
                        </span>
                      </li>
                    }
                  </ol>
                  <div class="flex flex-col gap-3 border-l border-base-300 pl-3 text-sm">
                    <p class="cd-dato"><app-icono nombre="camion" class="size-5" /><span><span class="cd-dato-label">Placa</span>{{ rutaHoy()?.vehiculo?.placa || '—' }}</span></p>
                    <p class="cd-dato"><app-icono nombre="perfil" class="size-5" /><span><span class="cd-dato-label">Conductor</span>{{ conductorHoy() }}</span></p>
                    <p class="cd-dato"><app-icono nombre="grupo" class="size-5" /><span><span class="cd-dato-label">Auxiliares</span>{{ auxiliaresTexto(rutaHoy()?.auxiliares ?? []) }}</span></p>
                  </div>
                </div>
                <button type="button" class="cd-btn mt-auto" (click)="ir('servicio')">
                  <app-icono nombre="play" class="size-5" /> Registrar servicio
                </button>
              </article>

              @if (rutaHoy(); as ruta) {
                <article class="cd-card">
                  <div class="flex items-center justify-between gap-2">
                    <span class="cd-etiqueta bg-violet-500/10 text-violet-700">Ruta asignada</span>
                    <span class="badge badge-soft gap-1 font-semibold" [class]="chipRuta().clase">
                      @if (chipRuta().check) { <app-icono nombre="check" class="size-3.5" /> }
                      {{ chipRuta().texto }}
                    </span>
                  </div>
                  <div class="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-3">
                    <div class="flex min-w-0 flex-col gap-2.5 text-sm">
                      <p class="flex items-center gap-2.5"><app-icono nombre="edificio" class="size-6 text-base-content/70" /><strong class="truncate font-display text-base">{{ ruta.cliente_nombre }}</strong></p>
                      <p class="cd-dato"><app-icono nombre="pin" class="size-5" />{{ ruta.paradas.length }} {{ ruta.paradas.length === 1 ? 'destino' : 'destinos' }}</p>
                      <p class="cd-dato"><app-icono nombre="caja" class="size-5" />{{ resumenServicios(ruta) }}</p>
                      <p class="cd-dato"><app-icono nombre="mapa" class="size-5" />{{ distritos(ruta) }}</p>
                    </div>
                    <div class="flex flex-col gap-2.5 border-l border-base-300 pl-3 text-sm">
                      <p class="cd-dato"><app-icono nombre="calendario" class="size-5" />{{ fechaCorta(ruta.fecha) }}</p>
                      <p class="cd-dato"><app-icono nombre="reloj" class="size-5" />{{ horario(ruta) }}</p>
                      <p class="cd-dato"><app-icono nombre="camion" class="size-5" /><span><span class="cd-dato-label">Placa</span>{{ ruta.vehiculo?.placa || '—' }}</span></p>
                      <p class="cd-dato"><app-icono nombre="perfil" class="size-5" /><span><span class="cd-dato-label">Conductor</span>{{ nombrePersona(ruta.conductor) }}</span></p>
                    </div>
                  </div>
                  @if (pendientes().length > 1) {
                    <button type="button" class="flex items-center gap-2.5 rounded-xl bg-azul/8 px-3 py-2.5 text-left text-sm text-azul transition hover:bg-azul/12" (click)="verTodas()">
                      <app-icono nombre="grupo" class="size-5" />
                      <span class="min-w-0 flex-1 leading-tight">
                        <strong class="block">Tienes {{ pendientes().length }} rutas asignadas</strong>
                        @if (otrasHoy()) {
                          <span class="text-xs text-azul/80">+{{ otrasHoy() }} {{ otrasHoy() === 1 ? 'ruta más' : 'rutas más' }} hoy</span>
                        }
                      </span>
                      <span class="text-xs font-semibold">Ver todas</span>
                      <app-icono nombre="derecha" class="size-4" />
                    </button>
                  }
                  <button type="button" class="cd-btn mt-auto" (click)="verRutaAsignada()">
                    <app-icono nombre="mapa" class="size-5" /> Ver ruta asignada
                    <app-icono nombre="derecha" class="ml-auto size-5" />
                  </button>
                </article>
              } @else {
                <article class="cd-card items-center justify-center text-center">
                  <span class="grid size-12 place-items-center rounded-full bg-base-200 text-base-content/50"><app-icono nombre="mapa" class="size-6" /></span>
                  <div>
                    <p class="font-display text-base font-semibold">Sin ruta asignada</p>
                    <p class="text-sm text-base-content/60">Cuando la empresa confirme tus rutas aparecerán aquí.</p>
                  </div>
                </article>
              }
            </div>
          }

          @case ('servicio') {
            <article class="cd-card">
              <div class="flex items-center gap-3">
                <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-content"><app-icono nombre="servicio" class="size-6" /></span>
                <div class="min-w-0">
                  <h2>Registrar servicio</h2>
                  <p class="text-sm text-base-content/60">Disponible próximamente.</p>
                </div>
              </div>
              <p class="text-sm text-base-content/70">Aquí registrarás cada etapa de tu jornada:</p>
              <ol class="flex flex-col gap-2">
                @for (paso of pasos; track paso; let i = $index) {
                  <li class="flex items-center gap-3 rounded-xl border border-base-300 px-3 py-2.5">
                    <span class="grid size-7 shrink-0 place-items-center rounded-full bg-azul/10 text-sm font-bold text-azul">{{ i + 1 }}</span>
                    <span class="flex-1 font-semibold">{{ paso }}</span>
                    <span class="text-xs text-base-content/50">Por registrar</span>
                  </li>
                }
              </ol>
            </article>
          }

          @case ('ruta') {
            <app-rutas-conductor
              [rutas]="activas()"
              [seleccion]="seleccionActual()"
              [puedeIniciar]="puedeIniciar()"
              (elegir)="elegir($event)"
              (cambio)="actualizar($event)"
              (volver)="ir('inicio')"
            />
          }

          @case ('perfil') {
            <article class="cd-card mx-auto w-full max-w-xl">
              <div class="flex items-center gap-4">
                <span class="grid size-16 shrink-0 place-items-center rounded-full bg-primary font-display text-xl font-semibold text-primary-content">{{ iniciales() }}</span>
                <div class="min-w-0">
                  <h2 class="truncate">{{ nombre() }}</h2>
                  <p class="text-sm text-base-content/60">{{ rol() }}</p>
                </div>
              </div>
              <dl class="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt class="cd-dato-label">Correo</dt><dd class="break-all font-semibold">{{ usuario()?.email || '—' }}</dd></div>
                <div><dt class="cd-dato-label">Celular</dt><dd class="font-semibold">{{ usuario()?.telefono || '—' }}</dd></div>
                <div><dt class="cd-dato-label">Documento</dt><dd class="font-semibold">{{ usuario()?.documento || '—' }}</dd></div>
                <div><dt class="cd-dato-label">Vehículo de hoy</dt><dd class="font-semibold">{{ rutaHoy()?.vehiculo?.placa || '—' }}</dd></div>
              </dl>
              <button type="button" class="btn btn-outline btn-error mt-2 min-h-12 rounded-xl" (click)="salir()">
                <app-icono nombre="salir" class="size-5" /> Cerrar sesión
              </button>
            </article>
          }
        }
      </main>

      <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-base-300 bg-base-100/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,20,48,0.06)] backdrop-blur lg:hidden" aria-label="Secciones">
        <div class="mx-auto grid max-w-lg grid-cols-4">
          @for (item of menu; track item.vista) {
            <button type="button" class="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors" [class]="vista() === item.vista ? 'text-azul' : 'text-base-content/60'" (click)="ir(item.vista)" [attr.aria-current]="vista() === item.vista ? 'page' : null">
              <app-icono [nombre]="item.icono" class="size-6" />
              {{ item.texto }}
            </button>
          }
        </div>
      </nav>
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
  protected readonly menu = MENU;
  protected readonly pasos = PASOS_SERVICIO;
  protected readonly usuario = this.auth.usuario;
  protected readonly nombre = computed(() => nombrePersona(this.usuario()));
  protected readonly rol = computed(() => etiquetaRol(this.usuario()?.rol ?? ''));
  protected readonly iniciales = computed(() => {
    const persona = this.usuario();
    const letras = `${persona?.nombre.trim()[0] ?? ''}${persona?.apellido.trim()[0] ?? ''}`;
    return letras.toUpperCase() || '?';
  });
  protected readonly fechaHoy = fechaLarga(new Date());
  protected readonly fechaCorta = fechaCorta;
  protected readonly nombrePersona = nombrePersona;
  protected readonly vista = signal<Vista>('inicio');
  protected readonly enLinea = signal(navigator.onLine);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly seleccion = signal<SeleccionRuta | null>(null);
  protected readonly error = signal('');
  protected readonly gpsAviso = signal('');

  protected readonly activas = computed(() => {
    const dia = hoy();
    return this.rutas()
      .filter(
        (ruta) =>
          ruta.estado === 'EN_PROCESO' ||
          ruta.estado === 'NO_INICIADA' ||
          (ruta.estado === 'FINALIZADA' && (ruta.fecha.slice(0, 10) === dia || diaLocal(ruta.finalizada_en) === dia)),
      )
      .sort((a, b) => pesoRuta(a.estado) - pesoRuta(b.estado) || a.fecha.localeCompare(b.fecha) || a.id - b.id);
  });

  protected readonly pendientes = computed(() =>
    this.activas().filter((ruta) => ruta.estado === 'EN_PROCESO' || ruta.estado === 'NO_INICIADA'),
  );

  protected readonly rutaHoy = computed(() => {
    const rutas = this.activas();
    const dia = hoy();
    return (
      rutas.find((ruta) => ruta.estado === 'EN_PROCESO') ??
      rutas.find((ruta) => ruta.estado === 'NO_INICIADA' && ruta.fecha.slice(0, 10) === dia) ??
      rutas.find((ruta) => ruta.estado === 'NO_INICIADA' && ruta.fecha.slice(0, 10) > dia) ??
      rutas[0] ??
      null
    );
  });

  protected readonly otrasHoy = computed(() => {
    const principal = this.rutaHoy();
    return this.pendientes().filter((ruta) => ruta.id !== principal?.id && ruta.fecha.slice(0, 10) === hoy()).length;
  });

  protected readonly seleccionActual = computed<SeleccionRuta>(() => {
    const seleccion = this.seleccion();
    if (seleccion === 'todas' && this.activas().length > 1) return 'todas';
    if (typeof seleccion === 'number' && this.activas().some((ruta) => ruta.id === seleccion)) return seleccion;
    return this.rutaHoy()?.id ?? 'todas';
  });

  protected readonly chipRuta = computed(() => {
    const ruta = this.rutaHoy();
    return ruta ? chipRuta(ruta) : { texto: '', clase: '', check: false };
  });

  protected readonly conductorHoy = computed(() => {
    const conductor = this.rutaHoy()?.conductor;
    return conductor ? nombrePersona(conductor) : this.nombre();
  });

  protected readonly estadoTexto = computed(() => {
    if (!this.enLinea()) return 'Revisa tu señal de internet';
    if (this.rutaHoy()?.estado === 'EN_PROCESO') return 'Ruta en proceso';
    return 'Listo para operar';
  });

  protected readonly puedeIniciar = computed(
    () => !this.rutas().some((ruta) => ruta.estado === 'EN_PROCESO'),
  );

  constructor() {
    this.cargar();
    effect(() => {
      const activa = this.rutas().find((ruta) => ruta.estado === 'EN_PROCESO');
      this.sincronizarGps(activa?.id ?? null);
    });
    this.destroyRef.onDestroy(() => this.detenerGps());
    const reloj = window.setInterval(() => this.cargar(), 20000);
    this.destroyRef.onDestroy(() => window.clearInterval(reloj));
    const conexion = () => this.enLinea.set(navigator.onLine);
    window.addEventListener('online', conexion);
    window.addEventListener('offline', conexion);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', conexion);
      window.removeEventListener('offline', conexion);
    });
  }

  ir(vista: Vista): void {
    this.vista.set(vista);
    window.scrollTo({ top: 0 });
  }

  verRutaAsignada(): void {
    this.seleccion.set(this.rutaHoy()?.id ?? null);
    this.ir('ruta');
  }

  verTodas(): void {
    this.seleccion.set('todas');
    this.ir('ruta');
  }

  elegir(seleccion: SeleccionRuta): void {
    this.seleccion.set(seleccion);
    window.scrollTo({ top: 0 });
  }

  actualizar(ruta: Ruta): void {
    this.rutas.update((rutas) =>
      rutas.some((item) => item.id === ruta.id) ? rutas.map((item) => (item.id === ruta.id ? ruta : item)) : [...rutas, ruta],
    );
    this.seleccion.set(ruta.id);
    this.cargar();
  }

  salir(): void {
    this.auth.salir().subscribe(() => void this.router.navigateByUrl('/login'));
  }

  auxiliaresTexto(auxiliares: PersonaRuta[]): string {
    return textoAuxiliares(auxiliares);
  }

  resumenServicios(ruta: Ruta): string {
    const conteo = new Map<string, number>();
    for (const parada of ruta.paradas) conteo.set(parada.tipo_servicio, (conteo.get(parada.tipo_servicio) ?? 0) + 1);
    if (!conteo.size) return 'Sin servicios';
    return [...conteo]
      .map(([tipo, n]) => `${n} ${etiquetaTipo(tipo).toLowerCase()}${n === 1 ? '' : 's'}`)
      .join(', ');
  }

  distritos(ruta: Ruta): string {
    const lista = [...new Set(ruta.paradas.map((parada) => parada.distrito).filter(Boolean))];
    if (!lista.length) return 'Distrito: —';
    const etiqueta = lista.length === 1 ? 'Distrito' : 'Distritos';
    const visibles = lista.slice(0, 2).join(', ');
    return `${etiqueta}: ${visibles}${lista.length > 2 ? ` +${lista.length - 2}` : ''}`;
  }

  horario(ruta: Ruta): string {
    return horarioParadas(ruta.paradas);
  }

  private cargar(): void {
    const pedir = (estado: string, tamano: number) =>
      this.api.get<Pagina<Ruta>>('/api/rutas/', { estado, page_size: tamano });
    forkJoin([pedir('EN_PROCESO', 100), pedir('NO_INICIADA', 100), pedir('FINALIZADA', 20)]).subscribe({
      next: (paginas) => {
        const previas = new Map(this.rutas().map((ruta) => [ruta.id, ruta]));
        const vistas = new Set<number>();
        const rutas: Ruta[] = [];
        for (const ruta of paginas.flatMap((pagina) => pagina.results)) {
          if (vistas.has(ruta.id)) continue;
          vistas.add(ruta.id);
          const previa = previas.get(ruta.id);
          rutas.push(previa && firmaRuta(previa) === firmaRuta(ruta) ? previa : ruta);
        }
        this.rutas.set(rutas);
        this.error.set('');
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

function firmaRuta(ruta: Ruta): string {
  const paradas = ruta.paradas.map((p) => `${p.destino_id}:${p.orden}:${p.estado}:${p.hora_estimada}`).join('|');
  return `${ruta.estado}:${ruta.ultima_posicion_en}:${ruta.vehiculo?.placa}:${ruta.conductor?.id}:${paradas}`;
}

function diaLocal(valor: string | null): string {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function fechaLarga(fecha: Date): string {
  const texto = fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
