/* =============================================================================
 * render/shaders.js — Programas GLSL ES 3.00 embebidos como cadenas.
 *
 * Van en JavaScript, no en ficheros aparte, porque el prototipo debe abrirse
 * con doble clic desde file:// y ahí no hay fetch que valga (documento §23).
 *
 * Pipeline:
 *   1. shadow  — profundidad desde la luz (mapa de sombras direccional)
 *   2. scene   — geometría con Blinn-Phong + sombras + niebla → framebuffer HDR
 *   3. bright  — extrae las zonas luminosas
 *   4. blur    — desenfoque separable sobre el bright
 *   5. present — tonemap ACES + bloom + viñeta → pantalla
 * ========================================================================== */
Arena.define('render/shaders', [], function (Arena) {
  'use strict';

  var S = {};

  /* --- Utilidades GLSL compartidas --------------------------------------- */
  var COMMON = [
    'const float PI = 3.14159265359;',
    'float saturate(float x) { return clamp(x, 0.0, 1.0); }',
    'vec3 saturate3(vec3 x) { return clamp(x, 0.0, 1.0); }'
  ].join('\n');

  /* =========================================================================
   * 1. Mapa de sombras
   * ====================================================================== */
  S.shadowVert = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uLightViewProj;
uniform mat4 uModel;
void main() {
  gl_Position = uLightViewProj * uModel * vec4(aPosition, 1.0);
}`;

  S.shadowFrag = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`;

  /* =========================================================================
   * 2. Escena
   * ====================================================================== */
  S.sceneVert = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;

uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
uniform mat4 uLightViewProj;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
out vec4 vShadowCoord;

uniform float uNormalBias;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  vUv = aUv;
  // Normal offset bias: la coordenada de sombra se muestrea un poco "fuera"
  // de la superficie, lo que elimina el acné sin despegar la sombra.
  vShadowCoord = uLightViewProj * vec4(world.xyz + vNormal * uNormalBias, 1.0);
  gl_Position = uViewProj * world;
}`;

  S.sceneFrag = `#version 300 es
precision highp float;
${COMMON}

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
in vec4 vShadowCoord;

uniform vec3 uBaseColor;
uniform vec3 uEmissive;
uniform vec3 uLightDir;        // hacia la luz, normalizado
uniform vec3 uLightColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uRoughness;
uniform float uMetallic;
uniform float uAlpha;
uniform float uGridScale;      // > 0 activa la retícula procedural del suelo
uniform vec3 uGridColor;
uniform float uRimPower;
uniform vec3 uRimColor;
uniform sampler2D uShadowMap;
uniform float uShadowTexel;
uniform float uReceiveShadow;

out vec4 fragColor;

/* PCF 3x3 con bias dependiente de la pendiente.
   Un bias fijo produce acné en las superficies casi paralelas a la luz —
   justo el suelo, que es donde más se nota. */
float shadowFactor(float ndl) {
  if (uReceiveShadow < 0.5) return 1.0;
  vec3 proj = vShadowCoord.xyz / max(vShadowCoord.w, 1e-5);
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;

  float bias = max(0.0060 * (1.0 - ndl), 0.0018);
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 off = vec2(float(x), float(y)) * uShadowTexel;
      float depth = texture(uShadowMap, proj.xy + off).r;
      sum += (proj.z - bias > depth) ? 0.0 : 1.0;
    }
  }
  // Suelo de sombra: la luz indirecta impide que una zona en sombra caiga a
  // negro puro. Sin esto las sombras se leen como agujeros en el suelo.
  return mix(0.28, 1.0, sum / 9.0);
}

/* Retícula del suelo: da escala espacial y ayuda a leer distancias de rango.
 *
 * El desvanecido NO es por distancia sino por resolubilidad: cuando una celda
 * mide menos de medio píxel, dibujarla produce un moiré de puntos que parece
 * ruido de sombras. Se apaga justo antes de llegar a ese límite. */
