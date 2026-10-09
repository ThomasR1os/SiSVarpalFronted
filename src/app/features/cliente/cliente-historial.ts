import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { EstadoRuta, Ruta, Seguimiento } from '../../core/models';
import { TAMANO_PAGINA, distancia, duracion, fechaCorta, nombrePersona } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { Paginacion } from '../../shared/paginacion';
import { ZonaFiltro, etiquetaZona, listarRutasCliente } from './rutas-cliente';

@Component({
  selector: 'app-cliente-historial',
  imports: [Badge, Mapa, Paginacion],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="panel-head">
      <div>
        <h2>Historial de rutas</h2>
        <p>Puedes ver todas, solo Lima metropolitana o solo provincia.</p>
      </div>
    </div>

    <div class="barra-filtros">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Zona">
        @for (opcion of zonas; track opcion.id) {
          <button
            type="button"
            class="btn btn-sm"
            [class.btn-primary]="zona() === opcion.id"
            [class.btn-ghost]="zona() !== opcion.id"
            (click)="cambiarZona(opcion.id)"
          >{{ opcion.nombre }} ({{ conteo(opcion.id) }})</button>
        }
      </div>
      <label class="control">Estado
        <select [value]="estado()" (change)="cambiarEstado($event)">
          <option value="">Todos</option>
          <option value="NO_INICIADA">No iniciada</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="FINALIZADA">Finalizada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </label>
      <label class="control">Desde
        <input type="date" [value]="desde()" (change)="cambiarDesde($event)" />
      </label>
      <label class="control">Hasta
        <input type="date" [value]="hasta()" (change)="cambiarHasta($event)" />
      </label>
    </div>

    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (cargando()) { <p class="vacio-texto">Cargando el historial…</p> }

    <div class="layout-operacion">
      <section class="card card-body border border-base-300 bg-base-100 shadow-sm">
        <div class="lista-rutas max-h-[18rem] overflow-auto lg:max-h-[min(72vh,680px)]">
          @for (ruta of paginaActual(); track ruta.id) {
            <button type="button" class="ruta-card" [class.activo]="seleccionId() === ruta.id" (click)="elegir(ruta.id)">
              <span class="flex w-full flex-wrap items-center gap-2">
                <strong>{{ fechaCorta(ruta.fecha) }} · Ruta {{ ruta.id }}</strong>
                <app-badge [estado]="ruta.estado" />
                <span class="badge badge-ghost badge-sm">{{ etiquetaZona(ruta.dentro_de_lima) }}</span>
              </span>
              <span class="text-sm opacity-70">{{ ruta.paradas.length }} paradas · {{ distancia(ruta.distancia_metros) }} · {{ nombrePersona(ruta.conductor) }}</span>
            </button>
          } @empty {
            <p class="vacio-texto">No hay rutas en este filtro.</p>
          }
        </div>
        <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="filtradas().length" (paginaChange)="pagina.set($event)" />
      </section>

      <section class="card card-body gap-4 border border-base-300 bg-base-100 shadow-sm">
        @if (seguimiento(); as seguimiento) {
          <div class="panel-head">
            <div>
              <h2>Ruta {{ seguimiento.ruta_id }}</h2>
              <p>{{ fechaCorta(seguimiento.fecha) }} · {{ etiquetaZona(seguimiento.dentro_de_lima) }} · {{ duracion(rutaSeleccionada()?.duracion_segundos) }}</p>
            </div>
            <app-badge [estado]="seguimiento.estado" />
          </div>
          @if (!seguimiento.dentro_de_lima) {
            <div class="alert alert-warning">Esta ruta tiene puntos fuera de Lima metropolitana.</div>
          }
          <div class="mapa-caja">
            <app-mapa [marcas]="marcas()" [geometria]="geometria()" [recorrido]="recorrido()" [encuadre]="'historial-' + seguimiento.ruta_id" />
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
          <p class="vacio-texto">Elige una ruta para ver sus paradas.</p>
        }
      </section>
    </div>
  `,
})
export class ClienteHistorial {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly fechaCorta = fechaCorta;
  protected readonly distancia = distancia;
  protected readonly duracion = duracion;
  protected readonly nombrePersona = nombrePersona;
  protected readonly etiquetaZona = etiquetaZona;
  protected readonly zonas: { id: ZonaFiltro; nombre: string }[] = [
    { id: 'todas', nombre: 'Todas' },
    { id: 'lima', nombre: 'Lima metropolitana' },
    { id: 'provincia', nombre: 'Provincia' },
  ];
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly zona = signal<ZonaFiltro>('todas');
  protected readonly estado = signal('');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly pagina = signal(1);
  protected readonly seleccionId = signal<number | null>(null);
  protected readonly seguimiento = signal<Seguimiento | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  protected readonly porFecha = computed(() => {
    const estado = this.estado();
    const desde = this.desde();
    const hasta = this.hasta();
    return this.rutas().filter((ruta) => {
      if (estado && ruta.estado !== estado) return false;
      if (desde && ruta.fecha < desde) return false;
      if (hasta && ruta.fecha > hasta) return false;
      return true;
    });
  });
  protected readonly filtradas = computed(() => {
    const zona = this.zona();
    return this.porFecha().filter((ruta) => {
      if (zona === 'lima') return ruta.dentro_de_lima;
      if (zona === 'provincia') return !ruta.dentro_de_lima;
      return true;
    });
  });
  protected readonly paginaActual = computed(() => {
    const inicio = (this.pagina() - 1) * this.tamano;
    return this.filtradas().slice(inicio, inicio + this.tamano);
  });
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
    const params = this.route.snapshot.queryParamMap;
    const zona = params.get('zona');
    if (zona === 'todas' || zona === 'lima' || zona === 'provincia') this.zona.set(zona);
    this.estado.set(estadoValido(params.get('estado')));
    this.desde.set(params.get('desde') ?? '');
    this.hasta.set(params.get('hasta') ?? '');
    const pedida = Number(params.get('ruta'));
    listarRutasCliente(this.api).subscribe({
      next: (rutas) => {
        this.rutas.set(rutas);
        this.cargando.set(false);
        this.error.set('');
        const visible = pedida > 0 && this.filtradas().some((ruta) => ruta.id === pedida);
        const id = visible ? pedida : this.filtradas()[0]?.id ?? null;
        if (id) this.enfocar(id);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  conteo(zona: ZonaFiltro): number {
    if (zona === 'lima') return this.porFecha().filter((ruta) => ruta.dentro_de_lima).length;
    if (zona === 'provincia') return this.porFecha().filter((ruta) => !ruta.dentro_de_lima).length;
    return this.porFecha().length;
  }

  cambiarZona(zona: ZonaFiltro): void {
    this.zona.set(zona);
    this.publicar();
  }

  cambiarEstado(evento: Event): void {
    this.estado.set((evento.target as HTMLSelectElement).value);
    this.publicar();
  }

  cambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
    this.publicar();
  }

  cambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
    this.publicar();
  }

  elegir(id: number): void {
    this.seleccionId.set(id);
    this.api.get<Seguimiento>(`/api/rutas/${id}/seguimiento/`).subscribe({
      next: (seguimiento) => this.seguimiento.set(seguimiento),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private enfocar(id: number): void {
    const indice = this.filtradas().findIndex((ruta) => ruta.id === id);
    if (indice >= 0) this.pagina.set(Math.floor(indice / this.tamano) + 1);
    this.elegir(id);
  }

  private publicar(): void {
    this.pagina.set(1);
    const primera = this.filtradas()[0]?.id ?? null;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        zona: this.zona(),
        estado: this.estado() || null,
        desde: this.desde() || null,
        hasta: this.hasta() || null,
        ruta: null,
      },
      replaceUrl: true,
    });
    if (primera) this.enfocar(primera);
    else {
      this.seleccionId.set(null);
      this.seguimiento.set(null);
    }
  }
}

function estadoValido(valor: string | null): '' | EstadoRuta {
  if (valor === 'NO_INICIADA' || valor === 'EN_PROCESO' || valor === 'FINALIZADA' || valor === 'CANCELADA') {
    return valor;
  }
  return '';
}
