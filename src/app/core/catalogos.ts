import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { Api } from './api';
import { Pagina, Punto, Usuario, Vehiculo } from './models';
import { TAMANO_CATALOGO } from './texto';

export interface CatalogoRuta {
  conductores: Usuario[];
  auxiliares: Usuario[];
  vehiculos: Vehiculo[];
  basesVarpal: Punto[];
  basesCliente: Punto[];
  origenes: Punto[];
  finales: Punto[];
}

@Injectable({ providedIn: 'root' })
export class Catalogos {
  private readonly api = inject(Api);

  paraRuta(clienteId: number): Observable<CatalogoRuta> {
    return forkJoin({
      conductores: this.api.get<Pagina<Usuario>>('/api/usuarios/', {
        rol: 'CONDUCTOR',
        is_active: true,
        page_size: TAMANO_CATALOGO,
      }),
      auxiliares: this.api.get<Pagina<Usuario>>('/api/usuarios/', {
        rol: 'AUXILIAR',
        is_active: true,
        page_size: TAMANO_CATALOGO,
      }),
      vehiculos: this.api.get<Pagina<Vehiculo>>('/api/vehiculos/', {
        activo: true,
        page_size: TAMANO_CATALOGO,
      }),
      puntosCliente: this.api.get<Pagina<Punto>>('/api/puntos/', {
        cliente: clienteId,
        activo: true,
        page_size: TAMANO_CATALOGO,
      }),
      puntosVarpal: this.api.get<Pagina<Punto>>('/api/puntos/', {
        de_varpal: true,
        activo: true,
        page_size: TAMANO_CATALOGO,
      }),
    }).pipe(
      map((res) => {
        const basesVarpal = ordenarBases(res.puntosVarpal.results);
        const basesCliente = ordenarBases(res.puntosCliente.results);
        const todas = [...basesVarpal, ...basesCliente];
        return {
          conductores: res.conductores.results,
          auxiliares: res.auxiliares.results,
          vehiculos: res.vehiculos.results,
          basesVarpal,
          basesCliente,
          origenes: todas,
          finales: todas,
        };
      }),
    );
  }
}

function ordenarBases(puntos: Punto[]): Punto[] {
  return [...puntos].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}
