import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { AplicaA, Motivo, Pagina } from '../../../core/models';
import { TAMANO_PAGINA } from '../../../core/texto';
import { Modal } from '../../../shared/modal';
import { Paginacion } from '../../../shared/paginacion';

@Component({
  selector: 'app-motivos-panel',
  imports: [ReactiveFormsModule, Modal, Paginacion],
  template: `
    <div class="panel-head">
      <div>
        <h2>Motivos de incumplimiento</h2>
        <p>Se piden solo cuando una parada se cierra como fallida.</p>
      </div>
      <div class="btns">
        <button type="button" class="btn btn-primary" (click)="nuevo()">Nuevo motivo</button>
      </div>
    </div>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    <div class="data-table">
      <table class="table table-zebra table-sm">
        <thead><tr><th>Código</th><th>Descripción</th><th>Aplica a</th><th></th></tr></thead>
        <tbody>
          @for (motivo of motivos(); track motivo.id) {
            <tr>
              <td data-label="Código">{{ motivo.codigo }}</td>
              <td data-label="Descripción">{{ motivo.descripcion }}<div class="ayuda">{{ motivo.activo ? 'Activo' : 'Inactivo' }}</div></td>
              <td data-label="Aplica a">{{ etiqueta(motivo.aplica_a) }}</td>
              <td class="acciones" data-label="Acciones">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editar(motivo)">Editar</button>
                  @if (motivo.activo) {
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="desactivar(motivo)">Desactivar</button>
                  }
                </div>
              </td>
            </tr>
          } @empty { <tr class="fila-vacia"><td colspan="4">No hay motivos.</td></tr> }
        </tbody>
      </table>
    </div>
    <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="total()" (paginaChange)="ir($event)" />
    @if (abierto()) {
      <app-modal [titulo]="editando() ? 'Editar motivo' : 'Nuevo motivo'" (cerrar)="abierto.set(false)">
        <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
          <label class="control">Código<input formControlName="codigo" /></label>
          <label class="control">Descripción<input formControlName="descripcion" /></label>
          <label class="control">Aplica a
            <select formControlName="aplica_a">
              <option value="AMBOS">Ambos</option>
              <option value="NO_LLEGO">No llegó</option>
              <option value="SERVICIO_FALLIDO">Servicio fallido</option>
            </select>
          </label>
          <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="activo" /> Activo</label>
          <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar</button>
        </form>
      </app-modal>
    }
  `,
})
export class MotivosPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly motivos = signal<Motivo[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Motivo | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', Validators.required],
    descripcion: ['', Validators.required],
    aplica_a: ['AMBOS' as AplicaA, Validators.required],
    activo: [true],
  });

  constructor() { this.cargar(); }

  cargar(): void {
    this.api.get<Pagina<Motivo>>('/api/motivos/', { page: this.pagina(), page_size: this.tamano }).subscribe({
      next: (pagina) => { this.motivos.set(pagina.results); this.total.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  ir(pagina: number): void { this.pagina.set(pagina); this.cargar(); }
  etiqueta(valor: AplicaA): string {
    if (valor === 'NO_LLEGO') return 'No llegó';
    if (valor === 'SERVICIO_FALLIDO') return 'Servicio fallido';
    return 'Ambos';
  }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ codigo: '', descripcion: '', aplica_a: 'AMBOS', activo: true });
    this.abierto.set(true);
  }

  editar(motivo: Motivo): void {
    this.editando.set(motivo);
    this.form.patchValue(motivo);
    this.abierto.set(true);
  }

  guardar(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Motivo>(`/api/motivos/${id}/`, raw) : this.api.post<Motivo>('/api/motivos/', raw);
    req.subscribe({
      next: () => { this.enviando.set(false); this.abierto.set(false); this.cargar(); },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  desactivar(motivo: Motivo): void {
    if (!confirm(`¿Desactivar el motivo ${motivo.codigo}?`)) return;
    this.api.delete(`/api/motivos/${motivo.id}/`).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
