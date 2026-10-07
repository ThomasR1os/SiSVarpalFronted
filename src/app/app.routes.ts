import { Routes } from '@angular/router';
import { entradaGuard, rolGuard, sesionGuard } from './core/auth.guard';
import { AdminShell } from './features/admin/admin-shell';
import { Configuracion } from './features/admin/configuracion';
import { MapaVivo } from './features/admin/mapa-vivo';
import { Operacion } from './features/admin/operacion';
import { ClienteVista } from './features/cliente/cliente';
import { Conductor } from './features/conductor/conductor';
import { Login } from './features/login/login';
import { SinAcceso } from './features/sin-acceso/sin-acceso';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: 'admin',
    component: AdminShell,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['ADMINISTRADOR'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'operacion' },
      { path: 'operacion', component: Operacion },
      { path: 'mapa', component: MapaVivo },
      { path: 'configuracion', component: Configuracion },
    ],
  },
  {
    path: 'conductor',
    component: Conductor,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['CONDUCTOR'] },
  },
  {
    path: 'cliente',
    component: ClienteVista,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['CLIENTE'] },
  },
  {
    path: 'sin-acceso',
    component: SinAcceso,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['AUXILIAR'] },
  },
  { path: '', pathMatch: 'full', canActivate: [entradaGuard], component: Login },
  { path: '**', canActivate: [entradaGuard], component: Login },
];
