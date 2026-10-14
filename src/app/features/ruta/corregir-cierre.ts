import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Destino, Evidencia, Motivo, Pagina, Parada } from '../../core/models';
import { TAMANO_CATALOGO } from '../../core/texto';
import { Modal } from '../../shared/modal';

const MAX_FOTOS = 10;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-corregir-cierre',
  imports: [ReactiveFormsModule, Modal],
  template: `
    <app-modal titulo="Corregir cierre" (cerrar)="cancelar()">
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="alert alert-warning">
          El conductor marcó esta parada como {{ parada().estado === 'FALLIDO' ? 'fallida' : 'exitosa' }}.
          Aquí puedes cambiar el estado y las fotos si la revisión del administrador no coincide con ese cierre.
        </div>
        <p><strong>{{ parada().codigo_externo }}</strong> · {{ parada().direccion }}</p>

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">Estado</span>
          <select class="select w-full" formControlName="resultado">
            <option value="EXITOSO">Exitoso</option>
            <option value="FALLIDO">Fallido</option>
          </select>
        </label>

        @if (form.controls.resultado.value === 'FALLIDO') {
          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold">Motivo</span>
            <select class="select w-full" formControlName="motivo_id">
              <option value="">Seleccionar motivo</option>
              @for (motivo of motivos(); track motivo.id) {
                <option [value]="motivo.id">{{ motivo.descripcion }}</option>
              }
            </select>
          </label>
        }

        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold">Comentario del cierre</span>
          <textarea class="textarea min-h-24 w-full" formControlName="observacion" maxlength="500"></textarea>
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-semibold">Evidencias · {{ totalFotos() }}/{{ maxFotos }}</span>
          @if (cargando()) {
            <p class="ayuda">Cargando fotos…</p>
          } @else if (!fotosActuales().length && !vistas().length) {
            <p class="ayuda">Esta parada no tiene fotos. Agrega al menos una.</p>
          }
          <div class="fotos">
            @for (foto of fotosActuales(); track foto.id) {
              <div class="relative">
                <a [href]="foto.archivo" target="_blank" rel="noopener">
                  <img [src]="foto.archivo" alt="Evidencia" [class.opacity-40]="quitadas().has(foto.id)" />
                </a>
                @if (quitadas().has(foto.id)) {
                  <button type="button" class="btn btn-xs mt-1" (click)="restaurar(foto.id)">Conservar</button>
                } @else {
                  <button type="button" class="btn btn-error btn-outline btn-xs mt-1" (click)="marcarQuitar(foto.id)">Quitar</button>
                }
              </div>
            }
            @for (vista of vistas(); track vista.url; let i = $index) {
              <div class="relative">
                <img [src]="vista.url" [alt]="vista.nombre" />
                <button type="button" class="btn btn-error btn-outline btn-xs mt-1" (click)="quitarNueva(i)">Quitar</button>
              </div>
            }
          </div>
          @if (totalFotos() < maxFotos) {
            <label class="btn btn-outline btn-sm w-fit">
              Agregar fotos
              <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp" multiple (change)="elegirFotos($event)" />
            </label>
          }
        </div>

        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        <button type="submit" class="btn btn-primary" [disabled]="enviando() || cargando()">Guardar corrección</button>
      </form>
    </app-modal>
  `,
})
export class CorregirCierre implements OnInit {
  readonly parada = input.required<Parada>();
  readonly corregida = output<number>();
  readonly cancelada = output<void>();

  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly maxFotos = MAX_FOTOS;
  protected readonly motivos = signal<Motivo[]>([]);
  protected readonly fotosActuales = signal<Evidencia[]>([]);
  protected readonly quitadas = signal<Set<number>>(new Set());
  protected readonly vistas = signal<{ url: string; nombre: string }[]>([]);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  private archivos: File[] = [];
  protected readonly form = this.fb.nonNullable.group({
    resultado: ['EXITOSO'],
    motivo_id: [''],
    observacion: [''],
  });
  protected readonly totalFotos = computed(
    () => this.fotosActuales().filter((foto) => !this.quitadas().has(foto.id)).length + this.vistas().length,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const vista of this.vistas()) URL.revokeObjectURL(vista.url);
    });
  }

  ngOnInit(): void {
    const destinoId = this.parada().destino_id;
    this.api.get<Pagina<Motivo>>('/api/motivos/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.motivos.set(pagina.results),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
    this.api.get<Destino>(`/api/destinos/${destinoId}/`).subscribe({
      next: (destino) => {
        this.form.patchValue({
          resultado: destino.estado === 'FALLIDO' ? 'FALLIDO' : 'EXITOSO',
          motivo_id: destino.motivo_id ? String(destino.motivo_id) : '',
          observacion: destino.observacion_cierre ?? '',
        });
      },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
    this.api.get<Evidencia[]>(`/api/destinos/${destinoId}/evidencias/`).subscribe({
      next: (fotos) => {
        this.fotosActuales.set(fotos);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  marcarQuitar(id: number): void {
    const siguiente = new Set(this.quitadas());
    siguiente.add(id);
    this.quitadas.set(siguiente);
  }

  restaurar(id: number): void {
    const siguiente = new Set(this.quitadas());
    siguiente.delete(id);
    this.quitadas.set(siguiente);
  }

  elegirFotos(event: Event): void {
    const campo = event.target as HTMLInputElement;
    const nuevos = Array.from(campo.files ?? []);
    campo.value = '';
    if (nuevos.some((archivo) => !TIPOS_FOTO.includes(archivo.type))) {
      this.error.set('Las fotos deben ser JPG, PNG o WEBP.');
      return;
    }
    const libres = MAX_FOTOS - this.totalFotos();
    if (nuevos.length > libres) {
      this.error.set(`Puedes dejar hasta ${MAX_FOTOS} fotos.`);
      return;
    }
    this.error.set('');
    this.archivos = [...this.archivos, ...nuevos];
    this.vistas.update((actual) => [
      ...actual,
      ...nuevos.map((archivo) => ({ url: URL.createObjectURL(archivo), nombre: archivo.name })),
    ]);
  }

  quitarNueva(indice: number): void {
    const vista = this.vistas()[indice];
    if (vista) URL.revokeObjectURL(vista.url);
    this.vistas.update((actual) => actual.filter((_, i) => i !== indice));
    this.archivos = this.archivos.filter((_, i) => i !== indice);
  }

  cancelar(): void {
    this.cancelada.emit();
  }

  guardar(): void {
    const resultado = this.form.controls.resultado.value;
    const motivoId = this.form.controls.motivo_id.value;
    if (resultado === 'FALLIDO' && !motivoId) {
      this.error.set('Selecciona un motivo para el cierre fallido.');
      return;
    }
    if (this.totalFotos() < 1) {
      this.error.set('Debe quedar al menos una evidencia.');
      return;
    }
    const datos = new FormData();
    datos.append('resultado', resultado);
    datos.append('observacion', this.form.controls.observacion.value);
    if (resultado === 'FALLIDO') datos.append('motivo_id', motivoId);
    for (const id of this.quitadas()) datos.append('eliminar', String(id));
    for (const archivo of this.archivos) datos.append('fotos', archivo);
    this.enviando.set(true);
    this.error.set('');
    this.api.subir<Destino>(`/api/destinos/${this.parada().destino_id}/corregir/`, datos).subscribe({
      next: () => {
        this.enviando.set(false);
        this.corregida.emit(this.parada().destino_id);
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }
}
