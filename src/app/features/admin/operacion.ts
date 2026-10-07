import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { CatalogoRuta, Catalogos } from '../../core/catalogos';
import { Cliente, Destino, ImportacionDestinos, Optimizacion, Pagina, Punto, Ruta, TipoServicio } from '../../core/models';
import {
  TAMANO_CATALOGO,
  TAMANO_PAGINA,
  distancia,
  duracion,
  etiquetaTipo,
  fechaCorta,
  hoy,
  idOpcional,
  nombrePersona,
  textoCoordenada,
} from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { Modal } from '../../shared/modal';
import { Paginacion } from '../../shared/paginacion';
import { RutaDetalle } from '../ruta/ruta-detalle';

@Component({
  selector: 'app-operacion',
  imports: [ReactiveFormsModule, Badge, Mapa, Modal, Paginacion, RutaDetalle],
  templateUrl: './operacion.html',
  host: { class: 'flex flex-col gap-4' },
})
export class Operacion {
  private readonly api = inject(Api);
  private readonly catalogos = inject(Catalogos);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  protected readonly tamano = TAMANO_PAGINA;
  protected readonly fechaMinima = hoy();
  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly nombrePersona = nombrePersona;
  protected readonly distancia = distancia;
  protected readonly duracion = duracion;

  protected readonly fecha = signal(hoy());
  protected readonly clienteId = signal<number | null>(null);
  protected readonly estadoDestino = signal('');
  protected readonly sinRuta = signal(false);
  protected readonly estadoRuta = signal('');
  protected readonly paginaDestinos = signal(1);
  protected readonly paginaRutas = signal(1);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly destinos = signal<Destino[]>([]);
  protected readonly totalDestinos = signal(0);
  protected readonly rutas = signal<Ruta[]>([]);
  protected readonly totalRutas = signal(0);
  protected readonly sedes = signal<Punto[]>([]);
  protected readonly seleccion = signal<number[]>([]);
  protected readonly orden = signal<number[]>([]);
  protected readonly destinosArmado = signal<Destino[]>([]);
  protected readonly baseOrigenId = signal('');
  protected readonly baseFinalId = signal('');
  protected readonly auxiliares = signal<number[]>([]);
  protected readonly armando = signal(false);
  protected readonly preview = signal<Optimizacion | null>(null);
  protected readonly catalogo = signal<CatalogoRuta | null>(null);
  protected readonly rutaAbierta = signal<Ruta | null>(null);
  protected readonly dialogo = signal<'' | 'destino' | 'importar' | 'reprogramar'>('');
  protected readonly editando = signal<Destino | null>(null);
  protected readonly tipo = signal<TipoServicio>('ENTREGA');
  protected readonly archivoNombre = signal('');
  protected readonly importacion = signal<ImportacionDestinos | null>(null);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  private archivo: File | null = null;

  protected readonly destinoForm = this.fb.nonNullable.group({
    codigo_externo: ['', Validators.required],
    fecha: [hoy(), Validators.required],
    tipo_servicio: ['ENTREGA' as TipoServicio, Validators.required],
    sede_id: [''],
    documento_receptor: [''],
    nombre_receptor: [''],
    apellido_receptor: [''],
    telefono_receptor: [''],
    direccion: [''],
    distrito: [''],
    referencia: [''],
    latitud: [''],
    longitud: [''],
    motivo_servicio: [''],
    observaciones: [''],
  });
  protected readonly rutaForm = this.fb.nonNullable.group({
    conductor_id: ['', Validators.required],
    vehiculo_id: ['', Validators.required],
    base_origen_id: [''],
    base_final_id: [''],
  });
  protected readonly reprogramarForm = this.fb.nonNullable.group({
    fecha: [hoy(), Validators.required],
  });

  protected readonly marcasPreview = computed(() => {
    const previa = this.preview();
    const paradas = previa
      ? previa.paradas.map((p) => ({ ...p, estado: 'NO_INICIADO' as const }))
      : this.orden().flatMap((id, indice) => {
          const destino = this.destinosArmado().find((item) => item.id === id);
          if (!destino) return [];
          return [{
            destino_id: destino.id,
            orden: indice + 1,
            latitud: destino.latitud,
            longitud: destino.longitud,
            direccion: destino.direccion,
            codigo_externo: destino.codigo_externo,
            estado: destino.estado,
          }];
        });
    return marcasRuta({
      paradas,
      origen: this.baseMarcada(this.catalogo()?.origenes ?? [], this.baseOrigenId()),
      final: this.baseMarcada(this.catalogo()?.finales ?? [], this.baseFinalId()),
    });
  });
  protected readonly geometriaPreview = computed(() => lineaGeo(this.preview()?.geometria_empresa));

