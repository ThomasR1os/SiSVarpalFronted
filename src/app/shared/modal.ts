import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" (click)="cerrar.emit()">
      <div class="modal-box max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-b-none p-4 sm:w-11/12 sm:rounded-box sm:p-6" (click)="$event.stopPropagation()">
        <div class="mb-4 flex items-start justify-between gap-3">
          <h2 class="min-w-0 text-xl">{{ titulo() }}</h2>
          <button type="button" class="btn btn-circle btn-ghost btn-sm shrink-0" (click)="cerrar.emit()" aria-label="Cerrar">✕</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class Modal {
  readonly titulo = input('');
  readonly cerrar = output<void>();
}
