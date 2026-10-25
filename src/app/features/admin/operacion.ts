import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, expand, reduce } from 'rxjs';
import { Api, guardarBlob } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { CatalogoRuta, Catalogos } from '../../core/catalogos';
import { Cliente, Destino, ImportacionDestinos, Optimizacion, Pagina, Punto, Ruta, TipoServicio } from '../../core/models';
import {
  TAMANO_CATALOGO,
  etiquetaEstado,
  etiquetaTipo,
  fechaCorta,
  hoy,
  idOpcional,
  nombrePersona,
  textoCoordenada,
} from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Modal } from '../../shared/modal';
import { RutaDetalle } from '../ruta/ruta-detalle';

@Component({
  selector: 'app-operacion',
  imports: [ReactiveFormsModule, Badge, Modal, RutaDetalle],
  templateUrl: './operacion.html',
  host: { class: 'prog-host flex flex-col gap-4' },
})
export class Operacion {
  private readonly api = inject(Api);
  private readonly catalogos = inject(Catalogos);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  protected readonly fechaCorta = fechaCorta;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly nombrePersona = nombrePersona;
  protected readonly fecha = signal(hoy());
  protected readonly clienteId = signal<number | null>(null);
  protected readonly ambito = signal<'local' | 'provincia'>('local');
  protected readonly tipoServicio = signal('');
  protected readonly busqueda = signal('');
  protected readonly estadoDestino = signal('');
  protected readonly sinRuta = signal(false);
  protected readonly filtrosAbiertos = signal(false);
  protected readonly verErrores = signal(false);
  protected readonly verRutas = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly modoAsignacion = signal<'manual' | 'optimizacion'>('optimizacion');
  protected readonly horaSalida = signal('08:00');
  protected readonly conductorId = signal('');
  protected readonly vehiculoId = signal('');
  protected readonly auxiliar1Id = signal('');
  protected readonly auxiliar2Id = signal('');
  protected readonly archivoHora = signal('');
  protected readonly estadoRuta = signal('');
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
  protected readonly preview = signal<Optimizacion | null>(null);
  protected readonly catalogo = signal<CatalogoRuta | null>(null);
  protected readonly rutaAbierta = signal<Ruta | null>(null);
  protected readonly rutaAccion = signal<Ruta | null>(null);
  protected readonly dialogo = signal<'' | 'destino' | 'inhabilitar' | 'eliminar'>('');
  protected readonly editando = signal<Destino | null>(null);
  protected readonly tipo = signal<TipoServicio>('ENTREGA');
  protected readonly archivoNombre = signal('');
  protected readonly importacion = signal<ImportacionDestinos | null>(null);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  private archivo: File | null = null;
  private solicitud = 0;
  private rutasTicket = 0;
  private destinosTicket = 0;

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
    auxiliar_1: [''],
    auxiliar_2: [''],
    base_origen_id: [''],
    base_final_id: [''],
  });
  protected readonly clienteActual = computed(() => this.clientes().find((item) => item.id === this.clienteId()) ?? null);
  protected readonly nombreCliente = computed(() => this.clienteActual()?.nombre_comercial || this.clienteActual()?.razon_social || 'Sin cliente');
  protected readonly etiquetaAmbito = computed(() => (this.ambito() === 'local' ? 'Local' : 'Provincia'));
  protected readonly codigoRuta = computed(() => {
    const nombre = (this.clienteActual()?.nombre_comercial || this.clienteActual()?.razon_social || 'Ruta')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const sigla = (nombre.match(/[A-Za-z]/g) ?? ['R']).slice(0, 2).join('').toUpperCase();
    const marca = this.ambito() === 'local' ? 'L' : 'P';
    return `${sigla}-${marca}-${String(this.totalRutas() + 1).padStart(3, '0')}`;
  });
  protected readonly conductorActual = computed(() =>
    this.catalogo()?.conductores.find((persona) => persona.id === Number(this.conductorId())) ?? null,
  );
  protected readonly vehiculoActual = computed(() =>
    this.catalogo()?.vehiculos.find((vehiculo) => vehiculo.id === Number(this.vehiculoId())) ?? null,
  );
  protected readonly destinosVisibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const tipo = this.tipoServicio();
    return this.destinos().filter((destino) => {
      if (tipo && destino.tipo_servicio !== tipo) return false;
      if (!texto) return true;
      const blob = [
        destino.documento_receptor,
        destino.codigo_externo,
        destino.nombre_receptor,
        destino.apellido_receptor,
        destino.direccion,
        destino.distrito,
      ].join(' ').toLowerCase();
      return blob.includes(texto);
    });
  });
  protected readonly avisoEdicion = computed(() => {
    const destino = this.editando();
    const ruta = this.rutaAccion();
    if (!destino) return 'Revisa la fecha y la dirección antes de crear el destino.';
    if (destino.estado === 'EN_PROCESO' || ruta?.estado === 'EN_PROCESO') {
      return 'Este destino está en una ruta ya iniciada. Los cambios afectan al conductor que va en camino.';
    }
    if (destino.ruta_id) return 'Este destino ya está en una ruta. Al guardarlo, la ruta usará los datos nuevos.';
    return 'Vas a modificar este destino.';
  });
  protected readonly resumenCarga = computed(() => {
    const resultado = this.importacion();
    if (!resultado) return null;
    const texto = (fila: { errores: string[] }) => fila.errores.join(' ').toLowerCase();
    return {
      validos: resultado.creados,
      errores: resultado.rechazados.length,
      sinGeo: resultado.rechazados.filter((fila) => /latitud|longitud|coorden|geocod/.test(texto(fila))).length,
      duplicados: resultado.rechazados.filter((fila) => /duplic/.test(texto(fila))).length,
    };
  });

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
    const valor = (event.target as HTMLInputElement).value;
    if (!valor) return;
    this.fecha.set(valor);
    this.seleccion.set([]);
    this.cargar();
  }

  etiquetaFecha(): string {
    return fechaCorta(this.fecha());
  }

  cambiarCliente(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.clienteId.set(id || null);
    this.seleccion.set([]);
    this.orden.set([]);
    this.destinosArmado.set([]);
    this.preview.set(null);
    this.importacion.set(null);
    this.archivo = null;
    this.archivoNombre.set('');
    this.archivoHora.set('');
    this.reiniciarAsignacion();
    if (id) {
      this.cargarSedes(id);
      this.cargarCatalogo(id);
    } else this.catalogo.set(null);
    this.cargar();
  }

  fijarAmbito(valor: 'local' | 'provincia'): void {
    this.ambito.set(valor);
  }

  exigirCliente(event: Event): void {
    if (this.clienteId()) return;
    event.preventDefault();
    this.error.set('Elige un cliente para importar su Excel.');
  }

  cambiarAmbito(event: Event): void {
    this.fijarAmbito((event.target as HTMLSelectElement).value === 'provincia' ? 'provincia' : 'local');
  }

  cambiarOperacion(): void {
    this.fijarAmbito(this.ambito() === 'local' ? 'provincia' : 'local');
  }

  cambiarTipoServicio(event: Event): void {
    this.tipoServicio.set((event.target as HTMLSelectElement).value);
  }

  buscarDestinatarios(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  verTodos(): void {
    this.fecha.set(hoy());
    this.busqueda.set('');
    this.tipoServicio.set('');
    this.estadoDestino.set('');
    this.sinRuta.set(false);
    this.filtrosAbiertos.set(false);
    this.seleccion.set([]);
    this.cargar();
  }

  cambiarEstadoDestino(event: Event): void {
    this.estadoDestino.set((event.target as HTMLSelectElement).value);
    this.cargarDestinos();
  }

  cambiarSinRuta(event: Event): void {
    this.sinRuta.set((event.target as HTMLInputElement).checked);
    this.cargarDestinos();
  }

  cambiarEstadoRuta(event: Event): void {
    this.estadoRuta.set((event.target as HTMLSelectElement).value);
    this.cargarRutas();
  }

  alternarSeleccion(id: number, event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    const actual = this.seleccion();
    this.seleccion.set(marcado ? [...actual, id] : actual.filter((item) => item !== id));
  }

  paginaMarcada(): boolean {
    const elegibles = this.destinosVisibles().filter((destino) => this.destinoLibre(destino));
    return elegibles.length > 0 && elegibles.every((destino) => this.seleccion().includes(destino.id));
  }

  alternarPagina(event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    const ids = this.destinosVisibles().filter((destino) => this.destinoLibre(destino)).map((destino) => destino.id);
    if (marcado) this.seleccion.set([...new Set([...this.seleccion(), ...ids])]);
    else this.seleccion.set(this.seleccion().filter((id) => !ids.includes(id)));
  }

  nuevoDestino(): void {
    if (!this.clienteId()) {
      this.error.set('Elige un cliente antes de cargar destinos.');
      return;
    }
    this.editando.set(null);
    this.rutaAccion.set(null);
    this.tipo.set('ENTREGA');
    this.destinoForm.reset({
      codigo_externo: '', fecha: this.fecha(), tipo_servicio: 'ENTREGA', sede_id: '',
      documento_receptor: '', nombre_receptor: '', apellido_receptor: '', telefono_receptor: '',
      direccion: '', distrito: '', referencia: '', latitud: '', longitud: '', motivo_servicio: '', observaciones: '',
    });
    this.dialogo.set('destino');
  }

  editarDestino(destino: Destino): void {
    if (destino.estado === 'EXITOSO' || destino.estado === 'FALLIDO') {
      this.error.set('No se puede editar un destino exitoso o fallido.');
      return;
    }
    if (destino.estado !== 'NO_INICIADO' && destino.estado !== 'EN_PROCESO') {
      this.error.set('No se puede editar este destino.');
      return;
    }
    this.solicitud += 1;
    this.error.set('');
    this.rutaAccion.set(null);
    this.editando.set(destino);
    this.tipo.set(destino.tipo_servicio);
    this.destinoForm.patchValue({
      codigo_externo: destino.codigo_externo,
      fecha: destino.fecha.slice(0, 10),
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
    if (!destino.ruta_id) return;
    const ticket = ++this.solicitud;
    this.api.get<Ruta>(`/api/rutas/${destino.ruta_id}/`).subscribe({
      next: (ruta) => {
        if (ticket === this.solicitud && this.editando()?.id === destino.id) this.rutaAccion.set(ruta);
      },
      error: () => undefined,
    });
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
      next: (guardado) => {
        this.enviando.set(false);
        this.dialogo.set('');
        this.error.set('');
        const mensaje = id
          ? 'Destino actualizado. Si cambiaste las coordenadas, el mapa de la ruta ya usa el punto nuevo.'
          : 'Destino cargado.';
        const rutaId = guardado.ruta_id;
        if (rutaId && this.rutaAbierta()?.id === rutaId) {
          this.api.get<Ruta>(`/api/rutas/${rutaId}/`).subscribe({
            next: (ruta) => {
              this.rutaAbierta.set(ruta);
              this.aviso.set(mensaje);
              this.cargar();
            },
            error: (err: unknown) => {
              this.aviso.set(mensaje);
              this.error.set(mensajeError(err));
              this.cargar();
            },
          });
          return;
        }
        this.aviso.set(mensaje);
        this.cargar();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  abrirInhabilitar(destino: Destino): void {
    this.error.set('');
    if (destino.estado === 'EXITOSO' || destino.estado === 'FALLIDO') {
      this.error.set('No se puede inhabilitar la ruta de un destino exitoso o fallido.');
      return;
    }
    if (!destino.ruta_id) {
      this.error.set('Este destino todavía no está en una ruta.');
      return;
    }
    const ticket = ++this.solicitud;
    this.api.get<Ruta>(`/api/rutas/${destino.ruta_id}/`).subscribe({
      next: (ruta) => {
        if (ticket !== this.solicitud) return;
        if (ruta.estado === 'FINALIZADA' || ruta.estado === 'CANCELADA') {
          this.error.set(ruta.estado === 'FINALIZADA'
            ? 'No se puede inhabilitar una ruta finalizada.'
            : 'Esta ruta ya está inhabilitada.');
          return;
        }
        this.rutaAccion.set(ruta);
        this.editando.set(destino);
        this.dialogo.set('inhabilitar');
      },
      error: (err: unknown) => {
        if (ticket === this.solicitud) this.error.set(mensajeError(err));
      },
    });
  }

  confirmarInhabilitar(): void {
    const ruta = this.rutaAccion();
    if (!ruta || ruta.estado === 'FINALIZADA' || ruta.estado === 'CANCELADA') return;
    this.enviando.set(true);
    this.api.post(`/api/rutas/${ruta.id}/cancelar/`, {}).subscribe({
      next: () => {
        this.enviando.set(false);
        this.dialogo.set('');
        this.error.set('');
        this.aviso.set('Ruta inhabilitada. Los destinos quedan libres para otra ruta.');
        this.cargar();
        if (this.rutaAbierta()?.id === ruta.id) this.abrirRuta(ruta.id);
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  textoInhabilitar(): string {
    if (this.rutaAccion()?.estado === 'EN_PROCESO') {
      return 'Esta ruta ya está en camino. Al inhabilitarla, el conductor dejará de verla y los destinos quedan libres para otra ruta.';
    }
    return 'Al inhabilitar la ruta, los destinos quedan libres para otra ruta y el conductor ya no la verá.';
  }

  abrirEliminar(destino: Destino): void {
    this.error.set('');
    const ticket = ++this.solicitud;
    if (!destino.ruta_id) {
      if (destino.estado !== 'NO_INICIADO') {
        this.error.set('Solo se elimina un destino pendiente que no está en una ruta.');
        return;
      }
      this.rutaAccion.set(null);
      this.editando.set(destino);
      this.dialogo.set('eliminar');
      return;
    }
    this.api.get<Ruta>(`/api/rutas/${destino.ruta_id}/`).subscribe({
      next: (ruta) => {
        if (ticket !== this.solicitud) return;
        if (ruta.estado === 'FINALIZADA' || ruta.estado === 'CANCELADA') {
          this.error.set('No se puede quitar un destino de una ruta finalizada o inhabilitada.');
          return;
        }
        if (ruta.paradas.length < 2) {
          this.error.set('No se puede quitar la única parada. Inhabilita la ruta si ya no debe continuar.');
          return;
        }
        this.rutaAccion.set(ruta);
        this.editando.set(destino);
        this.dialogo.set('eliminar');
      },
      error: (err: unknown) => {
        if (ticket === this.solicitud) this.error.set(mensajeError(err));
      },
    });
  }

  confirmarEliminar(): void {
    const destino = this.editando();
    const ruta = this.rutaAccion();
    if (!destino) return;
    if (!ruta && destino.estado !== 'NO_INICIADO') return;
    this.enviando.set(true);
    if (ruta) {
      const destinoIds = ruta.paradas.filter((parada) => parada.destino_id !== destino.id).map((parada) => parada.destino_id);
      this.api.patch<Ruta>(`/api/rutas/${ruta.id}/`, { destino_ids: destinoIds }).subscribe({
        next: () => {
          this.enviando.set(false);
          this.dialogo.set('');
          this.error.set('');
          this.aviso.set('Parada retirada de la ruta. El destino queda libre.');
          this.cargar();
          if (this.rutaAbierta()?.id === ruta.id) this.abrirRuta(ruta.id);
        },
        error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
      });
      return;
    }
    this.api.delete(`/api/destinos/${destino.id}/`).subscribe({
      next: () => {
        this.enviando.set(false);
        this.dialogo.set('');
        this.error.set('');
        this.aviso.set('Destino eliminado.');
        this.seleccion.set(this.seleccion().filter((id) => id !== destino.id));
        this.cargarDestinos();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  textoEliminar(): string {
    const ruta = this.rutaAccion();
    const estado = this.editando()?.estado;
    if (ruta && (estado === 'EXITOSO' || estado === 'FALLIDO' || estado === 'PENDIENTE')) {
      return 'Esta parada ya tiene un cierre. Al quitarla sale de la ruta y el destino vuelve a quedar libre, sin ese resultado.';
    }
    if (ruta?.estado === 'EN_PROCESO') {
      return 'Quitar esta parada de una ruta ya iniciada la saca del recorrido en vivo. El conductor dejará de verla.';
    }
    if (ruta) return 'La parada saldrá de la ruta y el destino quedará libre. La ruta se conserva.';
    return 'Se eliminará este destino. No se puede deshacer.';
  }

  elegirArchivo(event: Event): void {
    this.marcarArchivo((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  alArrastrar(event: DragEvent, activo: boolean): void {
    event.preventDefault();
    this.arrastrando.set(activo);
  }

  soltarArchivo(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando.set(false);
    if (!this.clienteId()) {
      this.error.set('Elige un cliente para importar su Excel.');
      return;
    }
    this.marcarArchivo(event.dataTransfer?.files?.[0] ?? null);
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
        this.aviso.set(
          `Se cargaron ${resultado.creados} destinos. ${resultado.rechazados.length} filas se rechazaron. Si el archivo trae otra fecha, ajústala en Fecha para verlos.`,
        );
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

  asignarDestinos(): void {
    const clienteId = this.clienteId();
    if (!clienteId || !this.seleccion().length) return;
    const elegidos = this.seleccion().flatMap((id) => {
      const destino = this.destinos().find((item) => item.id === id) ?? this.destinosArmado().find((item) => item.id === id);
      return destino ? [destino] : [];
    });
    this.destinosArmado.set(elegidos);
    this.orden.set(elegidos.map((destino) => destino.id));
    this.preview.set(null);
    this.rutaAbierta.set(null);
    this.error.set('');
    this.aviso.set(`${elegidos.length} destinos quedaron listos en ${this.codigoRuta()}. Elige conductor y unidad para guardar o publicar.`);
    if (!this.catalogo()) this.cargarCatalogo(clienteId);
  }

  volverAlListado(): void {
    if (this.rutaAbierta()) {
      this.rutaAbierta.set(null);
      this.cargar();
      return;
    }
    this.preview.set(null);
    this.orden.set([]);
    this.destinosArmado.set([]);
    this.seleccion.set([]);
    this.error.set('');
    this.aviso.set('');
  }

  guardarBorrador(): void {
    const cuerpo = this.prepararCuerpo();
    if (!cuerpo) return;
    this.enviando.set(true);
    this.api.post<Ruta>('/api/rutas/', { ...cuerpo, optimizar: false }).subscribe({
      next: (ruta) => {
        this.enviando.set(false);
        this.limpiarTrasGuardar();
        this.aviso.set('Borrador guardado. Publícalo para que lo vea el conductor.');
        this.rutaAbierta.set(ruta);
        this.cargar();
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  publicarProgramacion(): void {
    const cuerpo = this.prepararCuerpo();
    if (!cuerpo) return;
    this.enviando.set(true);
    this.api.post<Ruta>('/api/rutas/', cuerpo).subscribe({
      next: (ruta) => {
        this.api.post(`/api/rutas/${ruta.id}/confirmar/`, {}).subscribe({
          next: () => {
            this.enviando.set(false);
            this.limpiarTrasGuardar();
            this.aviso.set('Programación publicada. El conductor ya puede ver la ruta.');
            this.abrirRuta(ruta.id);
          },
          error: (err: unknown) => {
            this.enviando.set(false);
            this.limpiarTrasGuardar();
            this.error.set(mensajeError(err));
            this.rutaAbierta.set(ruta);
            this.cargar();
          },
        });
      },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
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

  abrirRuta(id: number): void {
    this.api.get<Ruta>(`/api/rutas/${id}/`).subscribe({
      next: (ruta) => {
        this.error.set('');
        this.aviso.set('');
        this.rutaAbierta.set(ruta);
        this.incluirFecha(ruta.fecha);
        this.clienteId.set(ruta.cliente_id);
        this.cargarSedes(ruta.cliente_id);
        this.cargarCatalogo(ruta.cliente_id);
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

  elegirAsignacion(
    campo: 'conductor_id' | 'vehiculo_id' | 'auxiliar_1' | 'auxiliar_2' | 'base_origen_id' | 'base_final_id',
    event: Event,
  ): void {
    const valor = (event.target as HTMLSelectElement).value;
    this.rutaForm.controls[campo].setValue(valor);
    this.sincronizarAsignacion();
  }

  sincronizarAsignacion(): void {
    const raw = this.rutaForm.getRawValue();
    this.conductorId.set(raw.conductor_id);
    this.vehiculoId.set(raw.vehiculo_id);
    this.auxiliar1Id.set(raw.auxiliar_1);
    this.auxiliar2Id.set(raw.auxiliar_2);
    if (raw.base_origen_id !== this.baseOrigenId() || raw.base_final_id !== this.baseFinalId()) this.preview.set(null);
    this.baseOrigenId.set(raw.base_origen_id);
    this.baseFinalId.set(raw.base_final_id);
  }

  cambiarHora(event: Event): void {
    this.horaSalida.set((event.target as HTMLInputElement).value);
  }

  alternarOptimizacion(event: Event): void {
    const activo = (event.target as HTMLInputElement).checked;
    this.modoAsignacion.set(activo ? 'optimizacion' : 'manual');
    if (!activo) this.preview.set(null);
  }

  exportarDestinos(): void {
    const filas = this.destinosVisibles();
    const encabezado = ['Documento', 'Destinatario', 'Dirección', 'Distrito', 'Tipo', 'Estado'];
    const lineas = [encabezado, ...filas.map((destino) => [
      this.documentoDestino(destino),
      this.nombreDestinatario(destino),
      destino.direccion,
      destino.distrito,
      etiquetaTipo(destino.tipo_servicio),
      this.textoEstado(destino.estado),
    ])].map((cols) => cols.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(',')).join('\n');
    guardarBlob(new Blob([lineas], { type: 'text/csv;charset=utf-8' }), 'destinatarios.csv');
  }

  documentoDestino(destino: Destino): string {
    return destino.documento_receptor || destino.codigo_externo;
  }

  nombreDestinatario(destino: Destino): string {
    const nombre = `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim();
    return nombre || destino.codigo_externo;
  }

  destinoLibre(destino: Destino): boolean {
    return destino.estado === 'NO_INICIADO' && !destino.ruta_id;
  }

  textoEstado(estado: string): string {
    if (estado === 'NO_INICIADO') return 'Pendiente';
    return etiquetaEstado(estado);
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'NO_INICIADO':
        return 'prog-pill prog-pill-pendiente';
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

  iniciales(persona: { nombre: string; apellido: string } | null | undefined): string {
    if (!persona) return '';
    return `${persona.nombre.trim()[0] ?? ''}${persona.apellido.trim()[0] ?? ''}`.toUpperCase();
  }

  private cargarDestinos(): void {
    const clienteId = this.clienteId();
    if (!clienteId) return;
    const ticket = ++this.destinosTicket;
    const consulta = {
      cliente: clienteId,
      fecha: this.fecha(),
      estado: this.estadoDestino() || undefined,
      sin_ruta: this.sinRuta() ? true : undefined,
      page_size: 100,
    };
    const pedir = (page: number) => this.api.get<Pagina<Destino>>('/api/destinos/', { ...consulta, page });
    let paginaActual = 1;
    pedir(1).pipe(
      expand((pagina) => {
        if (ticket !== this.destinosTicket) return EMPTY;
        const siguiente = paginaSiguiente(pagina.next);
        if (pagina.results.length < 100 || siguiente == null || siguiente <= paginaActual) return EMPTY;
        paginaActual = siguiente;
        return pedir(siguiente);
      }),
      reduce((acumulado, pagina) => {
        acumulado.resultados.push(...pagina.results);
        acumulado.total = pagina.count;
        return acumulado;
      }, { resultados: [] as Destino[], total: 0 }),
    ).subscribe({
      next: (lista) => {
        if (ticket !== this.destinosTicket) return;
        this.destinos.set(lista.resultados);
        this.totalDestinos.set(lista.total);
      },
      error: (err: unknown) => {
        if (ticket === this.destinosTicket) this.error.set(mensajeError(err));
      },
    });
  }

  private incluirFecha(dia: string): void {
    const fecha = dia.slice(0, 10);
    if (fecha) this.fecha.set(fecha);
  }

  private cargarRutas(): void {
    const ticket = ++this.rutasTicket;
    const consulta = {
      fecha: this.fecha(),
      cliente: this.clienteId() || undefined,
      estado: this.estadoRuta() || undefined,
      page_size: 100,
    };
    const pedir = (page: number) => this.api.get<Pagina<Ruta>>('/api/rutas/', { ...consulta, page });
    let paginaActual = 1;
    pedir(1).pipe(
      expand((pagina) => {
        if (ticket !== this.rutasTicket) return EMPTY;
        const siguiente = paginaSiguiente(pagina.next);
        if (pagina.results.length < 100 || siguiente == null || siguiente <= paginaActual) return EMPTY;
        paginaActual = siguiente;
        return pedir(siguiente);
      }),
      reduce((acumulado, pagina) => {
        acumulado.resultados.push(...pagina.results);
        acumulado.total = pagina.count;
        return acumulado;
      }, { resultados: [] as Ruta[], total: 0 }),
    ).subscribe({
      next: (lista) => {
        if (ticket !== this.rutasTicket) return;
        this.rutas.set(lista.resultados);
        this.totalRutas.set(lista.total);
      },
      error: (err: unknown) => {
        if (ticket === this.rutasTicket) this.error.set(mensajeError(err));
      },
    });
  }

  private cargarSedes(clienteId: number): void {
    this.api.get<Pagina<Punto>>('/api/puntos/', { cliente: clienteId, es_sede: true, activo: true, page_size: 100 }).subscribe({
      next: (pagina) => this.sedes.set(pagina.results),
    });
  }

  private cargarCatalogo(clienteId: number): void {
    this.catalogos.paraRuta(clienteId).subscribe({
      next: (catalogo) => {
        this.catalogo.set(catalogo);
        this.aplicarBasesPorDefecto(catalogo);
      },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private aplicarBasesPorDefecto(catalogo: CatalogoRuta): void {
    const raw = this.rutaForm.getRawValue();
    const parche: { base_origen_id?: string; base_final_id?: string } = {};
    if (!raw.base_origen_id) {
      const origen = catalogo.basesCliente.find((punto) => punto.es_principal);
      if (origen) parche.base_origen_id = String(origen.id);
    }
    if (!raw.base_final_id) {
      const final = catalogo.basesVarpal.find((punto) => punto.es_principal) ?? catalogo.basesVarpal[0];
      if (final) parche.base_final_id = String(final.id);
    }
    if (!parche.base_origen_id && !parche.base_final_id) return;
    this.rutaForm.patchValue(parche);
    this.sincronizarAsignacion();
  }

  private marcarArchivo(archivo: File | null): void {
    this.archivo = archivo;
    this.archivoNombre.set(archivo?.name ?? '');
    this.importacion.set(null);
    this.verErrores.set(false);
    if (!archivo) {
      this.archivoHora.set('');
      return;
    }
    this.archivoHora.set(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }));
  }

  private reiniciarAsignacion(): void {
    this.conductorId.set('');
    this.vehiculoId.set('');
    this.auxiliar1Id.set('');
    this.auxiliar2Id.set('');
    this.horaSalida.set('08:00');
    this.baseOrigenId.set('');
    this.baseFinalId.set('');
    this.rutaForm.reset({
      conductor_id: '',
      vehiculo_id: '',
      auxiliar_1: '',
      auxiliar_2: '',
      base_origen_id: '',
      base_final_id: '',
    });
  }

  private limpiarTrasGuardar(): void {
    this.seleccion.set([]);
    this.orden.set([]);
    this.destinosArmado.set([]);
    this.preview.set(null);
    this.error.set('');
  }

  private prepararCuerpo(): {
    cliente_id: number;
    fecha: string;
    conductor_id: number;
    vehiculo_id: number;
    auxiliar_ids: number[];
    base_origen_id: number | null;
    base_final_id: number | null;
    destino_ids: number[];
    optimizar: boolean;
  } | null {
    const clienteId = this.clienteId();
    const raw = this.rutaForm.getRawValue();
    const conductorId = idOpcional(raw.conductor_id);
    const vehiculoId = idOpcional(raw.vehiculo_id);
    const destinoIds = this.orden().length ? this.orden() : this.seleccion();
    if (!clienteId || !conductorId || !vehiculoId || !destinoIds.length) {
      this.error.set('Elige cliente, conductor, unidad y al menos un destino.');
      return null;
    }
    const auxiliares = [...new Set([raw.auxiliar_1, raw.auxiliar_2].flatMap((valor) => {
      const id = idOpcional(valor);
      return id ? [id] : [];
    }))];
    return {
      cliente_id: clienteId,
      fecha: this.fecha(),
      conductor_id: conductorId,
      vehiculo_id: vehiculoId,
      auxiliar_ids: auxiliares,
      base_origen_id: idOpcional(raw.base_origen_id),
      base_final_id: idOpcional(raw.base_final_id),
      destino_ids: destinoIds,
      optimizar: this.modoAsignacion() === 'optimizacion',
    };
  }
}

function paginaSiguiente(next: string | null): number | null {
  if (!next) return null;
  const pagina = Number(new URL(next, 'http://local').searchParams.get('page'));
  return Number.isFinite(pagina) && pagina > 0 ? pagina : null;
}
