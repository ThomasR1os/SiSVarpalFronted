import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';
import { Api } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { Destino, Geocerca, ParadaSeguimiento, Ruta, Seguimiento } from '../../core/models';
import { grados, nombrePersona } from '../../core/texto';
import { FichaParada, fusionarFichas, pedirPorFecha, textoParada } from './fichas-parada';
import { Mapa } from './mapa';
import { LineaMapa, MarcaMapa, lineaGeo, marcasRuta } from './marcas';

export interface RutaMapa {
  ruta: Ruta;
  color: string;
}

@Component({
  selector: 'app-mapa-seguimiento',
  imports: [Mapa],
  template: `
    <div class="mapa-caja alta">
      <app-mapa
        [marcas]="marcas()"
        [lineas]="lineas()"
        [recorrido]="recorrido()"
        [geocerca]="geocerca()"
        [encuadre]="encuadre()"
      />
    </div>
  `,
})
export class MapaSeguimiento {
  readonly ruta = input<Ruta | null>(null);
  readonly rutas = input<RutaMapa[]>([]);

  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seguimientos = signal<ReadonlyMap<number, Seguimiento>>(new Map());
  private readonly documentos = signal<ReadonlyMap<number, Destino>>(new Map());
  protected readonly geocerca = signal<[number, number][] | null>(null);
  private claveDestinos = '';
  private destinosTicket = 0;
  private readonly activas = computed(() => {
    const varias = this.rutas();
    if (varias.length) return varias;
    const una = this.ruta();
    return una ? [{ ruta: una, color: '#00275a' }] : [];
  });

  protected readonly lineas = computed(() => this.armarLineas());
  protected readonly recorrido = computed(() => {
    const lista = this.activas();
    if (lista.length !== 1) return [];
    const seguimiento = this.seguimientos().get(lista[0].ruta.id);
    return seguimiento?.en_vivo ? seguimiento.recorrido ?? [] : [];
  });
  protected readonly encuadre = computed(() => {
    const partes = this.activas().map((item) => {
      const seguimiento = this.seguimientos().get(item.ruta.id);
      const paradas = seguimiento?.paradas?.length ? seguimiento.paradas : item.ruta.paradas;
      const puntos = paradas.map((parada) => `${parada.latitud},${parada.longitud}`).join('|');
      const trazo = seguimiento?.geometria?.coordinates.length ?? item.ruta.geometria_empresa?.coordinates.length ?? item.ruta.geometria_cliente?.coordinates.length ?? 0;
      return `${item.ruta.id}-${trazo}-${puntos}`;
    });
    return partes.join('~') || 'vacio';
  });
  protected readonly marcas = computed(() => this.armar());

