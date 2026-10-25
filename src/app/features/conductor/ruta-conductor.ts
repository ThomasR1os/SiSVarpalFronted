import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, computed, effect, inject, input, model, output, signal, viewChild } from '@angular/core';
import { Api } from '../../core/api';
import { mensajeError } from '../../core/api-error';
import { Destino, Evidencia, Pagina, Parada, Punto, Ruta } from '../../core/models';
import {
  TAMANO_CATALOGO,
  etiquetaTipo,
  fechaCorta,
  horaCorta,
  horarioParadas,
  hoy,
  nombrePersona,
  paradasCerradas,
  textoAuxiliares,
} from '../../core/texto';
import { Modal } from '../../shared/modal';
import { Mapa } from '../../shared/mapa/mapa';
import { lineaGeo, marcasRuta } from '../../shared/mapa/marcas';
import { CerrarParada } from '../ruta/cerrar-parada';
import { Icono, NombreIcono } from './icono';

export type Modo = 'listado' | 'mapa';

interface EstiloParada {
  texto: string;
  chip: string;
  circulo: string;
  icono: NombreIcono;
}

const EXITO: Record<string, string> = {
  ENTREGA: 'Entregado',
  RECOJO: 'Recogido',
  INTERCAMBIO: 'Intercambiado',
  TRASLADO: 'Trasladado',
};

export function chipRuta(ruta: Ruta): { texto: string; clase: string; check: boolean } {
  if (ruta.estado === 'EN_PROCESO') return { texto: 'En proceso', clase: 'badge-info', check: false };
  if (ruta.estado === 'FINALIZADA') return { texto: 'Finalizada', clase: 'badge-success', check: true };
  if (ruta.estado === 'CANCELADA') return { texto: 'Cancelada', clase: 'badge-error', check: false };
  const dia = ruta.fecha.slice(0, 10);
  if (dia === hoy()) return { texto: 'Asignada hoy', clase: 'badge-success', check: true };
  if (dia < hoy()) return { texto: `Pendiente · ${fechaCorta(ruta.fecha).slice(0, 5)}`, clase: 'badge-warning', check: false };
  return { texto: `Próxima · ${fechaCorta(ruta.fecha).slice(0, 5)}`, clase: 'badge-neutral', check: false };
}

export interface ItemResumen {
  texto: string;
  valor: number;
  icono: NombreIcono;
  caja: string;
  burbuja: string;
  color: string;
}

export function resumenParadas(paradas: Parada[]): ItemResumen[] {
  const exitosas = paradas.filter((p) => p.estado === 'EXITOSO').length;
  const fallidas = paradas.filter((p) => p.estado === 'FALLIDO').length;
  return [
    {
      texto: 'Pendientes',
      valor: paradas.length - exitosas - fallidas,
      icono: 'reloj',
      caja: 'border-amber-200 bg-amber-50',
      burbuja: 'bg-amber-100 text-amber-600',
      color: 'text-amber-700',
    },
    {
      texto: 'Exitosas',
      valor: exitosas,
      icono: 'check',
      caja: 'border-emerald-200 bg-emerald-50',
      burbuja: 'bg-emerald-100 text-emerald-600',
      color: 'text-emerald-700',
    },
    {
      texto: 'Fallidas',
      valor: fallidas,
      icono: 'x-circulo',
      caja: 'border-red-200 bg-red-50',
      burbuja: 'bg-red-100 text-red-600',
      color: 'text-red-700',
    },
  ];
}

function atendida(parada: Parada): boolean {
  return parada.estado === 'EXITOSO' || parada.estado === 'FALLIDO';
}