  constructor() {
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = Number(params.get('ruta'));
      if (id > 0) this.abrirRuta(id);
    });
    this.cargar();
  }

  cargar(): void {
    this.cargarRutas();
    if (this.clienteId()) this.cargarDestinos();
    else {
      this.destinos.set([]);
      this.totalDestinos.set(0);
    }
  }

  cambiarFecha(event: Event): void {
    this.fecha.set((event.target as HTMLInputElement).value);
    this.paginaDestinos.set(1);
    this.paginaRutas.set(1);
    this.seleccion.set([]);
    this.cargar();
  }

  cambiarCliente(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.clienteId.set(id || null);
    this.paginaDestinos.set(1);
    this.seleccion.set([]);
    this.armando.set(false);
    if (id) this.cargarSedes(id);
    this.cargar();
  }

  cambiarEstadoDestino(event: Event): void {
    this.estadoDestino.set((event.target as HTMLSelectElement).value);
    this.paginaDestinos.set(1);
    this.cargarDestinos();
  }

  cambiarSinRuta(event: Event): void {
    this.sinRuta.set((event.target as HTMLInputElement).checked);
    this.paginaDestinos.set(1);
    this.cargarDestinos();
  }

  cambiarEstadoRuta(event: Event): void {
    this.estadoRuta.set((event.target as HTMLSelectElement).value);
    this.paginaRutas.set(1);
    this.cargarRutas();
  }

  irDestinos(pagina: number): void { this.paginaDestinos.set(pagina); this.cargarDestinos(); }
  irRutas(pagina: number): void { this.paginaRutas.set(pagina); this.cargarRutas(); }

  alternarSeleccion(id: number, event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    const actual = this.seleccion();
    this.seleccion.set(marcado ? [...actual, id] : actual.filter((item) => item !== id));
  }

  nuevoDestino(): void {
    if (!this.clienteId()) {
      this.error.set('Elige un cliente antes de cargar destinos.');
      return;
    }
    this.editando.set(null);
    this.tipo.set('ENTREGA');
    this.destinoForm.reset({
      codigo_externo: '', fecha: this.fecha(), tipo_servicio: 'ENTREGA', sede_id: '',
      documento_receptor: '', nombre_receptor: '', apellido_receptor: '', telefono_receptor: '',
      direccion: '', distrito: '', referencia: '', latitud: '', longitud: '', motivo_servicio: '', observaciones: '',
    });
    this.dialogo.set('destino');
  }

  editarDestino(destino: Destino): void {
    if (destino.estado !== 'NO_INICIADO') return;
    this.editando.set(destino);
    this.tipo.set(destino.tipo_servicio);
    this.destinoForm.patchValue({
      codigo_externo: destino.codigo_externo,
      fecha: destino.fecha,
      tipo_servicio: destino.tipo_servicio,
      sede_id: destino.sede_id ? String(destino.sede_id) : '',
      documento_receptor: destino.documento_receptor,
      nombre_receptor: destino.nombre_receptor,
      apellido_receptor: destino.apellido_receptor,
      telefono_receptor: destino.telefono_receptor,
      direccion: destino.direccion,
      distrito: destino.distrito,
      referencia: destino.referencia,
      latitud: destino.latitud ?? '',
      longitud: destino.longitud ?? '',
      motivo_servicio: destino.motivo_servicio,
      observaciones: destino.observaciones,
    });
    this.dialogo.set('destino');
  }

  guardarDestino(): void {
    const clienteId = this.clienteId();
    const raw = this.destinoForm.getRawValue();
    if (!clienteId) return;
    const traslado = raw.tipo_servicio === 'TRASLADO';
    const sede = this.sedes().find((item) => item.id === Number(raw.sede_id));
    if (traslado && !sede) {
      this.error.set('Un traslado necesita una sede del cliente.');
      return;
    }
    const latitud = traslado ? textoCoordenada(sede?.latitud ?? '') : textoCoordenada(raw.latitud);
    const longitud = traslado ? textoCoordenada(sede?.longitud ?? '') : textoCoordenada(raw.longitud);
    if (!traslado && (latitud == null || longitud == null || !raw.direccion || !raw.distrito)) {
      this.error.set('Entrega, intercambio y recojo exigen dirección, distrito y coordenadas en texto.');
      return;
    }
    if (latitud == null || longitud == null) {
      this.error.set('La sede del traslado no tiene coordenadas válidas.');
      return;
    }
    if (raw.fecha < this.fechaMinima) {
      this.error.set('La fecha no puede ser anterior a hoy.');
      return;
    }
    const cuerpo = {
      cliente_id: clienteId,
      fecha: raw.fecha,
      codigo_externo: raw.codigo_externo,
      tipo_servicio: raw.tipo_servicio,
      sede_id: traslado ? sede?.id ?? null : null,
      documento_receptor: raw.documento_receptor,
      nombre_receptor: raw.nombre_receptor,
      apellido_receptor: raw.apellido_receptor,
      telefono_receptor: raw.telefono_receptor,
      direccion: traslado ? sede?.direccion ?? '' : raw.direccion,
      distrito: traslado ? sede?.distrito ?? '' : raw.distrito,
      referencia: raw.referencia,
      latitud,
      longitud,
      motivo_servicio: raw.motivo_servicio,
      observaciones: raw.observaciones,
    };
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Destino>(`/api/destinos/${id}/`, cuerpo) : this.api.post<Destino>('/api/destinos/', cuerpo);
    req.subscribe({
      next: () => {
        this.enviando.set(false);
        this.dialogo.set('');
        this.error.set('');
        this.aviso.set(id ? 'Destino actualizado.' : 'Destino cargado.');
        this.cargarDestinos();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  eliminarDestino(destino: Destino): void {
    if (destino.estado !== 'NO_INICIADO' || destino.ruta_id) return;
    if (!confirm(`¿Eliminar el destino ${destino.codigo_externo}?`)) return;
    this.api.delete(`/api/destinos/${destino.id}/`).subscribe({
      next: () => this.cargarDestinos(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  abrirReprogramar(destino: Destino): void {
    if (destino.estado !== 'NO_INICIADO') return;
    this.editando.set(destino);
    this.reprogramarForm.patchValue({ fecha: destino.fecha });
    this.dialogo.set('reprogramar');
  }

  reprogramar(): void {
    const destino = this.editando();
    const fecha = this.reprogramarForm.getRawValue().fecha;
    if (!destino) return;
    if (fecha < this.fechaMinima) {
      this.error.set('La fecha no puede ser anterior a hoy.');
      return;
    }
    this.enviando.set(true);
    this.api.post<Destino>(`/api/destinos/${destino.id}/reprogramar/`, { fecha }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.dialogo.set('');
        this.aviso.set('Destino reprogramado. Si estaba en una ruta que no inició, salió de esa ruta.');
        this.cargar();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  abrirImportar(): void {
    if (!this.clienteId()) {
      this.error.set('Elige un cliente para importar su Excel.');
      return;
    }
    this.archivo = null;
    this.archivoNombre.set('');
    this.importacion.set(null);
    this.dialogo.set('importar');
  }

  elegirArchivo(event: Event): void {
    const archivo = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.archivo = archivo;
    this.archivoNombre.set(archivo?.name ?? '');
  }

  importar(): void {
    const clienteId = this.clienteId();
    if (!clienteId || !this.archivo) {
      this.error.set('Elige el archivo de Excel.');
      return;
    }
    const datos = new FormData();
    datos.append('cliente_id', String(clienteId));
    datos.append('archivo', this.archivo);
    this.enviando.set(true);
    this.api.subir<ImportacionDestinos>('/api/destinos/importar/', datos).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.importacion.set(resultado);
        this.aviso.set(`Se cargaron ${resultado.creados} destinos. ${resultado.rechazados.length} filas se rechazaron.`);
        this.cargarDestinos();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  descargarPlantilla(): void {
    this.api.descargar('/api/destinos/plantilla/').subscribe({
      next: (blob) => guardarBlob(blob, 'plantilla_destinos.xlsx'),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  abrirArmado(): void {
    const clienteId = this.clienteId();
    if (!clienteId || !this.seleccion().length) return;
    const elegidos = this.seleccion().flatMap((id) => {
      const destino = this.destinos().find((item) => item.id === id);
      return destino ? [destino] : [];
    });
    this.destinosArmado.set(elegidos);
    this.orden.set(elegidos.map((destino) => destino.id));
    this.preview.set(null);
    this.auxiliares.set([]);
    this.baseOrigenId.set('');
    this.baseFinalId.set('');
    this.error.set('');
    this.aviso.set('');
    this.rutaForm.reset({ conductor_id: '', vehiculo_id: '', base_origen_id: '', base_final_id: '' });
    this.armando.set(true);
    this.rutaAbierta.set(null);
    this.catalogos.paraRuta(clienteId).subscribe({
      next: (catalogo) => this.catalogo.set(catalogo),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  volverArmado(): void {
    this.armando.set(false);
    this.preview.set(null);
    this.error.set('');
    this.aviso.set('');
  }

  cambiarBase(cual: 'origen' | 'final', event: Event): void {
    const valor = (event.target as HTMLSelectElement).value;
    if (cual === 'origen') this.baseOrigenId.set(valor);
    else this.baseFinalId.set(valor);
    this.preview.set(null);
  }

  moverOrden(indice: number, delta: number): void {
    const lista = [...this.orden()];
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const [item] = lista.splice(indice, 1);
    if (item == null) return;
    lista.splice(destino, 0, item);
    this.orden.set(lista);
    this.preview.set(null);
  }

  sugerir(): void {
    const clienteId = this.clienteId();
    if (!clienteId) return;
    this.enviando.set(true);
    const raw = this.rutaForm.getRawValue();
    this.api.post<Optimizacion>('/api/rutas/optimizar/', {
      cliente_id: clienteId,
      fecha: this.fecha(),
      base_origen_id: idOpcional(raw.base_origen_id),
      base_final_id: idOpcional(raw.base_final_id),
      destino_ids: this.orden(),
    }).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.preview.set(resultado);
        this.orden.set(resultado.destino_ids);
        this.aviso.set('Este orden es una vista previa. La ruta no se publica hasta que la confirmes.');
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  guardarBorrador(): void {
    const clienteId = this.clienteId();
    const raw = this.rutaForm.getRawValue();
    const conductorId = idOpcional(raw.conductor_id);
    const vehiculoId = idOpcional(raw.vehiculo_id);
    if (!clienteId || !conductorId || !vehiculoId || !this.orden().length) {
      this.error.set('Elige conductor, vehículo y al menos un destino.');
      return;
    }
    this.enviando.set(true);
    this.api.post<Ruta>('/api/rutas/', {
      cliente_id: clienteId,
      fecha: this.fecha(),
      conductor_id: conductorId,
      vehiculo_id: vehiculoId,
      auxiliar_ids: this.auxiliares(),
      base_origen_id: idOpcional(raw.base_origen_id),
      base_final_id: idOpcional(raw.base_final_id),
      destino_ids: this.orden(),
      optimizar: false,
    }).subscribe({
      next: (ruta) => {
        this.enviando.set(false);
        this.armando.set(false);
        this.seleccion.set([]);
        this.aviso.set('Borrador guardado. Confírmalo para que lo vea el conductor.');
        this.rutaAbierta.set(ruta);
        this.cargar();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  alternarAuxiliar(id: number, event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    const actual = this.auxiliares();
    if (marcado) {
      if (actual.length >= 4) return;
      this.auxiliares.set([...actual, id]);
    } else this.auxiliares.set(actual.filter((item) => item !== id));
  }

  abrirRuta(id: number): void {
    this.api.get<Ruta>(`/api/rutas/${id}/`).subscribe({
      next: (ruta) => {
        this.error.set('');
        this.aviso.set('');
        this.rutaAbierta.set(ruta);
        this.armando.set(false);
        this.fecha.set(ruta.fecha);
        this.clienteId.set(ruta.cliente_id);
        this.cargarSedes(ruta.cliente_id);
        this.cargar();
      },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  actualizarRuta(ruta: Ruta): void {
    this.rutaAbierta.set(ruta);
    this.cargar();
  }

  etiquetaDestino(id: number): string {
    const destino = this.destinosArmado().find((item) => item.id === id) ?? this.destinos().find((item) => item.id === id);
    const previa = this.preview()?.paradas.find((item) => item.destino_id === id);
    if (destino) return `${destino.codigo_externo} · ${destino.direccion}`;
    if (previa) return `${previa.codigo_externo} · ${previa.direccion}`;
    return `Destino ${id}`;
  }

  cambiarTipo(event: Event): void {
    const tipo = (event.target as HTMLSelectElement).value as TipoServicio;
    this.tipo.set(tipo);
  }

  private cargarDestinos(): void {
    const clienteId = this.clienteId();
    if (!clienteId) return;
    this.api.get<Pagina<Destino>>('/api/destinos/', {
      cliente: clienteId,
      fecha: this.fecha(),
      estado: this.estadoDestino() || undefined,
      sin_ruta: this.sinRuta() ? true : undefined,
      page: this.paginaDestinos(),
      page_size: this.tamano,
    }).subscribe({
      next: (pagina) => { this.destinos.set(pagina.results); this.totalDestinos.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private cargarRutas(): void {
    this.api.get<Pagina<Ruta>>('/api/rutas/', {
      fecha: this.fecha(),
      cliente: this.clienteId() || undefined,
      estado: this.estadoRuta() || undefined,
      page: this.paginaRutas(),
      page_size: this.tamano,
    }).subscribe({
      next: (pagina) => { this.rutas.set(pagina.results); this.totalRutas.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private cargarSedes(clienteId: number): void {
    this.api.get<Pagina<Punto>>('/api/puntos/', { cliente: clienteId, es_sede: true, activo: true, page_size: 100 }).subscribe({
      next: (pagina) => this.sedes.set(pagina.results),
    });
  }

  private baseMarcada(puntos: Punto[], id: string): Punto | null {
    if (id) return puntos.find((item) => item.id === Number(id)) ?? null;
    return puntos.find((item) => item.es_principal) ?? null;
  }
}
