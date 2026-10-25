import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { CatalogoRuta, Catalogos } from '../../core/catalogos';
import { Destino, Evidencia, Pagina, Parada, Ruta } from '../../core/models';
import {
  distancia,
  duracion,
  etiquetaTipo,
  fechaCorta,
  idOpcional,
  nombrePersona,
  paradasCerradas,
} from '../../core/texto';
import { Badge } from '../../shared/badge';
import { Modal } from '../../shared/modal';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, lineaParadas, marcasRuta } from '../../shared/mapa/marcas';
import { CerrarParada } from './cerrar-parada';
import { CorregirCierre } from './corregir-cierre';

@Component({
  selector: 'app-ruta-detalle',
  imports: [ReactiveFormsModule, Badge, Modal, Mapa, CerrarParada, CorregirCierre],
  template: `
    @if (ruta(); as ruta) {
      <article class="flex flex-col gap-4">
        <div class="panel-head">
          <div class="min-w-0">
            <h2>Ruta {{ ruta.id }} · {{ ruta.cliente_nombre }}</h2>
            <p>{{ fechaCorta(ruta.fecha) }} · {{ distancia(ruta.distancia_metros) }} · {{ duracion(ruta.duracion_segundos) }}</p>
          </div>
          <div class="btns items-center">
            <app-badge [estado]="ruta.estado" />
            <button type="button" class="btn btn-ghost" (click)="cerrada.emit()">Volver</button>
          </div>
        </div>
        @if (!ruta.dentro_de_lima) {
          <div class="alert alert-warning">Esta ruta tiene puntos fuera de Lima metropolitana. No aparecerá en el mapa en vivo.</div>
        }
        @if (error() || aviso()) {
          <div class="flex flex-col gap-4">
            @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
            @if (aviso()) { <div class="alert alert-info">{{ aviso() }}</div> }
          </div>
        }
        <div class="mapa-caja">
          <app-mapa [marcas]="marcas()" [geometria]="geometria()" [encuadre]="encuadre()" />
        </div>
        <p class="ayuda">
          Conductor: {{ nombrePersona(ruta.conductor) }}
          · Vehículo: {{ ruta.vehiculo?.placa || '—' }}
          · Auxiliares: {{ auxiliaresTexto(ruta) }}
        </p>

        @if (editable()) {
          <form class="form-grid" [formGroup]="form" (ngSubmit)="guardarAsignacion()">
            <label class="control">Conductor
              <select formControlName="conductor_id">
                @for (persona of catalogo()?.conductores ?? []; track persona.id) {
                  <option [value]="persona.id">{{ persona.nombre }} {{ persona.apellido }}</option>
                }
              </select>
            </label>
            <label class="control">Vehículo
              <select formControlName="vehiculo_id">
                @for (vehiculo of catalogo()?.vehiculos ?? []; track vehiculo.id) {
                  <option [value]="vehiculo.id">{{ vehiculo.placa }} · {{ vehiculo.marca }}</option>
                }
              </select>
            </label>
            <label class="control">Base de origen
              <select formControlName="base_origen_id">
                <option value="">Elige una base</option>
                @if (catalogo()?.basesVarpal?.length) {
                  <optgroup label="Varpal">
                    @for (punto of catalogo()?.basesVarpal ?? []; track punto.id) {
                      <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                    }
                  </optgroup>
                }
                @if (catalogo()?.basesCliente?.length) {
                  <optgroup [label]="ruta.cliente_nombre || 'Cliente'">
                    @for (punto of catalogo()?.basesCliente ?? []; track punto.id) {
                      <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                    }
                  </optgroup>
                }
              </select>
            </label>
            <label class="control">Base final
              <select formControlName="base_final_id">
                <option value="">Elige una base</option>
                @if (catalogo()?.basesVarpal?.length) {
                  <optgroup label="Varpal">
                    @for (punto of catalogo()?.basesVarpal ?? []; track punto.id) {
                      <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                    }
                  </optgroup>
                }
                @if (catalogo()?.basesCliente?.length) {
                  <optgroup [label]="ruta.cliente_nombre || 'Cliente'">
                    @for (punto of catalogo()?.basesCliente ?? []; track punto.id) {
                      <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                    }
                  </optgroup>
                }
              </select>
            </label>
            <div class="wide">
              <span class="ayuda">Auxiliares (hasta 4). Verán la ruta y podrán subir evidencias.</span>
              <div class="flex flex-wrap gap-3">
                @for (auxiliar of catalogo()?.auxiliares ?? []; track auxiliar.id) {
                  <label class="label cursor-pointer justify-start gap-2 font-normal">
                    <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" [checked]="auxiliares().includes(auxiliar.id)" [disabled]="!auxiliares().includes(auxiliar.id) && auxiliares().length >= 4" (change)="alternarAuxiliar(auxiliar.id, $event)" />
                    {{ auxiliar.nombre }} {{ auxiliar.apellido }}
                  </label>
                }
              </div>
            </div>
            <button class="btn btn-outline" type="submit" [disabled]="enviando()">Guardar asignación</button>
          </form>
        }
        @if (puedeAuxiliares()) {
          <div class="form-grid">
            <div class="wide">
              <span class="ayuda">La ruta ya está en camino. Puedes agregar o quitar auxiliares (hasta 4). Ellos verán esta ruta y podrán subir evidencias.</span>
              @if (catalogo(); as datos) {
                <div class="flex flex-wrap gap-3">
                  @for (auxiliar of datos.auxiliares; track auxiliar.id) {
                    <label class="label cursor-pointer justify-start gap-2 font-normal">
                      <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" [checked]="auxiliares().includes(auxiliar.id)" [disabled]="!auxiliares().includes(auxiliar.id) && auxiliares().length >= 4" (change)="alternarAuxiliar(auxiliar.id, $event)" />
                      {{ auxiliar.nombre }} {{ auxiliar.apellido }}
                    </label>
                  } @empty {
                    <span class="ayuda">No hay auxiliares activos.</span>
                  }
                </div>
              } @else {
                <span class="loading loading-spinner loading-sm text-primary"></span>
              }
            </div>
            <button type="button" class="btn btn-outline" (click)="guardarAuxiliares()" [disabled]="enviando()">Guardar auxiliares</button>
          </div>
        }
        @if (puedeParadas()) {
          <div class="barra-filtros">
            <label class="control flex-1">Agregar destino del mismo día
              <select [value]="nuevoDestino()" (change)="nuevoDestino.set(valor($event))">
                <option value="">Elige un destino sin ruta</option>
                @for (destino of disponibles(); track destino.id) {
                  <option [value]="destino.id">{{ destino.codigo_externo }} · {{ destino.direccion }}</option>
                }
              </select>
            </label>
            <button type="button" class="btn btn-ghost" (click)="pedirAgregar()" [disabled]="!nuevoDestino()">Agregar</button>
          </div>
        }

        <div class="flex flex-col gap-2">
          @if (editable()) {
            <p class="ayuda">Arrastra una parada para cambiar su lugar. Después pulsa Guardar orden.</p>
          }
          @for (parada of paradasLocal(); track parada.destino_id; let indice = $index) {
            <div class="parada" [class.arrastrable]="editable()" [class.arrastrando]="arrastre() === indice" [class.soltar]="sobre() === indice && arrastre() !== indice" [attr.draggable]="editable() ? true : null" (dragstart)="iniciarArrastre($event, indice)" (dragover)="sobreArrastre($event, indice)" (drop)="soltarArrastre($event, indice)" (dragend)="terminarArrastre()">
              <div class="flex w-full flex-wrap items-center gap-2">
                @if (editable()) {
                  <span class="parada-asa" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.4" /><circle cx="15" cy="7" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="17" r="1.4" /><circle cx="15" cy="17" r="1.4" /></svg>
                  </span>
                }
                <strong>{{ indice + 1 }}. {{ parada.codigo_externo }}</strong>
                <app-badge [estado]="parada.estado" />
                <span class="ayuda">{{ etiquetaTipo(parada.tipo_servicio) }}</span>
                @if (editable() || puedeParadas() || modo() === 'admin') {
                  <span class="flex w-full flex-wrap gap-1 sm:ml-auto sm:w-auto" (dragstart)="$event.preventDefault()">
                    @if (editable()) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="mover(indice, -1)" [disabled]="indice === 0">Subir</button>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="mover(indice, 1)" [disabled]="indice === paradasLocal().length - 1">Bajar</button>
                    }
                    @if (puedeParadas()) {
                      <button type="button" class="btn btn-error btn-outline btn-sm" (click)="pedirQuitar(parada.destino_id)" [disabled]="paradasLocal().length < 2">Quitar</button>
                    }
                    @if (modo() === 'admin') {
                      <button type="button" class="btn btn-error btn-outline btn-sm" (click)="pedirEliminarDestino(parada.destino_id)">Eliminar</button>
                    }
                  </span>
                }
              </div>
              <span>{{ parada.direccion }}, {{ parada.distrito }}</span>
              <span class="ayuda">{{ parada.nombre_receptor }} {{ parada.apellido_receptor }}</span>
              @if (parada.estado === 'EN_PROCESO' && (modo() === 'admin' || modo() === 'conductor')) {
                <app-cerrar-parada class="mt-2 w-full border-t border-base-300 pt-3" [parada]="parada" (cerrado)="recargar()" (georeferenciada)="alGeoreferenciar()" />
              }
              @if (parada.estado === 'EXITOSO' || parada.estado === 'FALLIDO' || parada.estado === 'PENDIENTE') {
                <span class="flex flex-wrap gap-1">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="verEvidencias(parada.destino_id)">Ver fotos</button>
                  @if (modo() === 'admin') {
                    <button type="button" class="btn btn-outline btn-sm" (click)="abrirCorreccion(parada)">Corregir cierre</button>
                  }
                </span>
                @if (evidencias()[parada.destino_id]; as fotos) {
                  <div class="fotos">
                    @for (foto of fotos; track foto.id) {
                      <a [href]="foto.archivo" target="_blank" rel="noopener"><img [src]="foto.archivo" alt="Evidencia" /></a>
                    }
                  </div>
                }
              }
            </div>
          }
        </div>
        @if (modo() === 'admin' || puedeParadas() || (modo() === 'conductor' && ruta.estado === 'NO_INICIADA') || (ruta.estado === 'EN_PROCESO' && todasCerradas())) {
          <div class="acciones-pie">
            @if (editable()) {
              <button type="button" class="btn btn-outline" (click)="guardarOrden()" [disabled]="enviando()">Guardar orden</button>
            }
            @if (modo() === 'admin' && ruta.estado === 'BORRADOR') {
              <button type="button" class="btn btn-primary" (click)="confirmar()" [disabled]="enviando()">Confirmar ruta</button>
            }
            @if (modo() === 'conductor' && ruta.estado === 'NO_INICIADA') {
              <button type="button" class="btn btn-primary h-auto min-h-12 whitespace-normal" (click)="iniciar()" [disabled]="enviando() || !puedeIniciar()">
                {{ puedeIniciar() ? 'Iniciar ruta' : 'Termina la ruta en proceso antes de iniciar otra' }}
              </button>
            }
            @if (puedeParadas()) {
              <button type="button" class="btn btn-error btn-outline" (click)="pedirInhabilitar()" [disabled]="enviando()">Inhabilitar ruta</button>
            }
            @if (modo() === 'admin') {
              <button type="button" class="btn btn-error btn-outline" (click)="pedirEliminar()" [disabled]="enviando()">Eliminar ruta</button>
            }
            @if (ruta.estado === 'EN_PROCESO' && todasCerradas()) {
              <button type="button" class="btn btn-primary" (click)="llegada()" [disabled]="enviando()">Llegué a la base Varpal</button>
            }
          </div>
        }
        @if (confirmacion() === 'agregar') {
          <app-modal titulo="Agregar destino" (cerrar)="confirmacion.set('')">
            <div class="flex flex-col gap-4">
              <div class="alert alert-warning">{{ textoAgregar() }}</div>
              @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
              <p>Se agregará {{ etiquetaDestinoNuevo() }} a la ruta {{ ruta.id }}.</p>
              <button type="button" class="btn btn-primary" (click)="agregarDestino()" [disabled]="enviando()">Agregar destino</button>
            </div>
          </app-modal>
        }
        @if (confirmacion() === 'quitar') {
          <app-modal titulo="Quitar parada" (cerrar)="confirmacion.set('')">
            <div class="flex flex-col gap-4">
              <div class="alert alert-warning">{{ textoQuitar() }}</div>
              @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
              <p>La parada saldrá de la ruta {{ ruta.id }}. La ruta se conserva.</p>
              <button type="button" class="btn btn-error" (click)="quitar()" [disabled]="enviando()">Quitar de la ruta</button>
            </div>
          </app-modal>
        }
        @if (correccion(); as paradaCorregir) {
          <app-corregir-cierre [parada]="paradaCorregir" (corregida)="alCorregir($event)" (cancelada)="correccion.set(null)" />
        }
        @if (confirmacion() === 'eliminarDestino') {
          <app-modal titulo="Eliminar destino" (cerrar)="confirmacion.set('')">
            <div class="flex flex-col gap-4">
              <div class="alert alert-warning">Se borrará este destino de la ruta {{ ruta.id }}. No se puede deshacer.</div>
              @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
              <p>Se eliminará {{ etiquetaParada(paradaQuitar()) }}.</p>
              <button type="button" class="btn btn-error" (click)="eliminarDestino()" [disabled]="enviando()">Eliminar destino</button>
            </div>
          </app-modal>
        }
        @if (confirmacion() === 'eliminar') {
          <app-modal titulo="Eliminar ruta" (cerrar)="confirmacion.set('')">
            <div class="flex flex-col gap-4">
              <div class="alert alert-warning">Se borrará la ruta {{ ruta.id }}. Los destinos que seguían en proceso quedan libres. Los que ya se cerraron se conservan. No se puede deshacer.</div>
              @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
              <p>¿Eliminar la ruta {{ ruta.id }}?</p>
              <button type="button" class="btn btn-error" (click)="eliminarRuta()" [disabled]="enviando()">Eliminar ruta</button>
            </div>
          </app-modal>
        }
        @if (confirmacion() === 'inhabilitar') {
          <app-modal titulo="Inhabilitar ruta" (cerrar)="confirmacion.set('')">
            <div class="flex flex-col gap-4">
              <div class="alert alert-warning">{{ textoInhabilitar() }}</div>
              @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
              <p>¿Inhabilitar la ruta {{ ruta.id }}? Los destinos quedan libres para otra ruta.</p>
              <button type="button" class="btn btn-error" (click)="inhabilitar()" [disabled]="enviando()">Inhabilitar ruta</button>
            </div>
          </app-modal>
        }
      </article>
    }
  `,
})
export class RutaDetalle {
  readonly ruta = input.required<Ruta>();
  readonly modo = input<'admin' | 'conductor'>('admin');
  readonly puedeIniciar = input(false);
  readonly cambio = output<Ruta>();
  readonly cerrada = output<void>();
  readonly eliminada = output<void>();

