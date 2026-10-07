import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export function rutaApi(ruta: string): string {
  if (!environment.apiUrl || /^https?:\/\//.test(ruta)) return ruta;
  return `${environment.apiUrl}${ruta}`;
}

export const backendInterceptor: HttpInterceptorFn = (req, next) => {
  const url = rutaApi(req.url);
  return next(url === req.url ? req : req.clone({ url }));
};
