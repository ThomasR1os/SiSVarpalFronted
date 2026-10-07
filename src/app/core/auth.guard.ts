import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Rol } from './models';
import { rutaPorRol } from './texto';

export const sesionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.usuario()) return true;
  return router.createUrlTree(['/login']);
};

export const rolGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const usuario = auth.usuario();
  if (!usuario) return router.createUrlTree(['/login']);
  const roles = route.data['roles'] as Rol[] | undefined;
  if (!roles || roles.includes(usuario.rol)) return true;
  return router.createUrlTree([rutaPorRol(usuario.rol)]);
};

export const entradaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const usuario = auth.usuario();
  if (!usuario) return router.createUrlTree(['/login']);
  return router.createUrlTree([rutaPorRol(usuario.rol)]);
};
