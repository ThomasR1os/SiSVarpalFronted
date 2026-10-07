import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Pagina, Vehiculo } from '../../../core/models';
import { TAMANO_PAGINA, numero } from '../../../core/texto';
import { Modal } from '../../../shared/modal';
import { Paginacion } from '../../../shared/paginacion';

@Component({
  selector: 'app-vehiculos-panel',
  imports: [ReactiveFormsModule, Modal, Paginacion],
  template: `
    <div class="panel-head">
      <div>
        <h2>Vehículos</h2>
        <p>La placa se guarda en mayúsculas. Desactivar no borra el historial.</p>
      </div>
      <div class="btns">
        <button type="button" class="btn btn-primary" (click)="nuevo()">Nuevo vehículo</button>
      </div>
    </div>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    <div class="data-table">
      <table class="table table-zebra table-sm">
        <thead><tr><th>Placa</th><th>Vehículo</th><th>Tipo</th><th>Capacidad</th><th></th></tr></thead>
        <tbody>
          @for (vehiculo of vehiculos(); track vehiculo.id) {
            <tr>
              <td data-label="Placa">{{ vehiculo.placa }}</td>
              <td data-label="Vehículo">{{ vehiculo.marca }} {{ vehiculo.modelo }}</td>
              <td data-label="Tipo">{{ vehiculo.tipo }}</td>
              <td data-label="Capacidad">{{ vehiculo.capacidad_kg }} kg<div class="ayuda">{{ vehiculo.activo ? 'Activo' : 'Inactivo' }}</div></td>
              <td class="acciones" data-label="Acciones">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editar(vehiculo)">Editar</button>
                  @if (vehiculo.activo) {
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="desactivar(vehiculo)">Desactivar</button>
                  }
                </div>
              </td>
            </tr>
          } @empty { <tr class="fila-vacia"><td colspan="5">No hay vehículos.</td></tr> }
        </tbody>
      </table>
    </div>
    <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="total()" (paginaChange)="ir($event)" />
    @if (abierto()) {
      <app-modal [titulo]="editando() ? 'Editar vehículo' : 'Nuevo vehículo'" (cerrar)="abierto.set(false)">
        <form class="form-grid" [formGroup]="form" (ngSubmit)="guardar()">
          <label class="control">Placa<input formControlName="placa" /></label>
          <label class="control">Marca<input formControlName="marca" /></label>
          <label class="control">Modelo<input formControlName="modelo" /></label>
          <label class="control">Tipo<input formControlName="tipo" /></label>
          <label class="control">Capacidad (kg)<input formControlName="capacidad_kg" /></label>
          <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="activo" /> Activo</label>
          <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar</button>
        </form>
      </app-modal>
    }
  `,
})
export class VehiculosPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Vehiculo | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    placa: ['', Validators.required],
    marca: ['', Validators.required],
    modelo: [''],
    tipo: [''],
    capacidad_kg: ['', Validators.required],
    activo: [true],
  });

  constructor() { this.cargar(); }

  cargar(): void {
    this.api.get<Pagina<Vehiculo>>('/api/vehiculos/', { page: this.pagina(), page_size: this.tamano }).subscribe({
      next: (pagina) => { this.vehiculos.set(pagina.results); this.total.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  ir(pagina: number): void { this.pagina.set(pagina); this.cargar(); }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ placa: '', marca: '', modelo: '', tipo: '', capacidad_kg: '', activo: true });
    this.abierto.set(true);
  }

  editar(vehiculo: Vehiculo): void {
    this.editando.set(vehiculo);
    this.form.patchValue({ ...vehiculo, capacidad_kg: String(vehiculo.capacidad_kg) });
    this.abierto.set(true);
  }

  guardar(): void {
    const raw = this.form.getRawValue();
    const capacidad = numero(raw.capacidad_kg);
    if (this.form.invalid || capacidad == null) {
      this.error.set('Indica placa, marca y capacidad.');
      return;
    }
    const cuerpo = { ...raw, capacidad_kg: capacidad };
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Vehiculo>(`/api/vehiculos/${id}/`, cuerpo) : this.api.post<Vehiculo>('/api/vehiculos/', cuerpo);
    req.subscribe({
      next: () => { this.enviando.set(false); this.abierto.set(false); this.error.set(''); this.cargar(); },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  desactivar(vehiculo: Vehiculo): void {
    if (!confirm(`¿Desactivar la placa ${vehiculo.placa}?`)) return;
    this.api.delete(`/api/vehiculos/${vehiculo.id}/`).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
