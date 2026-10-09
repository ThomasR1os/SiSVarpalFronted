import { Component, signal } from '@angular/core';

type TipoTicket = 'Operativo' | 'Técnico' | 'Urgente';
type Prioridad = 'Alta' | 'Media' | 'Baja';

interface Ticket {
  id: string;
  fecha: string;
  asunto: string;
  tipo: TipoTicket;
  prioridad: Prioridad;
  estado: 'Borrador';
  descripcion: string;
  adjuntos: string[];
}

const CLAVE = 'varpal-ayuda-ti';

@Component({
  selector: 'app-cliente-ayuda',
  host: { class: 'flex flex-col gap-4' },
  template: `
    <section class="relative min-h-56 overflow-hidden rounded-2xl bg-neutral text-neutral-content">
      <img class="absolute inset-0 h-full w-full object-cover object-[72%_center]" src="camion-varpal.jpg" alt="" />
      <div class="absolute inset-0 bg-gradient-to-r from-neutral via-neutral/88 to-neutral/25"></div>
      <div class="relative flex min-h-56 flex-col justify-center px-5 py-6 sm:px-7">
        <div class="max-w-xl">
          <h2 class="text-3xl text-white sm:text-4xl">Centro de ayuda</h2>
          <p class="mt-2 max-w-md text-sm text-neutral-content/75">Arma una solicitud para el equipo de TI. Esta vista es un borrador: el mensaje queda en este navegador y todavía no sale del portal.</p>
        </div>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" class="rounded-2xl border border-base-300 bg-base-100 p-4 text-left shadow-sm" (click)="preparar('Operativo')">
        <strong class="block">Soporte operativo</strong>
        <span class="mt-1 block text-sm text-base-content/70">Rutas, entregas, evidencias y el día a día de la operación.</span>
      </button>
      <button type="button" class="rounded-2xl border border-base-300 bg-base-100 p-4 text-left shadow-sm" (click)="preparar('Técnico')">
        <strong class="block">Soporte técnico</strong>
        <span class="mt-1 block text-sm text-base-content/70">Acceso al portal, pantallas, reportes y fallas del sistema.</span>
      </button>
      <button type="button" class="rounded-2xl border border-error/30 bg-error/5 p-4 text-left shadow-sm" (click)="preparar('Urgente')">
        <strong class="block text-error">Canal urgente</strong>
        <span class="mt-1 block text-sm text-base-content/70">Cuando el portal no deja ver una ruta o una evidencia en curso.</span>
      </button>
      <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <strong class="block">Horario de atención</strong>
        <p class="mt-1 text-sm text-base-content/70">Lun–Vie 08:00–18:00</p>
        <p class="text-sm text-base-content/70">Sáb 08:00–13:00</p>
        <p class="text-xs text-base-content/50">Hora de Lima (GMT-5). Referencia del mockup.</p>
      </article>
    </section>

    <section class="grid items-start gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <article id="ticket-ti" class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <h2 class="text-base">Contactar a TI</h2>
        <p class="ayuda mb-4">Cuéntanos qué pantalla y qué pedido no puedes ver. El equipo de sistemas usa eso para revisar el caso.</p>
        @if (errorForm()) { <div class="alert alert-error mb-3">{{ errorForm() }}</div> }
        @if (aviso()) { <div class="alert alert-info mb-3">{{ aviso() }}</div> }
        <form class="grid gap-3" (submit)="enviar($event)">
          <label class="control">Asunto
            <input [value]="asunto()" (input)="asunto.set(valor($event))" placeholder="Ej. No carga la evidencia de un pedido" required />
          </label>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="control">Tipo
              <select [value]="tipo()" (change)="cambiarTipo($event)">
                <option value="Técnico">Técnico</option>
                <option value="Operativo">Operativo</option>
                <option value="Urgente">Urgente</option>
              </select>
            </label>
            <label class="control">Prioridad
              <select [value]="prioridad()" (change)="cambiarPrioridad($event)">
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </label>
          </div>
          <label class="control">Descripción
            <textarea rows="5" [value]="descripcion()" (input)="descripcion.set(valor($event))" placeholder="Qué estabas haciendo, qué ruta o código, y qué viste en pantalla." required></textarea>
          </label>
          <label class="control">Adjuntos
            <input type="file" multiple accept="image/*,.pdf,.xlsx,.xls" (change)="adjuntar($event)" />
          </label>
          @if (adjuntos().length) {
            <ul class="text-sm text-base-content/70">
              @for (nombre of adjuntos(); track nombre) {
                <li>{{ nombre }}</li>
              }
            </ul>
          }
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" class="btn btn-ghost" (click)="limpiar()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Enviar a TI</button>
          </div>
        </form>
      </article>

      <div class="flex flex-col gap-3">
        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <h2 class="text-base">Solicitudes de esta sesión</h2>
          <p class="ayuda mb-3">Se guardan solo en este navegador, como vista previa del contacto.</p>
          <div class="data-table overflow-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Asunto</th>
                  <th>Tipo</th>
                  <th>Prioridad</th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of tickets(); track ticket.id) {
                  <tr>
                    <td data-label="Ticket">{{ ticket.id }}</td>
                    <td data-label="Asunto">{{ ticket.asunto }}</td>
                    <td data-label="Tipo">{{ ticket.tipo }}</td>
                    <td data-label="Prioridad">{{ ticket.prioridad }}</td>
                  </tr>
                } @empty {
                  <tr class="fila-vacia"><td colspan="4">Aún no hay solicitudes en esta sesión.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </article>

        <article class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
          <h2 class="text-base">Preguntas frecuentes</h2>
          <div class="mt-3 flex flex-col gap-2">
            @for (item of preguntas; track item.titulo) {
              <details class="rounded-xl border border-base-300 px-3 py-2">
                <summary class="cursor-pointer font-medium">{{ item.titulo }}</summary>
                <p class="mt-2 text-sm text-base-content/70">{{ item.detalle }}</p>
              </details>
            }
          </div>
        </article>
      </div>
    </section>
  `,
})
export class ClienteAyuda {
  protected readonly preguntas = [
    {
      titulo: '¿Cómo consulto el estado de mis entregas?',
      detalle: 'En Seguimiento ves la ruta cuando está en proceso. En Rutas programadas ves las paradas, el conductor y el mapa.',
    },
    {
      titulo: '¿Dónde veo las fotos de una entrega?',
      detalle: 'En Evidencias elige la zona, la ruta o el distrito, y luego el destinatario. Las fotos aparecen cuando la parada ya se cerró.',
    },
    {
      titulo: '¿Qué hago si una evidencia no carga?',
      detalle: 'Confirma que la parada figure como exitosa o fallida. Si sigue vacía, arma una solicitud técnica con el código del pedido.',
    },
    {
      titulo: '¿Esta solicitud ya le llega a TI?',
      detalle: 'Todavía no. El formulario muestra cómo se verá el contacto. La solicitud queda guardada en este navegador hasta que el canal esté conectado.',
    },
  ];
  protected readonly tickets = signal<Ticket[]>(leerTickets());
  protected readonly asunto = signal('');
  protected readonly tipo = signal<TipoTicket>('Técnico');
  protected readonly prioridad = signal<Prioridad>('Media');
  protected readonly descripcion = signal('');
  protected readonly adjuntos = signal<string[]>([]);
  protected readonly errorForm = signal('');
  protected readonly aviso = signal('');

