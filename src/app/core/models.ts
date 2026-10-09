export type Rol = 'ADMINISTRADOR' | 'CONDUCTOR' | 'AUXILIAR' | 'CLIENTE';

export type EstadoDestino = 'NO_INICIADO' | 'EN_PROCESO' | 'EXITOSO' | 'FALLIDO';

export type EstadoRuta = 'BORRADOR' | 'NO_INICIADA' | 'EN_PROCESO' | 'FINALIZADA' | 'CANCELADA';

export type TipoServicio = 'ENTREGA' | 'INTERCAMBIO' | 'RECOJO' | 'TRASLADO';

export type AplicaA = 'NO_LLEGO' | 'SERVICIO_FALLIDO' | 'AMBOS';

export interface Pagina<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string;
  documento: string;
  rol: Rol;
  cliente_id: number | null;
  is_active: boolean;
}

export interface Empresa {
  id: number;
  ruc: string;
  razon_social: string;
  telefono: string;
  email: string;
  direccion_principal: string;
  distrito: string;
  latitud: string;
  longitud: string;
}

export interface Cliente {
  id: number;
  ruc: string;
  razon_social: string;
  nombre_comercial: string;
  telefono: string;
  email: string;
  direccion_principal: string;
  distrito: string;
  latitud: string;
  longitud: string;
  activo: boolean;
}

export interface Punto {
  id: number;
  cliente_id: number | null;
  codigo: string;
  nombre: string;
  direccion: string;
  distrito: string;
  latitud: string;
  longitud: string;
  es_principal: boolean;
  es_base_origen: boolean;
  es_sede: boolean;
  es_base_final: boolean;
  activo: boolean;
}

export interface Vehiculo {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  tipo: string;
  capacidad_kg: number;
  activo: boolean;
}

export interface Motivo {
  id: number;
  codigo: string;
  descripcion: string;
  aplica_a: AplicaA;
  activo: boolean;
}

export interface Plantilla {
  id: number;
  cliente_id: number;
  tipo: 'DESTINOS' | 'RUTAS';
  nombre: string;
  activa: boolean;
  mapeo_columnas: Record<string, string>;
}

export interface Destino {
  id: number;
  cliente_id: number;
  fecha: string;
  codigo_externo: string;
  tipo_servicio: TipoServicio;
  sede_id: number | null;
  documento_receptor: string;
  nombre_receptor: string;
  apellido_receptor: string;
  telefono_receptor: string;
  direccion: string;
  distrito: string;
  referencia: string;
  latitud: string;
  longitud: string;
  motivo_servicio: string;
  observaciones: string;
  datos_extra: Record<string, unknown>;
  estado: EstadoDestino;
  motivo_id: number | null;
  motivo_descripcion?: string | null;
  observacion_cierre: string;
  ruta_id: number | null;
  creado_en: string;
  actualizado_en: string;
}

export interface FilaRechazada {
  fila: number;
  errores: string[];
}

export interface ImportacionDestinos {
  creados: number;
  destinos: number[];
  rechazados: FilaRechazada[];
}

export interface PersonaRuta {
  id: number;
  email: string;
  nombre: string;
  apellido: string;
  documento: string;
  rol: Rol;
}

export interface VehiculoRuta {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  tipo: string;
}

export interface PuntoRuta {
  id: number;
  codigo: string;
  nombre: string;
  direccion: string;
  distrito: string;
  latitud: string;
  longitud: string;
}

export interface Parada {
  id: number;
  orden: number;
  destino_id: number;
  codigo_externo: string;
  tipo_servicio: TipoServicio;
  estado: EstadoDestino;
  direccion: string;
  distrito: string;
  latitud: string;
  longitud: string;
  nombre_receptor: string;
  apellido_receptor: string;
  hora_estimada: string | null;
  hora_llegada: string | null;
  hora_salida: string | null;
}

export interface LineStringGeo {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface Ruta {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha: string;
  estado: EstadoRuta;
  conductor: PersonaRuta | null;
  vehiculo: VehiculoRuta | null;
  auxiliares: PersonaRuta[];
  base_origen: PuntoRuta | null;
  base_final?: PuntoRuta | null;
  paradas: Parada[];
  distancia_metros: number | null;
  duracion_segundos: number | null;
  geometria_cliente?: LineStringGeo | null;
  geometria_empresa?: LineStringGeo | null;
  dentro_de_lima: boolean;
  iniciada_en: string | null;
  llegada_base_en: string | null;
  finalizada_en: string | null;
  ultima_latitud: string | null;
  ultima_longitud: string | null;
  ultima_posicion_en: string | null;
}

export interface ParadaOptimizada {
  orden: number;
  destino_id: number;
  codigo_externo: string;
  direccion: string;
  distrito: string;
  latitud: string;
  longitud: string;
}

export interface Optimizacion {
  destino_ids: number[];
  paradas: ParadaOptimizada[];
  distancia_metros: number;
  duracion_segundos: number;
  geometria_empresa: LineStringGeo;
  geometria_cliente: LineStringGeo;
  dentro_de_lima: boolean;
}

export interface Posicion {
  latitud: string;
  longitud: string;
  registrado_en?: string;
}

export interface ParadaSeguimiento {
  orden: number;
  destino_id: number;
  codigo_externo: string;
  estado: EstadoDestino;
  direccion: string;
  distrito: string;
  latitud: string;
  longitud: string;
  nombre_receptor: string;
}

export interface Seguimiento {
  ruta_id: number;
  cliente_id: number;
  estado: EstadoRuta;
  fecha: string;
  dentro_de_lima: boolean;
  en_vivo: boolean;
  seguimiento_activo: boolean;
  base_origen: PuntoRuta | null;
  base_final?: PuntoRuta | null;
  geometria: LineStringGeo | null;
  paradas: ParadaSeguimiento[];
  ultima_posicion: Posicion | null;
  recorrido: Posicion[];
}

export interface Geocerca {
  id: number;
  nombre: string;
  poligono: [number, number][];
  activa: boolean;
}

export interface Notificacion {
  id: number;
  ruta_id: number;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  creado_en: string;
}

export interface Evidencia {
  id: number;
  archivo: string;
  creado_en: string;
}

export interface AsignacionRuta {
  conductor_id: number | null;
  vehiculo_id: number | null;
  auxiliar_ids: number[];
  base_origen_id: number | null;
  base_final_id: number | null;
}
