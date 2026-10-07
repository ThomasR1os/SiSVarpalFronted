import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacion',
  template: `
    @if (total() > tamano()) {
      <nav class="paginacion" aria-label="Paginación">
        <p class="text-sm opacity-70">{{ desde() }}–{{ hasta() }} de {{ total() }}</p>
        <div class="join">
          <button type="button" class="btn join-item btn-sm" (click)="paginaChange.emit(pagina() - 1)" [disabled]="pagina() <= 1">
            Anterior
          </button>
          <button
            type="button"
            class="btn join-item btn-sm"
            (click)="paginaChange.emit(pagina() + 1)"
            [disabled]="pagina() * tamano() >= total()"
          >
            Siguiente
          </button>
        </div>
      </nav>
    }
  `,
})
export class Paginacion {
  readonly pagina = input(1);
  readonly tamano = input(20);
  readonly total = input(0);
  readonly paginaChange = output<number>();
  protected readonly desde = computed(() => (this.pagina() - 1) * this.tamano() + 1);
  protected readonly hasta = computed(() => Math.min(this.pagina() * this.tamano(), this.total()));
}
