import { afterRenderEffect, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, forkJoin, Observable, reduce } from 'rxjs';
import { Api, Consulta } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Cliente, Destino, EstadoDestino, Evidencia, Pagina, Ruta, TipoServicio } from '../../core/models';
import { TAMANO_CATALOGO, etiquetaTipo, fechaCorta, fechaHora, hoy, nombrePersona } from '../../core/texto';

type Ambito = 'todas' | 'local' | 'provincia';
type Corte = '' | 'EXITOSO' | 'FALLIDO' | 'PENDIENTE' | 'EN_PROCESO';

@Component({
  selector: 'app-evidencias-admin',
  host: { class: 'block min-w-0' },
  templateUrl: './evidencias.html',
})
export class EvidenciasAdmin {
  private readonly api = inject(Api);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cierreFoto = viewChild<ElementRef<HTMLButtonElement>>('cierreFoto');
  private ticket = 0;
  private pedidoFotos = 0;
  private visorPendiente = false;

  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaHora = fechaHora;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly nombrePersona = nombrePersona;
  protected readonly hoyIso = hoy();
  protected readonly ayerIso = diaAnterior(hoy());
  protected readonly fecha = signal(hoy());
  protected readonly clienteId = signal<number | null>(null);
  protected readonly ambito = signal<Ambito>('todas');
  protected readonly tipo = signal<'' | TipoServicio>('');
  protected readonly buscar = signal('');
  protected readonly corte = signal<Corte>('');
  protected readonly destinoId = signal<number | null>(null);
  protected readonly fotoAbierta = signal<number | null>(null);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly fotos = signal<Record<number, Evidencia[]>>({});
  protected readonly cargando = signal(true);
  protected readonly cargandoFotos = signal(false);
  protected readonly error = signal('');
  protected readonly errorFotos = signal('');

  private readonly porRuta = computed(() => new Map(this.rutas().map((ruta) => [ruta.id, ruta])));
  protected readonly nombreCliente = computed(() => {
    const cliente = this.clientes().find((item) => item.id === this.clienteId());
    return cliente?.nombre_comercial || cliente?.razon_social || 'Todos los clientes';
  });
  protected readonly etiquetaAmbito = computed(() => {
    if (this.ambito() === 'local') return 'Local';
    if (this.ambito() === 'provincia') return 'Provincia';
    return 'Todas';
  });
  protected readonly base = computed(() => {
    const ambito = this.ambito();
    const tipo = this.tipo();
    const buscar = this.buscar().trim().toLowerCase();
    const rutas = this.porRuta();
    return this.destinos().filter((destino) => {
      if (destino.estado === 'NO_INICIADO') return false;
      const ruta = destino.ruta_id == null ? undefined : rutas.get(destino.ruta_id);
      if (ambito === 'local' && !ruta?.dentro_de_lima) return false;
      if (ambito === 'provincia' && (ruta == null || ruta.dentro_de_lima)) return false;
      if (tipo && destino.tipo_servicio !== tipo) return false;
      if (!buscar) return true;
      const texto = [
        destino.codigo_externo,
        destino.nombre_receptor,
        destino.apellido_receptor,
        destino.documento_receptor,
        destino.direccion,
        destino.distrito,
        destino.telefono_receptor,
        ruta ? codigoDeRuta(ruta) : '',
      ].join(' ').toLowerCase();
      return texto.includes(buscar);
    });
  });
  protected readonly conteo = computed(() => {
    const base = this.base();
    const exitosos = base.filter((destino) => destino.estado === 'EXITOSO').length;
    const fallidos = base.filter((destino) => destino.estado === 'FALLIDO').length;
    const pendientes = base.filter((destino) => destino.estado === 'PENDIENTE').length;
    return {
      cierres: exitosos + fallidos + pendientes,
      exitosos,
      fallidos,
      pendientes,
      enRuta: base.filter((destino) => destino.estado === 'EN_PROCESO').length,
    };
  });
  protected readonly lista = computed(() => {
    const corte = this.corte();
    const peso: Record<string, number> = { PENDIENTE: 0, FALLIDO: 1, EXITOSO: 2, EN_PROCESO: 3 };
    return this.base()
      .filter((destino) => {
        if (corte) return destino.estado === corte;
        return destino.estado === 'EXITOSO' || destino.estado === 'FALLIDO' || destino.estado === 'PENDIENTE';
      })
      .sort((a, b) => {
        const orden = (peso[a.estado] ?? 9) - (peso[b.estado] ?? 9);
        if (orden) return orden;
        const distrito = a.distrito.localeCompare(b.distrito, 'es');
        if (distrito) return distrito;
        return nombreDestino(a).localeCompare(nombreDestino(b), 'es');
      });
  });
  protected readonly destinoActual = computed(() => this.destinos().find((destino) => destino.id === this.destinoId()) ?? null);
  protected readonly rutaActual = computed(() => {
    const destino = this.destinoActual();
    if (destino?.ruta_id == null) return null;
    return this.porRuta().get(destino.ruta_id) ?? null;
  });
  protected readonly evidencias = computed(() => {
    const id = this.destinoId();
    if (id == null) return [];
    return this.fotos()[id] ?? [];
  });
  protected readonly fotoActual = computed(() => {
    const indice = this.fotoAbierta();
    if (indice == null) return null;
    return this.evidencias()[indice] ?? null;
  });
  protected readonly indice = computed(() => this.lista().findIndex((destino) => destino.id === this.destinoId()));

