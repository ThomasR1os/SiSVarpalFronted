import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Destino, EstadoDestino, Evidencia, Ruta, TipoServicio } from '../../core/models';
import { etiquetaTipo, fechaCorta, fechaHora } from '../../core/texto';
import { Badge } from '../../shared/badge';
import { codigoRuta, listarDestinosCliente, listarRutasCliente } from './rutas-cliente';

type Corte = '' | 'EN_PROCESO' | 'EXITOSO' | 'NO_INICIADO';

@Component({
  selector: 'app-cliente-evidencias',
  imports: [Badge],
  host: { class: 'flex flex-col gap-4' },
  template: `
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (cargando()) { <p class="vacio-texto">Cargando las evidencias…</p> }

    <section class="relative min-h-56 overflow-hidden rounded-2xl bg-neutral text-neutral-content">
      <img class="absolute inset-0 h-full w-full object-cover object-[72%_center]" src="camion-varpal.jpg" alt="" />
      <div class="absolute inset-0 bg-gradient-to-r from-neutral via-neutral/88 to-neutral/25"></div>
      <div class="relative flex min-h-56 flex-col justify-center gap-4 px-5 py-6 sm:px-7">
        <div class="max-w-xl">
          <h2 class="text-3xl text-white sm:text-4xl">Evidencias</h2>
          <p class="mt-2 max-w-md text-sm text-neutral-content/75">Consulta las fotos de cierre de cada destinatario, por ruta y por estado.</p>
          <div class="mt-4 flex flex-wrap gap-2" role="group" aria-label="Zona">
            <button type="button" class="btn btn-sm" [class.bg-white]="zona() === 'lima'" [class.text-primary]="zona() === 'lima'" [class.bg-white/10]="zona() !== 'lima'" [class.text-white]="zona() !== 'lima'" [class.border-white/20]="zona() !== 'lima'" (click)="cambiarZona('lima')">Local</button>
            <button type="button" class="btn btn-sm" [class.bg-white]="zona() === 'provincia'" [class.text-primary]="zona() === 'provincia'" [class.bg-white/10]="zona() !== 'provincia'" [class.text-white]="zona() !== 'provincia'" [class.border-white/20]="zona() !== 'provincia'" (click)="cambiarZona('provincia')">Provincia</button>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="control">Desde
          <input type="date" [value]="desde()" [max]="hasta() || undefined" (change)="cambiarDesde($event)" />
        </label>
        <label class="control">Hasta
          <input type="date" [value]="hasta()" [min]="desde() || undefined" (change)="cambiarHasta($event)" />
        </label>
        <label class="control">Tipo de servicio
          <select [value]="tipo()" (change)="cambiarTipo($event)">
            <option value="">Todos</option>
            <option value="ENTREGA">Entrega</option>
            <option value="INTERCAMBIO">Intercambio</option>
            <option value="RECOJO">Recojo</option>
            <option value="TRASLADO">Traslado</option>
          </select>
        </label>
        <label class="control">Código
          <input type="search" placeholder="Código de pedido" [value]="codigo()" (input)="cambiarCodigo($event)" />
        </label>
        <label class="control">Buscar
          <input type="search" placeholder="Nombre, documento o dirección" [value]="buscar()" (input)="cambiarBuscar($event)" />
        </label>
      </div>
    </section>

    <section class="grid items-start gap-3 xl:grid-cols-3">
      <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        @if (zona() === 'lima') {
          <h2 class="text-base">Rutas</h2>
          <p class="ayuda mb-3">Elige una ruta para ver sus destinatarios.</p>
          <div class="flex max-h-[36rem] flex-col gap-2 overflow-auto">
            @for (bloque of rutasVista(); track bloque.ruta.id) {
              <button type="button" class="rounded-xl border p-3 text-left" [class.border-primary]="rutaId() === bloque.ruta.id" [class.bg-primary/5]="rutaId() === bloque.ruta.id" [class.border-base-300]="rutaId() !== bloque.ruta.id" (click)="elegirRuta(bloque.ruta.id)">
                <span class="flex items-center justify-between gap-2">
                  <strong>{{ codigoRuta(bloque.ruta) }}</strong>
                  <span class="text-sm">{{ bloque.exitosos }}/{{ bloque.total }}</span>
                </span>
                <span class="mt-1 block text-sm text-base-content/60">{{ fechaCorta(bloque.ruta.fecha) }}</span>
                <span class="mt-2 block h-2 overflow-hidden rounded-full bg-base-200">
                  <span class="block h-full rounded-full bg-success" [style.width.%]="ancho(bloque.exitosos, bloque.total)"></span>
                </span>
              </button>
            } @empty {
              <p class="vacio-texto">No hay rutas locales en este filtro.</p>
            }
          </div>
        } @else {
          <h2 class="text-base">Programaciones</h2>
          <p class="ayuda mb-3">Elige un distrito para ver los pedidos de esa tanda.</p>
          <div class="flex max-h-[36rem] flex-col gap-4 overflow-auto">
            @for (dia of grupos(); track dia.fecha) {
              <div>
                <p class="mb-2 text-sm font-semibold">{{ fechaCorta(dia.fecha) }} · {{ dia.total }} pedidos</p>
                <div class="flex flex-col gap-2">
                  @for (fila of dia.filas; track fila.clave) {
                    <button type="button" class="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left" [class.border-primary]="grupoId() === fila.clave" [class.bg-primary/5]="grupoId() === fila.clave" [class.border-base-300]="grupoId() !== fila.clave" (click)="elegirGrupo(fila.clave)">
                      <span>
                        <strong class="block">{{ fila.distrito }}</strong>
                        <span class="text-xs text-base-content/60">{{ fila.total }} pedidos</span>
                      </span>
                      <app-badge [estado]="fila.estado" />
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <p class="vacio-texto">No hay programaciones de provincia en este filtro.</p>
            }
          </div>
        }
      </article>

      <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 class="text-base">Destinatarios</h2>
        <p class="ayuda mb-3">{{ tituloLista() }}</p>
        <div class="mb-3 flex flex-wrap gap-2">
          @for (chip of chips(); track chip.id) {
            <button type="button" class="btn btn-xs" [class.btn-primary]="corte() === chip.id" [class.btn-ghost]="corte() !== chip.id" (click)="corte.set(chip.id)">
              {{ chip.nombre }} {{ chip.total }}
            </button>
          }
        </div>
        <div class="data-table max-h-[32rem] overflow-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Destinatario</th>
                <th>Dirección</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              @for (destino of lista(); track destino.id) {
                <tr class="cursor-pointer" [class.bg-primary/5]="destinoId() === destino.id" (click)="elegirDestino(destino.id)">
                  <td data-label="Destinatario">
                    <strong class="block">{{ nombre(destino) }}</strong>
                    <span class="text-xs text-base-content/60">{{ destino.codigo_externo }}</span>
                  </td>
                  <td data-label="Dirección">{{ destino.direccion }}, {{ destino.distrito }}</td>
                  <td data-label="Estado"><app-badge [estado]="destino.estado" /></td>
                </tr>
              } @empty {
                <tr class="fila-vacia"><td colspan="3">No hay destinatarios en este corte.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </article>

      <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div class="mb-3 flex items-start justify-between gap-2">
          <h2 class="text-base">Evidencias del destinatario</h2>
          @if (destinoActual(); as destino) { <app-badge [estado]="destino.estado" /> }
        </div>
        @if (destinoActual(); as destino) {
          <p class="font-semibold">{{ nombre(destino) }}</p>
          <p class="text-sm text-base-content/70">{{ destino.codigo_externo }} · {{ etiquetaTipo(destino.tipo_servicio) }}</p>
          <dl class="mt-3 grid gap-2 text-sm">
            <div><dt class="text-base-content/60">Documento</dt><dd>{{ destino.documento_receptor || '—' }}</dd></div>
            <div><dt class="text-base-content/60">Teléfono</dt><dd>{{ destino.telefono_receptor || '—' }}</dd></div>
            <div><dt class="text-base-content/60">Dirección</dt><dd>{{ destino.direccion }}, {{ destino.distrito }}</dd></div>
            <div><dt class="text-base-content/60">Referencia</dt><dd>{{ destino.referencia || '—' }}</dd></div>
          </dl>
          @if (errorFotos()) { <div class="alert alert-error mt-3">{{ errorFotos() }}</div> }
          @if (cargandoFotos()) {
            <p class="ayuda mt-3">Cargando fotos…</p>
          } @else if (evidencias().length) {
            <div class="fotos mt-4">
              @for (foto of evidencias(); track foto.id) {
                <a [href]="foto.archivo" target="_blank" rel="noopener" [title]="fechaHora(foto.creado_en)">
                  <img [src]="foto.archivo" [alt]="'Evidencia del ' + fechaHora(foto.creado_en)" />
                </a>
              }
            </div>
            <ul class="mt-3 flex flex-col gap-1 text-xs text-base-content/70">
              @for (foto of evidencias(); track foto.id) {
                <li>{{ nombreArchivo(foto.archivo) }} · {{ fechaHora(foto.creado_en) }}</li>
              }
            </ul>
          } @else {
            <p class="vacio-texto mt-4">Esta parada todavía no tiene fotos de cierre.</p>
          }
          @if (destino.observacion_cierre) {
            <div class="mt-4 rounded-xl bg-base-200/70 p-3 text-sm">
              <p class="font-semibold">Observación de entrega</p>
              <p>{{ destino.observacion_cierre }}</p>
            </div>
          }
        } @else {
          <p class="vacio-texto">Elige un destinatario para ver sus evidencias.</p>
        }
      </article>
    </section>
  `,
})
export class ClienteEvidencias {
  private readonly api = inject(Api);
  private pedidoFotos = 0;
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly codigoRuta = codigoRuta;
  protected readonly zona = signal<'lima' | 'provincia'>('lima');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly tipo = signal<'' | TipoServicio>('');
  protected readonly codigo = signal('');
  protected readonly buscar = signal('');
  protected readonly corte = signal<Corte>('');
  protected readonly rutaId = signal<number | null>(null);
  protected readonly grupoId = signal('');
  protected readonly destinoId = signal<number | null>(null);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly evidencias = signal<Evidencia[]>([]);
  protected readonly cargando = signal(true);
  protected readonly cargandoFotos = signal(false);
  protected readonly error = signal('');
  protected readonly errorFotos = signal('');

