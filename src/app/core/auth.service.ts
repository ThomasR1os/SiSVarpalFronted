import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { mensajeError, sesionRechazada } from './api-error';
import { rutaApi } from './backend';
import { Usuario } from './models';

const REFRESH_KEY = 'varpal_refresh';
const RECORDAR_KEY = 'varpal_recordar';
const MSG_KEY = 'varpal_sesion_mensaje';

interface LoginRespuesta {
  access: string;
  refresh: string;
  user: Usuario;
}

interface RefreshRespuesta {
  access: string;
  refresh: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly crudo = new HttpClient(inject(HttpBackend));
  private readonly access = signal<string | null>(null);
  private refresh$: Observable<string> | null = null;

  readonly usuario = signal<Usuario | null>(null);

  accessToken(): string | null {
    return this.access();
  }

  /** True si la última vez eligió seguir conectado al cerrar el navegador. */
  prefiereRecordar(): boolean {
    return localStorage.getItem(RECORDAR_KEY) !== '0';
  }

  entrar(email: string, password: string, recordar = false): Observable<Usuario> {
    return this.crudo
      .post<LoginRespuesta>(rutaApi('/api/auth/login/'), { email, password })
      .pipe(
        tap((res) => this.guardar(res.access, res.refresh, res.user, recordar)),
        map((res) => res.user),
      );
  }

  refreshAccess(): Observable<string> {
    if (this.refresh$) return this.refresh$;
    const refresh = this.leerRefresh();
    if (!refresh) return throwError(() => new Error('No hay sesión guardada.'));

    this.refresh$ = this.crudo.post<RefreshRespuesta>(rutaApi('/api/auth/refresh/'), { refresh }).pipe(
      tap((res) => {
        this.access.set(res.access);
        this.escribirRefresh(res.refresh);
      }),
      map((res) => res.access),
      shareReplay({ bufferSize: 1, refCount: true }),
      finalize(() => {
        this.refresh$ = null;
      }),
    );
    return this.refresh$;
  }

  restaurar(): Promise<void> {
    if (!this.leerRefresh()) return Promise.resolve();
    return new Promise((resolve) => {
      this.refreshAccess().subscribe({
        next: () => {
          this.http.get<Usuario>('/api/auth/me/').subscribe({
            next: (user) => {
              this.usuario.set(user);
              resolve();
            },
            error: (err: unknown) => {
              this.alFallarRestauracion(err);
              resolve();
            },
          });
        },
        error: (err: unknown) => {
          this.alFallarRestauracion(err);
          resolve();
        },
      });
    });
  }

  salir(): Observable<unknown> {
    const peticion = this.access()
      ? this.http.post('/api/auth/logout/', {}).pipe(catchError(() => of(null)))
      : of(null);
    return peticion.pipe(finalize(() => this.cerrar()));
  }

  cerrar(mensaje?: string): void {
    this.access.set(null);
    this.usuario.set(null);
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    if (mensaje) sessionStorage.setItem(MSG_KEY, mensaje);
  }

  tomarMensaje(): string {
    const mensaje = sessionStorage.getItem(MSG_KEY) ?? '';
    sessionStorage.removeItem(MSG_KEY);
    return mensaje;
  }

  private guardar(access: string, refresh: string, user: Usuario, recordar: boolean): void {
    this.access.set(access);
    localStorage.setItem(RECORDAR_KEY, recordar ? '1' : '0');
    this.escribirRefresh(refresh, recordar);
    this.usuario.set(user);
    sessionStorage.removeItem(MSG_KEY);
  }

  private leerRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  }

  private escribirRefresh(refresh: string, recordar?: boolean): void {
    const persistir = recordar ?? localStorage.getItem(REFRESH_KEY) !== null;
    if (persistir) {
      sessionStorage.removeItem(REFRESH_KEY);
      localStorage.setItem(REFRESH_KEY, refresh);
      return;
    }
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  }

  private alFallarRestauracion(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 0) {
      this.access.set(null);
      this.usuario.set(null);
      sessionStorage.setItem(MSG_KEY, 'No se pudo conectar con el servidor.');
      return;
    }
    if (sesionRechazada(err) || err instanceof Error) {
      this.cerrar(mensajeError(err));
      return;
    }
    this.cerrar(mensajeError(err));
  }
}