  constructor() {
    effect(() => {
      const lista = this.lista();
      const actual = this.destinoId();
      if (actual != null && lista.some((destino) => destino.id === actual)) return;
      this.destinoId.set(lista[0]?.id ?? null);
    });
    effect(() => {
      const id = this.destinoId();
      untracked(() => {
        this.fotoAbierta.set(null);
        this.cargarFotos(id);
      });
    });
    afterRenderEffect(() => {
      const abierta = this.fotoAbierta();
      const boton = this.cierreFoto();
      if (abierta == null || !boton || !this.visorPendiente) return;
      this.visorPendiente = false;
      boton.nativeElement.focus();
    });
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).pipe(
      takeUntilDestroyed(),
    ).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
    this.cargar();
  }

  @HostListener('document:keydown', ['$event'])
  tecla(evento: KeyboardEvent): void {
    if (this.fotoAbierta() == null) return;
    if (evento.key === 'Escape') {
      this.cerrarFoto();
      return;
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.pasarFoto(1);
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.pasarFoto(-1);
    }
  }

  cambiarCliente(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    this.clienteId.set(Number.isFinite(valor) && valor > 0 ? valor : null);
    this.recargar();
  }

  cambiarFecha(evento: Event): void {
    this.fecha.set((evento.target as HTMLInputElement).value || this.hoyIso);
    this.recargar();
  }

  irHoy(): void {
    if (this.fecha() === this.hoyIso) return;
    this.fecha.set(this.hoyIso);
    this.recargar();
  }

  irAyer(): void {
    if (this.fecha() === this.ayerIso) return;
    this.fecha.set(this.ayerIso);
    this.recargar();
  }

  fijarAmbito(ambito: Ambito): void {
    this.ambito.set(ambito);
  }

  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === '' || valor === 'ENTREGA' || valor === 'INTERCAMBIO' || valor === 'RECOJO' || valor === 'TRASLADO') {
      this.tipo.set(valor);
    }
  }

  cambiarBuscar(evento: Event): void {
    this.buscar.set((evento.target as HTMLInputElement).value);
  }

  fijarCorte(corte: Corte): void {
    this.corte.set(corte);
  }

  elegir(id: number): void {
    this.destinoId.set(id);
  }

  mover(delta: number): void {
    const destino = this.lista()[this.indice() + delta];
    if (destino) this.destinoId.set(destino.id);
  }

  abrirFoto(indice: number): void {
    if (!this.evidencias()[indice]) return;
    this.visorPendiente = true;
    this.fotoAbierta.set(indice);
  }

  cerrarFoto(): void {
    this.fotoAbierta.set(null);
  }

  pasarFoto(delta: number): void {
    const total = this.evidencias().length;
    const actual = this.fotoAbierta();
    if (total < 2 || actual == null) return;
    this.fotoAbierta.set((actual + delta + total) % total);
  }

  reintentar(): void {
    this.recargar();
  }

  nombre(destino: Destino): string {
    return nombreDestino(destino);
  }

  rutaDe(destino: Destino): Ruta | null {
    if (destino.ruta_id == null) return null;
    return this.porRuta().get(destino.ruta_id) ?? null;
  }

  codigo(ruta: Ruta): string {
    return codigoDeRuta(ruta);
  }

  fotosDe(id: number): Evidencia[] | null {
    const mapa = this.fotos();
    return Object.hasOwn(mapa, id) ? mapa[id] : null;
  }

  textoEstado(estado: EstadoDestino): string {
    switch (estado) {
      case 'NO_INICIADO':
        return 'Pendiente';
      case 'EN_PROCESO':
        return 'En ruta';
      case 'PENDIENTE':
        return 'Por entregar';
      case 'EXITOSO':
        return 'Entregado';
      case 'FALLIDO':
        return 'Fallido';
    }
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'EN_PROCESO':
        return 'prog-pill prog-pill-proceso';
      case 'PENDIENTE':
        return 'prog-pill prog-pill-pendiente';
      case 'EXITOSO':
        return 'prog-pill prog-pill-ok';
      case 'FALLIDO':
        return 'prog-pill prog-pill-error';
      default:
        return 'prog-pill';
    }
  }

  nombreArchivo(url: string): string {
    const limpio = url.split('?')[0];
    return decodeURIComponent(limpio.split('/').pop() || 'evidencia');
  }

  textoVacio(destino: Destino): string {
    if (destino.estado === 'PENDIENTE') return 'El cierre quedó pendiente. Las fotos se pueden entregar después.';
    if (destino.estado === 'EN_PROCESO') return 'La parada sigue en ruta. Las fotos aparecen cuando se cierra.';
    return 'Esta parada no tiene fotos de cierre.';
  }

  private recargar(): void {
    this.fotos.set({});
    this.cargar();
  }

  private cargar(): void {
    const ticket = ++this.ticket;
    this.cargando.set(true);
    this.error.set('');
    this.destinos.set([]);
    this.rutas.set([]);
    const consulta: Consulta = {
      fecha: this.fecha(),
      cliente: this.clienteId() || undefined,
    };
    forkJoin({
      destinos: this.listar<Destino>('/api/destinos/', consulta),
      rutas: this.listar<Ruta>('/api/rutas/', consulta),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ destinos, rutas }) => {
        if (ticket !== this.ticket) return;
        this.destinos.set(destinos);
        this.rutas.set(rutas);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        if (ticket !== this.ticket) return;
        this.destinos.set([]);
        this.rutas.set([]);
        this.error.set(mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  private cargarFotos(id: number | null): void {
    const ticket = ++this.pedidoFotos;
    if (id == null) {
      this.cargandoFotos.set(false);
      this.errorFotos.set('');
      return;
    }
    if (Object.hasOwn(this.fotos(), id)) {
      this.cargandoFotos.set(false);
      this.errorFotos.set('');
      return;
    }
    this.cargandoFotos.set(true);
    this.errorFotos.set('');
    this.api.get<Evidencia[]>(`/api/destinos/${id}/evidencias/`).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (lista) => {
        if (ticket !== this.pedidoFotos) return;
        this.fotos.update((actual) => ({ ...actual, [id]: lista }));
        this.cargandoFotos.set(false);
      },
      error: (err: unknown) => {
        if (ticket !== this.pedidoFotos) return;
        this.errorFotos.set(mensajeError(err));
        this.cargandoFotos.set(false);
      },
    });
  }

  private listar<T>(url: string, consulta: Consulta): Observable<T[]> {
    const pedir = (page: number) => this.api.get<Pagina<T>>(url, { ...consulta, page, page_size: 100 });
    let paginaActual = 1;
    return pedir(1).pipe(
      expand((pagina) => {
        const siguiente = paginaSiguiente(pagina.next);
        if (pagina.results.length < 100 || siguiente == null || siguiente <= paginaActual) return EMPTY;
        paginaActual = siguiente;
        return pedir(siguiente);
      }),
      reduce((acumulado, pagina) => acumulado.concat(pagina.results), [] as T[]),
    );
  }
}

function nombreDestino(destino: Destino): string {
  return `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim() || destino.codigo_externo || 'Sin nombre';
}

function codigoDeRuta(ruta: Ruta): string {
  return `RUTA-${ruta.dentro_de_lima ? 'LIM' : 'PRO'}-${String(ruta.id).padStart(3, '0')}`;
}

function diaAnterior(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() - 1);
  const mesTexto = String(fecha.getMonth() + 1).padStart(2, '0');
  const diaTexto = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mesTexto}-${diaTexto}`;
}

function paginaSiguiente(next: string | null): number | null {
  if (!next) return null;
  const pagina = Number(new URL(next, 'http://local').searchParams.get('page'));
  return Number.isFinite(pagina) && pagina > 0 ? pagina : null;
}
