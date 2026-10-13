import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ClientesPanel } from './config/clientes-panel';
import { UsuariosPanel } from './config/usuarios-panel';
import { VehiculosPanel } from './config/vehiculos-panel';

@Component({
  selector: 'app-panel-ruta',
  imports: [ClientesPanel, UsuariosPanel, VehiculosPanel],
  template: `
    <section class="card card-body border border-base-300 bg-base-100 shadow-sm">
      @switch (modulo) {
        @case ('clientes') { <app-clientes-panel /> }
        @case ('flota') { <app-vehiculos-panel /> }
        @case ('usuarios') { <app-usuarios-panel /> }
      }
    </section>
  `,
})
export class PanelRuta {
  private readonly route = inject(ActivatedRoute);
  protected modulo = '';

  constructor() {
    this.route.data.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.modulo = String(data['modulo'] ?? '');
    });
  }
}

@Component({
  selector: 'app-seccion-pendiente',
  template: `
    <p class="vacio-texto">Esta sección se está preparando.</p>
  `,
})
export class SeccionPendiente {}