  constructor() {
    if (this.auth.usuario()?.rol === 'ADMINISTRADOR') {
      this.api.get<Geocerca>('/api/geocerca/').subscribe({
        next: (cerca) => this.geocerca.set(cerca.poligono),
        error: () => undefined,
      });
    }
    toObservable(this.activas)
      .pipe(
        switchMap((lista) => {
          this.cargarDestinos(lista);
          const ids = lista.map((item) => item.ruta.id);
          if (!ids.length) return of(new Map<number, Seguimiento>());
          return interval(10000).pipe(
            startWith(0),
            switchMap(() =>
              forkJoin(
                ids.map((id) =>
                  this.api.get<Seguimiento>(`/api/rutas/${id}/seguimiento/`).pipe(
                    catchError(() => of(null as Seguimiento | null)),
                  ),
                ),
              ),
            ),
            map((resultados) => {
              const mapa = new Map<number, Seguimiento>();
              resultados.forEach((seguimiento, indice) => {
                if (seguimiento) mapa.set(ids[indice], seguimiento);
              });
              return mapa;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((mapa) => this.seguimientos.set(mapa));
  }

  private cargarDestinos(lista: RutaMapa[]): void {
    const ids = [...new Set(lista.flatMap((item) => item.ruta.paradas.map((parada) => parada.destino_id)))].sort((a, b) => a - b);
    const fechas = [...new Set(lista.map((item) => item.ruta.fecha.slice(0, 10)).filter(Boolean))].sort();
    const clave = `${fechas.join(',')}|${ids.join(',')}`;
    if (clave === this.claveDestinos) return;
    this.claveDestinos = clave;
    const ticket = ++this.destinosTicket;
    if (!fechas.length || !ids.length) {
      this.documentos.set(new Map());
      return;
    }
    const interes = new Set(ids);
    pedirPorFecha<Destino>(this.api, '/api/destinos/', fechas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((listas) => {
        if (ticket !== this.destinosTicket) return;
        if (listas.some((grupo) => !grupo.ok)) this.claveDestinos = '';
        const mapa = new Map<number, Destino>();
        for (const grupo of listas) {
          if (!grupo.ok) continue;
          for (const destino of grupo.items) {
            if (interes.has(destino.id)) mapa.set(destino.id, destino);
          }
        }
        if (listas.some((grupo) => grupo.ok)) this.documentos.set(mapa);
      });
  }

  private armarLineas(): LineaMapa[] {
    const lineas: LineaMapa[] = [];
    for (const item of this.activas()) {
      const seguimiento = this.seguimientos().get(item.ruta.id);
      const coords = lineaGeo(seguimiento?.geometria ?? item.ruta.geometria_empresa ?? item.ruta.geometria_cliente);
      if (coords) lineas.push({ coords, color: item.color });
    }
    return lineas;
  }

  private armar(): MarcaMapa[] {
    const varias = this.activas().length > 1;
    const marcas: MarcaMapa[] = [];
    for (const item of this.activas()) {
      const ruta = item.ruta;
      const seguimiento = this.seguimientos().get(ruta.id) ?? null;
      const paradas = seguimiento?.paradas?.length ? seguimiento.paradas : paradasDeRuta(ruta);
      const deRutas = new Map<number, FichaParada>();
      for (const parada of ruta.paradas) {
        deRutas.set(parada.destino_id, {
          nombre: parada.nombre_receptor.trim(),
          apellido: parada.apellido_receptor.trim(),
          documento: '',
          codigo: parada.codigo_externo.trim(),
          tipo: parada.tipo_servicio,
        });
      }
      const fichas = fusionarFichas(seguimiento ? [seguimiento] : [], deRutas, this.documentos());
      if (seguimiento?.en_vivo && seguimiento.ultima_posicion) {
        const placa = ruta.vehiculo?.placa?.trim() || 'Sin placa';
        const etiqueta = `${nombrePersona(ruta.conductor)} · ${placa}`;
        marcas.push({
          id: `camion-${ruta.id}`,
          lat: grados(seguimiento.ultima_posicion.latitud),
          lng: grados(seguimiento.ultima_posicion.longitud),
          tipo: 'camion',
          texto: varias ? etiqueta : '',
          titulo: etiqueta,
          detalle: etiqueta,
        });
      }
      const paradasMarca = marcasRuta({
        paradas,
        origen: seguimiento?.base_origen ?? ruta.base_origen,
        final: seguimiento?.base_final ?? ruta.base_final,
        color: item.color,
      });
      for (const marca of paradasMarca) {
        marca.id = `r${ruta.id}-${marca.id}`;
        if (!marca.id.includes('parada-')) continue;
        const destinoId = Number(marca.id.slice(marca.id.lastIndexOf('parada-') + 'parada-'.length));
        const parada = paradas.find((punto) => punto.destino_id === destinoId);
        if (!parada) continue;
        const texto = textoParada(parada, paradas, fichas);
        marca.detalle = texto;
        marca.titulo = texto;
      }
      marcas.push(...paradasMarca);
    }
    return marcas;
  }
}

function paradasDeRuta(ruta: Ruta | null): ParadaSeguimiento[] {
  if (!ruta) return [];
  return ruta.paradas.map((parada) => ({
    orden: parada.orden,
    destino_id: parada.destino_id,
    codigo_externo: parada.codigo_externo,
    estado: parada.estado,
    direccion: parada.direccion,
    distrito: parada.distrito,
    latitud: parada.latitud,
    longitud: parada.longitud,
    nombre_receptor: parada.nombre_receptor,
    apellido_receptor: parada.apellido_receptor,
    tipo_servicio: parada.tipo_servicio,
  }));
}
