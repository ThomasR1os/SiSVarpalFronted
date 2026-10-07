import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { Api } from './api';
import { Pagina, Punto, Usuario, Vehiculo } from './models';
import { TAMANO_CATALOGO } from './texto';

export interface CatalogoRuta {
  conductores: Usuario[];
  auxiliares: Usuario[];
  vehiculos: Vehiculo[];
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
      map((res) => ({
        conductores: res.conductores.results,
        auxiliares: res.auxiliares.results,
        vehiculos: res.vehiculos.results,
        origenes: res.puntosCliente.results.filter((p) => p.es_base_origen || p.es_principal),
        finales: res.puntosVarpal.results.filter((p) => p.es_base_final || p.es_principal),
      })),
    );
  }
}