@Component({
  selector: 'app-ruta-conductor',
  imports: [NgTemplateOutlet, Mapa, CerrarParada, Icono, Modal],
  template: `
    @if (ruta(); as ruta) {
      <div class="flex flex-col gap-3">
        @if (seleccionada(); as parada) {
          <div class="flex items-center gap-3">
            <button type="button" class="btn btn-circle shrink-0 border-0 bg-base-100 shadow-sm" (click)="cerrarDetalle()" aria-label="Volver a la ruta">
              <app-icono nombre="izquierda" class="size-5" />
            </button>
            <div class="min-w-0 flex-1">
              <h2 class="truncate">Destino {{ posicion(parada) }} de {{ paradas().length }}</h2>
              <p class="truncate text-sm text-base-content/60">{{ ruta.cliente_nombre }} · {{ etiquetaTipo(parada.tipo_servicio) }}</p>
            </div>
            <ng-container *ngTemplateOutlet="chip; context: { $implicit: parada }" />
          </div>

          <div class="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <section class="cd-card">
              <div class="flex items-start gap-3">
                <span class="grid size-10 shrink-0 place-items-center rounded-full font-display text-lg font-bold" [class]="estilo(parada).circulo">{{ posicion(parada) }}</span>
                <div class="min-w-0 flex-1">
                  <strong class="block font-display text-lg leading-tight">{{ titulo(parada) }}</strong>
                  <p class="mt-1 text-sm text-base-content/70">{{ parada.direccion }}</p>
                  <p class="text-xs text-base-content/55">Distrito: {{ parada.distrito || '—' }}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3 border-t border-base-300/70 pt-3 text-sm">
                <p class="cd-dato"><app-icono nombre="reloj" class="size-5" /><span><span class="cd-dato-label">Llegada estimada</span>{{ parada.hora_estimada ? horaCorta(parada.hora_estimada) : 'Por calcular' }}</span></p>
                <p class="cd-dato"><app-icono nombre="calendario" class="size-5" /><span><span class="cd-dato-label">Ventana de atención</span>Por confirmar</span></p>
                @if (atendida(parada)) {
                  <p class="cd-dato"><app-icono nombre="play" class="size-5" /><span><span class="cd-dato-label">Inicio descarga</span>{{ horaCorta(parada.hora_inicio_descarga) }}</span></p>
                  <p class="cd-dato"><app-icono nombre="check" class="size-5" /><span><span class="cd-dato-label">Fin descarga</span>{{ horaCorta(parada.hora_fin_descarga) }}</span></p>
                }
              </div>
              @if (telefono(parada) || parada.estado !== 'EN_PROCESO') {
                <div class="grid gap-2" [class.grid-cols-2]="!!telefono(parada) && parada.estado !== 'EN_PROCESO'">
                  @if (telefono(parada); as tel) {
                    <a class="btn min-h-12 gap-2 rounded-xl border-azul/40 bg-azul/5 text-base text-azul hover:bg-azul/10" [href]="'tel:' + tel">
                      <app-icono nombre="telefono" class="size-5" /> Llamar
                    </a>
                  }
                  @if (parada.estado !== 'EN_PROCESO') {
                    <a class="cd-btn" [href]="navegar(parada)" target="_blank" rel="noopener">
                      <app-icono nombre="navegar" class="size-5" /> Navegar
                    </a>
                  }
                </div>
              }
            </section>

            @if (parada.estado === 'EN_PROCESO' || parada.estado === 'PENDIENTE') {
              <section class="cd-card">
                @if (parada.estado === 'PENDIENTE') {
                  <p class="text-sm text-base-content/70">Esta parada está pendiente. Sube las evidencias para cerrarla.</p>
                }
                <app-cerrar-parada [parada]="parada" (cerrado)="paradaCerrada()" (georeferenciada)="alGeoreferenciar()" />
              </section>
            } @else if (atendida(parada)) {
              <section class="cd-card">
                <h3>Evidencias</h3>
                @if (evidencias()[parada.destino_id]; as fotos) {
                  <div class="fotos">
                    @for (foto of fotos; track foto.id) {
                      <a [href]="foto.archivo" target="_blank" rel="noopener"><img [src]="foto.archivo" alt="Evidencia" /></a>
                    } @empty { <p class="text-sm text-base-content/60">Sin fotos registradas.</p> }
                  </div>
                } @else {
                  <span class="loading loading-spinner loading-sm text-azul"></span>
                }
              </section>
            } @else {
              <p class="vacio-texto">{{ puedeOperar() ? 'Inicia la ruta para registrar la evidencia de este destino.' : 'Cuando el conductor inicie la ruta podrás subir la evidencia de este destino.' }}</p>
            }
          </div>
        } @else {
          <div class="flex items-center gap-3">
            <button type="button" class="btn btn-circle shrink-0 border-0 bg-base-100 shadow-sm" (click)="cerrada.emit()" aria-label="Volver al inicio">
              <app-icono nombre="izquierda" class="size-5" />
            </button>
            <div class="min-w-0 flex-1">
              <h2 class="truncate">{{ tituloRuta() }}</h2>
              <p class="truncate text-sm text-base-content/60">{{ subtitulo() }}</p>
            </div>
          </div>

          <ng-content />

          @if (error()) { <div class="alert alert-error text-sm">{{ error() }}</div> }
          @if (aviso()) { <div class="alert alert-info text-sm">{{ aviso() }}</div> }
          @if (!ruta.dentro_de_lima) {
            <div class="alert alert-warning text-sm">Esta ruta tiene puntos fuera de Lima metropolitana. No aparecerá en el mapa en vivo.</div>
          }

          @if (modo() === 'listado') {
            <div class="grid grid-cols-3 gap-2 sm:gap-3">
              @for (item of resumen(); track item.texto) {
                <div class="flex items-center gap-2 rounded-box border p-2.5 sm:gap-3 sm:p-3.5" [class]="item.caja">
                  <span class="hidden size-10 shrink-0 place-items-center rounded-full min-[380px]:grid sm:size-11" [class]="item.burbuja">
                    <app-icono [nombre]="item.icono" class="size-6" />
                  </span>
                  <span class="min-w-0">
                    <strong class="block font-display text-2xl leading-none" [class]="item.color">{{ item.valor }}</strong>
                    <span class="block text-sm font-semibold" [class]="item.color">{{ item.texto }}</span>
                    <span class="block text-[11px] leading-tight text-base-content/55">de {{ paradas().length }} destinos</span>
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="grid grid-cols-3 divide-x divide-base-300/70 rounded-box border border-base-300/70 bg-base-100 py-2.5 shadow-sm">
              @for (item of resumen(); track item.texto) {
                <div class="flex items-center justify-center gap-2 px-2">
                  <span class="grid size-8 shrink-0 place-items-center rounded-full" [class]="item.burbuja"><app-icono [nombre]="item.icono" class="size-5" /></span>
                  <span class="min-w-0 leading-tight">
                    <strong class="block font-display text-lg">{{ item.valor }}</strong>
                    <span class="block truncate text-xs text-base-content/60">{{ item.texto }}</span>
                  </span>
                </div>
              }
            </div>
          }

          <div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
            <div class="grid grid-cols-2 gap-1 rounded-xl bg-base-100 p-1 shadow-sm sm:w-96" role="tablist">
              <button type="button" role="tab" class="btn btn-sm h-10 gap-2 rounded-lg border-0 shadow-none" [class]="modo() === 'listado' ? 'bg-azul text-white' : 'bg-transparent text-base-content/70'" [attr.aria-selected]="modo() === 'listado'" (click)="modo.set('listado')">
                <app-icono nombre="lista" class="size-5" /> Listado
              </button>
              <button type="button" role="tab" class="btn btn-sm h-10 gap-2 rounded-lg border-0 shadow-none" [class]="modo() === 'mapa' ? 'bg-azul text-white' : 'bg-transparent text-base-content/70'" [attr.aria-selected]="modo() === 'mapa'" (click)="modo.set('mapa')">
                <app-icono nombre="mapa" class="size-5" /> Mapa
              </button>
            </div>
            @if (puedeOperar() && ruta.estado === 'EN_PROCESO') {
              <button type="button" class="btn h-12 gap-2 rounded-xl border-0 bg-azul text-white" (click)="abrirTraslado()">
                <app-icono nombre="pin" class="size-5" /> Agregar traslado
              </button>
            }
          </div>

          @if (trasladoAbierto()) {
            <app-modal titulo="Agregar traslado" (cerrar)="cerrarTraslado()">
              <form class="flex flex-col gap-4" (ngSubmit)="guardarTraslado()">
                <div class="alert alert-warning">En una ruta activa solo puedes agregar un traslado. El destino entra al recorrido de esta ruta.</div>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold">Tipo de servicio</span>
                  <select class="select w-full" disabled>
                    <option>Traslado</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold">Sede</span>
                  <select class="select w-full" [value]="sedeId()" (change)="sedeId.set(valor($event))" required>
                    <option value="">Elige la sede del cliente</option>
                    @for (sede of sedes(); track sede.id) {
                      <option [value]="sede.id">{{ sede.es_principal ? 'Base original · ' : '' }}{{ sede.nombre }} · {{ sede.direccion }}</option>
                    }
                  </select>
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold">Código</span>
                  <input class="input w-full" [value]="codigoTraslado()" (input)="codigoTraslado.set(texto($event))" placeholder="Si lo dejas vacío, se genera uno" />
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-sm font-semibold">Motivo</span>
                  <textarea class="textarea min-h-20 w-full" [value]="motivoTraslado()" (input)="motivoTraslado.set(texto($event))" required placeholder="Por qué se hace este traslado"></textarea>
                </label>
                @if (!sedes().length && !cargandoSedes()) {
                  <div class="alert alert-error">Este cliente no tiene sedes activas para un traslado.</div>
                }
                @if (errorTraslado()) { <div class="alert alert-error">{{ errorTraslado() }}</div> }
                <button type="submit" class="btn btn-primary" [disabled]="enviando() || !sedeId() || !motivoTraslado().trim()">Agregar a la ruta</button>
              </form>
            </app-modal>
          }

          @if (modo() === 'listado') {
            <div class="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
              <article class="cd-card">
                <div class="flex items-center justify-between gap-2">
                  <span class="cd-etiqueta bg-violet-500/10 text-violet-700">Cliente</span>
                  <span class="badge badge-soft gap-1 font-semibold" [class]="chipActual().clase">
                    @if (chipActual().check) { <app-icono nombre="check" class="size-3.5" /> }
                    {{ chipActual().texto }}
                  </span>
                </div>
                <p class="flex items-center gap-2.5"><app-icono nombre="edificio" class="size-7 text-primary" /><strong class="min-w-0 font-display text-lg leading-tight">{{ ruta.cliente_nombre }}</strong></p>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div class="flex min-w-0 flex-col gap-3">
                    <p class="cd-dato"><app-icono nombre="caja" class="size-5" /><span><span class="cd-dato-label">Servicio</span>{{ servicios() }}</span></p>
                    <p class="cd-dato"><app-icono nombre="calendario" class="size-5" /><span><span class="cd-dato-label">Fecha</span>{{ fechaCorta(ruta.fecha) }}</span></p>
                    <p class="cd-dato"><app-icono nombre="reloj" class="size-5" /><span><span class="cd-dato-label">Horario</span>{{ horario() }}</span></p>
                  </div>
                  <div class="flex min-w-0 flex-col gap-3 border-l border-base-300 pl-3">
                    <p class="cd-dato"><app-icono nombre="camion" class="size-5" /><span><span class="cd-dato-label">Placa</span>{{ ruta.vehiculo?.placa || '—' }}</span></p>
                    <p class="cd-dato"><app-icono nombre="perfil" class="size-5" /><span><span class="cd-dato-label">Conductor</span>{{ nombrePersona(ruta.conductor) }}</span></p>
                    <p class="cd-dato"><app-icono nombre="grupo" class="size-5" /><span><span class="cd-dato-label">Auxiliares</span>{{ auxiliares() }}</span></p>
                  </div>
                </div>
              </article>

              <article class="cd-card gap-0 overflow-hidden p-0">
                <div class="flex items-center gap-2 px-4 pt-4 pb-1">
                  <app-icono nombre="pin" class="size-6 text-azul" />
                  <h3>Destinos de la ruta ({{ paradas().length }})</h3>
                </div>
                <ul class="divide-y divide-base-300/70 px-2">
                  @for (parada of paradas(); track parada.destino_id; let i = $index) {
                    <li>
                      <button type="button" class="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-base-200/70 active:scale-[0.99]" (click)="abrirParada(parada)">
                        <span class="grid size-9 shrink-0 place-items-center rounded-full font-display text-base font-bold" [class]="estilo(parada).circulo">{{ i + 1 }}</span>
                        <span class="min-w-0 flex-1">
                          <strong class="block truncate leading-tight">{{ titulo(parada) }}</strong>
                          <span class="block truncate text-sm text-base-content/70">{{ parada.direccion }}</span>
                          <span class="block truncate text-xs text-base-content/55">Distrito: {{ parada.distrito || '—' }}</span>
                        </span>
                        <span class="flex shrink-0 flex-col items-end gap-1">
                          <ng-container *ngTemplateOutlet="chip; context: { $implicit: parada }" />
                          <span class="text-xs text-base-content/60">{{ horaParada(parada) }}</span>
                        </span>
                        <app-icono nombre="derecha" class="size-4 text-base-content/40" />
                      </button>
                    </li>
                  } @empty {
                    <li class="px-2 py-6 text-center text-sm text-base-content/60">La ruta no tiene destinos.</li>
                  }
                </ul>
                @if (hayAccion()) {
                  <div class="p-4 pt-2"><ng-container *ngTemplateOutlet="accion" /></div>
                }
              </article>
            </div>
          } @else {
            <div class="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-3">
              <div class="relative z-0 h-[44vh] min-h-64 overflow-hidden rounded-box border border-base-300/70 shadow-sm lg:h-[min(72vh,640px)]">
                <app-mapa [marcas]="marcas()" [geometria]="geometria()" [colorLinea]="color()" [encuadre]="encuadre()" (marcaClick)="enfocar($event)" />
                <button type="button" class="btn btn-circle btn-sm absolute top-3 right-3 z-[500] border-0 bg-base-100 shadow" (click)="centrado.update((n) => n + 1)" aria-label="Centrar mapa">
                  <app-icono nombre="ubicacion" class="size-5 text-base-content/70" />
                </button>
              </div>

              <article class="cd-card relative z-10 -mt-6 rounded-t-3xl lg:mt-0 lg:rounded-box">
                <span class="mx-auto -mt-1 h-1 w-10 rounded-full bg-base-300 lg:hidden"></span>
                @if (foco(); as parada) {
                  <div class="flex items-center justify-between gap-2">
                    <span class="rounded-full border border-base-300 px-3 py-1 text-xs font-semibold">
                      {{ parada.destino_id === actual()?.destino_id ? 'Destino actual' : 'Destino' }} ({{ posicion(parada) }} de {{ paradas().length }})
                    </span>
                    <ng-container *ngTemplateOutlet="chip; context: { $implicit: parada }" />
                  </div>
                  <button type="button" class="flex items-start gap-3 text-left" (click)="abrirParada(parada)">
                    <app-icono nombre="tienda" class="size-8 text-primary" />
                    <span class="min-w-0 flex-1">
                      <strong class="block font-display text-lg leading-tight">{{ titulo(parada) }}</strong>
                      <span class="mt-1 flex items-start gap-1.5 text-sm text-base-content/70">
                        <app-icono nombre="pin" class="mt-0.5 size-4" />
                        <span class="min-w-0">{{ parada.direccion }}{{ parada.distrito ? ', ' + parada.distrito : '' }}</span>
                      </span>
                    </span>
                    <app-icono nombre="derecha" class="mt-2 size-5 text-base-content/40" />
                  </button>
                  @let llegada = eta(parada);
                  <div class="grid grid-cols-2 gap-3 border-t border-base-300/70 pt-3 text-sm">
                    <p class="cd-dato">
                      <app-icono nombre="reloj" class="size-6" />
                      <span class="min-w-0"><span class="cd-dato-label">{{ llegada.etiqueta }}</span><strong class="block font-display text-lg leading-tight">{{ llegada.valor }}</strong><span class="text-xs text-base-content/55">{{ llegada.detalle }}</span></span>
                    </p>
                    <p class="cd-dato border-l border-base-300 pl-3">
                      <app-icono nombre="calendario" class="size-6" />
                      <span class="min-w-0"><span class="cd-dato-label">Ventana de atención</span><strong class="block font-display text-lg leading-tight">Por confirmar</strong><span class="text-xs text-base-content/55">{{ diaRuta() }}</span></span>
                    </p>
                  </div>
                  <div class="grid gap-2" [class.grid-cols-2]="!!telefono(parada)">
                    @if (telefono(parada); as tel) {
                      <a class="btn min-h-12 gap-2 rounded-xl border-azul/40 bg-azul/5 text-base text-azul hover:bg-azul/10" [href]="'tel:' + tel">
                        <app-icono nombre="telefono" class="size-5" /> Llamar
                      </a>
                    }
                    <a class="cd-btn" [href]="navegar(parada)" target="_blank" rel="noopener">
                      <app-icono nombre="navegar" class="size-5" /> Navegar
                    </a>
                  </div>
                } @else {
                  <p class="vacio-texto">{{ paradas().length ? 'Todos los destinos están cerrados.' : 'La ruta no tiene destinos.' }}</p>
                }
                @if (hayAccion()) {
                  <div class="border-t border-base-300/70 pt-3"><ng-container *ngTemplateOutlet="accion" /></div>
                }
              </article>
            </div>
          }
        }
      </div>

      <ng-template #chip let-parada>
        <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold" [class]="estilo(parada).chip">
          <app-icono [nombre]="estilo(parada).icono" class="size-3.5" />
          {{ estilo(parada).texto }}
        </span>
      </ng-template>

      <ng-template #accion>
        @if (ruta.estado === 'NO_INICIADA') {
          <button type="button" class="cd-btn h-auto whitespace-normal py-2" (click)="iniciar()" [disabled]="enviando() || !puedeIniciar()">
            <app-icono nombre="play" class="size-5" />
            {{ puedeIniciar() ? 'Iniciar ruta' : 'Termina la ruta en proceso antes de iniciar otra' }}
          </button>
        } @else if (ruta.estado === 'EN_PROCESO') {
          <button type="button" class="cd-btn h-auto flex-col gap-0.5 py-2.5 disabled:bg-azul/40 disabled:text-white" (click)="finalizar()" [disabled]="enviando() || !todasCerradas()">
            <span class="flex items-center gap-2"><app-icono nombre="bandera" class="size-5" /> Finalizar ruta</span>
            <span class="text-xs font-normal opacity-90">{{ todasCerradas() ? 'Confirma tu llegada a la base Varpal' : 'Completa todas las entregas para habilitar esta acción' }}</span>
          </button>
        }
      </ng-template>

      <dialog #dialogoFinal class="modal modal-bottom sm:modal-middle" aria-labelledby="titulo-finalizar" (cancel)="cancelarDialogo($event)" (close)="confirmarFinal.set(false)">
        <div class="modal-box flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-box sm:p-6">
          <div class="flex flex-col items-center gap-3 text-center">
            <span class="grid size-16 place-items-center rounded-full bg-azul/10 text-azul">
              <app-icono nombre="bandera" class="size-8" />
            </span>
            <h2 id="titulo-finalizar" class="font-display text-xl">Finalizar ruta</h2>
            <p class="text-sm text-base-content/70">¿Confirmas tu llegada a la base Varpal? La ruta quedará finalizada.</p>
          </div>

          <div class="flex flex-col gap-2 rounded-box border border-base-300/70 bg-base-200/40 p-3 text-sm">
            <p class="flex items-center gap-2"><app-icono nombre="edificio" class="size-5 text-primary" /><strong class="min-w-0 truncate">{{ ruta.cliente_nombre }}</strong></p>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span class="flex items-center gap-1.5 font-semibold text-emerald-700"><app-icono nombre="check" class="size-4" /> {{ resumen()[1].valor }} exitosas</span>
              <span class="flex items-center gap-1.5 font-semibold text-red-700"><app-icono nombre="x-circulo" class="size-4" /> {{ resumen()[2].valor }} fallidas</span>
              <span class="text-base-content/60">de {{ paradas().length }} destinos</span>
            </div>
          </div>

          @if (errorFinal()) { <div class="alert alert-error text-sm" role="alert">{{ errorFinal() }}</div> }

          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn min-h-12 rounded-xl border-base-300 bg-base-100 text-base" (click)="cerrarFinalizar()" [disabled]="enviando()">Cancelar</button>
            <button type="button" class="cd-btn" (click)="confirmarFinalizar()" [disabled]="enviando()">
              @if (enviando()) { <span class="loading loading-spinner loading-sm"></span> } @else { <app-icono nombre="bandera" class="size-5" /> }
              Finalizar ruta
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="cerrarFinalizar()"></div>
      </dialog>
    }
  `,
})
export class RutaConductor {
  readonly ruta = input.required<Ruta>();
  readonly puedeIniciar = input(false);
  readonly puedeOperar = input(true);
  readonly color = input('#00275a');
  readonly posicionHoy = input<{ indice: number; total: number } | null>(null);
  readonly modo = model<Modo>('listado');
  readonly cambio = output<Ruta>();
  readonly cerrada = output<void>();

