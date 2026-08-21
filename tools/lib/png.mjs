/* =============================================================================
 * tools/lib/png.mjs — decodificador PNG mínimo, sin dependencias.
 *
 * POR QUÉ EXISTE
 *
 * El inspector de canvas necesita PÍXELES para medir entropía de color, densidad
 * de bordes y contraste. Chromium entrega la captura como PNG en base64, así que
 * hay que descomprimirla.
 *
 * Se descarta leer los píxeles desde la propia página con `getImageData`: un
 * canvas WebGL sin `preserveDrawingBuffer` devuelve negro, y este proyecto no lo
 * activa (ni debe: cuesta rendimiento). `Page.captureScreenshot` compone el
 * fotograma de verdad, así que es la fuente fiable.
 *
 * Node trae `zlib`, que es el 90 % del trabajo. Lo que queda es deshacer los
 * filtros por línea que define la especificación del formato.
 *
 * Cubre lo que Chromium produce: 8 bits por canal, color type 2 (RGB) y 6
 * (RGBA), sin entrelazado. Si llega otra cosa, revienta en vez de devolver
 * píxeles inventados.
 * ========================================================================== */
import zlib from 'node:zlib';

const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @param {Buffer} buf  PNG completo
 * @returns {{width:number, height:number, channels:number, data:Uint8Array}}
 *          `data` son píxeles sin filtrar, `channels` bytes por píxel.
 */
export function decodePng(buf) {
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== FIRMA[i]) throw new Error('no es un PNG');
  }
  let off = 8, ihdr = null;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const tipo = buf.toString('ascii', off + 4, off + 8);
    const cuerpo = buf.subarray(off + 8, off + 8 + len);
    if (tipo === 'IHDR') {
      ihdr = {
        width: cuerpo.readUInt32BE(0),
        height: cuerpo.readUInt32BE(4),
        depth: cuerpo[8],
        colorType: cuerpo[9],
        interlace: cuerpo[12]
      };
    } else if (tipo === 'IDAT') {
      idat.push(cuerpo);
    } else if (tipo === 'IEND') {
      break;
    }
    off += 12 + len;                       // long + tipo + cuerpo + crc
  }
  if (!ihdr) throw new Error('PNG sin IHDR');
  if (ihdr.depth !== 8) throw new Error('PNG de ' + ihdr.depth + ' bits no soportado');
  if (ihdr.interlace) throw new Error('PNG entrelazado no soportado');
  const canales = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colorType];
  if (!canales) throw new Error('color type ' + ihdr.colorType + ' no soportado');

  const crudo = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const bpp = canales;                      // 8 bits por canal ⇒ bytes = canales
  const linea = w * bpp;
  const out = new Uint8Array(w * h * bpp);

  /* Deshacer filtros. Cada línea empieza con un byte que dice cuál se aplicó;
     los cinco están en la especificación y todos se resuelven con el píxel de
     la izquierda (a), el de arriba (b) y el de arriba-izquierda (c). */
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filtro = crudo[p++];
    const dst = y * linea;
    const prev = dst - linea;
    for (let x = 0; x < linea; x++) {
      const bruto = crudo[p++];
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = (x >= bpp && y > 0) ? out[prev + x - bpp] : 0;
      let v;
      switch (filtro) {
        case 0: v = bruto; break;                       // None
        case 1: v = bruto + a; break;                   // Sub
        case 2: v = bruto + b; break;                   // Up
        case 3: v = bruto + ((a + b) >> 1); break;      // Average
        case 4: {                                       // Paeth
          const q = a + b - c;
          const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
          v = bruto + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error('filtro PNG desconocido: ' + filtro);
      }
      out[dst + x] = v & 0xff;
    }
  }
  return { width: w, height: h, channels: canales, data: out };
}
