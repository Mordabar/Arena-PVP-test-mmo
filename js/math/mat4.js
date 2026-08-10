/* =============================================================================
 * math/mat4.js — Matrices 4x4 column-major (compatibles con uniformMatrix4fv).
 * Sólo lo que el renderer necesita: proyección, vista, modelo y la inversa
 * suficiente para el unproject del picking.
 * ========================================================================== */
Arena.define('math/mat4', ['math/vec3'], function (Arena) {
  'use strict';

  var M = {};

  M.create = function () {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };

  M.identity = function (out) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
  };

  M.copy = function (out, a) { out.set(a); return out; };

  M.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return out;
  };

  M.perspective = function (out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  };

  M.ortho = function (out, l, r, b, t, n, f) {
    var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
    out[12] = (l + r) * lr; out[13] = (t + b) * bt; out[14] = (f + n) * nf; out[15] = 1;
    return out;
  };

  M.lookAt = function (out, eye, center, up) {
    var z0 = eye.x - center.x, z1 = eye.y - center.y, z2 = eye.z - center.z;
    var len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    if (len < 1e-9) { return M.identity(out); }
    z0 /= len; z1 /= len; z2 /= len;

    var x0 = up.y * z2 - up.z * z1;
    var x1 = up.z * z0 - up.x * z2;
    var x2 = up.x * z1 - up.y * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (len < 1e-9) { x0 = 0; x1 = 0; x2 = 0; } else { x0 /= len; x1 /= len; x2 /= len; }

    var y0 = z1 * x2 - z2 * x1;
    var y1 = z2 * x0 - z0 * x2;
    var y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye.x + x1 * eye.y + x2 * eye.z);
    out[13] = -(y0 * eye.x + y1 * eye.y + y2 * eye.z);
    out[14] = -(z0 * eye.x + z1 * eye.y + z2 * eye.z);
    out[15] = 1;
    return out;
  };

  /** Compone traslación + rotación Y + escala no uniforme. Cubre el 100% de
   *  las transformaciones que usa el renderer de primitivas. */
  M.compose = function (out, pos, yaw, scale) {
    var s = Math.sin(yaw), c = Math.cos(yaw);
    var sx = scale.x, sy = scale.y, sz = scale.z;
    out[0] = c * sx; out[1] = 0; out[2] = -s * sx; out[3] = 0;
    out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
    out[8] = s * sz; out[9] = 0; out[10] = c * sz; out[11] = 0;
    out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
    return out;
  };

  /** Compone con rotación completa yaw→pitch→roll (usada por VFX y miembros). */
  M.composeFull = function (out, pos, yaw, pitch, roll, scale) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cr = Math.cos(roll), sr = Math.sin(roll);

    // R = Ry * Rx * Rz
    var m00 = cy * cr + sy * sp * sr;
    var m01 = cp * sr;
    var m02 = -sy * cr + cy * sp * sr;

    var m10 = -cy * sr + sy * sp * cr;
    var m11 = cp * cr;
    var m12 = sy * sr + cy * sp * cr;

    var m20 = sy * cp;
    var m21 = -sp;
    var m22 = cy * cp;

    out[0] = m00 * scale.x; out[1] = m01 * scale.x; out[2] = m02 * scale.x; out[3] = 0;
    out[4] = m10 * scale.y; out[5] = m11 * scale.y; out[6] = m12 * scale.y; out[7] = 0;
    out[8] = m20 * scale.z; out[9] = m21 * scale.z; out[10] = m22 * scale.z; out[11] = 0;
    out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
    return out;
  };

  M.invert = function (out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    var b00 = a00 * a11 - a01 * a10;
    var b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11;
    var b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30;
    var b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31;
    var b11 = a22 * a33 - a23 * a32;

    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  };

  /** Transforma un punto homogéneo y divide por w. Devuelve {x,y,z}. */
  M.transformPoint = function (out, m, p) {
    var x = p.x, y = p.y, z = p.z;
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (Math.abs(w) < 1e-9) w = 1;
    out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  };

  /** Transforma y devuelve también w — necesario para descartar puntos detrás
   *  de la cámara al proyectar nameplates y texto flotante. */
  M.projectPoint = function (out, m, p) {
    var x = p.x, y = p.y, z = p.z;
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    out.x = m[0] * x + m[4] * y + m[8] * z + m[12];
    out.y = m[1] * x + m[5] * y + m[9] * z + m[13];
    out.z = m[2] * x + m[6] * y + m[10] * z + m[14];
    out.w = w;
    return out;
  };

  Arena.Math.Mat4 = M;
});