  preparar(tipo: TipoTicket): void {
    this.tipo.set(tipo);
    if (tipo === 'Urgente') this.prioridad.set('Alta');
    document.getElementById('ticket-ti')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === 'Operativo' || valor === 'Técnico' || valor === 'Urgente') this.tipo.set(valor);
  }

  cambiarPrioridad(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    if (valor === 'Alta' || valor === 'Media' || valor === 'Baja') this.prioridad.set(valor);
  }

  adjuntar(evento: Event): void {
    const archivos = (evento.target as HTMLInputElement).files;
    this.adjuntos.set(archivos ? [...archivos].map((archivo) => archivo.name) : []);
  }

  limpiar(): void {
    this.asunto.set('');
    this.descripcion.set('');
    this.adjuntos.set([]);
    this.tipo.set('Técnico');
    this.prioridad.set('Media');
    this.errorForm.set('');
    this.aviso.set('');
  }

  enviar(evento: Event): void {
    evento.preventDefault();
    const asunto = this.asunto().trim();
    const descripcion = this.descripcion().trim();
    if (!asunto || !descripcion) {
      this.errorForm.set('Escribe el asunto y qué le ocurre en el portal.');
      this.aviso.set('');
      return;
    }
    const ticket: Ticket = {
      id: `TK-${new Date().getFullYear()}-${String(this.tickets().length + 1).padStart(3, '0')}`,
      fecha: new Date().toISOString(),
      asunto,
      tipo: this.tipo(),
      prioridad: this.prioridad(),
      estado: 'Borrador',
      descripcion,
      adjuntos: this.adjuntos(),
    };
    const lista = [ticket, ...this.tickets()];
    this.tickets.set(lista);
    guardarTickets(lista);
    this.asunto.set('');
    this.descripcion.set('');
    this.adjuntos.set([]);
    this.errorForm.set('');
    this.aviso.set('Quedó registrada en este navegador. Aún no se envía al equipo de TI.');
  }
}

function leerTickets(): Ticket[] {
  try {
    const raw = sessionStorage.getItem(CLAVE);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(esTicket) : [];
  } catch {
    return [];
  }
}

function guardarTickets(tickets: Ticket[]): void {
  sessionStorage.setItem(CLAVE, JSON.stringify(tickets));
}

function esTicket(valor: unknown): valor is Ticket {
  if (!valor || typeof valor !== 'object') return false;
  const ticket = valor as Ticket;
  return typeof ticket.id === 'string' && typeof ticket.asunto === 'string';
}
