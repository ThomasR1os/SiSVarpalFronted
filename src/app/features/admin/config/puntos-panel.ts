import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Cliente, Pagina, Punto } from '../../../core/models';
import { TAMANO_CATALOGO, TAMANO_PAGINA, numero, textoCoordenada } from '../../../core/texto';
import { Modal } from '../../../shared/modal';
import { Paginacion } from '../../../shared/paginacion';

@Component({
  selector: 'app-puntos-panel',
  imports: [ReactiveFormsModule, Modal, Paginacion],
  template: `
    <div class="panel-head">
      <div>
        <h2>Sedes y bases</h2>
        <p>La dirección principal no se edita aquí. Una sede puede ser destino de un traslado.</p>
      </div>
      <div class="btns">
        <button type="button" class="btn btn-primary" (click)="nuevo()">Nuevo punto</button>
      </div>
    </div>
    <div class="barra-filtros mb-3">
      <label class="control">Cliente
        <select [value]="clienteFiltro()" (change)="filtrar($event)">
          <option value="">Todos</option>
          <option value="varpal">Bases de Varpal</option>
          @for (cliente of clientes(); track cliente.id) {
            <option [value]="cliente.id">{{ cliente.razon_social }}</option>
          }
        </select>
      </label>
    </div>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    <div class="data-table">
      <table class="table table-zebra table-sm">
        <thead><tr><th>Código</th><th>Nombre</th><th>Dirección</th><th>Uso</th><th></th></tr></thead>
        <tbody>
          @for (punto of puntos(); track punto.id) {
            <tr>
              <td data-label="Código">{{ punto.codigo }}</td>
              <td data-label="Nombre">{{ punto.nombre }}</td>
              <td data-label="Dirección">{{ punto.direccion }}<div class="ayuda">{{ punto.distrito }}</div></td>
              <td data-label="Uso">{{ usos(punto) }}</td>
              <td class="acciones" data-label="Acciones">
                <div class="flex flex-wrap gap-2">
                  @if (!punto.es_principal) {
                    <button type="button" class="btn btn-ghost btn-sm" (click)="editar(punto)">Editar</button>
                    <button type="button" class="btn btn-error btn-outline btn-sm" (click)="eliminar(punto)">Desactivar</button>
                  } @else {
                    <span class="ayuda">Principal</span>
                  }
                </div>
              </td>
            </tr>
          } @empty { <tr class="fila-vacia"><td colspan="5">No hay puntos.</td></tr> }
        </tbody>
      </table>
    </div>
    <app-paginacion [pagina]="pagina()" [tamano]="tamano" [total]="total()" (paginaChange)="ir($event)" />
    @if (abierto()) {
      <app-modal [titulo]="editando() ? 'Editar punto' : 'Nuevo punto'" (cerrar)="abierto.set(false)">
        <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
          <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="deVarpal" (change)="baseVarpal.set(($any($event.target)).checked)" /> Base de Varpal, sin cliente</label>
          @if (!baseVarpal()) {
            <label class="control">Cliente
              <select formControlName="cliente_id">
                <option value="">Elige un cliente</option>
                @for (cliente of clientes(); track cliente.id) {
                  <option [value]="cliente.id">{{ cliente.razon_social }}</option>
                }
              </select>
            </label>
          }
          <div class="form-grid">
            <label class="control">Código<input formControlName="codigo" /></label>
            <label class="control">Nombre<input formControlName="nombre" /></label>
            <label class="control wide">Dirección<input formControlName="direccion" /></label>
            <label class="control">Distrito<input formControlName="distrito" /></label>
            <label class="control">Latitud<input formControlName="latitud" /></label>
            <label class="control">Longitud<input formControlName="longitud" /></label>
          </div>
          <div class="flex flex-wrap gap-3">
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="es_sede" /> Sede (destino de traslado)</label>
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="es_base_origen" /> Base de origen</label>
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="es_base_final" /> Base final</label>
            <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="activo" /> Activo</label>
          </div>
          <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar</button>
        </form>
      </app-modal>
    }
  `,
})
export class PuntosPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly tamano = TAMANO_PAGINA;
  protected readonly puntos = signal<Punto[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly clienteFiltro = signal('');
  protected readonly abierto = signal(false);
  protected readonly editando = signal<Punto | null>(null);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly baseVarpal = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    deVarpal: [false],
    cliente_id: [''],
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    direccion: ['', Validators.required],
    distrito: ['', Validators.required],
    latitud: ['', Validators.required],
    longitud: ['', Validators.required],
    es_sede: [true],
    es_base_origen: [false],
    es_base_final: [false],
    activo: [true],
  });

  constructor() {
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
    });
    this.cargar();
  }

  cargar(): void {
    const filtro = this.clienteFiltro();
    this.api.get<Pagina<Punto>>('/api/puntos/', {
      page: this.pagina(),
      page_size: this.tamano,
      cliente: filtro !== '' && filtro !== 'varpal' ? Number(filtro) : undefined,
      de_varpal: filtro === 'varpal' ? true : undefined,
    }).subscribe({
      next: (pagina) => { this.puntos.set(pagina.results); this.total.set(pagina.count); },
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  filtrar(event: Event): void {
    this.clienteFiltro.set((event.target as HTMLSelectElement).value);
    this.pagina.set(1);
    this.cargar();
  }

  ir(pagina: number): void { this.pagina.set(pagina); this.cargar(); }

  usos(punto: Punto): string {
    const partes = [
      punto.es_principal ? 'Principal' : '',
      punto.es_sede ? 'Sede' : '',
      punto.es_base_origen ? 'Origen' : '',
      punto.es_base_final ? 'Final' : '',
    ].filter(Boolean);
    return partes.join(' · ') || 'Punto';
  }

  nuevo(): void {
    this.editando.set(null);
    this.baseVarpal.set(false);
    this.form.reset({
      deVarpal: false, cliente_id: '', codigo: '', nombre: '', direccion: '', distrito: '',
      latitud: '', longitud: '', es_sede: true, es_base_origen: false, es_base_final: false, activo: true,
    });
    this.abierto.set(true);
  }

  editar(punto: Punto): void {
    this.editando.set(punto);
    this.baseVarpal.set(punto.cliente_id == null);
    this.form.patchValue({
      deVarpal: punto.cliente_id == null,
      cliente_id: punto.cliente_id ? String(punto.cliente_id) : '',
      codigo: punto.codigo,
      nombre: punto.nombre,
      direccion: punto.direccion,
      distrito: punto.distrito,
      latitud: punto.latitud,
      longitud: punto.longitud,
      es_sede: punto.es_sede,
      es_base_origen: punto.es_base_origen,
      es_base_final: punto.es_base_final,
      activo: punto.activo,
    });
    this.abierto.set(true);
  }

  guardar(): void {
    const raw = this.form.getRawValue();
    const latitud = textoCoordenada(raw.latitud);
    const longitud = textoCoordenada(raw.longitud);
    if (latitud == null || longitud == null || this.form.invalid) {
      this.error.set('Completa el punto con coordenadas en texto. Pueden tener menos de 14 decimales.');
      return;
    }
    const clienteId = raw.deVarpal ? null : numero(raw.cliente_id);
    if (!raw.deVarpal && !clienteId) {
      this.error.set('Elige el cliente o márcalo como base de Varpal.');
      return;
    }
    const cuerpo = {
      cliente_id: clienteId,
      codigo: raw.codigo,
      nombre: raw.nombre,
      direccion: raw.direccion,
      distrito: raw.distrito,
      latitud,
      longitud,
      es_sede: raw.es_sede,
      es_base_origen: raw.es_base_origen,
      es_base_final: raw.deVarpal ? true : raw.es_base_final,
      activo: raw.activo,
    };
    const id = this.editando()?.id;
    this.enviando.set(true);
    const req = id ? this.api.patch<Punto>(`/api/puntos/${id}/`, cuerpo) : this.api.post<Punto>('/api/puntos/', cuerpo);
    req.subscribe({
      next: () => { this.enviando.set(false); this.abierto.set(false); this.error.set(''); this.cargar(); },
      error: (err: unknown) => { this.enviando.set(false); this.error.set(mensajeError(err)); },
    });
  }

  eliminar(punto: Punto): void {
    if (!confirm(`¿Desactivar ${punto.nombre}?`)) return;
    this.api.delete(`/api/puntos/${punto.id}/`).subscribe({
      next: () => this.cargar(),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }
}