float gridMask(vec2 p, float scale) {
  vec2 q = p * scale;
  vec2 w = fwidth(q);
  vec2 grid = abs(fract(q - 0.5) - 0.5) / max(w, vec2(1e-4));
  float line = min(grid.x, grid.y);
  float mask = 1.0 - min(line, 1.0);
  float resolvable = 1.0 - smoothstep(0.30, 0.85, max(w.x, w.y));
  return mask * resolvable;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);

  float viewDist = length(uCameraPos - vWorldPos);

  vec3 albedo = uBaseColor;
  if (uGridScale > 0.0) {
    // Dos frecuencias: la fina da escala de paso, la gruesa (cada 5 unidades)
    // sobrevive a distancia y sigue comunicando alcance de habilidades.
    float g = gridMask(vWorldPos.xz, uGridScale) * 0.45
            + gridMask(vWorldPos.xz, uGridScale * 0.2) * 0.55;
    albedo = mix(albedo, uGridColor, saturate(g));
  }

  float ndl = saturate(dot(N, L));
  float shadow = shadowFactor(ndl);

  // Ambiente hemisférico: cielo arriba, rebote del suelo abajo.
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(uGroundColor, uSkyColor, hemi);

  vec3 diffuse = uLightColor * ndl * shadow;

  // Luz de relleno fría desde el lado opuesto, sin sombras. Es lo que separa un
  // personaje del fondo cuando está a contraluz: sin ella, media silueta se
  // funde en negro justo cuando hay que leer quién es y qué está haciendo.
  vec3 fillDir = normalize(vec3(-L.x, 0.35, -L.z));
  float ndf = saturate(dot(N, fillDir));
  vec3 fill = uSkyColor * ndf * 1.45;

  float gloss = mix(64.0, 4.0, saturate(uRoughness));
  float spec = pow(saturate(dot(N, H)), gloss) * (1.0 - uRoughness) * shadow * ndl;
  vec3 specular = uLightColor * spec * mix(0.25, 1.0, uMetallic);

  // Luz de contorno: separa las siluetas del fondo, clave para leer el combate.
  float rim = pow(1.0 - saturate(dot(N, V)), max(uRimPower, 0.001));
  vec3 rimLight = uRimColor * rim;

  vec3 color = albedo * (ambient + diffuse + fill) + specular + rimLight + uEmissive;

  float fog = 1.0 - exp(-uFogDensity * uFogDensity * viewDist * viewDist);
  color = mix(color, uFogColor, saturate(fog));

  fragColor = vec4(color, uAlpha);
}`;

  /* =========================================================================
   * 3. Sin iluminar — telegraphs, indicadores, líneas, VFX
   * ====================================================================== */
  S.unlitVert = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uViewProj;
uniform mat4 uModel;
out vec2 vUv;
out vec3 vWorldPos;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vUv = aUv;
  gl_Position = uViewProj * world;
}`;

  S.unlitFrag = `#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
in vec3 vWorldPos;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uTime;
uniform float uMode;      // 0 plano · 1 anillo pulsante · 2 barrido de carga · 3 disco suave
uniform float uProgress;
out vec4 fragColor;

void main() {
  float a = uAlpha;
  vec3 c = uColor;

  if (uMode > 0.5 && uMode < 1.5) {
    // Anillo: fino en el borde, con latido.
    float d = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.86, 0.99, d) * (1.0 - smoothstep(0.99, 1.02, d));
    float pulse = 0.75 + 0.25 * sin(uTime * 6.0);
    a *= ring * pulse;
  } else if (uMode > 1.5 && uMode < 2.5) {
    // Telegraph de carga: el disco se rellena con el progreso del casteo.
    float d = length(vUv - 0.5) * 2.0;
    float fill = step(d, uProgress);
    float edge = smoothstep(0.90, 1.0, d) * (1.0 - smoothstep(1.0, 1.04, d));
    a *= saturate(fill * 0.35 + edge * 0.9);
  } else if (uMode > 2.5) {
    // Disco con caída suave: sombras de apoyo y auras.
    float d = length(vUv - 0.5) * 2.0;
    a *= (1.0 - smoothstep(0.0, 1.0, d));
  }

  if (a <= 0.001) discard;
  fragColor = vec4(c, a);
}`;

  /* =========================================================================
   * 4. Post-proceso
   * ====================================================================== */
  S.fullscreenVert = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Triángulo que cubre la pantalla: sin buffers ni atributos.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  S.brightFrag = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uThreshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(lum - uThreshold, 0.0) / max(lum, 1e-4);
  fragColor = vec4(c * k, 1.0);
}`;

  S.blurFrag = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uDirection;   // (texel, 0) u (0, texel)
out vec4 fragColor;
void main() {
  // Gauss de 9 taps con pesos de tent filter.
  float w[5];
  w[0] = 0.2270270270; w[1] = 0.1945945946; w[2] = 0.1216216216;
  w[3] = 0.0540540541; w[4] = 0.0162162162;
  vec3 sum = texture(uSource, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = uDirection * float(i);
    sum += texture(uSource, vUv + off).rgb * w[i];
    sum += texture(uSource, vUv - off).rgb * w[i];
  }
  fragColor = vec4(sum, 1.0);
}`;

  S.presentFrag = `#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uVignette;
uniform float uHurt;        // pulso rojo al recibir daño
uniform float uSaturation;
out vec4 fragColor;

/* Tonemap ACES (aproximación de Narkowicz): contraste de cine sin quemar. */
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return saturate3((x * (a * x + b)) / (x * (c * x + d) + e));
}

void main() {
  vec3 color = texture(uScene, vUv).rgb;
  color += texture(uBloom, vUv).rgb * uBloomStrength;
  color *= uExposure;
  color = aces(color);

  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(lum), color, uSaturation);

  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(q, q) * 2.2;
  color *= saturate(vig);

  if (uHurt > 0.001) {
    float edge = smoothstep(0.18, 0.62, length(q));
    color = mix(color, vec3(0.65, 0.05, 0.05), edge * uHurt * 0.75);
  }

  // Corrección gamma final.
  fragColor = vec4(pow(color, vec3(1.0 / 2.2)), 1.0);
}`;

  Arena.Render.shaders = S;
});
