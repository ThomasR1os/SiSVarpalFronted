import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-paginacion',
  template: `
    @if (total() > 0) {
      <nav class="paginacion" aria-label="Paginación">
        <p class="text-sm opacity-70">Mostrando {{ desde() }}–{{ hasta() }} de {{ total() }}</p>
        @if (totalPaginas() > 1) {
          <div class="flex flex-wrap items-center gap-1">
            <button type="button" class="btn btn-sm" (click)="paginaChange.emit(pagina() - 1)" [disabled]="pagina() <= 1">Anterior</button>
            @for (numero of numeros(); track numero) {
              <button type="button" class="btn btn-sm min-w-9" [class.btn-primary]="numero === pagina()" (click)="paginaChange.emit(numero)">
                {{ numero }}
              </button>
            }
            <button type="button" class="btn btn-sm" (click)="paginaChange.emit(pagina() + 1)" [disabled]="pagina() >= totalPaginas()">
              Siguiente
            </button>
          </div>
        }
      </nav>
    }
  `,
})
export class Paginacion {
  readonly pagina = input(1);
  readonly tamano = input(20);
  readonly total = input(0);
  readonly paginaChange = output<number>();
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * this.tamano() + 1));
  protected readonly hasta = computed(() => Math.min(this.pagina() * this.tamano(), this.total()));
  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.tamano())));
  protected readonly numeros = computed(() => {
    const total = this.totalPaginas();
    const actual = this.pagina();
    if (total <= 7) return lista(1, total);
    const fin = Math.min(total, Math.max(actual + 2, 5));
    const inicio = Math.max(1, fin - 4);
    return lista(inicio, Math.min(total, inicio + 4));
  });
}

function lista(desde: number, hasta: number): number[] {
  const numeros: number[] = [];
  for (let i = desde; i <= hasta; i += 1) numeros.push(i);
  return numeros;
}