  private readonly api = inject(Api);
  private clave = '';
  private readonly pedidos = new Set<number>();
  protected readonly fechaCorta = fechaCorta;
  protected readonly horaCorta = horaCorta;
  protected readonly nombrePersona = nombrePersona;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly atendida = atendida;
  protected readonly seleccionadaId = signal<number | null>(null);
  protected readonly focoId = signal<number | null>(null);
  protected readonly centrado = signal(0);
  protected readonly ahora = signal(Date.now());
  protected readonly telefonos = signal<Record<number, string>>({});
  protected readonly evidencias = signal<Record<number, Evidencia[]>>({});
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly enviando = signal(false);
  protected readonly confirmarFinal = signal(false);
  protected readonly errorFinal = signal('');
  protected readonly trasladoAbierto = signal(false);
  protected readonly sedes = signal<Punto[]>([]);
  protected readonly cargandoSedes = signal(false);
  protected readonly sedeId = signal('');
  protected readonly codigoTraslado = signal('');
  protected readonly motivoTraslado = signal('');
  protected readonly errorTraslado = signal('');
  private readonly dialogoFinal = viewChild<ElementRef<HTMLDialogElement>>('dialogoFinal');

  protected readonly paradas = computed(() => [...this.ruta().paradas].sort((a, b) => a.orden - b.orden));
  protected readonly todasCerradas = computed(() => paradasCerradas(this.ruta().paradas));
  protected readonly chipActual = computed(() => chipRuta(this.ruta()));
  protected readonly horario = computed(() => horarioParadas(this.ruta().paradas));
  protected readonly auxiliares = computed(() => textoAuxiliares(this.ruta().auxiliares));
  protected readonly hayAccion = computed(
    () => this.puedeOperar() && (this.ruta().estado === 'NO_INICIADA' || this.ruta().estado === 'EN_PROCESO'),
  );
  protected readonly servicios = computed(() => {
    const tipos = [...new Set(this.ruta().paradas.map((parada) => etiquetaTipo(parada.tipo_servicio)))];
    return tipos.length ? tipos.join(', ') : '—';
  });
  protected readonly tituloRuta = computed(() => {
    switch (this.ruta().estado) {
      case 'EN_PROCESO':
        return 'Ruta en curso';
      case 'FINALIZADA':
        return 'Ruta finalizada';
      case 'CANCELADA':
        return 'Ruta cancelada';
      default:
        return 'Ruta asignada';
    }
  });
  protected readonly subtitulo = computed(() => {
    const ruta = this.ruta();
    if (ruta.estado === 'EN_PROCESO') return `${ruta.cliente_nombre} - ${this.servicios()}`;
    if (ruta.estado === 'FINALIZADA') return `Finalizada a las ${horaCorta(ruta.finalizada_en)} · ${fechaCorta(ruta.fecha)}`;
    if (ruta.fecha.slice(0, 10) === hoy()) {
      const posicion = this.posicionHoy();
      return posicion && posicion.total > 1
        ? `Ruta ${posicion.indice} de ${posicion.total} asignadas para hoy`
        : 'Ruta asignada para hoy';
    }
    if (ruta.fecha.slice(0, 10) < hoy()) return `Pendiente desde el ${fechaCorta(ruta.fecha)}`;
    return `Programada para el ${fechaCorta(ruta.fecha)}`;
  });
  protected readonly diaRuta = computed(() => {
    const fecha = fechaCorta(this.ruta().fecha);
    return this.ruta().fecha.slice(0, 10) === hoy() ? `Hoy, ${fecha}` : fecha;
  });
  protected readonly resumen = computed(() => resumenParadas(this.ruta().paradas));
  protected readonly actual = computed(
    () =>
      this.paradas().find((p) => p.estado === 'EN_PROCESO') ??
      this.paradas().find((p) => p.estado === 'NO_INICIADO') ??
      null,
  );
  protected readonly foco = computed(() => {
    const id = this.focoId();
    return this.paradas().find((p) => p.destino_id === id) ?? this.actual();
  });
  protected readonly seleccionada = computed(() => {
    const id = this.seleccionadaId();
    return id == null ? null : (this.paradas().find((p) => p.destino_id === id) ?? null);
  });
  protected readonly geometria = computed(() => lineaGeo(this.ruta().geometria_empresa));
  protected readonly encuadre = computed(() => {
    const puntos = this.ruta().paradas.map((parada) => `${parada.latitud},${parada.longitud}`).join('|');
    const origen = this.ruta().base_origen;
    const inicio = origen ? `${origen.latitud},${origen.longitud}` : '';
    return `ruta-${this.ruta().id}-${this.centrado()}-${inicio}-${puntos}`;
  });
  protected readonly marcas = computed(() => {
    const ruta = this.ruta();
    const latitud = ruta.ultima_latitud;
    const longitud = ruta.ultima_longitud;
    return marcasRuta({
      paradas: this.paradas().map((parada, i) => ({ ...parada, orden: i + 1 })),
      origen: ruta.base_origen,
      final: ruta.base_final,
      camion: ruta.estado === 'EN_PROCESO' && latitud && longitud ? { latitud, longitud } : null,
      camionId: ruta.id,
      color: this.color(),
    });
  });

