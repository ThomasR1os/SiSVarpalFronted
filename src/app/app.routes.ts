import { Routes } from '@angular/router';
import { entradaGuard, rolGuard, sesionGuard } from './core/auth.guard';
import { AdminShell } from './features/admin/admin-shell';
import { Configuracion } from './features/admin/configuracion';
import { MapaVivo } from './features/admin/mapa-vivo';
import { Operacion } from './features/admin/operacion';
import { PanelRuta, SeccionPendiente } from './features/admin/panel-ruta';
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

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: 'admin',
    component: AdminShell,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['ADMINISTRADOR'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'programacion' },
      { path: 'inicio', component: SeccionPendiente },
      { path: 'indicadores', component: SeccionPendiente },
      { path: 'clientes', component: PanelRuta, data: { modulo: 'clientes' } },
      { path: 'programacion', component: Operacion },
      { path: 'operacion', pathMatch: 'full', redirectTo: 'programacion' },
      { path: 'seguimiento', component: MapaVivo },
      { path: 'mapa', pathMatch: 'full', redirectTo: 'seguimiento' },
      { path: 'evidencias', component: SeccionPendiente },
      { path: 'servicios', component: SeccionPendiente },
      { path: 'planilla', component: SeccionPendiente },
      { path: 'flota', component: PanelRuta, data: { modulo: 'flota' } },
      { path: 'usuarios', component: PanelRuta, data: { modulo: 'usuarios' } },
      { path: 'tickets', component: SeccionPendiente },
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
    path: 'auxiliar',
    component: Conductor,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['AUXILIAR'] },
  },
  {
    path: 'cliente',
    component: ClienteShell,
    canActivate: [sesionGuard, rolGuard],
    data: { roles: ['CLIENTE'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', component: ClienteDashboard },
      { path: 'seguimiento', component: ClienteVista },
      { path: 'dashboard', component: ClienteDashboard },
      { path: 'reporte', component: ClienteReporte },
      { path: 'rutas', component: ClienteRutas },
      { path: 'evidencias', component: ClienteEvidencias },
      { path: 'ayuda', component: ClienteAyuda },
      { path: 'historial', component: ClienteHistorial },
    ],
  },
  { path: '', pathMatch: 'full', canActivate: [entradaGuard], component: Login },
  { path: '**', canActivate: [entradaGuard], component: Login },
];
