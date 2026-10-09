import { EstadoDestino, EstadoRuta, Rol, TipoServicio } from './models';

export const TAMANO_PAGINA = 20;
export const TAMANO_CATALOGO = 100;

export const CAMPOS_DESTINO: { campo: string; etiqueta: string }[] = [
  { campo: 'codigo_externo', etiqueta: 'Código externo' },
  { campo: 'fecha', etiqueta: 'Fecha' },
  { campo: 'tipo_servicio', etiqueta: 'Tipo de servicio' },
  { campo: 'motivo_servicio', etiqueta: 'Motivo del servicio' },
  { campo: 'documento_receptor', etiqueta: 'Documento del receptor' },
  { campo: 'nombre_receptor', etiqueta: 'Nombres del receptor' },
  { campo: 'apellido_receptor', etiqueta: 'Apellidos del receptor' },
  { campo: 'telefono_receptor', etiqueta: 'Celular' },
  { campo: 'direccion', etiqueta: 'Dirección' },
  { campo: 'distrito', etiqueta: 'Distrito' },
  { campo: 'referencia', etiqueta: 'Referencia' },
  { campo: 'latitud', etiqueta: 'Latitud' },
  { campo: 'longitud', etiqueta: 'Longitud' },
  { campo: 'observaciones', etiqueta: 'Observaciones' },
  { campo: 'codigo_sede', etiqueta: 'Código de sede (traslado)' },
];

const ESTADOS_RUTA: Record<EstadoRuta, string> = {
  BORRADOR: 'Borrador',
  NO_INICIADA: 'No iniciada',
  EN_PROCESO: 'En proceso',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const ESTADOS_DESTINO: Record<EstadoDestino, string> = {
  NO_INICIADO: 'No iniciado',
  EN_PROCESO: 'En proceso',
  EXITOSO: 'Exitoso',
  FALLIDO: 'Fallido',
};

const TIPOS: Record<TipoServicio, string> = {
  ENTREGA: 'Entrega',
  INTERCAMBIO: 'Intercambio',
  RECOJO: 'Recojo',
  TRASLADO: 'Traslado',
};

const ROLES: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  CONDUCTOR: 'Conductor',
  AUXILIAR: 'Auxiliar',
  CLIENTE: 'Cliente',
};

export function etiquetaEstado(estado: string): string {
  if (estado in ESTADOS_RUTA) return ESTADOS_RUTA[estado as EstadoRuta];
  if (estado in ESTADOS_DESTINO) return ESTADOS_DESTINO[estado as EstadoDestino];
  return estado;
}

export function etiquetaTipo(tipo: string): string {
  if (tipo in TIPOS) return TIPOS[tipo as TipoServicio];
  return tipo;
}

export function etiquetaRol(rol: string): string {
  if (rol in ROLES) return ROLES[rol as Rol];
  return rol;
}

export function rutaPorRol(rol: Rol): string {
  switch (rol) {
    case 'ADMINISTRADOR':
      return '/admin';
    case 'CONDUCTOR':
      return '/conductor';
    case 'CLIENTE':
      return '/cliente';
    case 'AUXILIAR':
      return '/sin-acceso';
  }
}

export function hoy(): string {
  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function fechaCorta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const dia = valor.slice(0, 10);
  const partes = dia.split('-');
  if (partes.length !== 3) return valor;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function horaCorta(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor.slice(0, 5);
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

export function fechaHora(valor: string | null | undefined): string {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nombrePersona(
  persona: { nombre: string; apellido: string } | null | undefined,
): string {
  if (!persona) return '—';
  return `${persona.nombre} ${persona.apellido}`.trim() || '—';
}

export function distancia(metros: number | null | undefined): string {
  if (metros == null) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

export function duracion(segundos: number | null | undefined): string {
  if (segundos == null) return '—';
  const minutos = Math.round(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas <= 0) return `${resto} min`;
  return `${horas} h ${resto} min`;
}

export function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const COORDENADA = /^(-?\d{1,3})(?:\.(\d+))?$/;
const DECIMALES_COORDENADA = 14;

function unirCoordenada(entero: string, decimales: string): string {
  const limpios = decimales.replace(/0+$/, '');
  return limpios ? `${entero}.${limpios}` : entero;
}

function recortarCoordenada(entero: string, decimales: string): string {
  if (decimales.length <= DECIMALES_COORDENADA) return unirCoordenada(entero, decimales);
  const fraccion = decimales.slice(0, DECIMALES_COORDENADA).split('');
  if (decimales[DECIMALES_COORDENADA] < '5') return unirCoordenada(entero, fraccion.join(''));
  let i = fraccion.length - 1;
  while (i >= 0 && fraccion[i] === '9') {
    fraccion[i] = '0';
    i -= 1;
  }
  if (i >= 0) {
    fraccion[i] = String(Number(fraccion[i]) + 1);
    return unirCoordenada(entero, fraccion.join(''));
  }
  const negativo = entero.startsWith('-');
  const digitos = (negativo ? entero.slice(1) : entero).split('');
  let j = digitos.length - 1;
  while (j >= 0 && digitos[j] === '9') {
    digitos[j] = '0';
    j -= 1;
  }
  if (j >= 0) digitos[j] = String(Number(digitos[j]) + 1);
  else digitos.unshift('1');
  return unirCoordenada(`${negativo ? '-' : ''}${digitos.join('')}`, fraccion.join(''));
}

export function textoCoordenada(valor: string): string | null {
  const texto = valor.trim().replace(',', '.');
  const coincide = COORDENADA.exec(texto);
  if (!coincide) return null;
  return recortarCoordenada(coincide[1], coincide[2] ?? '');
}

export function grados(valor: string | number | null | undefined): number {
  if (valor == null || valor === '') return Number.NaN;
  return Number(valor);
}

export function coordenadaGps(valor: number): string {
  if (!Number.isFinite(valor)) return '';
  return valor.toFixed(14).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function idOpcional(valor: unknown): number | null {
  const n = numero(valor);
  return n && n > 0 ? n : null;
}

export function paradasCerradas(paradas: { estado: string }[]): boolean {
  return paradas.length > 0 && paradas.every((p) => p.estado === 'EXITOSO' || p.estado === 'FALLIDO');
}

export function pesoRuta(estado: EstadoRuta): number {
  switch (estado) {
    case 'EN_PROCESO':
      return 0;
    case 'NO_INICIADA':
      return 1;
    case 'BORRADOR':
      return 2;
    case 'FINALIZADA':
      return 3;
    case 'CANCELADA':
      return 4;
  }
}