  constructor() {
    effect(() => {
      const ruta = this.ruta();
      const clave = `${ruta.id}:${ruta.estado}`;
      if (clave === this.clave) return;
      const primera = this.clave === '';
      const otraRuta = !this.clave.startsWith(`${ruta.id}:`);
      this.clave = clave;
      if (ruta.estado === 'EN_PROCESO' && (primera || !otraRuta)) this.modo.set('mapa');
      else if (!otraRuta) this.modo.set('listado');
      if (otraRuta) {
        this.seleccionadaId.set(null);
        this.focoId.set(null);
        this.error.set('');
        this.aviso.set('');
        this.confirmarFinal.set(false);
      }
    });
    effect(() => {
      const dialogo = this.dialogoFinal()?.nativeElement;
      if (!dialogo) return;
      if (this.confirmarFinal() && !dialogo.open) dialogo.showModal();
      else if (!this.confirmarFinal() && dialogo.open) dialogo.close();
    });
    effect(() => {
      for (const parada of [this.foco(), this.seleccionada()]) {
        if (parada) this.cargarTelefono(parada.destino_id);
      }
    });
    const reloj = window.setInterval(() => this.ahora.set(Date.now()), 30000);
    inject(DestroyRef).onDestroy(() => window.clearInterval(reloj));
  }

