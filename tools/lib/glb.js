/* =============================================================================
 * tools/lib/glb.js — lector de GLB sin navegador ni dependencias.
 *
 * Existe porque la FASE 0 de la v0.18 es una auditoría de MEDIDA: hay que saber
 * exactamente qué hay en los dos esqueletos antes de escribir una sola línea de
 * retargeting. Hacerlo en el navegador significaría medir a través de Three.js,
 * que ya interpreta (rellena rotaciones por defecto, normaliza, reordena). Aquí
 * se leen los bytes tal cual están en el fichero.
 *
 * Cubre lo que estos dos ficheros usan: accesores densos, matrices inversas de
 * bind, samplers de animación y jerarquía de nodos. NO cubre accesores sparse ni
 * Draco: si aparecen, revienta en vez de devolver datos silenciosamente falsos.
 * ========================================================================== */
'use strict';
const fs = require('fs');

const COMPONENT = {
  5120: { n: 'BYTE',           size: 1, get: (dv, o) => dv.getInt8(o) },
  5121: { n: 'UNSIGNED_BYTE',  size: 1, get: (dv, o) => dv.getUint8(o) },
  5122: { n: 'SHORT',          size: 2, get: (dv, o) => dv.getInt16(o, true) },
  5123: { n: 'UNSIGNED_SHORT', size: 2, get: (dv, o) => dv.getUint16(o, true) },
  5125: { n: 'UNSIGNED_INT',   size: 4, get: (dv, o) => dv.getUint32(o, true) },
  5126: { n: 'FLOAT',          size: 4, get: (dv, o) => dv.getFloat32(o, true) }
};
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function load(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(file + ': no es un GLB');
  let json = null, bin = null, off = 12;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const body = buf.slice(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error(file + ': sin chunk JSON');
  if (json.extensionsRequired && json.extensionsRequired.length)
    throw new Error(file + ': requiere extensiones no soportadas: ' + json.extensionsRequired.join(', '));
  return new Glb(file, json, bin);
}

class Glb {
  constructor(file, json, bin) {
    this.file = file; this.json = json; this.bin = bin;
    this.nodes = json.nodes || [];
    /* Padre de cada nodo. glTF sólo guarda hijos, así que hay que invertirlo. */
    this.parent = new Array(this.nodes.length).fill(-1);
    this.nodes.forEach((n, i) => (n.children || []).forEach(c => { this.parent[c] = i; }));
    this.byName = new Map();
    this.nodes.forEach((n, i) => { if (n.name && !this.byName.has(n.name)) this.byName.set(n.name, i); });
  }

  /** Lee un accesor completo como array de arrays (o de escalares). */
  accessor(index) {
    const a = this.json.accessors[index];
    if (a.sparse) throw new Error('accesor sparse no soportado (' + this.file + ')');
    const comp = COMPONENT[a.componentType];
    const n = NCOMP[a.type];
    const out = [];
    if (a.bufferView === undefined) {                 // accesor con ceros implícitos
      for (let i = 0; i < a.count; i++) out.push(n === 1 ? 0 : new Array(n).fill(0));
      return out;
    }
    const bv = this.json.bufferViews[a.bufferView];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || comp.size * n;
    const dv = new DataView(this.bin.buffer, this.bin.byteOffset, this.bin.byteLength);
    for (let i = 0; i < a.count; i++) {
      const o = base + i * stride;
      if (n === 1) { out.push(comp.get(dv, o)); continue; }
      const v = new Array(n);
      for (let c = 0; c < n; c++) v[c] = comp.get(dv, o + c * comp.size);
      out.push(v);
    }
    return out;
  }

  /** TRS local de un nodo, con los valores por defecto de glTF explícitos. */
  local(i) {
    const n = this.nodes[i];
    if (n.matrix) return decompose(n.matrix);
    return {
      t: (n.translation || [0, 0, 0]).slice(),
      r: (n.rotation || [0, 0, 0, 1]).slice(),        // x,y,z,w
      s: (n.scale || [1, 1, 1]).slice()
    };
  }

  /** Matriz local 4x4 (column-major, como glTF y Three). */
  localMatrix(i) { const l = this.local(i); return compose(l.t, l.r, l.s); }

  /** Matriz mundial componiendo hasta la raíz. */
  worldMatrix(i) {
    let m = this.localMatrix(i), p = this.parent[i];
    while (p !== -1) { m = mul(this.localMatrix(p), m); p = this.parent[p]; }
    return m;
  }

  /** Cadena de nombres desde la raíz hasta el nodo. */
  path(i) {
    const out = []; let cur = i;
    while (cur !== -1 && cur !== undefined) { out.unshift(this.nodes[cur].name || ('#' + cur)); cur = this.parent[cur]; }
    return out;
  }

  /** Profundidad en la jerarquía (raíz = 0). */
  depth(i) { let d = 0, p = this.parent[i]; while (p !== -1) { d++; p = this.parent[p]; } return d; }

  skin(index = 0) {
    const s = (this.json.skins || [])[index];
    if (!s) return null;
    const ibm = s.inverseBindMatrices !== undefined
      ? this.accessor(s.inverseBindMatrices).map(v => v.slice())
      : s.joints.map(() => identity());
    return { joints: s.joints.slice(), ibm, skeleton: s.skeleton };
  }

  /**
   * Pistas de una animación agrupadas por nodo:
   *   { [nodoIndex]: { translation:{times,values}, rotation:{...}, scale:{...} } }
   */
  animation(index) {
    const a = this.json.animations[index];
    const out = Object.create(null);
    let maxT = 0;
    for (const ch of a.channels) {
      const node = ch.target.node;
      if (node === undefined) continue;
      const smp = a.samplers[ch.sampler];
      const times = this.accessor(smp.input);
      const values = this.accessor(smp.output);
      if (times.length) maxT = Math.max(maxT, times[times.length - 1]);
      (out[node] || (out[node] = {}))[ch.target.path] = {
        times, values, interpolation: smp.interpolation || 'LINEAR'
      };
    }
    return { name: a.name || ('anim#' + index), duration: maxT, tracks: out };
  }
}

/* --- álgebra mínima. Column-major, mismo layout que glTF y Three.js -------- */
function identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }

