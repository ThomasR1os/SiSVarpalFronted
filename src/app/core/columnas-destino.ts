import { Destino } from './models';
import { CAMPOS_DESTINO, etiquetaTipo, fechaCorta } from './texto';

export interface ColumnaDestino {
  clave: string;
  etiqueta: string;
}

const CAMPOS = new Set(CAMPOS_DESTINO.map((campo) => campo.campo));

export function columnasExcel(filas: readonly Record<string, string>[]): ColumnaDestino[] {
  const extras: string[] = [];
  const vistas = new Set<string>();
  for (const fila of filas) {
    for (const clave of Object.keys(fila)) {
      if (CAMPOS.has(clave) || vistas.has(clave)) continue;
      vistas.add(clave);
      extras.push(clave);
    }
  }
  return [
    ...CAMPOS_DESTINO.map((campo) => ({ clave: campo.campo, etiqueta: campo.etiqueta })),
    ...extras.map((clave) => ({ clave, etiqueta: clave })),
  ];
}

export function valoresExcel(destino: Destino, codigoSede = ''): Record<string, string> {
  const fila: Record<string, string> = {};
  for (const campo of CAMPOS_DESTINO) {
    fila[campo.campo] = textoCampo(destino, campo.campo, codigoSede);
  }
  for (const [clave, valor] of Object.entries(destino.datos_extra ?? {})) {
    if (CAMPOS.has(clave)) continue;
    fila[clave] = textoPlano(valor);
  }
  return fila;
}

function textoCampo(destino: Destino, clave: string, codigoSede: string): string {
  switch (clave) {
    case 'codigo_externo':
      return textoPlano(destino.codigo_externo);
    case 'fecha':
      return fechaCorta(destino.fecha);
    case 'tipo_servicio':
      return etiquetaTipo(destino.tipo_servicio);
    case 'motivo_servicio':
      return textoPlano(destino.motivo_servicio);
    case 'documento_receptor':
      return textoPlano(destino.documento_receptor);
    case 'nombre_receptor':
      return textoPlano(destino.nombre_receptor);
    case 'apellido_receptor':
      return textoPlano(destino.apellido_receptor);
    case 'telefono_receptor':
      return textoPlano(destino.telefono_receptor);
    case 'direccion':
      return textoPlano(destino.direccion);
    case 'distrito':
      return textoPlano(destino.distrito);
    case 'referencia':
      return textoPlano(destino.referencia);
    case 'latitud':
      return textoPlano(destino.latitud);
    case 'longitud':
      return textoPlano(destino.longitud);
    case 'observaciones':
      return textoPlano(destino.observaciones);
    case 'codigo_sede':
      return textoPlano(codigoSede);
    default:
      return '—';
  }
}

function textoPlano(valor: unknown): string {
  if (valor == null) return '—';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'string') return valor.trim() || '—';
  try {
    const json = JSON.stringify(valor);
    return json && json !== '{}' && json !== '[]' ? json : '—';
  } catch {
    return '—';
  }
}
