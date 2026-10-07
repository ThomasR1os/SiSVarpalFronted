import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Cliente, Pagina } from '../../../core/models';
import { Modal } from '../../../shared/modal';
import { Paginacion } from '../../../shared/paginacion';
import { TAMANO_PAGINA, textoCoordenada } from '../../../core/texto';

@Component({
  selector: 'app-clientes-panel',
  imports: [ReactiveFormsModule, Modal, Paginacion],
  template: `
    <div class="panel-head">
      <div>
        <h2>Clientes</h2>
        <p>La dirección principal queda como base de origen por defecto.</p>
      </div>
      <div class="btns">
        <button type="button" class="btn btn-primary" (click)="nuevo()">Nuevo cliente</button>
      </div>
    </div>
    <form class="barra-filtros mb-3" (ngSubmit)="buscar()">
      <label class="search flex-1">Buscar<input name="q" [value]="busqueda()" (input)="busqueda.set(leer($event))" /></label>
      <button class="btn btn-ghost" type="submit">Buscar</button>
    </form>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    <div class="data-table">
      <table class="table table-zebra table-sm">
        <thead><tr><th>RUC</th><th>Cliente</th><th>Dirección</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (cliente of clientes(); track cliente.id) {
            <tr>
              <td data-label="RUC">{{ cliente.ruc }}</td>
              <td data-label="Cliente">{{ cliente.razon_social }}<div class="ayuda">{{ cliente.nombre_comercial }}</div></td>
              <td data-label="Dirección">{{ cliente.direccion_principal }}<div class="ayuda">{{ cliente.distrito }}</div></td>
              <td data-label="Estado">{{ cliente.activo ? 'Activo' : 'Inactivo' }}</td>
              <td class="acciones" data-label="Acciones">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editar(cliente)">Editar</button>
                  @if (cliente.activo) {
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="desactivar(cliente)">Desactivar</button>
                  }
                </div>
              </td>
            </tr>
          } @empty { <tr class="fila-vacia"><td colspan="5">No hay clientes.</td></tr> }
        </tbody>
      </table>
    </div>
    <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="total()" (paginaChange)="ir($event)" />
    @if (abierto()) {
      <app-modal [titulo]="editando() ? 'Editar cliente' : 'Nuevo cliente'" (cerrar)="abierto.set(false)">
        <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
          @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
          <div class="form-grid">
            <label class="control">RUC<input formControlName="ruc" maxlength="11" /></label>
            <label class="control">Razón social<input formControlName="razon_social" /></label>
            <label class="control">Nombre comercial<input formControlName="nombre_comercial" /></label>
            <label class="control">Teléfono<input formControlName="telefono" /></label>
            <label class="control wide">Correo<input formControlName="email" /></label>
            <label class="control wide">Dirección principal<input formControlName="direccion_principal" /></label>
            <label class="control">Distrito<input formControlName="distrito" /></label>
            <label class="control">Latitud<input formControlName="latitud" /></label>
            <label class="control">Longitud<input formControlName="longitud" /></label>
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="activo" /> Activo</label>
          </div>
          <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar</button>
        </form>
      </app-modal>
    }
  `,
})
export class ClientesPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly busqueda = signal('');
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Cliente | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    razon_social: ['', Validators.required],
    nombre_comercial: [''],
    telefono: [''],
    email: [''],
    direccion_principal: ['', Validators.required],
    distrito: ['', Validators.required],
    latitud: ['', Validators.required],
    longitud: ['', Validators.required],
    activo: [true],
  });

  constructor() { this.cargar(); }

  cargar(): void {
    this.api.get<Pagina<Cliente>>('/api/clientes/', {
      page: this.pagina(), search: this.busqueda(), page_size: this.tamano,
    }).subscribe({
      next: (pagina) => { this.clientes.set(pagina.results); this.total.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  buscar(): void { this.pagina.set(1); this.cargar(); }
  ir(pagina: number): void { this.pagina.set(pagina); this.cargar(); }
  leer(event: Event): string { return (event.target as HTMLInputElement).value; }

  nuevo(): void {
    this.editando.set(null);
    this.form.reset({ ruc: '', razon_social: '', nombre_comercial: '', telefono: '', email: '', direccion_principal: '', distrito: '', latitud: '', longitud: '', activo: true });
    this.abierto.set(true);
  }

  editar(cliente: Cliente): void {
    this.editando.set(cliente);
    this.form.patchValue({
      ruc: cliente.ruc,
      razon_social: cliente.razon_social,
      nombre_comercial: cliente.nombre_comercial,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion_principal: cliente.direccion_principal,
      distrito: cliente.distrito,
      latitud: cliente.latitud,
      longitud: cliente.longitud,
      activo: cliente.activo,
    });
    this.abierto.set(true);
  }

  guardar(): void {
    const raw = this.form.getRawValue();
    const latitud = textoCoordenada(raw.latitud);
    const longitud = textoCoordenada(raw.longitud);
    if (this.form.invalid || latitud == null || longitud == null) {
      this.error.set('El RUC, la dirección y las coordenadas son obligatorios. Las coordenadas se envían como texto.');
      return;
    }
    const cuerpo = { ...raw, latitud, longitud };
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Cliente>(`/api/clientes/${id}/`, cuerpo) : this.api.post<Cliente>('/api/clientes/', cuerpo);
    req.subscribe({
      next: () => { this.enviando.set(false); this.abierto.set(false); this.error.set(''); this.cargar(); },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  desactivar(cliente: Cliente): void {
    if (!confirm(`¿Desactivar a ${cliente.razon_social}?`)) return;
    this.api.delete(`/api/clientes/${cliente.id}/`).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
