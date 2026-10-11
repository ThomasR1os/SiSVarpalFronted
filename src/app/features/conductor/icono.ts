import { Component, input } from '@angular/core';

export type NombreIcono =
  | 'inicio'
  | 'servicio'
  | 'pin'
  | 'mapa'
  | 'perfil'
  | 'grupo'
  | 'barras'
  | 'reloj'
  | 'camion'
  | 'edificio'
  | 'caja'
  | 'calendario'
  | 'play'
  | 'derecha'
  | 'check'
  | 'salir'
  | 'navegar'
  | 'camara'
  | 'comentario'
  | 'alerta'
  | 'izquierda'
  | 'telefono'
  | 'lista'
  | 'x-circulo'
  | 'bandera'
  | 'ubicacion'
  | 'tienda';

@Component({
  selector: 'app-icono',
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" class="size-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      @switch (nombre()) {
        @case ('inicio') { <path fill="currentColor" stroke="none" d="M11.3 2.7a1 1 0 011.4 0l8.6 8.1a1 1 0 01-.7 1.7H19V20a1 1 0 01-1 1h-4v-6h-4v6H6a1 1 0 01-1-1v-7.5H3.4a1 1 0 01-.7-1.7l8.6-8.1z" /> }
        @case ('servicio') { <path d="M9 4H7a2 2 0 00-2 2v13a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm0 7h6m-6 4h6" /> }
        @case ('pin') { <path d="M12 21s-7-6.1-7-11.5a7 7 0 1114 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /> }
        @case ('mapa') { <path d="M9 20l-5.4-2.2A1 1 0 013 16.9V5.1a1 1 0 011.4-.9L9 6m0 14l6-2m-6 2V6m6 12l4.6 1.8a1 1 0 001.4-.9V7.1a1 1 0 00-.6-.9L15 4m0 14V4M9 6l6-2" /> }
        @case ('perfil') { <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /> }
        @case ('grupo') { <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14a6 6 0 013.5 6" /> }
        @case ('barras') { <path fill="currentColor" stroke="none" d="M4 13h3v7H4zM10.5 8h3v12h-3zM17 4h3v16h-3z" /> }
        @case ('reloj') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /> }
        @case ('camion') { <path d="M2 6.5A1.5 1.5 0 013.5 5H13a1 1 0 011 1v10H2V6.5zM14 9h4l3 3.5V16h-7V9z" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /> }
        @case ('edificio') { <path d="M4 21V4a1 1 0 011-1h9a1 1 0 011 1v17m0-11h4a1 1 0 011 1v10M3 21h18M8 7h3m-3 4h3m-3 4h3" /> }
        @case ('caja') { <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 9l8-4.5M12 12L4 7.5M12 12v9" /> }
        @case ('calendario') { <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" /> }
        @case ('play') { <path fill="currentColor" stroke="none" d="M7 4.8v14.4a1 1 0 001.5.9l11.3-7.2a1 1 0 000-1.8L8.5 3.9A1 1 0 007 4.8z" /> }
        @case ('derecha') { <path d="M9 5l7 7-7 7" /> }
        @case ('check') { <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path stroke="var(--icono-contraste, #fff)" stroke-width="2.2" d="M8 12.5l2.7 2.7L16 10" /> }
        @case ('salir') { <path d="M15 17l5-5-5-5m5 5H9m3 9H5a1 1 0 01-1-1V4a1 1 0 011-1h7" /> }
        @case ('navegar') { <path fill="currentColor" stroke="none" d="M20.6 3.4a1 1 0 00-1.1-.2L3.6 10a1 1 0 00.1 1.9l6.6 1.8 1.8 6.6a1 1 0 001.9.1l6.8-15.9a1 1 0 00-.2-1.1z" /> }
        @case ('camara') { <path fill="currentColor" stroke="none" d="M9.2 4a1.5 1.5 0 00-1.3.8L7.1 6.5H4.5A2.5 2.5 0 002 9v9a2.5 2.5 0 002.5 2.5h15A2.5 2.5 0 0022 18V9a2.5 2.5 0 00-2.5-2.5h-2.6l-.8-1.7A1.5 1.5 0 0014.8 4H9.2zM12 9a4.25 4.25 0 110 8.5A4.25 4.25 0 0112 9z" /> }
        @case ('comentario') { <path fill="currentColor" stroke="none" d="M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H9l-4.4 3.5A1 1 0 013 19.7V5a2 2 0 012-2zm2.5 5a1 1 0 000 2h9a1 1 0 000-2h-9zm0 4a1 1 0 000 2h5a1 1 0 000-2h-5z" /> }
        @case ('alerta') { <path fill="currentColor" stroke="none" d="M10.3 3.9a2 2 0 013.4 0l8 13.6A2 2 0 0120 20.5H4a2 2 0 01-1.7-3L10.3 3.9zM12 9a1 1 0 00-1 1v4a1 1 0 002 0v-4a1 1 0 00-1-1zm0 7.2a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z" /> }
        @case ('izquierda') { <path d="M15 5l-7 7 7 7" /> }
        @case ('telefono') { <path d="M5 4h3l1.5 4.5-2 1.3a11 11 0 006.7 6.7l1.3-2L20 16v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /> }
        @case ('lista') { <path d="M9 6h11M9 12h11M9 18h11" /><path stroke-width="2.8" d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /> }
        @case ('x-circulo') { <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path stroke="var(--icono-contraste, #fff)" stroke-width="2.2" d="M9.2 9.2l5.6 5.6m0-5.6l-5.6 5.6" /> }
        @case ('bandera') { <path d="M5 21V4m0 0h12l-2.5 4L17 12H5" /> }
        @case ('ubicacion') { <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /> }
        @case ('tienda') { <path d="M4 9l1.5-5h13L20 9v.5a2.7 2.7 0 01-5.3.6 2.7 2.7 0 01-5.4 0 2.7 2.7 0 01-5.3-.6V9zm1 3.5V20h14v-7.5M10 20v-4.5h4V20" /> }
      }
    </svg>
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();
}
