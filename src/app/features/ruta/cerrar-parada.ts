import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Motivo, Pagina } from '../../core/models';
import { TAMANO_CATALOGO } from '../../core/texto';

@Component({
  selector: 'app-cerrar-parada',
  imports: [ReactiveFormsModule],
  template: `
    <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="enviar()">
      <strong>Cerrar parada</strong>
      <label class="control">Resultado
        <select formControlName="resultado" (change)="resultado.set(form.controls.resultado.value)">
          <option value="EXITOSO">Exitoso</option>
          <option value="FALLIDO">Fallido</option>
        </select>
      </label>
      @if (resultado() === 'FALLIDO') {
        <label class="control">Motivo
          <select formControlName="motivo_id">
            <option value="">Elige un motivo</option>
            @for (motivo of motivos(); track motivo.id) {
              <option [value]="motivo.id">{{ motivo.descripcion }}</option>
            }
          </select>
        </label>
      }
      <label class="control">Observación
        <textarea formControlName="observacion"></textarea>
      </label>
      <label class="control">Fotos (mínimo 1, máximo 10)
        <input type="file" class="file-input w-full" accept="image/jpeg,image/png,image/webp" capture="environment" multiple (change)="elegirFotos($event)" />
      </label>
      @if (vistas().length) {
        <div class="fotos">
          @for (vista of vistas(); track vista.url) {
            <img [src]="vista.url" [alt]="vista.nombre" />
          }
        </div>
      }
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      <button class="btn btn-primary w-full sm:w-auto" type="submit" [disabled]="enviando()">Guardar cierre</button>
    </form>
  `,
})
export class CerrarParada {
  readonly destinoId = input.required<number>();
  readonly cerrado = output<void>();

  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly motivos = signal<Motivo[]>([]);
  protected readonly resultado = signal<'EXITOSO' | 'FALLIDO'>('EXITOSO');
  protected readonly vistas = signal<{ url: string; nombre: string }[]>([]);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  private archivos: File[] = [];
  protected readonly form = this.fb.nonNullable.group({
    resultado: ['EXITOSO' as 'EXITOSO' | 'FALLIDO', Validators.required],
    motivo_id: [''],
    observacion: [''],
  });

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
    for (const vista of this.vistas()) URL.revokeObjectURL(vista.url);
    const archivos = Array.from((event.target as HTMLInputElement).files ?? []);
    this.archivos = archivos;
    this.vistas.set(archivos.map((archivo) => ({ url: URL.createObjectURL(archivo), nombre: archivo.name })));
  }

  enviar(): void {
    const raw = this.form.getRawValue();
    if (!this.archivos.length) {
      this.error.set('Sube al menos una foto.');
      return;
    }
    if (this.archivos.length > 10) {
      this.error.set('Puedes subir hasta 10 fotos.');
      return;
    }
    if (this.archivos.some((archivo) => !['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type))) {
      this.error.set('Las fotos deben ser JPG, PNG o WEBP.');
      return;
    }
    if (raw.resultado === 'FALLIDO' && !raw.motivo_id) {
      this.error.set('Si la parada falló, el motivo es obligatorio.');
      return;
    }
    const datos = new FormData();
    datos.append('resultado', raw.resultado);
    datos.append('observacion', raw.observacion);
    if (raw.resultado === 'FALLIDO') datos.append('motivo_id', raw.motivo_id);
    for (const archivo of this.archivos) datos.append('fotos', archivo);
    this.enviando.set(true);
    this.error.set('');
    this.api.subir(`/api/destinos/${this.destinoId()}/cerrar/`, datos).subscribe({
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