  estilo(parada: Parada): EstiloParada {
    if (parada.estado === 'EXITOSO') {
      return {
        texto: EXITO[parada.tipo_servicio] ?? 'Exitoso',
        chip: 'bg-emerald-50 text-emerald-700',
        circulo: 'bg-emerald-100 text-emerald-700',
        icono: 'check',
      };
    }
    if (parada.estado === 'FALLIDO') {
      return { texto: 'Fallido', chip: 'bg-red-50 text-red-700', circulo: 'bg-red-100 text-red-700', icono: 'x-circulo' };
    }
    if (parada.estado === 'PENDIENTE') {
      return { texto: 'Evidencia pendiente', chip: 'bg-amber-50 text-amber-700', circulo: 'bg-amber-100 text-amber-700', icono: 'camara' };
    }
    return { texto: 'Pendiente', chip: 'bg-amber-50 text-amber-700', circulo: 'bg-amber-100 text-amber-700', icono: 'reloj' };
  }

  titulo(parada: Parada): string {
    const receptor = `${parada.nombre_receptor} ${parada.apellido_receptor}`.trim();
    return receptor ? `${parada.codigo_externo} ${receptor}` : parada.codigo_externo;
  }

  posicion(parada: Parada): number {
    return this.paradas().findIndex((p) => p.destino_id === parada.destino_id) + 1;
  }

