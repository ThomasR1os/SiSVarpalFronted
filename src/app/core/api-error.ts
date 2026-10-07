import { HttpErrorResponse } from '@angular/common/http';

export function mensajeError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.error instanceof Blob) return 'No se pudo completar la descarga.';
    const body: unknown = err.error;
    if (body && typeof body === 'object') {
      const rec = body as { detail?: unknown; errores?: unknown };
      const lineas: string[] = [];
      if (rec.errores && typeof rec.errores === 'object') {
        for (const [campo, msgs] of Object.entries(rec.errores as Record<string, unknown>)) {
          const lista = Array.isArray(msgs) ? msgs : [msgs];
          for (const item of lista) {
            if (typeof item !== 'string') continue;
            lineas.push(campo === 'non_field_errors' || campo === 'detail' ? item : `${campo}: ${item}`);
          }
        }
      }
      if (lineas.length) return lineas.join(' ');
      if (typeof rec.detail === 'string' && rec.detail.trim()) return rec.detail;
    }
    if (typeof body === 'string' && body.trim()) return body;
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    if (err.status === 403) return 'No tienes permiso para esta acción.';
    if (err.status === 404) return 'No se encontró el recurso.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Ocurrió un error inesperado.';
}

export function esFalloDeRed(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}

export function sesionRechazada(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
}
