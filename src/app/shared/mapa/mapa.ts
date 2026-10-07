import { DestroyRef, Component, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { Posicion } from '../../core/models';
import { grados } from '../../core/texto';
import { MarcaMapa, colorEstado } from './marcas';

@Component({
  selector: 'app-mapa',
  template: `<div class="mapa-wrap"><div #lienzo class="mapa-lienzo"></div></div>`,
})
export class Mapa {
  readonly marcas = input<MarcaMapa[]>([]);
  readonly geometria = input<[number, number][] | null>(null);
  readonly recorrido = input<Posicion[]>([]);
  readonly geocerca = input<[number, number][] | null>(null);
  readonly encuadre = input('');
  readonly marcaClick = output<string>();

  private readonly lienzo = viewChild<ElementRef<HTMLDivElement>>('lienzo');
  private readonly destroyRef = inject(DestroyRef);
  private map: L.Map | null = null;
  private grupo: L.LayerGroup | null = null;
  private observador: ResizeObserver | null = null;
  private ultimoEncuadre = '\u0000';

  constructor() {
    afterNextRender(() => this.iniciar());
    effect(() => {
      this.marcas();
      this.geometria();
      this.recorrido();
      this.geocerca();
      this.encuadre();
      if (this.map) this.pintar();
    });
    this.destroyRef.onDestroy(() => {
      this.observador?.disconnect();
      this.observador = null;
      this.map?.remove();
      this.map = null;
    });
  }

  private iniciar(): void {
    const elemento = this.lienzo()?.nativeElement;
    if (!elemento || this.map) return;
    this.map = L.map(elemento, { zoomControl: true }).setView([-12.0464, -77.0428], 12);
    L.tileLayer(
      `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${environment.cartoKey}`,
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 20,
      },
    ).addTo(this.map);
    this.grupo = L.layerGroup().addTo(this.map);
    this.observador = new ResizeObserver(() => this.map?.invalidateSize());
    this.observador.observe(elemento);
    this.pintar();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private pintar(): void {
    if (!this.map || !this.grupo) return;
    this.grupo.clearLayers();
    const puntos: L.LatLngExpression[] = [];

    const cerca = this.geocerca();
    if (cerca && cerca.length > 2) {
      L.polygon(
        cerca.map(([lng, lat]) => [lat, lng] as [number, number]),
        { color: '#0a4f8f', weight: 1.5, fillOpacity: 0.04 },
      ).addTo(this.grupo);
    }

    const linea = this.geometria();
    if (linea && linea.length > 1) {
      const coords = linea
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat))
        .map(([lng, lat]) => [lat, lng] as [number, number]);
      if (coords.length > 1) {
        L.polyline(coords, { color: '#00275a', weight: 4, opacity: 0.9, smoothFactor: 0 }).addTo(this.grupo);
        puntos.push(...coords);
      }
    }

    const recorrido = this.recorrido();
    if (recorrido.length > 1) {
      L.polyline(
        recorrido.map((p) => [grados(p.latitud), grados(p.longitud)] as [number, number]),
        { color: '#2c9ef6', weight: 3, opacity: 0.85, dashArray: '6 8', smoothFactor: 0 },
      ).addTo(this.grupo);
    }

    for (const marca of this.marcas()) {
      if (!Number.isFinite(marca.lat) || !Number.isFinite(marca.lng)) continue;
      const icono = L.divIcon({
        className: 'pin-icon',
        html: htmlMarca(marca),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([marca.lat, marca.lng], { icon: icono, title: marca.titulo });
      marker.on('click', () => this.marcaClick.emit(marca.id));
      marker.addTo(this.grupo);
      puntos.push([marca.lat, marca.lng]);
    }

    const clave = this.encuadre();
    if (clave !== this.ultimoEncuadre) {
      this.ultimoEncuadre = clave;
      if (puntos.length) {
        this.map.fitBounds(L.latLngBounds(puntos), { padding: [32, 32], maxZoom: 15 });
      } else {
        this.map.setView([-12.0464, -77.0428], 12);
      }
    }
    this.map.invalidateSize();
  }
}

function htmlMarca(marca: MarcaMapa): string {
  if (marca.tipo === 'camion') {
    return `<span class="pin pin-camion" title="${esc(marca.titulo)}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 7h11v8H3V7zm11 2h3.2L20 12.2V15h-6V9zM6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg></span>`;
  }
  const color = marca.tipo === 'parada' ? colorEstado(marca.estado) : marca.tipo === 'final' ? '#00275a' : '#0a4f8f';
  return `<span class="pin" style="background:${color}" title="${esc(marca.titulo)}">${esc(marca.texto)}</span>`;
}

function esc(valor: string): string {
  return valor.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
