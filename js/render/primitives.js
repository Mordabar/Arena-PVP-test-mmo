/* =============================================================================
 * render/primitives.js — Geometría procedural.
 *
 * No hay ningún fichero de malla en el proyecto: todo se genera aquí en el
 * arranque (documento §21). Cada primitiva devuelve {positions, normals, uvs,
 * indices} listo para subir a un VAO.
 * ========================================================================== */
Arena.define('render/primitives', ['math/vec3'], function (Arena) {
  'use strict';

  var P = {};

  function mesh() { return { positions: [], normals: [], uvs: [], indices: [] }; }

  /** Caja centrada en el origen, con normales duras por cara. */
  P.box = function (w, h, d) {
    w = (w || 1) / 2; h = (h || 1) / 2; d = (d || 1) / 2;
    var m = mesh();
    var faces = [
      { n: [0, 0, 1], v: [[-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d]] },
      { n: [0, 0, -1], v: [[w, -h, -d], [-w, -h, -d], [-w, h, -d], [w, h, -d]] },
      { n: [1, 0, 0], v: [[w, -h, d], [w, -h, -d], [w, h, -d], [w, h, d]] },
      { n: [-1, 0, 0], v: [[-w, -h, -d], [-w, -h, d], [-w, h, d], [-w, h, -d]] },
      { n: [0, 1, 0], v: [[-w, h, d], [w, h, d], [w, h, -d], [-w, h, -d]] },
      { n: [0, -1, 0], v: [[-w, -h, -d], [w, -h, -d], [w, -h, d], [-w, -h, d]] }
    ];
    var uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (var f = 0; f < faces.length; f++) {
      var base = m.positions.length / 3;
      for (var i = 0; i < 4; i++) {
        m.positions.push(faces[f].v[i][0], faces[f].v[i][1], faces[f].v[i][2]);
        m.normals.push(faces[f].n[0], faces[f].n[1], faces[f].n[2]);
        m.uvs.push(uv[i][0], uv[i][1]);
      }
      m.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return m;
  };

  /** Cilindro con eje Y, base en y=0. `taper` estrecha la tapa superior. */
  P.cylinder = function (radius, height, segments, taper) {
    segments = segments || 16;
    taper = taper === undefined ? 1 : taper;
    var m = mesh();
    var i, a, x, z, nx, nz;

    for (i = 0; i <= segments; i++) {
      a = (i / segments) * Math.PI * 2;
      x = Math.cos(a); z = Math.sin(a);
      // Normal inclinada según el estrechamiento, si no el sombreado miente.
      var slope = (radius - radius * taper) / Math.max(height, 1e-4);
      nx = x; nz = z;
      var len = Math.sqrt(nx * nx + nz * nz + slope * slope);
      m.positions.push(x * radius, 0, z * radius);
      m.normals.push(nx / len, slope / len, nz / len);
      m.uvs.push(i / segments, 0);
      m.positions.push(x * radius * taper, height, z * radius * taper);
      m.normals.push(nx / len, slope / len, nz / len);
      m.uvs.push(i / segments, 1);
    }
    for (i = 0; i < segments; i++) {
      var b = i * 2;
      m.indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }

    // Tapas
    var capTop = m.positions.length / 3;
    m.positions.push(0, height, 0); m.normals.push(0, 1, 0); m.uvs.push(0.5, 0.5);
    for (i = 0; i <= segments; i++) {
      a = (i / segments) * Math.PI * 2;
      m.positions.push(Math.cos(a) * radius * taper, height, Math.sin(a) * radius * taper);
      m.normals.push(0, 1, 0);
      m.uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (i = 0; i < segments; i++) m.indices.push(capTop, capTop + i + 1, capTop + i + 2);

    var capBot = m.positions.length / 3;
    m.positions.push(0, 0, 0); m.normals.push(0, -1, 0); m.uvs.push(0.5, 0.5);
    for (i = 0; i <= segments; i++) {
      a = (i / segments) * Math.PI * 2;
      m.positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      m.normals.push(0, -1, 0);
      m.uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (i = 0; i < segments; i++) m.indices.push(capBot, capBot + i + 2, capBot + i + 1);

    return m;
  };

  P.sphere = function (radius, rings, segments) {
    rings = rings || 12; segments = segments || 16;
    var m = mesh();
    for (var y = 0; y <= rings; y++) {
      var v = y / rings;
      var phi = v * Math.PI;
      for (var x = 0; x <= segments; x++) {
        var u = x / segments;
        var theta = u * Math.PI * 2;
        var nx = Math.sin(phi) * Math.cos(theta);
        var ny = Math.cos(phi);
        var nz = Math.sin(phi) * Math.sin(theta);
        m.positions.push(nx * radius, ny * radius, nz * radius);
        m.normals.push(nx, ny, nz);
        m.uvs.push(u, v);
      }
    }
    for (var yy = 0; yy < rings; yy++) {
      for (var xx = 0; xx < segments; xx++) {
        var a = yy * (segments + 1) + xx;
        var b = a + segments + 1;
        m.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return m;
  };


  /** Elipsoide centrado. Evita repetir sphere+scale y hace explícita la anatomía. */
  P.ellipsoid = function (rx, ry, rz, rings, segments) {
    return P.scale(P.sphere(1, rings || 10, segments || 14), rx, ry, rz);
  };

  /** Toro con eje Y. Útil para golas, brazales, aros mágicos y remates sin cajas. */
  P.torus = function (majorR, minorR, majorSegments, minorSegments, arc) {
    majorSegments = majorSegments || 18; minorSegments = minorSegments || 7;
    arc = arc === undefined ? Math.PI * 2 : arc;
    var m = mesh();
    for (var i = 0; i <= majorSegments; i++) {
      var u = i / majorSegments, a = u * arc;
      var ca = Math.cos(a), sa = Math.sin(a);
      for (var j = 0; j <= minorSegments; j++) {
        var v = j / minorSegments, b = v * Math.PI * 2;
        var cb = Math.cos(b), sb = Math.sin(b);
        var rr = majorR + minorR * cb;
        var x = rr * ca, y = minorR * sb, z = rr * sa;
        var nx = cb * ca, ny = sb, nz = cb * sa;
        m.positions.push(x,y,z); m.normals.push(nx,ny,nz); m.uvs.push(u,v);
      }
    }
    var row = minorSegments + 1;
    for (var ii=0; ii<majorSegments; ii++) for (var jj=0; jj<minorSegments; jj++) {
      var q=ii*row+jj, r=q+row;
      m.indices.push(q,r,q+1,q+1,r,r+1);
    }
    return m;
  };

  /** Cápsula: el cuerpo de los personajes y de las cajas de colisión. */
  P.capsule = function (radius, height, segments) {
    segments = segments || 14;
    var body = P.cylinder(radius, Math.max(0.01, height - radius * 2), segments, 1);
    var top = P.sphere(radius, 8, segments);
    var bottom = P.sphere(radius, 8, segments);
    P.translate(body, 0, radius, 0);
    P.translate(top, 0, height - radius, 0);
    P.translate(bottom, 0, radius, 0);
    return P.merge([body, top, bottom]);
  };

  /** Plano horizontal centrado, mirando hacia +Y. */
  P.plane = function (w, d, segments) {
    segments = segments || 1;
    var m = mesh();
    for (var z = 0; z <= segments; z++) {
      for (var x = 0; x <= segments; x++) {
        var u = x / segments, v = z / segments;
        m.positions.push((u - 0.5) * w, 0, (v - 0.5) * d);
        m.normals.push(0, 1, 0);
        m.uvs.push(u, v);
      }
    }
    for (var zz = 0; zz < segments; zz++) {
      for (var xx = 0; xx < segments; xx++) {
        var a = zz * (segments + 1) + xx;
        var b = a + segments + 1;
        m.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return m;
  };

  /** Cono con la punta en +Y: proyectiles, flechas e indicadores de dirección. */
  P.cone = function (radius, height, segments) {
    return P.cylinder(radius, height, segments || 12, 0.001);
  };

  /**
   * Cuña: caja con la cara superior inclinada. Es la rampa de acceso a las
   * plataformas. Se genera con la misma pendiente que devuelve
   * Arena.Sim.Arena.groundHeightAt, o el personaje flotaría o se hundiría.
   */
  P.ramp = function (w, d, hMinZ, hMaxZ) {
    var hw = w / 2, hd = d / 2;
    var m = mesh();
    var slope = (hMaxZ - hMinZ) / d;
    var nLen = Math.sqrt(slope * slope + 1);
    var topN = [0, 1 / nLen, -slope / nLen];

    function quad(v, n) {
      var base = m.positions.length / 3;
      var uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (var i = 0; i < 4; i++) {
        m.positions.push(v[i][0], v[i][1], v[i][2]);
        m.normals.push(n[0], n[1], n[2]);
        m.uvs.push(uv[i][0], uv[i][1]);
      }
      m.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    // superior (inclinada)
    quad([[-hw, hMinZ, -hd], [hw, hMinZ, -hd], [hw, hMaxZ, hd], [-hw, hMaxZ, hd]], topN);
    // inferior
    quad([[-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd]], [0, -1, 0]);
    // frontal (z = +hd) y trasera (z = −hd)
    quad([[-hw, 0, hd], [hw, 0, hd], [hw, hMaxZ, hd], [-hw, hMaxZ, hd]], [0, 0, 1]);
    quad([[hw, 0, -hd], [-hw, 0, -hd], [-hw, hMinZ, -hd], [hw, hMinZ, -hd]], [0, 0, -1]);
    // laterales
    quad([[hw, 0, hd], [hw, 0, -hd], [hw, hMinZ, -hd], [hw, hMaxZ, hd]], [1, 0, 0]);
    quad([[-hw, 0, -hd], [-hw, 0, hd], [-hw, hMaxZ, hd], [-hw, hMinZ, -hd]], [-1, 0, 0]);
    return m;
  };

  /** Sector de anillo plano: telegraphs de cono y arcos de progreso. */
  P.ringSector = function (innerR, outerR, angle, segments) {
    segments = segments || 24;
    var m = mesh();
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var a = -angle / 2 + angle * t;
      var c = Math.cos(a), s = Math.sin(a);
      m.positions.push(s * innerR, 0, c * innerR);
      m.normals.push(0, 1, 0);
      m.uvs.push(t, 0);
      m.positions.push(s * outerR, 0, c * outerR);
      m.normals.push(0, 1, 0);
      m.uvs.push(t, 1);
    }
    for (var j = 0; j < segments; j++) {
      var b = j * 2;
      m.indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    return m;
  };

  /* --- Transformaciones sobre mallas ya generadas ------------------------- */

  P.translate = function (m, x, y, z) {
    for (var i = 0; i < m.positions.length; i += 3) {
      m.positions[i] += x; m.positions[i + 1] += y; m.positions[i + 2] += z;
    }
    return m;
  };

  P.scale = function (m, x, y, z) {
    for (var i = 0; i < m.positions.length; i += 3) {
      m.positions[i] *= x; m.positions[i + 1] *= y; m.positions[i + 2] *= z;
    }
    // Las normales se escalan por la inversa para no deformar el sombreado.
    for (var j = 0; j < m.normals.length; j += 3) {
      var nx = m.normals[j] / x, ny = m.normals[j + 1] / y, nz = m.normals[j + 2] / z;
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      m.normals[j] = nx / len; m.normals[j + 1] = ny / len; m.normals[j + 2] = nz / len;
    }
    return m;
  };

  P.rotateY = function (m, angle) {
    var c = Math.cos(angle), s = Math.sin(angle);
    function rot(arr) {
      for (var i = 0; i < arr.length; i += 3) {
        var x = arr[i], z = arr[i + 2];
        arr[i] = x * c + z * s;
        arr[i + 2] = -x * s + z * c;
      }
    }
    rot(m.positions); rot(m.normals);
    return m;
  };


  P.rotateX = function (m, angle) {
    var c=Math.cos(angle), s=Math.sin(angle);
    function rot(arr){ for(var i=0;i<arr.length;i+=3){ var y=arr[i+1], z=arr[i+2]; arr[i+1]=y*c-z*s; arr[i+2]=y*s+z*c; } }
    rot(m.positions); rot(m.normals); return m;
  };

  P.rotateZ = function (m, angle) {
    var c=Math.cos(angle), s=Math.sin(angle);
    function rot(arr){ for(var i=0;i<arr.length;i+=3){ var x=arr[i], y=arr[i+1]; arr[i]=x*c-y*s; arr[i+1]=x*s+y*c; } }
    rot(m.positions); rot(m.normals); return m;
  };

  P.merge = function (list) {
    var out = mesh();
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var offset = out.positions.length / 3;
      for (var p = 0; p < m.positions.length; p++) out.positions.push(m.positions[p]);
      for (var n = 0; n < m.normals.length; n++) out.normals.push(m.normals[n]);
      for (var u = 0; u < m.uvs.length; u++) out.uvs.push(m.uvs[u]);
      for (var k = 0; k < m.indices.length; k++) out.indices.push(m.indices[k] + offset);
    }
    return out;
  };

  Arena.Render.primitives = P;
});
