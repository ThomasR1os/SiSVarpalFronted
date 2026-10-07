import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../../../core/api';
import { mensajeError } from '../../../core/api-error';
import { Empresa } from '../../../core/models';
import { textoCoordenada } from '../../../core/texto';

@Component({
  selector: 'app-empresa-form',
  imports: [ReactiveFormsModule],
  template: `
    <form class="flex flex-col gap-4" [formGroup]="form" (ngSubmit)="guardar()">
      <div class="panel-head">
        <div>
          <h2>Empresa</h2>
          <p>La dirección principal de Varpal es la base final por defecto de las rutas.</p>
        </div>
      </div>
      @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
      @if (aviso()) { <div class="alert alert-info">{{ aviso() }}</div> }
      <div class="form-grid">
        <label class="control">RUC<input formControlName="ruc" maxlength="11" /></label>
        <label class="control">Razón social<input formControlName="razon_social" /></label>
        <label class="control">Teléfono<input formControlName="telefono" /></label>
        <label class="control">Correo<input formControlName="email" /></label>
        <label class="control wide">Dirección principal<input formControlName="direccion_principal" /></label>
        <label class="control">Distrito<input formControlName="distrito" /></label>
        <label class="control">Latitud<input formControlName="latitud" inputmode="decimal" /></label>
        <label class="control">Longitud<input formControlName="longitud" inputmode="decimal" /></label>
      </div>
      <button class="btn btn-primary" type="submit" [disabled]="enviando()">Guardar dirección de Varpal</button>
    </form>
  `,
})
export class EmpresaForm {
  private readonly api = inject(Api);
  private readonly fb = inject(FormBuilder);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    razon_social: ['', Validators.required],
    telefono: [''],
    email: [''],
    direccion_principal: ['', Validators.required],
    distrito: ['', Validators.required],
    latitud: ['', Validators.required],
    longitud: ['', Validators.required],
  });

  constructor() {
    this.api.get<Empresa>('/api/empresa/').subscribe({
      next: (empresa) => this.form.patchValue({
        ruc: empresa.ruc,
        razon_social: empresa.razon_social,
        telefono: empresa.telefono,
        email: empresa.email,
        direccion_principal: empresa.direccion_principal,
        distrito: empresa.distrito,
        latitud: empresa.latitud,
        longitud: empresa.longitud,
      }),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) return;
        this.error.set(mensajeError(err));
      },
    });
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa el RUC, la razón social y la dirección con coordenadas.');
      return;
    }
    const raw = this.form.getRawValue();
    const latitud = textoCoordenada(raw.latitud);
    const longitud = textoCoordenada(raw.longitud);
    if (latitud == null || longitud == null) {
      this.error.set('Latitud y longitud son obligatorias. Escríbelas con punto decimal; se guardan hasta 14 decimales.');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    this.api.patch<Empresa>('/api/empresa/', { ...raw, latitud, longitud }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.aviso.set('Dirección de Varpal guardada. Quedó como base final por defecto.');
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }
}
