import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { rutaPorRol } from '../../core/texto';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <section class="grid min-h-dvh w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
      <div class="login-marca flex min-w-0 flex-col justify-between gap-6 overflow-hidden px-5 py-8 text-neutral-content sm:px-8 lg:px-16 lg:py-14">
        <img class="block h-auto w-44 max-w-full sm:w-64 lg:w-full lg:max-w-lg" src="logo-varpal.png" alt="Varpal Soluciones Logísticas" />
        <div class="max-w-md">
          <p class="text-sm leading-relaxed text-neutral-content/80 lg:hidden">Operación, recorrido y seguimiento de entregas.</p>
          <p class="hidden text-lg leading-relaxed text-neutral-content/85 lg:block">
            Rutas de entrega en Lima. El administrador arma el día, el conductor lo recorre y el cliente sigue sus paradas.
          </p>
        </div>
      </div>
      <form class="mx-auto flex w-full min-w-0 max-w-md flex-col justify-center gap-4 bg-base-100 px-5 py-8 sm:px-8 lg:px-10 lg:py-12" [formGroup]="form" (ngSubmit)="entrar()">
        <div>
          <h1 class="text-primary">Entrar</h1>
          <p class="mt-2 text-base-content/70">Una sola sesión por usuario. Si entras en otro dispositivo, esta se cierra.</p>
        </div>
        @if (error()) {
          <div role="alert" class="alert alert-error text-sm">{{ error() }}</div>
        }
        <label class="fieldset">
          <span class="fieldset-legend">Correo</span>
          <input class="input input-lg w-full" type="email" formControlName="email" autocomplete="username" inputmode="email" />
        </label>
        <label class="fieldset">
          <span class="fieldset-legend">Contraseña</span>
          <div class="join w-full">
            <input class="input input-lg join-item w-full" [type]="verClave() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
            <button class="btn btn-lg join-item" type="button" (click)="verClave.set(!verClave())">{{ verClave() ? 'Ocultar' : 'Ver' }}</button>
          </div>
        </label>
        <button class="btn btn-primary btn-lg mt-1" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </section>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly error = signal('');
  protected readonly enviando = signal(false);
  protected readonly verClave = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    const aviso = this.auth.tomarMensaje();
    if (aviso) this.error.set(aviso);
    const usuario = this.auth.usuario();
    if (usuario) void this.router.navigateByUrl(rutaPorRol(usuario.rol));
  }

  entrar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.error.set('Ingresa tu correo y la contraseña.');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.entrar(email.trim(), password).subscribe({
      next: (user) => void this.router.navigateByUrl(rutaPorRol(user.rol)),
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }
}