function compose(t, r, s) {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1
  ];
}

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

/** Descompone una matriz en {t, r(quat xyzw), s}. Asume sin cizalla. */
function decompose(m) {
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  const det = m[0]*(m[5]*m[10]-m[6]*m[9]) - m[4]*(m[1]*m[10]-m[2]*m[9]) + m[8]*(m[1]*m[6]-m[2]*m[5]);
  const s0 = det < 0 ? -sx : sx;
  const r = [m[0]/s0, m[1]/s0, m[2]/s0, m[4]/sy, m[5]/sy, m[6]/sy, m[8]/sz, m[9]/sz, m[10]/sz];
  return { t: [m[12], m[13], m[14]], r: quatFromRot(r), s: [s0, sy, sz] };
}

/** r es column-major 3x3 aplanado: [c0x,c0y,c0z, c1x,...]. Devuelve xyzw. */
function quatFromRot(r) {
  const m00 = r[0], m10 = r[1], m20 = r[2];
  const m01 = r[3], m11 = r[4], m21 = r[5];
  const m02 = r[6], m12 = r[7], m22 = r[8];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m21 - m12) * s; y = (m02 - m20) * s; z = (m10 - m01) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  return normQ([x, y, z, w]);
}

function matToQuat(m) { return decompose(m).r; }
function pos(m) { return [m[12], m[13], m[14]]; }

function invert(m) {
  const inv = new Array(16);
  inv[0]=m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  inv[4]=-m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  inv[8]=m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  inv[12]=-m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  inv[1]=-m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  inv[5]=m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  inv[9]=-m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  inv[13]=m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  inv[2]=m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  inv[6]=-m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  inv[10]=m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  inv[14]=-m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  inv[3]=-m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  inv[7]=m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  inv[11]=-m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  inv[15]=m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  let det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
  if (!det) throw new Error('matriz singular');
  det = 1 / det;
  return inv.map(v => v * det);
}

/* --- cuaterniones (xyzw, igual que glTF) ---------------------------------- */
function normQ(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
}
function mulQ(a, b) {
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]
  ];
}
function invQ(q) { return [-q[0], -q[1], -q[2], q[3]]; }
function applyQ(q, v) {
  const [x, y, z] = v, [qx, qy, qz, qw] = q;
  const ix =  qw*x + qy*z - qz*y, iy =  qw*y + qz*x - qx*z;
  const iz =  qw*z + qx*y - qy*x, iw = -qx*x - qy*y - qz*z;
  return [
    ix*qw + iw*-qx + iy*-qz - iz*-qy,
    iy*qw + iw*-qy + iz*-qx - ix*-qz,
    iz*qw + iw*-qz + ix*-qy - iy*-qx
  ];
}
/** Ángulo en radianes del giro que representa el cuaternión. */
function angleQ(q) { return 2 * Math.acos(Math.min(1, Math.abs(normQ(q)[3]))); }
/** Ángulo entre dos cuaterniones (misma rotación → 0, aunque tengan signo opuesto). */
function angleBetweenQ(a, b) { return angleQ(mulQ(normQ(a), invQ(normQ(b)))); }

function transformPoint(m, v) {
  return [
    m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12],
    m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13],
    m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]
  ];
}
function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function len(v) { return Math.hypot(v[0], v[1], v[2]); }
function normV(v) { const l = len(v) || 1; return [v[0]/l, v[1]/l, v[2]/l]; }
function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

module.exports = {
  load, identity, compose, mul, invert, decompose, matToQuat, pos, transformPoint,
  normQ, mulQ, invQ, applyQ, angleQ, angleBetweenQ,
  sub, len, normV, dot
};
