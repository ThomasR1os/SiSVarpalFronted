const TIPO_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function blobExcel(hoja: string, filas: readonly (readonly string[])[]): Blob {
  const datos = libroExcel(hoja, filas);
  return new Blob([datos.buffer as ArrayBuffer], { type: TIPO_EXCEL });
}

function libroExcel(hoja: string, filas: readonly (readonly string[])[]): Uint8Array {
  const columnas = filas.reduce((maximo, fila) => Math.max(maximo, fila.length), 0);
  const nombre = nombreHoja(hoja);
  const archivos = [
    parte('[Content_Types].xml', contenidoTipos()),
    parte('_rels/.rels', relacionesRaiz()),
    parte('xl/workbook.xml', libro(nombre)),
    parte('xl/_rels/workbook.xml.rels', relacionesLibro()),
    parte('xl/worksheets/sheet1.xml', hojaCalculo(filas, columnas)),
  ];
  return zip(archivos);
}

function hojaCalculo(filas: readonly (readonly string[])[], columnas: number): string {
  const filasXml = filas.map((fila, indice) => {
    const celdas = Array.from({ length: columnas }, (_, columnaIndice) => {
      const ref = `${letraColumna(columnaIndice)}${indice + 1}`;
      const texto = xml(fila[columnaIndice] ?? '');
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${texto}</t></is></c>`;
    });
    return `<row r="${indice + 1}">${celdas.join('')}</row>`;
  });
  const rango = filas.length && columnas ? `A1:${letraColumna(columnas - 1)}${filas.length}` : 'A1';
  const anchos = anchosColumna(filas, columnas)
    .map((ancho, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="${ancho}" customWidth="1"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos}</cols>
<sheetData>${filasXml.join('')}</sheetData>
<autoFilter ref="${rango}"/>
</worksheet>`;
}

function libro(nombre: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlAtributo(nombre)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function contenidoTipos(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
}

function relacionesRaiz(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function relacionesLibro(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;
}

function anchosColumna(filas: readonly (readonly string[])[], columnas: number): number[] {
  const anchos = Array.from({ length: columnas }, () => 12);
  for (const fila of filas.slice(0, 200)) {
    for (let indice = 0; indice < columnas; indice++) {
      const largo = [...(fila[indice] ?? '')].length + 2;
      if (largo > anchos[indice]) anchos[indice] = Math.min(48, largo);
    }
  }
  return anchos;
}

function letraColumna(indice: number): string {
  let n = indice + 1;
  let letras = '';
  while (n > 0) {
    n -= 1;
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26);
  }
  return letras;
}

function nombreHoja(nombre: string): string {
  const limpio = nombre.replace(/[\u0000-\u001F:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (limpio || 'Reporte').slice(0, 31);
}

function xml(valor: string): string {
  return valor
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function xmlAtributo(valor: string): string {
  return xml(valor).replaceAll('"', '&quot;');
}

interface ParteZip {
  nombre: string;
  datos: Uint8Array;
}

function parte(nombre: string, xmlTexto: string): ParteZip {
  return { nombre, datos: new TextEncoder().encode(xmlTexto) };
}

function zip(archivos: readonly ParteZip[]): Uint8Array {
  const ahora = fechaDos(new Date());
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;
  for (const archivo of archivos) {
    const nombre = new TextEncoder().encode(archivo.nombre);
    const crc = crc32(archivo.datos);
    const local = cabeceraLocal(nombre, archivo.datos.length, crc, ahora);
    locales.push(local, archivo.datos);
    centrales.push(cabeceraCentral(nombre, archivo.datos.length, crc, offset, ahora));
    offset += local.length + archivo.datos.length;
  }
  const tamanoCentral = centrales.reduce((total, parte) => total + parte.length, 0);
  const fin = new Uint8Array(22);
  const vista = new DataView(fin.buffer);
  vista.setUint32(0, 0x06054b50, true);
  vista.setUint16(8, archivos.length, true);
  vista.setUint16(10, archivos.length, true);
  vista.setUint32(12, tamanoCentral, true);
  vista.setUint32(16, offset, true);
  return unir([...locales, ...centrales, fin]);
}

function cabeceraLocal(nombre: Uint8Array, tamano: number, crc: number, ahora: FechaDos): Uint8Array {
  const cabecera = new Uint8Array(30 + nombre.length);
  const vista = new DataView(cabecera.buffer);
  vista.setUint32(0, 0x04034b50, true);
  vista.setUint16(4, 20, true);
  vista.setUint16(6, 0x0800, true);
  vista.setUint16(10, ahora.hora, true);
  vista.setUint16(12, ahora.fecha, true);
  vista.setUint32(14, crc, true);
  vista.setUint32(18, tamano, true);
  vista.setUint32(22, tamano, true);
  vista.setUint16(26, nombre.length, true);
  cabecera.set(nombre, 30);
  return cabecera;
}

function cabeceraCentral(nombre: Uint8Array, tamano: number, crc: number, offset: number, ahora: FechaDos): Uint8Array {
  const cabecera = new Uint8Array(46 + nombre.length);
  const vista = new DataView(cabecera.buffer);
  vista.setUint32(0, 0x02014b50, true);
  vista.setUint16(4, 20, true);
  vista.setUint16(6, 20, true);
  vista.setUint16(8, 0x0800, true);
  vista.setUint16(12, ahora.hora, true);
  vista.setUint16(14, ahora.fecha, true);
  vista.setUint32(16, crc, true);
  vista.setUint32(20, tamano, true);
  vista.setUint32(24, tamano, true);
  vista.setUint16(28, nombre.length, true);
  vista.setUint32(42, offset, true);
  cabecera.set(nombre, 46);
  return cabecera;
}

interface FechaDos {
  hora: number;
  fecha: number;
}

function fechaDos(fecha: Date): FechaDos {
  return {
    hora: (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2),
    fecha: ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate(),
  };
}

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < datos.length; i++) crc = TABLA_CRC[(crc ^ datos[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function unir(partes: readonly Uint8Array[]): Uint8Array {
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let offset = 0;
  for (const parte of partes) {
    salida.set(parte, offset);
    offset += parte.length;
  }
  return salida;
}