  private readonly api = inject(Api);
  private readonly catalogos = inject(Catalogos);
  private readonly fb = inject(FormBuilder);
  private firma = '';
  private catalogoCliente = 0;
  protected readonly fechaCorta = fechaCorta;
  protected readonly distancia = distancia;
  protected readonly duracion = duracion;
  protected readonly nombrePersona = nombrePersona;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly paradasLocal = signal<Ruta['paradas']>([]);
  protected readonly arrastre = signal<number | null>(null);
  protected readonly sobre = signal<number | null>(null);
  protected readonly catalogo = signal<CatalogoRuta | null>(null);
  protected readonly disponibles = signal<Destino[]>([]);
  protected readonly auxiliares = signal<number[]>([]);
  protected readonly evidencias = signal<Record<number, Evidencia[]>>({});
  protected readonly nuevoDestino = signal('');
  protected readonly paradaQuitar = signal<number | null>(null);
  protected readonly confirmacion = signal<'' | 'agregar' | 'quitar' | 'inhabilitar' | 'eliminar' | 'eliminarDestino'>('');
  protected readonly correccion = signal<Parada | null>(null);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    conductor_id: [''],
    vehiculo_id: [''],
    base_origen_id: [''],
    base_final_id: [''],
  });
  protected readonly editable = computed(
    () => this.modo() === 'admin' && (this.ruta().estado === 'BORRADOR' || this.ruta().estado === 'NO_INICIADA'),
  );
  protected readonly puedeParadas = computed(
    () => this.editable() || (this.modo() === 'admin' && this.ruta().estado === 'EN_PROCESO'),
  );
  protected readonly puedeAuxiliares = computed(
    () => this.modo() === 'admin' && this.ruta().estado === 'EN_PROCESO',
  );
  protected readonly todasCerradas = computed(() => paradasCerradas(this.ruta().paradas));
  protected readonly geometria = computed(() => {
    const ruta = this.ruta();
    const local = this.paradasLocal();
    const guardado = [...ruta.paradas].sort((a, b) => a.orden - b.orden).map((parada) => parada.destino_id).join(',');
    const actual = local.map((parada) => parada.destino_id).join(',');
    if (!local.length || actual === guardado) return lineaGeo(ruta.geometria_empresa);
    return lineaParadas({ paradas: local, origen: ruta.base_origen, final: ruta.base_final });
  });
  protected readonly encuadre = computed(() => {
    const ruta = this.ruta();
    const puntos = ruta.paradas.map((parada) => `${parada.latitud},${parada.longitud}`).join('|');
    const origen = ruta.base_origen ? `${ruta.base_origen.latitud},${ruta.base_origen.longitud}` : '';
    return `ruta-${ruta.id}-${origen}-${puntos}`;
  });
  protected readonly marcas = computed(() => {
    const ruta = this.ruta();
    const latitud = ruta.ultima_latitud;
    const longitud = ruta.ultima_longitud;
    return marcasRuta({
      paradas: this.paradasLocal(),
      origen: ruta.base_origen,
      final: ruta.base_final,
      camion: ruta.estado === 'EN_PROCESO' && latitud && longitud ? { latitud, longitud } : null,
      camionId: ruta.id,
    });
  });

  constructor() {
    effect(() => {
      const ruta = this.ruta();
      const firma = `${ruta.id}:${ruta.estado}:${ruta.auxiliares.map((a) => a.id).join(',')}:${ruta.paradas.map((p) => `${p.destino_id}:${p.orden}:${p.estado}:${p.latitud}:${p.longitud}:${p.direccion}:${p.distrito}`).join('|')}:${ruta.geometria_empresa?.coordinates?.length ?? 0}`;
      if (firma !== this.firma) {
        this.firma = firma;
        this.paradasLocal.set([...ruta.paradas].sort((a, b) => a.orden - b.orden));
        this.auxiliares.set(ruta.auxiliares.map((a) => a.id));
        this.form.patchValue({
          conductor_id: ruta.conductor ? String(ruta.conductor.id) : '',
          vehiculo_id: ruta.vehiculo ? String(ruta.vehiculo.id) : '',
          base_origen_id: ruta.base_origen ? String(ruta.base_origen.id) : '',
          base_final_id: ruta.base_final ? String(ruta.base_final.id) : '',
        });
      }
      if (this.puedeParadas() && this.catalogoCliente !== ruta.cliente_id) {
        this.catalogoCliente = ruta.cliente_id;
        if (this.editable() || this.puedeAuxiliares()) {
          this.catalogos.paraRuta(ruta.cliente_id).subscribe({
            next: (catalogo) => this.catalogo.set(catalogo),
            error: (err: unknown) => this.error.set(mensajeError(err)),
          });
        }
        this.api.get<Pagina<Destino>>('/api/destinos/', {
          cliente: ruta.cliente_id,
          fecha: ruta.fecha,
          sin_ruta: true,
          estado: 'NO_INICIADO',
          page_size: 100,
        }).subscribe({
          next: (pagina) => this.disponibles.set(pagina.results),
          error: (err: unknown) => this.error.set(mensajeError(err)),
        });
      }
    });
  }

  auxiliaresTexto(ruta: Ruta): string {
    if (!ruta.auxiliares.length) return 'ninguno';
    return ruta.auxiliares.map((a) => nombrePersona(a)).join(', ');
  }

  valor(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  alternarAuxiliar(id: number, event: Event): void {
    const marcado = (event.target as HTMLInputElement).checked;
    const actual = this.auxiliares();
    if (marcado) {
      if (actual.length >= 4) return;
      this.auxiliares.set([...actual, id]);
    } else {
      this.auxiliares.set(actual.filter((item) => item !== id));
    }
  }

  mover(indice: number, delta: number): void {
    const lista = [...this.paradasLocal()];
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const [item] = lista.splice(indice, 1);
    if (!item) return;
    lista.splice(destino, 0, item);
    this.colocar(lista);
  }

  iniciarArrastre(event: DragEvent, indice: number): void {
    if (!this.editable()) {
      event.preventDefault();
      return;
    }
    this.arrastre.set(indice);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(indice));
    }
  }

  sobreArrastre(event: DragEvent, indice: number): void {
    if (!this.editable() || this.arrastre() == null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.sobre.set(indice);
  }

  soltarArrastre(event: DragEvent, indice: number): void {
    event.preventDefault();
    const origen = this.arrastre();
    this.terminarArrastre();
    if (origen == null || origen === indice) return;
    const lista = [...this.paradasLocal()];
    const [item] = lista.splice(origen, 1);
    if (!item) return;
    lista.splice(indice, 0, item);
    this.colocar(lista);
  }

  terminarArrastre(): void {
    this.arrastre.set(null);
    this.sobre.set(null);
  }

  private colocar(lista: Ruta['paradas']): void {
    this.paradasLocal.set(lista.map((parada, indice) => ({ ...parada, orden: indice + 1 })));
  }

  guardarOrden(): void {
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/orden/`, {
      destino_ids: this.paradasLocal().map((p) => p.destino_id),
    }).subscribe({
      next: (ruta) => this.listo(ruta, 'Orden guardado.'),
      error: (err: unknown) => this.fallo(err),
    });
  }

  guardarAuxiliares(): void {
    if (!this.puedeAuxiliares()) return;
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, {
      auxiliar_ids: this.auxiliares(),
    }).subscribe({
      next: (ruta) => this.listo(ruta, 'Auxiliares actualizados. Ya pueden ver esta ruta y subir evidencias.'),
      error: (err: unknown) => this.fallo(err),
    });
  }

  guardarAsignacion(): void {
    const raw = this.form.getRawValue();
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, {
      conductor_id: idOpcional(raw.conductor_id),
      vehiculo_id: idOpcional(raw.vehiculo_id),
      auxiliar_ids: this.auxiliares(),
      base_origen_id: idOpcional(raw.base_origen_id),
      base_final_id: idOpcional(raw.base_final_id),
    }).subscribe({
      next: (ruta) => this.listo(ruta, 'Asignación guardada. La ruta sigue sin publicarse hasta confirmarla.'),
      error: (err: unknown) => this.fallo(err),
    });
  }

  pedirAgregar(): void {
    if (!this.puedeParadas() || !Number(this.nuevoDestino())) return;
    this.error.set('');
    this.confirmacion.set('agregar');
  }

  agregarDestino(): void {
    const id = Number(this.nuevoDestino());
    if (!id || !this.puedeParadas()) return;
    const destinoIds = [...this.paradasLocal().map((p) => p.destino_id), id];
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, { destino_ids: destinoIds }).subscribe({
      next: (ruta) => {
        this.nuevoDestino.set('');
        this.catalogoCliente = 0;
        this.confirmacion.set('');
        this.listo(ruta, 'Destino agregado.');
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  pedirQuitar(destinoId: number): void {
    const parada = this.paradasLocal().find((item) => item.destino_id === destinoId);
    if (!this.puedeParadas() || !parada) return;
    if (this.paradasLocal().length < 2) {
      this.error.set('No se puede quitar la única parada de la ruta.');
      return;
    }
    this.error.set('');
    this.paradaQuitar.set(destinoId);
    this.confirmacion.set('quitar');
  }

  quitar(): void {
    const destinoId = this.paradaQuitar();
    if (!destinoId || !this.puedeParadas()) return;
    const destinoIds = this.paradasLocal().filter((p) => p.destino_id !== destinoId).map((p) => p.destino_id);
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, { destino_ids: destinoIds }).subscribe({
      next: (ruta) => {
        this.paradaQuitar.set(null);
        this.catalogoCliente = 0;
        this.confirmacion.set('');
        this.listo(ruta, 'Destino retirado de la ruta.');
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  textoAgregar(): string {
    if (this.ruta().estado === 'EN_PROCESO') {
      return 'Vas a agregar una parada a una ruta que ya está en camino. El conductor la verá en la ruta en vivo.';
    }
    return 'El destino se sumará a esta ruta y dejará de estar libre para otra asignación.';
  }

  textoQuitar(): string {
    const id = this.paradaQuitar();
    const parada = this.paradasLocal().find((item) => item.destino_id === id);
    const cerrado = parada?.estado === 'EXITOSO' || parada?.estado === 'FALLIDO' || parada?.estado === 'PENDIENTE';
    if (cerrado) {
      return 'Esta parada ya tiene un cierre. Al quitarla sale de la ruta y el destino vuelve a quedar libre, sin ese resultado.';
    }
    if (this.ruta().estado === 'EN_PROCESO') {
      return 'Quitar esta parada la saca de la ruta en vivo. El conductor ya no la verá en el recorrido.';
    }
    return 'La parada saldrá de la ruta y el destino quedará libre para otra asignación.';
  }

  textoInhabilitar(): string {
    if (this.ruta().estado === 'EN_PROCESO') {
      return 'Esta ruta ya está en camino. Al inhabilitarla, el conductor dejará de verla y los destinos quedan libres para otra ruta.';
    }
    return 'Al inhabilitar la ruta, los destinos quedan libres para otra ruta y el conductor ya no la verá.';
  }

  etiquetaDestinoNuevo(): string {
    const id = Number(this.nuevoDestino());
    const destino = this.disponibles().find((item) => item.id === id);
    return destino ? `${destino.codigo_externo} · ${destino.direccion}` : 'el destino elegido';
  }

  confirmar(): void {
    this.accion('confirmar', 'Ruta confirmada. Ahora la ve el conductor.');
  }

  iniciar(): void {
    this.accion('iniciar', 'Ruta iniciada. Los administradores reciben el aviso.');
  }

  pedirEliminarDestino(destinoId: number): void {
    if (this.modo() !== 'admin') return;
    this.error.set('');
    this.paradaQuitar.set(destinoId);
    this.confirmacion.set('eliminarDestino');
  }

  eliminarDestino(): void {
    const destinoId = this.paradaQuitar();
    if (!destinoId || this.modo() !== 'admin') return;
    this.enviando.set(true);
    this.api.delete(`/api/destinos/${destinoId}/`).subscribe({
      next: () => {
        this.paradaQuitar.set(null);
        this.confirmacion.set('');
        this.enviando.set(false);
        this.aviso.set('Destino eliminado.');
        this.recargar();
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  etiquetaParada(destinoId: number | null): string {
    const parada = this.paradasLocal().find((item) => item.destino_id === destinoId);
    return parada ? `${parada.codigo_externo} · ${parada.direccion}` : 'este destino';
  }

  pedirEliminar(): void {
    if (this.modo() !== 'admin') return;
    this.error.set('');
    this.confirmacion.set('eliminar');
  }

  eliminarRuta(): void {
    if (this.modo() !== 'admin') return;
    this.enviando.set(true);
    this.api.delete(`/api/rutas/${this.ruta().id}/`).subscribe({
      next: () => {
        this.confirmacion.set('');
        this.enviando.set(false);
        this.eliminada.emit();
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  pedirInhabilitar(): void {
    const estado = this.ruta().estado;
    if (estado === 'FINALIZADA' || estado === 'CANCELADA') {
      this.error.set(estado === 'FINALIZADA'
        ? 'No se puede inhabilitar una ruta finalizada.'
        : 'Esta ruta ya está inhabilitada.');
      return;
    }
    this.error.set('');
    this.confirmacion.set('inhabilitar');
  }

  inhabilitar(): void {
    const estado = this.ruta().estado;
    if (estado === 'FINALIZADA' || estado === 'CANCELADA') return;
    this.enviando.set(true);
    this.api.post(`/api/rutas/${this.ruta().id}/cancelar/`, {}).subscribe({
      next: () => {
        this.confirmacion.set('');
        this.aviso.set('Ruta inhabilitada. Los destinos quedan libres para otra ruta.');
        this.enviando.set(false);
        this.recargar();
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  llegada(): void {
    this.accion('llegada-base', 'Llegada confirmada. La ruta quedó finalizada.');
  }

  alGeoreferenciar(): void {
    this.aviso.set('Ubicación del destino actualizada. El mapa ya usa este punto.');
    this.recargar();
  }

  recargar(): void {
    this.api.get<Ruta>(`/api/rutas/${this.ruta().id}/`).subscribe({
      next: (ruta) => this.cambio.emit(ruta),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  abrirCorreccion(parada: Parada): void {
    this.error.set('');
    this.correccion.set(parada);
  }

  alCorregir(destinoId: number): void {
    this.correccion.set(null);
    this.aviso.set('Cierre corregido. El estado y las fotos quedaron actualizados.');
    this.verEvidencias(destinoId);
    this.recargar();
  }

  verEvidencias(destinoId: number): void {
    this.api.get<Evidencia[]>(`/api/destinos/${destinoId}/evidencias/`).subscribe({
      next: (fotos) => this.evidencias.update((actual) => ({ ...actual, [destinoId]: fotos })),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private accion(ruta: string, mensaje: string): void {
    this.enviando.set(true);
    this.api.post(`/api/rutas/${this.ruta().id}/${ruta}/`, {}).subscribe({
      next: () => {
        this.aviso.set(mensaje);
        this.enviando.set(false);
        this.recargar();
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  private listo(ruta: Ruta, mensaje: string): void {
    this.enviando.set(false);
    this.error.set('');
    this.aviso.set(mensaje);
    this.cambio.emit(ruta);
  }

  private fallo(err: unknown): void {
    this.enviando.set(false);
    this.error.set(mensajeError(err));
  }
}
