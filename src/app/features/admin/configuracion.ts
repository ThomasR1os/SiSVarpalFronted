import { Component, signal } from '@angular/core';
import { ClientesPanel } from './config/clientes-panel';
import { EmpresaForm } from './config/empresa-form';
import { MotivosPanel } from './config/motivos-panel';
import { PlantillasPanel } from './config/plantillas-panel';
import { PuntosPanel } from './config/puntos-panel';
import { UsuariosPanel } from './config/usuarios-panel';
import { VehiculosPanel } from './config/vehiculos-panel';

type Pestana = 'empresa' | 'clientes' | 'puntos' | 'usuarios' | 'vehiculos' | 'motivos' | 'plantillas';

@Component({
  selector: 'app-configuracion',
  imports: [EmpresaForm, ClientesPanel, PuntosPanel, UsuariosPanel, VehiculosPanel, MotivosPanel, PlantillasPanel],
  template: `
    <div class="-mx-1 mb-4 overflow-x-auto px-1 pb-1">
      <div role="tablist" class="tabs tabs-box w-max min-w-full flex-nowrap">
        @for (item of pestanas; track item.id) {
          <button type="button" role="tab" class="tab shrink-0" [class.tab-active]="tab() === item.id" [attr.aria-selected]="tab() === item.id" (click)="tab.set(item.id)">{{ item.nombre }}</button>
        }
      </div>
    </div>
    <section class="card card-body bg-base-100 border border-base-300 shadow-sm">
      @switch (tab()) {
        @case ('empresa') { <app-empresa-form /> }
        @case ('clientes') { <app-clientes-panel /> }
        @case ('puntos') { <app-puntos-panel /> }
        @case ('usuarios') { <app-usuarios-panel /> }
        @case ('vehiculos') { <app-vehiculos-panel /> }
        @case ('motivos') { <app-motivos-panel /> }
        @case ('plantillas') { <app-plantillas-panel /> }
      }
    </section>
  `,
})
export class Configuracion {
  protected readonly tab = signal<Pestana>('empresa');
  protected readonly pestanas: { id: Pestana; nombre: string }[] = [
    { id: 'empresa', nombre: 'Empresa' },
    { id: 'clientes', nombre: 'Clientes' },
    { id: 'puntos', nombre: 'Sedes y bases' },
    { id: 'usuarios', nombre: 'Usuarios' },
    { id: 'vehiculos', nombre: 'Vehículos' },
    { id: 'motivos', nombre: 'Motivos' },
    { id: 'plantillas', nombre: 'Excel' },
  ];
}
