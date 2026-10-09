import { Routes } from '@angular/router';
import { entradaGuard, rolGuard, sesionGuard } from './core/auth.guard';
import { AdminShell } from './features/admin/admin-shell';
import { Configuracion } from './features/admin/configuracion';
import { MapaVivo } from './features/admin/mapa-vivo';
import { Operacion } from './features/admin/operacion';
import { ClienteAyuda } from './features/cliente/cliente-ayuda';
import { ClienteDashboard } from './features/cliente/cliente-dashboard';
import { ClienteEvidencias } from './features/cliente/cliente-evidencias';
import { ClienteReporte } from './features/cliente/cliente-reporte';
import { ClienteRutas } from './features/cliente/cliente-rutas';

import { ClienteHistorial } from './features/cliente/cliente-historial';
import { ClienteShell } from './features/cliente/cliente-shell';
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
    component: ClienteShell,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['CLIENTE'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'seguimiento' },
      { path: 'seguimiento', component: ClienteVista },
      { path: 'dashboard', component: ClienteDashboard },
      { path: 'reporte', component: ClienteReporte },
      { path: 'rutas', component: ClienteRutas },
      { path: 'evidencias', component: ClienteEvidencias },
      { path: 'ayuda', component: ClienteAyuda },
      { path: 'historial', component: ClienteHistorial },
    ],
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
