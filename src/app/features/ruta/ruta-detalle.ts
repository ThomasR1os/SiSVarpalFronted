import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { CatalogoRuta, Catalogos } from '../../core/catalogos';
import { Destino, Evidencia, Pagina, Ruta } from '../../core/models';
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
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { CerrarParada } from './cerrar-parada';

@Component({
  selector: 'app-ruta-detalle',
  imports: [ReactiveFormsModule, Badge, Mapa, CerrarParada],
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
          <app-mapa [marcas]="marcas()" [geometria]="geometria()" [encuadre]="'ruta-' + ruta.id + '-' + ruta.estado" />
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
                <option value="">Dirección principal del cliente</option>
                @for (punto of catalogo()?.origenes ?? []; track punto.id) {
                  <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                }
              </select>
            </label>
            <label class="control">Base final
              <select formControlName="base_final_id">
                <option value="">Dirección principal de Varpal</option>
                @for (punto of catalogo()?.finales ?? []; track punto.id) {
                  <option [value]="punto.id">{{ punto.nombre }} · {{ punto.direccion }}</option>
                }
              </select>
            </label>
            <div class="wide">
              <span class="ayuda">Auxiliares (hasta 4). Todavía no pueden entrar a la aplicación.</span>
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
          <div class="barra-filtros">
            <label class="control flex-1">Agregar destino del mismo día
              <select [value]="nuevoDestino()" (change)="nuevoDestino.set(valor($event))">
                <option value="">Elige un destino sin ruta</option>
                @for (destino of disponibles(); track destino.id) {
                  <option [value]="destino.id">{{ destino.codigo_externo }} · {{ destino.direccion }}</option>
                }
              </select>
            </label>
            <button type="button" class="btn btn-ghost" (click)="agregarDestino()" [disabled]="!nuevoDestino()">Agregar</button>
          </div>
        }

        <div class="flex flex-col gap-2">
          @for (parada of paradasLocal(); track parada.destino_id; let indice = $index) {
            <div class="parada">
              <div class="flex w-full flex-wrap items-center gap-2">
                <strong>{{ indice + 1 }}. {{ parada.codigo_externo }}</strong>
                <app-badge [estado]="parada.estado" />
                <span class="ayuda">{{ etiquetaTipo(parada.tipo_servicio) }}</span>
                @if (editable()) {
                  <span class="flex w-full flex-wrap gap-1 sm:ml-auto sm:w-auto">
                    <button type="button" class="btn btn-ghost btn-sm" (click)="mover(indice, -1)" [disabled]="indice === 0">Subir</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="mover(indice, 1)" [disabled]="indice === paradasLocal().length - 1">Bajar</button>
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="quitar(parada.destino_id)" [disabled]="paradasLocal().length < 2">Quitar</button>
                  </span>
                }
              </div>
              <span>{{ parada.direccion }}, {{ parada.distrito }}</span>
              <span class="ayuda">{{ parada.nombre_receptor }} {{ parada.apellido_receptor }}</span>
              @if (parada.estado === 'EN_PROCESO' && (modo() === 'admin' || modo() === 'conductor')) {
                <app-cerrar-parada [destinoId]="parada.destino_id" (cerrado)="recargar()" />
              }
              @if (parada.estado === 'EXITOSO' || parada.estado === 'FALLIDO') {
                <button type="button" class="btn btn-ghost btn-sm" (click)="verEvidencias(parada.destino_id)">Ver fotos</button>
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
        @if (editable() || (modo() === 'conductor' && ruta.estado === 'NO_INICIADA') || (ruta.estado === 'EN_PROCESO' && todasCerradas())) {
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
            @if (editable()) {
              <button type="button" class="btn btn-error btn-outline" (click)="cancelar()" [disabled]="enviando()">Cancelar ruta</button>
            }
            @if (ruta.estado === 'EN_PROCESO' && todasCerradas()) {
              <button type="button" class="btn btn-primary" (click)="llegada()" [disabled]="enviando()">Llegué a la base Varpal</button>
            }
          </div>
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
  protected readonly catalogo = signal<CatalogoRuta | null>(null);
  protected readonly disponibles = signal<Destino[]>([]);
  protected readonly auxiliares = signal<number[]>([]);
  protected readonly evidencias = signal<Record<number, Evidencia[]>>({});
  protected readonly nuevoDestino = signal('');
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
  protected readonly todasCerradas = computed(() => paradasCerradas(this.ruta().paradas));
  protected readonly geometria = computed(() => lineaGeo(this.ruta().geometria_empresa));
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
      const firma = `${ruta.id}:${ruta.estado}:${ruta.paradas.map((p) => `${p.destino_id}:${p.orden}:${p.estado}`).join('|')}`;
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
      if (this.editable() && this.catalogoCliente !== ruta.cliente_id) {
        this.catalogoCliente = ruta.cliente_id;
        this.catalogos.paraRuta(ruta.cliente_id).subscribe({
          next: (catalogo) => this.catalogo.set(catalogo),
          error: (err: unknown) => this.error.set(mensajeError(err)),
        });
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
    this.paradasLocal.set(lista);
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

  agregarDestino(): void {
    const id = Number(this.nuevoDestino());
    if (!id) return;
    const destinoIds = [...this.paradasLocal().map((p) => p.destino_id), id];
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, { destino_ids: destinoIds }).subscribe({
      next: (ruta) => {
        this.nuevoDestino.set('');
        this.catalogoCliente = 0;
        this.listo(ruta, 'Destino agregado.');
      },
      error: (err: unknown) => this.fallo(err),
    });
  }

  quitar(destinoId: number): void {
    const destinoIds = this.paradasLocal().filter((p) => p.destino_id !== destinoId).map((p) => p.destino_id);
    this.enviando.set(true);
    this.api.patch<Ruta>(`/api/rutas/${this.ruta().id}/`, { destino_ids: destinoIds }).subscribe({
      next: (ruta) => this.listo(ruta, 'Destino retirado de la ruta.'),
      error: (err: unknown) => this.fallo(err),
    });
  }

  confirmar(): void {
    this.accion('confirmar', 'Ruta confirmada. Ahora la ve el conductor.');
  }

  iniciar(): void {
    this.accion('iniciar', 'Ruta iniciada. Los administradores reciben el aviso.');
  }

  cancelar(): void {
    if (!confirm('¿Cancelar la ruta? Los destinos quedan libres para otra ruta.')) return;
    this.accion('cancelar', 'Ruta cancelada.');
  }

  llegada(): void {
    this.accion('llegada-base', 'Llegada confirmada. La ruta quedó finalizada.');
  }

  recargar(): void {
    this.api.get<Ruta>(`/api/rutas/${this.ruta().id}/`).subscribe({
      next: (ruta) => this.cambio.emit(ruta),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
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
