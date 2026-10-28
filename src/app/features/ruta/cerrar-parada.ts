import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Motivo, Pagina, Parada } from '../../core/models';
import { TAMANO_CATALOGO } from '../../core/texto';
import { Icono } from '../conductor/icono';

const MAX_FOTOS = 10;
const MAX_COMENTARIO = 500;
const TIPOS_FOTO = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp'];

function fechaLocal(diasDespues: number): string {
  const dia = new Date();
  dia.setDate(dia.getDate() + diasDespues);
  const mes = String(dia.getMonth() + 1).padStart(2, '0');
  return `${dia.getFullYear()}-${mes}-${String(dia.getDate()).padStart(2, '0')}`;
}

function esFoto(archivo: File): boolean {
  if (TIPOS_FOTO.includes(archivo.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(archivo.name);
}

@Component({
  selector: 'app-cerrar-parada',
  imports: [ReactiveFormsModule, Icono],
  template: `
    <form class="flex w-full flex-col gap-4" [formGroup]="form" (ngSubmit)="enviar('EXITOSO')">
      <h3 class="font-display text-lg">Check-in / Evidencia</h3>

      <div class="flex flex-wrap items-center gap-3 rounded-box bg-base-200 p-3">
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <p class="flex items-start gap-2.5">
            <app-icono nombre="edificio" class="size-5 text-primary" />
            <strong class="min-w-0 font-display leading-tight">{{ parada().codigo_externo }} {{ receptor() }}</strong>
          </p>
          <p class="flex items-start gap-2.5 text-sm text-base-content/70">
            <app-icono nombre="pin" class="size-5 text-primary" />
            <span class="min-w-0">{{ parada().direccion }}<br />{{ parada().distrito }}</span>
          </p>
        </div>
        <a class="btn ml-auto gap-2 rounded-xl border-0 bg-azul/10 text-azul hover:bg-azul/20" [href]="enlaceMapa()" target="_blank" rel="noopener">
          <app-icono nombre="navegar" class="size-5" /> Navegar
        </a>
      </div>

      <div class="flex flex-col gap-2 rounded-box border border-dashed border-azul/30 bg-azul/5 p-3">
        <button type="button" class="btn min-h-12 justify-start gap-2 rounded-xl border-azul/30 bg-base-100" (click)="georeferenciar()" [disabled]="ubicando() || enviando()">
          <app-icono nombre="pin" class="size-5 text-primary" />
          {{ ubicando() ? 'Leyendo ubicación…' : 'Georeferenciar' }}
        </button>
        <p class="text-xs text-base-content/65">Si el mapa marca otro lugar, guarda el punto donde estás ahora. El pin y la ruta pasan a esa ubicación.</p>
        @if (ubicacionGuardada()) { <p class="text-sm font-medium text-success">Ubicación guardada. El mapa ya usa este punto.</p> }
      </div>

      <div class="flex flex-col gap-3 rounded-box bg-base-200 p-3">
        <p class="flex items-center gap-2 font-semibold">
          <app-icono nombre="camara" class="size-5 text-primary" />
          Fotografía obligatoria
          <span class="ml-auto text-xs font-normal text-base-content/60">{{ vistas().length }}/{{ maxFotos }}</span>
        </p>
        @if (vistas().length) {
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
            @for (vista of vistas(); track vista.url; let i = $index) {
              <div class="relative aspect-square overflow-hidden rounded-xl border border-base-300 bg-base-100">
                <img class="size-full object-cover" [src]="vista.url" [alt]="vista.nombre" />
                <button type="button" class="btn btn-circle btn-xs absolute top-1 right-1 border-0 bg-base-100/90" (click)="quitarFoto(i)" aria-label="Quitar foto">✕</button>
              </div>
            }
          </div>
        }
        @if (vistas().length < maxFotos) {
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label class="btn h-auto min-h-12 whitespace-normal rounded-xl border-azul/30 bg-base-100">
              <app-icono nombre="servicio" class="size-5" /> Buscar en archivos
              <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple (change)="elegirFotos($event)" />
            </label>
            <label class="btn h-auto min-h-12 whitespace-normal rounded-xl border-0 bg-azul text-white">
              <app-icono nombre="camara" class="size-5" /> Tomar foto
              <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp" capture="environment" (change)="elegirFotos($event)" />
            </label>
          </div>
          <p class="text-center text-xs text-base-content/55">Mínimo 1, máximo {{ maxFotos }} · JPG, PNG o WEBP</p>
        }
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="flex items-center gap-2 text-sm font-semibold">
          <app-icono nombre="servicio" class="size-5 text-primary" /> Motivo
        </span>
        <select class="select min-h-11 w-full rounded-xl" formControlName="motivo_id">
          <option value="">Seleccionar Motivo (Dejar en blanco si la entrega es exitosa)</option>
          @for (motivo of motivos(); track motivo.id) {
            <option [value]="motivo.id">{{ motivo.descripcion }}</option>
          }
        </select>
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="flex items-center gap-2 text-sm font-semibold">
          <app-icono nombre="comentario" class="size-5 text-primary" /> Ítems entregados / Comentarios
        </span>
        <textarea class="textarea min-h-24 w-full rounded-xl" formControlName="observacion" [maxlength]="maxComentario" placeholder="Ingresa los ítems entregados o algún comentario..." (input)="largo.set(form.controls.observacion.value.length)"></textarea>
        <span class="self-end text-xs text-base-content/55">{{ largo() }}/{{ maxComentario }}</span>
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1.5">
          <span class="flex items-center gap-2 text-sm font-semibold">
            <app-icono nombre="reloj" class="size-5 text-primary" /> Inicio descarga
          </span>
          <input type="time" class="input min-h-11 w-full rounded-xl" formControlName="hora_inicio_descarga" required />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="flex items-center gap-2 text-sm font-semibold">
            <app-icono nombre="check" class="size-5 text-primary" /> Fin descarga
          </span>
          <input type="time" class="input min-h-11 w-full rounded-xl" formControlName="hora_fin_descarga" required />
        </label>
      </div>

      @if (error()) { <div class="alert alert-error text-sm">{{ error() }}</div> }

      <div class="flex flex-col gap-2 sm:flex-row">
        <button class="btn btn-success min-h-12 flex-1 gap-2 rounded-xl text-base" type="submit" [disabled]="enviando()">
          <app-icono nombre="check" class="size-5" style="--icono-contraste: var(--color-success)" /> Finalizar entrega exitosa
        </button>
        <button class="btn btn-outline btn-error min-h-12 flex-1 gap-2 rounded-xl bg-base-100 text-base" type="button" [disabled]="enviando()" (click)="enviar('FALLIDO')">
          <app-icono nombre="alerta" class="size-5" /> Marcar entrega fallida
        </button>
        <button class="btn btn-outline btn-warning min-h-12 flex-1 gap-2 rounded-xl bg-base-100 text-base" type="button" [disabled]="enviando()" (click)="abrirReprogramar()">
          <app-icono nombre="reloj" class="size-5" /> Reprogramar
        </button>
      </div>

      @if (reprogramando()) {
        <div class="flex flex-col gap-3 rounded-box border border-warning/40 bg-warning/10 p-3">
          <p class="font-semibold">Reprogramar entrega</p>
          <p class="text-xs text-base-content/70">La parada sale de esta ruta y llega a Programación como solicitud. No necesita fotos ni horas de descarga.</p>
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Nueva fecha</span>
            <input type="date" class="input min-h-11 w-full rounded-xl" [min]="manana" [value]="fechaNueva()" (input)="fechaNueva.set(valorDe($event))" />
          </label>
          <p class="text-xs text-base-content/65">Indica el motivo arriba o escribe un comentario.</p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <button class="btn btn-warning min-h-12 flex-1 rounded-xl" type="button" [disabled]="enviando()" (click)="reprogramar()">Enviar solicitud</button>
            <button class="btn btn-ghost min-h-12 rounded-xl" type="button" [disabled]="enviando()" (click)="reprogramando.set(false)">Cancelar</button>
          </div>
        </div>
      }
    </form>
  `,
})
export class CerrarParada {
  readonly parada = input.required<Parada>();
  readonly cerrado = output<void>();
  readonly georeferenciada = output<void>();

  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly maxFotos = MAX_FOTOS;
  protected readonly maxComentario = MAX_COMENTARIO;
  protected readonly motivos = signal<Motivo[]>([]);
  protected readonly vistas = signal<{ url: string; nombre: string }[]>([]);
  protected readonly largo = signal(0);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly ubicando = signal(false);
  protected readonly ubicacionGuardada = signal(false);
  protected readonly reprogramando = signal(false);
  protected readonly manana = fechaLocal(1);
  protected readonly fechaNueva = signal(fechaLocal(1));
  private archivos: File[] = [];
  protected readonly form = this.fb.nonNullable.group({
    motivo_id: [''],
    observacion: [''],
    hora_inicio_descarga: [''],
    hora_fin_descarga: [''],
  });
  protected readonly receptor = computed(() =>
    `${this.parada().nombre_receptor} ${this.parada().apellido_receptor}`.trim(),
  );
  protected readonly enlaceMapa = computed(
    () => `https://www.google.com/maps/dir/?api=1&destination=${this.parada().latitud},${this.parada().longitud}`,
  );

  constructor() {
    this.api.get<Pagina<Motivo>>('/api/motivos/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.motivos.set(pagina.results),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
    this.destroyRef.onDestroy(() => {
      for (const vista of this.vistas()) URL.revokeObjectURL(vista.url);
    });
  }

  elegirFotos(event: Event): void {
    const campo = event.target as HTMLInputElement;
    const nuevos = Array.from(campo.files ?? []);
    campo.value = '';
    if (nuevos.some((archivo) => !esFoto(archivo))) {
      this.error.set('Las fotos deben ser JPG, PNG o WEBP.');
      return;
    }
    const libres = MAX_FOTOS - this.archivos.length;
    if (nuevos.length > libres) this.error.set(`Puedes subir hasta ${MAX_FOTOS} fotos.`);
    else this.error.set('');
    const agregados = nuevos.slice(0, libres);
    this.archivos = [...this.archivos, ...agregados];
    this.vistas.update((actual) => [
      ...actual,
      ...agregados.map((archivo) => ({ url: URL.createObjectURL(archivo), nombre: archivo.name })),
    ]);
  }

  quitarFoto(indice: number): void {
    const vista = this.vistas()[indice];
    if (vista) URL.revokeObjectURL(vista.url);
    this.archivos = this.archivos.filter((_, i) => i !== indice);
    this.vistas.update((actual) => actual.filter((_, i) => i !== indice));
  }

  georeferenciar(): void {
    if (!navigator.geolocation) {
      this.error.set('Este equipo no puede leer la ubicación.');
      return;
    }
    this.ubicando.set(true);
    this.ubicacionGuardada.set(false);
    this.error.set('');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        this.api.post(`/api/destinos/${this.parada().destino_id}/georeferenciar/`, {
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
        }).subscribe({
          next: () => {
            this.ubicando.set(false);
            this.ubicacionGuardada.set(true);
            this.georeferenciada.emit();
          },
          error: (err: unknown) => {
            this.ubicando.set(false);
            this.error.set(mensajeError(err));
          },
        });
      },
      () => {
        this.ubicando.set(false);
        this.error.set('No se pudo leer tu ubicación. Activa el GPS y vuelve a intentarlo.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  valorDe(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  abrirReprogramar(): void {
    this.error.set('');
    this.reprogramando.set(true);
  }

  reprogramar(): void {
    const raw = this.form.getRawValue();
    const fecha = this.fechaNueva();
    if (!fecha || fecha < this.manana) {
      this.error.set('Elige una fecha a partir de mañana.');
      return;
    }
    const motivo = this.motivos().find((item) => String(item.id) === raw.motivo_id)?.descripcion ?? '';
    const texto = [motivo, raw.observacion.trim()].filter(Boolean).join(' · ');
    if (!texto) {
      this.error.set('Para reprogramar, selecciona un motivo o escribe un comentario.');
      return;
    }
    if (!confirm(`¿Reprogramar esta entrega para el ${fecha.split('-').reverse().join('/')}?`)) return;
    this.enviando.set(true);
    this.error.set('');
    this.api
      .post(`/api/destinos/${this.parada().destino_id}/solicitar-reprogramacion/`, { fecha, motivo: texto.slice(0, MAX_COMENTARIO) })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrado.emit();
        },
        error: (err: unknown) => {
          this.enviando.set(false);
          this.error.set(mensajeError(err));
        },
      });
  }

  enviar(resultado: 'EXITOSO' | 'FALLIDO'): void {
    const raw = this.form.getRawValue();
    if (!this.archivos.length) {
      this.error.set('Sube al menos una foto.');
      return;
    }
    if (resultado === 'FALLIDO' && !raw.motivo_id) {
      this.error.set('Para marcar la entrega como fallida, selecciona un motivo.');
      return;
    }
    if (!raw.hora_inicio_descarga || !raw.hora_fin_descarga) {
      this.error.set('Ingresa la hora de inicio y de fin de la descarga.');
      return;
    }
    if (raw.hora_fin_descarga < raw.hora_inicio_descarga) {
      this.error.set('La hora de fin de descarga no puede ser anterior a la de inicio.');
      return;
    }
    if (resultado === 'FALLIDO' && !confirm('¿Marcar esta entrega como fallida?')) return;
    const datos = new FormData();
    datos.append('resultado', resultado);
    datos.append('observacion', raw.observacion.trim());
    if (resultado === 'FALLIDO') datos.append('motivo_id', raw.motivo_id);
    datos.append('hora_inicio_descarga', raw.hora_inicio_descarga);
    datos.append('hora_fin_descarga', raw.hora_fin_descarga);
    for (const archivo of this.archivos) datos.append('fotos', archivo);
    this.enviando.set(true);
    this.error.set('');
    this.api.subir(`/api/destinos/${this.parada().destino_id}/cerrar/`, datos).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrado.emit();
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }
}