  horaParada(parada: Parada): string {
    if (atendida(parada)) return horaCorta(parada.hora_fin_descarga || parada.hora_salida);
    return parada.hora_estimada ? `Est. ${horaCorta(parada.hora_estimada)}` : '—';
  }

  eta(parada: Parada): { etiqueta: string; valor: string; detalle: string } {
    if (atendida(parada)) return { etiqueta: 'Atendido', valor: this.horaParada(parada), detalle: 'Fin de descarga' };
    if (!parada.hora_estimada) return { etiqueta: 'Llegada estimada', valor: 'Por calcular', detalle: 'Se calcula al iniciar la ruta' };
    const hora = horaCorta(parada.hora_estimada);
    const minutos = Math.round((new Date(parada.hora_estimada).getTime() - this.ahora()) / 60000);
    if (minutos <= 0) return { etiqueta: 'Llegada estimada', valor: hora, detalle: 'Hora estimada alcanzada' };
    const valor = minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
    return { etiqueta: 'Llegada estimada', valor, detalle: hora };
  }

  telefono(parada: Parada): string {
    return this.telefonos()[parada.destino_id] ?? '';
  }

  navegar(parada: Parada): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${parada.latitud},${parada.longitud}`;
  }

  enfocar(id: string): void {
    if (!id.startsWith('parada-')) return;
    this.focoId.set(Number(id.slice('parada-'.length)));
  }

  abrirParada(parada: Parada): void {
    this.seleccionadaId.set(parada.destino_id);
    window.scrollTo({ top: 0 });
    if (atendida(parada) && !this.evidencias()[parada.destino_id]) {
      this.api.get<Evidencia[]>(`/api/destinos/${parada.destino_id}/evidencias/`).subscribe({
        next: (fotos) => this.evidencias.update((actual) => ({ ...actual, [parada.destino_id]: fotos })),
        error: (err: unknown) => this.error.set(mensajeError(err)),
      });
    }
  }

  cerrarDetalle(): void {
    this.seleccionadaId.set(null);
    window.scrollTo({ top: 0 });
  }

  paradaCerrada(): void {
    this.cerrarDetalle();
    this.focoId.set(null);
    this.aviso.set('Destino cerrado. La numeración sigue el orden de las visitas.');
    this.recargar();
  }

  alGeoreferenciar(): void {
    this.aviso.set('Ubicación guardada. El mapa ya usa este punto.');
    this.recargar();
  }

  abrirTraslado(): void {
    if (this.ruta().estado !== 'EN_PROCESO') return;
    this.errorTraslado.set('');
    this.sedeId.set('');
    this.codigoTraslado.set('');
    this.motivoTraslado.set('');
    this.trasladoAbierto.set(true);
    this.cargandoSedes.set(true);
    this.api.get<Pagina<Punto>>('/api/puntos/', {
      cliente: this.ruta().cliente_id,
      activo: true,
      page_size: TAMANO_CATALOGO,
    }).subscribe({
      next: (pagina) => {
        const lista = pagina.results
          .filter((punto) => punto.es_sede || punto.es_principal)
          .sort((a, b) => Number(b.es_principal) - Number(a.es_principal));
        this.sedes.set(lista);
        const base = lista.find((punto) => punto.es_principal) ?? lista[0];
        this.sedeId.set(base ? String(base.id) : '');
        this.cargandoSedes.set(false);
      },
      error: (err: unknown) => {
        this.cargandoSedes.set(false);
        this.errorTraslado.set(mensajeError(err));
      },
    });
  }

  cerrarTraslado(): void {
    if (!this.enviando()) this.trasladoAbierto.set(false);
  }

  valor(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  texto(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  guardarTraslado(): void {
    const sede = Number(this.sedeId());
    const motivo = this.motivoTraslado().trim();
    if (!sede || !motivo || this.ruta().estado !== 'EN_PROCESO') return;
    this.enviando.set(true);
    this.errorTraslado.set('');
    this.api.post<Ruta>(`/api/rutas/${this.ruta().id}/traslado/`, {
      sede_id: sede,
      codigo_externo: this.codigoTraslado().trim(),
      motivo_servicio: motivo,
      tipo_servicio: 'TRASLADO',
    }).subscribe({
      next: (ruta) => {
        this.enviando.set(false);
        this.trasladoAbierto.set(false);
        this.aviso.set('Traslado agregado a la ruta.');
        this.cambio.emit(ruta);
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.errorTraslado.set(mensajeError(err));
      },
    });
  }

  iniciar(): void {
    this.accion('iniciar', 'Ruta iniciada. Los administradores reciben el aviso.');
  }

  finalizar(): void {
    this.errorFinal.set('');
    this.confirmarFinal.set(true);
  }

  cerrarFinalizar(): void {
    if (!this.enviando()) this.confirmarFinal.set(false);
  }

  cancelarDialogo(evento: Event): void {
    evento.preventDefault();
    this.cerrarFinalizar();
  }

  confirmarFinalizar(): void {
    this.enviando.set(true);
    this.errorFinal.set('');
    this.api.post(`/api/rutas/${this.ruta().id}/llegada-base/`, {}).subscribe({
      next: () => {
        this.enviando.set(false);
        this.confirmarFinal.set(false);
        this.error.set('');
        this.aviso.set('Llegada confirmada. La ruta quedó finalizada.');
        this.recargar();
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.errorFinal.set(mensajeError(err));
      },
    });
  }

  private recargar(): void {
    this.api.get<Ruta>(`/api/rutas/${this.ruta().id}/`).subscribe({
      next: (ruta) => this.cambio.emit(ruta),
      error: (err: unknown) => this.error.set(mensajeError(err)),
    });
  }

  private accion(ruta: string, mensaje: string): void {
    this.enviando.set(true);
    this.error.set('');
    this.api.post(`/api/rutas/${this.ruta().id}/${ruta}/`, {}).subscribe({
      next: () => {
        this.aviso.set(mensaje);
        this.enviando.set(false);
        this.recargar();
      },
      error: (err: unknown) => {
        this.enviando.set(false);
        this.error.set(mensajeError(err));
      },
    });
  }

  private cargarTelefono(destinoId: number): void {
    if (this.pedidos.has(destinoId)) return;
    this.pedidos.add(destinoId);
    this.api.get<Destino>(`/api/destinos/${destinoId}/`).subscribe({
      next: (destino) =>
        this.telefonos.update((actual) => ({ ...actual, [destinoId]: destino.telefono_receptor.trim() })),
      error: () => this.pedidos.delete(destinoId),
    });
  }
}
