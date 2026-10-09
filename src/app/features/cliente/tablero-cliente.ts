import { Destino, EstadoDestino, Ruta } from '../../core/models';
import { etiquetaTipo, nombrePersona } from '../../core/texto';
import { ZonaFiltro } from './rutas-cliente';

export type GrupoPedido = 'EXITOSO' | 'FALLIDO' | 'PENDIENTE';
export type FiltroEstado = '' | GrupoPedido;

export interface FiltroTablero {
  mes: string;
  dia: string;
  codigo: string;
  zona: ZonaFiltro;
  estado: FiltroEstado;
}

export interface PedidoVista {
  id: number;
  fecha: string;
  codigo: string;
  grupo: GrupoPedido;
  estado: EstadoDestino;
  servicio: string;
  distrito: string;
  motivo: string;
  comentario: string;
  rutaId: number | null;
  zona: 'lima' | 'provincia' | null;
  placa: string;
  conductor: string;
  documento: string;
  destinatario: string;
  operacion: string;
  actualizado: string;
}

export interface FilaKm {
  id: number;
  fecha: string;
  placa: string;
  metros: number;
  dentroDeLima: boolean;
  paradas: number;
}

export interface BarraDia {
  fecha: string;
  exitosas: number;
  fallidas: number;
  pendientes: number;
  total: number;
  alto: number;
}

export interface BarraNombre {
  nombre: string;
  total: number;
  ancho: number;
}

