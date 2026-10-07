import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Cliente, Pagina, Rol, Usuario } from '../../../core/models';
import { TAMANO_CATALOGO, TAMANO_PAGINA, etiquetaRol } from '../../../core/texto';
import { Modal } from '../../../shared/modal';
import { Paginacion } from '../../../shared/paginacion';

@Component({
  selector: 'app-usuarios-panel',
  imports: [ReactiveFormsModule, Modal, Paginacion],
  template: `
    <div class="panel-head">
      <div>
        <h2>Usuarios</h2>
        <p>Desactivar cierra la sesión. El auxiliar se puede crear, pero su ingreso aún no está habilitado.</p>
      </div>
      <div class="btns">
        <button type="button" class="btn btn-primary" (click)="nuevo()">Nuevo usuario</button>
      </div>
    </div>
    <form class="barra-filtros mb-3" (ngSubmit)="buscar()">
      <label class="search flex-1">Buscar<input [value]="busqueda()" (input)="busqueda.set(valor($event))" /></label>
      <label class="control">Rol
        <select [value]="rol()" (change)="rol.set(valor($event))">
          <option value="">Todos</option>
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="CONDUCTOR">Conductor</option>
          <option value="AUXILIAR">Auxiliar</option>
          <option value="CLIENTE">Cliente</option>
        </select>
      </label>
      <button class="btn btn-ghost" type="submit">Buscar</button>
    </form>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    <div class="data-table">
      <table class="table table-zebra table-sm">
        <thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Documento</th><th></th></tr></thead>
        <tbody>
          @for (usuario of usuarios(); track usuario.id) {
            <tr>
              <td data-label="Correo">{{ usuario.email }}</td>
              <td data-label="Nombre">{{ usuario.nombre }} {{ usuario.apellido }}</td>
              <td data-label="Rol">{{ etiquetaRol(usuario.rol) }}</td>
              <td data-label="Documento">{{ usuario.documento }}<div class="ayuda">{{ usuario.is_active ? 'Activo' : 'Inactivo' }}</div></td>
              <td class="acciones" data-label="Acciones">
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-ghost btn-sm" (click)="editar(usuario)">Editar</button>
                  @if (usuario.is_active) {
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="desactivar(usuario)">Desactivar</button>
                  }
                </div>
              </td>
            </tr>
          } @empty { <tr class="fila-vacia"><td colspan="5">No hay usuarios.</td></tr> }
        </tbody>
      </table>
    </div>
    <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="total()" (paginaChange)="ir($event)" />
    @if (abierto()) {
      <app-modal [titulo]="editando() ? 'Editar usuario' : 'Nuevo usuario'" (cerrar)="abierto.set(false)">
        <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="form-grid">
            <label class="control wide">Correo<input type="email" formControlName="email" autocomplete="off" /></label>
            <label class="control">Contraseña<input type="password" formControlName="password" [attr.placeholder]="editando() ? 'Solo si cambia' : ''" /></label>
            <label class="control">Nombre<input formControlName="nombre" /></label>
            <label class="control">Apellido<input formControlName="apellido" /></label>
            <label class="control">Documento<input formControlName="documento" /></label>
            <label class="control">Teléfono<input formControlName="telefono" /></label>
            <label class="control">Rol
              <select formControlName="rol" (change)="alCambiarRol($event)">
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="CONDUCTOR">Conductor</option>
                <option value="AUXILIAR">Auxiliar</option>
                <option value="CLIENTE">Cliente</option>
              </select>
            </label>
            @if (rolSeleccionado() === 'CLIENTE') {
              <label class="control">Cliente
                <select formControlName="cliente_id">
                  <option value="">Elige el RUC</option>
                  @for (cliente of clientes(); track cliente.id) {
                    <option [value]="cliente.id">{{ cliente.ruc }} · {{ cliente.razon_social }}</option>
                  }
                </select>
              </label>
            }
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="is_active" /> Activo</label>
          </div>
          <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar</button>
        </form>
      </app-modal>
    }
  `,
})
export class UsuariosPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly etiquetaRol = etiquetaRol;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly busqueda = signal('');
  protected readonly rol = signal('');
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly rolSeleccionado = signal<Rol>('CONDUCTOR');
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    telefono: [''],
    documento: ['', Validators.required],
    rol: ['CONDUCTOR' as Rol, Validators.required],
    cliente_id: [''],
    is_active: [true],
  });

  constructor() {
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
    });
    this.cargar();
  }

  cargar(): void {
    this.api.get<Pagina<Usuario>>('/api/usuarios/', {
      page: this.pagina(), page_size: this.tamano, search: this.busqueda(), rol: this.rol() || undefined,
    }).subscribe({
      next: (pagina) => { this.usuarios.set(pagina.results); this.total.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  buscar(): void { this.pagina.set(1); this.cargar(); }
  ir(pagina: number): void { this.pagina.set(pagina); this.cargar(); }
  valor(event: Event): string { return (event.target as HTMLInputElement).value; }

  alCambiarRol(event: Event): void {
    this.rolSeleccionado.set((event.target as HTMLSelectElement).value as Rol);
  }

  nuevo(): void {
    this.editando.set(null);
    this.rolSeleccionado.set('CONDUCTOR');
    this.form.reset({ email: '', password: '', nombre: '', apellido: '', telefono: '', documento: '', rol: 'CONDUCTOR', cliente_id: '', is_active: true });
    this.abierto.set(true);
  }

  editar(usuario: Usuario): void {
    this.editando.set(usuario);
    this.rolSeleccionado.set(usuario.rol);
    this.form.patchValue({
      email: usuario.email,
      password: '',
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono,
      documento: usuario.documento,
      rol: usuario.rol,
      cliente_id: usuario.cliente_id ? String(usuario.cliente_id) : '',
      is_active: usuario.is_active,
    });
    this.abierto.set(true);
  }

  guardar(): void {
    const raw = this.form.getRawValue();
    if (!this.editando() && raw.password.length < 8) {
      this.error.set('La contraseña nueva necesita al menos 8 caracteres.');
      return;
    }
    const clienteId = raw.rol === 'CLIENTE' ? Number(raw.cliente_id) : null;
    if (this.form.controls.email.invalid) {
      this.error.set('El correo es obligatorio y es el dato con el que se entra.');
      return;
    }
    if (raw.rol === 'CLIENTE' && !clienteId) {
      this.error.set('Un usuario cliente tiene que pertenecer a un RUC.');
      return;
    }
    const cuerpo: Record<string, unknown> = {
      email: raw.email.trim(),
      nombre: raw.nombre,
      apellido: raw.apellido,
      telefono: raw.telefono,
      documento: raw.documento,
      rol: raw.rol,
      cliente_id: clienteId,
      is_active: raw.is_active,
    };
    if (raw.password) cuerpo['password'] = raw.password;
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Usuario>(`/api/usuarios/${id}/`, cuerpo) : this.api.post<Usuario>('/api/usuarios/', cuerpo);
    req.subscribe({
      next: () => { this.enviando.set(false); this.abierto.set(false); this.error.set(''); this.cargar(); },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  desactivar(usuario: Usuario): void {
    if (!confirm(`¿Desactivar a ${usuario.email}? Se cerrará su sesión.`)) return;
    this.api.delete(`/api/usuarios/${usuario.id}/`).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
