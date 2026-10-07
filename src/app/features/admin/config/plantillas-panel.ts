import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Cliente, Pagina, Plantilla } from '../../../core/models';
import { CAMPOS_DESTINO, TAMANO_CATALOGO } from '../../../core/texto';

@Component({
  selector: 'app-plantillas-panel',
  imports: [ReactiveFormsModule],
  template: `
    <div class="panel-head">
      <div>
        <h2>Mapeo de Excel</h2>
        <p>Se configura una sola vez por cliente. Las columnas que no mapees se guardan como dato extra. Si no hay plantilla, el archivo debe usar los nombres canónicos.</p>
      </div>
    </div>
    <label class="control">Cliente
      <select [value]="clienteId()" (change)="elegir($event)">
        <option value="">Elige un cliente</option>
        @for (cliente of clientes(); track cliente.id) {
          <option [value]="cliente.id">{{ cliente.razon_social }}</option>
        }
      </select>
    </label>
    @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
    @if (aviso()) { <div class="alert alert-info">{{ aviso() }}</div> }
    @if (clienteId()) {
      <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="form-grid">
          <label class="control">Nombre del formato<input formControlName="nombre" /></label>
          <label class="label cursor-pointer justify-start gap-2 font-normal"><input type="checkbox" class="checkbox checkbox-sm checkbox-primary" formControlName="activa" /> Activa</label>
        </div>
        <div class="data-table">
          <table class="table table-zebra table-sm">
            <thead><tr><th>Campo de Varpal</th><th>Encabezado en el Excel del cliente</th></tr></thead>
            <tbody>
              @for (campo of campos; track campo.campo) {
                <tr>
                  <td data-label="Campo">{{ campo.etiqueta }}<div class="ayuda">{{ campo.campo }}</div></td>
                  <td data-label="Encabezado"><input class="input input-sm w-full font-normal" [value]="encabezado(campo.campo)" (input)="poner(campo.campo, $event)" [attr.aria-label]="'Encabezado de ' + campo.etiqueta" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar mapeo</button>
      </form>
    }
  `,
})
export class PlantillasPanel {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly campos = CAMPOS_DESTINO;
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly clienteId = signal<number | null>(null);
  protected readonly plantilla = signal<Plantilla | null>(null);
  protected readonly mapeo = signal<Record<string, string>>({});
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['Formato de destinos', Validators.required],
    activa: [true],
  });

  constructor() {
    this.api.get<Pagina<Cliente>>('/api/clientes/', { activo: true, page_size: TAMANO_CATALOGO }).subscribe({
      next: (pagina) => this.clientes.set(pagina.results),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  elegir(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    this.clienteId.set(id || null);
    this.aviso.set('');
    this.error.set('');
    if (!id) return;
    this.api.get<Pagina<Plantilla>>('/api/plantillas/', { cliente: id, tipo: 'DESTINOS', page_size: 20 }).subscribe({
      next: (pagina) => this.aplicar(pagina.results.find((p) => p.activa) ?? pagina.results[0] ?? null),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.aplicar(null);
          return;
        }
        this.error.set(mensajeError(err));
      },
    });
  }

  encabezado(campo: string): string {
    return Object.entries(this.mapeo()).find(([, valor]) => valor === campo)?.[0] ?? '';
  }

  poner(campo: string, event: Event): void {
    const texto = (event.target as HTMLInputElement).value.trim();
    const siguiente: Record<string, string> = {};
    for (const [encabezado, destino] of Object.entries(this.mapeo())) {
      if (destino !== campo) siguiente[encabezado] = destino;
    }
    if (texto) siguiente[texto] = campo;
    this.mapeo.set(siguiente);
  }

  guardar(): void {
    const clienteId = this.clienteId();
    if (!clienteId) return;
    const raw = this.form.getRawValue();
    const cuerpo = {
      cliente_id: clienteId,
      tipo: 'DESTINOS' as const,
      nombre: raw.nombre,
      activa: raw.activa,
      mapeo_columnas: this.mapeo(),
    };
    const id = this.plantilla()?.id;
    this.enviando.set(true);
    const req = id
      ? this.api.patch<Plantilla>(`/api/plantillas/${id}/`, cuerpo)
      : this.api.post<Plantilla>('/api/plantillas/', cuerpo);
    req.subscribe({
      next: (plantilla) => {
        this.enviando.set(false);
        this.aplicar(plantilla);
        this.aviso.set('Mapeo guardado. La próxima importación de este cliente usará esos encabezados.');
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  private aplicar(plantilla: Plantilla | null): void {
    this.plantilla.set(plantilla);
    this.mapeo.set(plantilla ? { ...plantilla.mapeo_columnas } : {});
    this.form.patchValue({
      nombre: plantilla?.nombre || 'Formato de destinos',
      activa: plantilla?.activa ?? true,
    });
  }
}
