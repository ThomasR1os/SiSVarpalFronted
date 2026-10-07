import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { mensajeError, sesionRechazada } from './api-error';
import { AuthService } from './auth.service';

const REINTENTO = new HttpContextToken<boolean>(() => false);

function esAuthLibre(url: string): boolean {
  return url.includes('/api/auth/login/') || url.includes('/api/auth/refresh/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const libre = esAuthLibre(req.url);
  const token = auth.accessToken();
  const salida =
    !libre && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(salida).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || libre) {
        return throwError(() => err);
      }
      if (req.context.get(REINTENTO)) {
        auth.cerrar(mensajeError(err));
        void router.navigate(['/login']);
        return throwError(() => err);
      }
      return auth.refreshAccess().pipe(
        switchMap((access) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${access}` },
              context: req.context.set(REINTENTO, true),
            }),
          ),
        ),
        catchError((refreshErr: unknown) => {
          if (sesionRechazada(refreshErr)) {
            auth.cerrar(mensajeError(refreshErr));
            void router.navigate(['/login']);
          }
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
