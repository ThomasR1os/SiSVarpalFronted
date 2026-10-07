import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type Consulta = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(url: string, consulta?: Consulta): Observable<T> {
    return this.http.get<T>(url, { params: this.parametros(consulta) });
  }

  post<T>(url: string, cuerpo: unknown): Observable<T> {
    return this.http.post<T>(url, cuerpo ?? {});
  }

  patch<T>(url: string, cuerpo: unknown): Observable<T> {
    return this.http.patch<T>(url, cuerpo);
  }

  put<T>(url: string, cuerpo: unknown): Observable<T> {
    return this.http.put<T>(url, cuerpo);
  }

  delete(url: string): Observable<void> {
    return this.http.delete<void>(url);
  }

  subir<T>(url: string, datos: FormData): Observable<T> {
    return this.http.post<T>(url, datos);
  }

  descargar(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }

  private parametros(consulta?: Consulta): HttpParams {
    let params = new HttpParams();
    if (!consulta) return params;
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return params;
  }
}

export function guardarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