  private readonly porRuta = computed(() => new Map(this.rutas().map((ruta) => [ruta.id, ruta])));
  private readonly base = computed(() => {
    const zona = this.zona();
    const desde = this.desde();
    const hasta = this.hasta();
    const tipo = this.tipo();
    const codigo = this.codigo().trim().toLowerCase();
    const buscar = this.buscar().trim().toLowerCase();
    return this.destinos().filter((destino) => {
      const ruta = destino.ruta_id == null ? undefined : this.porRuta().get(destino.ruta_id);
      if (!ruta || (zona === 'lima') !== ruta.dentro_de_lima) return false;
      const fecha = destino.fecha.slice(0, 10);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (tipo && destino.tipo_servicio !== tipo) return false;
      if (codigo && !destino.codigo_externo.toLowerCase().includes(codigo)) return false;
      if (buscar) {
        const texto = `${destino.nombre_receptor} ${destino.apellido_receptor} ${destino.direccion} ${destino.documento_receptor}`.toLowerCase();
        if (!texto.includes(buscar)) return false;
      }
      return true;
    });
  });
  protected readonly rutasVista = computed(() => {
    const grupos = new Map<number, Destino[]>();
    for (const destino of this.base()) {
      if (destino.ruta_id == null) continue;
      const lista = grupos.get(destino.ruta_id) ?? [];
      lista.push(destino);
      grupos.set(destino.ruta_id, lista);
    }
    return [...grupos.entries()]
      .flatMap(([id, lista]) => {
        const ruta = this.porRuta().get(id);
        if (!ruta) return [];
        return [{
          ruta,
          total: lista.length,
          exitosos: lista.filter((destino) => destino.estado === 'EXITOSO').length,
        }];
      })
      .sort((a, b) => b.ruta.fecha.localeCompare(a.ruta.fecha) || a.ruta.id - b.ruta.id);
  });
  protected readonly grupos = computed(() => {
    const dias = new Map<string, Map<string, Destino[]>>();
    for (const destino of this.base()) {
      const fecha = destino.fecha.slice(0, 10);
      const distrito = destino.distrito.trim() || 'Sin distrito';
      const porDistrito = dias.get(fecha) ?? new Map<string, Destino[]>();
      const lista = porDistrito.get(distrito) ?? [];
      lista.push(destino);
      porDistrito.set(distrito, lista);
      dias.set(fecha, porDistrito);
    }
    return [...dias.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([fecha, distritos]) => ({
        fecha,
        total: [...distritos.values()].reduce((suma, lista) => suma + lista.length, 0),
        filas: [...distritos.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], 'es'))
          .map(([distrito, lista]) => ({
            clave: `${fecha}|${distrito}`,
            distrito,
            total: lista.length,
            estado: estadoGrupo(lista),
          })),
      }));
  });
  private readonly delContexto = computed(() => {
    if (this.zona() === 'lima') {
      const id = this.rutaId();
      return this.base().filter((destino) => destino.ruta_id === id);
    }
    const clave = this.grupoId();
    return this.base().filter((destino) => `${destino.fecha.slice(0, 10)}|${destino.distrito.trim() || 'Sin distrito'}` === clave);
  });
  protected readonly chips = computed(() => {
    const lista = this.delContexto();
    return [
      { id: '' as Corte, nombre: 'Todos', total: lista.length },
      { id: 'EN_PROCESO' as Corte, nombre: 'En ruta', total: lista.filter((destino) => destino.estado === 'EN_PROCESO').length },
      { id: 'EXITOSO' as Corte, nombre: 'Entregados', total: lista.filter((destino) => destino.estado === 'EXITOSO').length },
      { id: 'NO_INICIADO' as Corte, nombre: 'Pendientes', total: lista.filter((destino) => destino.estado === 'NO_INICIADO').length },
    ];
  });
  protected readonly lista = computed(() => {
    const corte = this.corte();
    return this.delContexto().filter((destino) => !corte || destino.estado === corte);
  });
  protected readonly destinoActual = computed(() => this.destinos().find((destino) => destino.id === this.destinoId()) ?? null);
  protected readonly tituloLista = computed(() => {
    if (this.zona() === 'lima') {
      const ruta = this.rutas().find((item) => item.id === this.rutaId());
      return ruta ? codigoRuta(ruta) : 'Selecciona una ruta';
    }
    const grupo = this.grupos().flatMap((dia) => dia.filas).find((fila) => fila.clave === this.grupoId());
    return grupo ? `${grupo.distrito}` : 'Selecciona un distrito';
  });

  constructor() {
    effect(() => {
      const rutas = this.rutasVista();
      const actual = this.rutaId();
      if (actual != null && rutas.some((bloque) => bloque.ruta.id === actual)) return;
      this.rutaId.set(rutas[0]?.ruta.id ?? null);
    });
    effect(() => {
      const grupos = this.grupos();
      const actual = this.grupoId();
      const claves = grupos.flatMap((dia) => dia.filas.map((fila) => fila.clave));
      if (actual && claves.includes(actual)) return;
      this.grupoId.set(claves[0] ?? '');
    });
    effect(() => {
      const lista = this.lista();
      const actual = this.destinoId();
      if (actual != null && lista.some((destino) => destino.id === actual)) return;
      this.destinoId.set(lista[0]?.id ?? null);
    });
    effect(() => {
      const id = this.destinoId();
      untracked(() => this.cargarFotos(id));
    });
    forkJoin({
      rutas: listarRutasCliente(this.api),
      destinos: listarDestinosCliente(this.api),
    }).subscribe({
      next: ({ rutas, destinos }) => {
        this.rutas.set(rutas);
        this.destinos.set(destinos);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  cambiarZona(zona: 'lima' | 'provincia'): void {
    this.zona.set(zona);
    this.corte.set('');
  }

  cambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  cambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'ENTREGA' || valor === 'INTERCAMBIO' || valor === 'RECOJO' || valor === 'TRASLADO') {
      this.tipo.set(valor);
    }
  }

  cambiarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value);
  }

  cambiarBuscar(evento: Event): void {
    this.buscar.set((evento.target as HTMLInputElement).value);
  }

  elegirRuta(id: number): void {
    this.rutaId.set(id);
    this.corte.set('');
  }

  elegirGrupo(clave: string): void {
    this.grupoId.set(clave);
    this.corte.set('');
  }

  elegirDestino(id: number): void {
    this.destinoId.set(id);
  }

  nombre(destino: Destino): string {
    return `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim() || '—';
  }

  ancho(parte: number, total: number): number {
    if (!total) return 0;
    return Math.round((parte / total) * 100);
  }

  nombreArchivo(url: string): string {
    const limpio = url.split('?')[0];
    return decodeURIComponent(limpio.split('/').pop() || 'evidencia');
  }

  private cargarFotos(id: number | null): void {
    const ticket = ++this.pedidoFotos;
    if (id == null) {
      this.evidencias.set([]);
      this.cargandoFotos.set(false);
      this.errorFotos.set('');
      return;
    }
    this.cargandoFotos.set(true);
    this.errorFotos.set('');
    this.api.get<Evidencia[]>(`/api/destinos/${id}/evidencias/`).subscribe({
      next: (lista) => {
        if (ticket !== this.pedidoFotos) return;
        this.evidencias.set(lista);
        this.cargandoFotos.set(false);
      },
      error: (err: unknown) => {
        if (ticket !== this.pedidoFotos) return;
        this.evidencias.set([]);
        this.errorFotos.set(mensajeError(err));
        this.cargandoFotos.set(false);
      },
    });
  }
}

function estadoGrupo(lista: Destino[]): EstadoDestino {
  if (lista.some((destino) => destino.estado === 'EN_PROCESO')) return 'EN_PROCESO';
  if (lista.length > 0 && lista.every((destino) => destino.estado === 'EXITOSO')) return 'EXITOSO';
  if (lista.some((destino) => destino.estado === 'FALLIDO')) return 'FALLIDO';
  return 'NO_INICIADO';
}
