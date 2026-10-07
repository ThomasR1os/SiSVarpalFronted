import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { nombrePersona } from '../../core/texto';

@Component({
  selector: 'app-sin-acceso',
  template: `
    <main class="grid min-h-dvh place-items-center bg-base-200 p-4 sm:p-6">
      <section class="card card-body w-full max-w-lg gap-4 border border-base-300 bg-base-100 shadow-md">
        <img class="h-14 w-auto" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
        <h1 class="text-2xl text-primary">Acceso no habilitado</h1>
        <p>Hola {{ nombre }}. La vista de auxiliar todavía no está disponible. El administrador puede asignarte a una ruta, pero por ahora no puedes entrar a operar.</p>
        <button type="button" class="btn btn-primary" (click)="salir()">Cerrar sesión</button>
      </section>
    </main>
  `,
})
export class SinAcceso {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nombre = nombrePersona(this.auth.usuario());

  salir(): void {
    this.auth.salir().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