export interface FilaMotivo {
  fecha: string;
  motivo: string;
  cantidad: number;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function pedidosDe(destinos: readonly Destino[], rutas: readonly Ruta[]): PedidoVista[] {
  const porRuta = new Map(rutas.map((ruta) => [ruta.id, ruta]));
  return destinos.map((destino) => {
    const ruta = destino.ruta_id == null ? undefined : porRuta.get(destino.ruta_id);
    const grupo: GrupoPedido =
      destino.estado === 'EXITOSO' ? 'EXITOSO' : destino.estado === 'FALLIDO' ? 'FALLIDO' : 'PENDIENTE';
    const descripcion = destino.motivo_descripcion?.trim();
    return {
      id: destino.id,
      fecha: destino.fecha.slice(0, 10),
      codigo: destino.codigo_externo,
      grupo,
      estado: destino.estado,
      servicio: `${etiquetaTipo(destino.tipo_servicio)} · ${destino.direccion || destino.motivo_servicio || 'Sin dirección'}`,
      distrito: destino.distrito.trim() || 'Sin distrito',
      motivo: descripcion || (grupo === 'FALLIDO' ? 'Sin motivo' : '—'),
      comentario: destino.observacion_cierre.trim() || destino.observaciones.trim() || '—',
      rutaId: ruta ? destino.ruta_id : null,
      zona: ruta ? (ruta.dentro_de_lima ? 'lima' : 'provincia') : null,
      placa: ruta?.vehiculo?.placa || '—',
      conductor: ruta?.conductor ? nombrePersona(ruta.conductor) : '—',
      documento: destino.documento_receptor.trim() || '—',
      destinatario: `${destino.nombre_receptor} ${destino.apellido_receptor}`.trim() || '—',
      operacion: etiquetaTipo(destino.tipo_servicio),
      actualizado: destino.actualizado_en,
    };
  });
}

export function filtrarPedidos(pedidos: readonly PedidoVista[], filtro: FiltroTablero): PedidoVista[] {
  return pedidos.filter((pedido) => coincidePedido(pedido, filtro));
}

export function filtrarRutas(rutas: readonly Ruta[], filtro: FiltroTablero): FilaKm[] {
  return rutas
    .filter((ruta) => {
      if (filtro.mes && !ruta.fecha.startsWith(filtro.mes)) return false;
      if (filtro.dia && ruta.fecha !== filtro.dia) return false;
      if (filtro.zona === 'lima' && !ruta.dentro_de_lima) return false;
      if (filtro.zona === 'provincia' && ruta.dentro_de_lima) return false;
      if (filtro.codigo && !ruta.paradas.some((parada) => parada.codigo_externo === filtro.codigo)) return false;
      return true;
    })
    .map((ruta) => ({
      id: ruta.id,
      fecha: ruta.fecha,
      placa: ruta.vehiculo?.placa || 'Sin placa',
      metros: ruta.distancia_metros ?? 0,
      dentroDeLima: ruta.dentro_de_lima,
      paradas: ruta.paradas.length,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}

export function serieDiaria(pedidos: readonly PedidoVista[]): BarraDia[] {
  const porFecha = new Map<string, BarraDia>();
  for (const pedido of pedidos) {
    const barra = porFecha.get(pedido.fecha) ?? {
      fecha: pedido.fecha,
      exitosas: 0,
      fallidas: 0,
      pendientes: 0,
      total: 0,
      alto: 0,
    };
    barra.total += 1;
    if (pedido.grupo === 'EXITOSO') barra.exitosas += 1;
    else if (pedido.grupo === 'FALLIDO') barra.fallidas += 1;
    else barra.pendientes += 1;
    porFecha.set(pedido.fecha, barra);
  }
  const barras = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const maximo = Math.max(...barras.map((barra) => barra.total), 1);
  return barras.map((barra) => ({ ...barra, alto: Math.max(14, Math.round((barra.total / maximo) * 100)) }));
}

export function porDistrito(pedidos: readonly PedidoVista[]): BarraNombre[] {
  return barrasPorNombre(pedidos.map((pedido) => pedido.distrito));
}

export function porMotivo(pedidos: readonly PedidoVista[]): FilaMotivo[] {
  const grupos = new Map<string, FilaMotivo>();
  for (const pedido of pedidos) {
    if (pedido.grupo !== 'FALLIDO') continue;
    const clave = `${pedido.fecha}|${pedido.motivo}`;
    const fila = grupos.get(clave) ?? { fecha: pedido.fecha, motivo: pedido.motivo, cantidad: 0 };
    fila.cantidad += 1;
    grupos.set(clave, fila);
  }
  return [...grupos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.cantidad - a.cantidad || a.motivo.localeCompare(b.motivo));
}

export function mesesDe(pedidos: readonly PedidoVista[]): string[] {
  return [...new Set(pedidos.map((pedido) => pedido.fecha.slice(0, 7)))].sort((a, b) => b.localeCompare(a));
}

export function diasDe(pedidos: readonly PedidoVista[], mes: string): string[] {
  return [...new Set(pedidos.filter((pedido) => !mes || pedido.fecha.startsWith(mes)).map((pedido) => pedido.fecha))].sort(
    (a, b) => b.localeCompare(a),
  );
}

export function codigosDe(pedidos: readonly PedidoVista[], filtro: Pick<FiltroTablero, 'mes' | 'dia' | 'zona'>): string[] {
  const vistos = pedidos.filter((pedido) => coincidePedido(pedido, { ...filtro, codigo: '', estado: '' }));
  return [...new Set(vistos.map((pedido) => pedido.codigo))].sort((a, b) => a.localeCompare(b));
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function etiquetaMes(valor: string): string {
  const [anio, mes] = valor.split('-');
  const nombre = MESES[Number(mes) - 1];
  return nombre ? `${nombre} ${anio}` : valor;
}

export function etiquetaMesCorta(valor: string): string {
  const [anio, mes] = valor.split('-');
  const nombre = MESES_CORTOS[Number(mes) - 1];
  return nombre ? `${nombre} ${anio.slice(2)}` : valor;
}

export function ultimosMeses(hoyIso: string, cantidad = 12): string[] {
  const [anio, mes] = hoyIso.split('-').map(Number);
  const lista: string[] = [];
  for (let i = cantidad - 1; i >= 0; i -= 1) {
    const fecha = new Date(anio, mes - 1 - i, 1);
    lista.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`);
  }
  return lista;
}

export function mesAnterior(iso: string): string {
  const [anio, mes] = iso.split('-').map(Number);
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function ultimoDia(fechas: readonly string[], hoyIso: string): string {
  const previas = fechas.filter((fecha) => fecha <= hoyIso).sort();
  return previas.at(-1) ?? hoyIso;
}

export function etiquetaDia(iso: string): string {
  const partes = iso.split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return iso;
  const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return `${dias[fecha.getDay()]} ${partes[2]}`;
}

export function diaCorto(iso: string): string {
  const partes = iso.split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}`;
}

function barrasPorNombre(nombres: readonly string[]): BarraNombre[] {
  const conteo = new Map<string, number>();
  for (const nombre of nombres) conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
  const barras = [...conteo.entries()]
    .map(([nombre, total]) => ({ nombre, total, ancho: 0 }))
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  const maximo = Math.max(...barras.map((barra) => barra.total), 1);
  return barras.map((barra) => ({ ...barra, ancho: Math.max(4, Math.round((barra.total / maximo) * 100)) }));
}

function coincidePedido(pedido: PedidoVista, filtro: FiltroTablero): boolean {
  if (filtro.mes && !pedido.fecha.startsWith(filtro.mes)) return false;
  if (filtro.dia && pedido.fecha !== filtro.dia) return false;
  if (filtro.codigo && pedido.codigo !== filtro.codigo) return false;
  if (filtro.zona === 'lima' && pedido.zona !== 'lima') return false;
  if (filtro.zona === 'provincia' && pedido.zona !== 'provincia') return false;
  if (filtro.estado && pedido.grupo !== filtro.estado) return false;
  return true;
}
