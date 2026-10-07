import { Component, computed, input } from '@angular/core';
import { etiquetaEstado } from '../core/texto';

@Component({
  selector: 'app-badge',
  template: `<span [class]="clase()">{{ texto() }}</span>`,
})
export class Badge {
  readonly estado = input.required<string>();
  protected readonly texto = computed(() => etiquetaEstado(this.estado()));
  protected readonly clase = computed(() => {
    switch (this.estado()) {
      case 'EN_PROCESO':
        return 'badge badge-sm badge-info whitespace-nowrap';
      case 'EXITOSO':
      case 'FINALIZADA':
        return 'badge badge-sm badge-success whitespace-nowrap';
      case 'FALLIDO':
      case 'CANCELADA':
        return 'badge badge-sm badge-error whitespace-nowrap';
      case 'BORRADOR':
        return 'badge badge-sm badge-ghost whitespace-nowrap';
      default:
        return 'badge badge-sm badge-neutral whitespace-nowrap';
    }
  });
}
