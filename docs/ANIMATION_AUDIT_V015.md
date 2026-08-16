# ANIMATION AUDIT v0.15 — Skinned Dark Elf

## Diagnóstico

Las capturas del build desplegado v0.14 mostraban un fallo de arquitectura, no sólo poses feas. El skeleton GLB recibía matrices mundiales creadas para el humanoide procedural y las piezas de equipo del maniquí seguían dibujándose encima. El resultado producía torsión de hombros, piernas cruzadas, armas/equipo desalineados y siluetas rotas.

## Regla nueva

El GLB se anima exclusivamente en su propio espacio local. Cada frame:

1. el root visual recibe posición y yaw del estado autoritativo;
2. cada hueso vuelve a su `bind position` y `bind quaternion`;
3. se multiplica un offset local de animación;
4. sólo el arma del arquetipo permanece visible.

No existe conversión `procedural world matrix → GLB bone`.

## Fuente visual

Las secuencias de imágenes aportadas por el usuario se estudiaron como referencia de body language. Se extraen principios de preparación, silueta, peso, release y recovery; no se copia un clip exacto.

### Caster / báculo

Objetivo:

```text
GUARD
→ PREPARE
→ GATHER
→ CHANNEL
→ RELEASE
→ FOLLOW
→ RECOVER
```

- centro de masa estable;
- zancada corta/controlada durante locomoción;
- báculo en la mano derecha con gesto de masa;
- mano izquierda participa en gather/release;
- el normal de báculo usa amplitud menor que un hechizo;
- el cuerpo no inventa un paso durante casteo estacionario.

### Archer / arco

Objetivo:

```text
READY
→ RAISE
→ DRAW
→ RELEASE
→ RECOIL
→ RECOVER
```

- brazo de arco estable hacia el objetivo;
- hombro/codo derecho llevan la mano de cuerda hacia el rostro;
- cuerda visible se desplaza durante draw;
- sólo después del marker de impacto/RELEASE la cuerda vuelve al frente;
- power cast puede mantener un draw más profundo sin romper la autoridad de simulación.

## Corrección adversarial del full draw

La primera versión del nuevo arco parecía mejor en datos, pero una prueba de forward kinematics reveló que la mano de cuerda quedaba demasiado baja/adelantada. Se resolvieron objetivos de rotación contra los vectores de bind reales de los 17 huesos y se añadió una prueba permanente.

La prueba exige mano de arco proyectada al frente, mano de cuerda detrás del arco, cerca del eje facial y a altura humana plausible.

## Melee

Sin secuencia de referencia suministrada en esta wave, se implementa una gramática original basada en la constitución del proyecto:

```text
pie → pelvis → spine/chest → hombro → brazo → arma
```

Familias iniciales: normal alterno, heavy, thrust, kick y charge. Su refinamiento visual se hará después de validar caster/archer en cámara real.

## Equipo

La ruta GLB no usa atuendo procedural. Únicamente:

- caster: staff;
- archer: bow;
- melee: sword provisional.

Esto elimina el ruido visual de las capturas v0.14 y permite juzgar primero rig y movimiento.

## QA

- `Skinned Animation v0.15`: **12/12**.
- Suite completa: **367/367**.
- Modelo: **50.000 tris · 76.070 vértices · 17 huesos · 1 skin**.
- Auditor de skinning: **PASS**.
- 11 agentes/revisores relevantes ejecutados: **PASS**.
- ARBITER v0.15: **APROBADO**.
- VISUAL CRITIC estático: **APROBADO**.

## Gate humano pendiente

El entorno administrado bloquea `127.0.0.1` antes de cargar el juego. Por ello no se declara esta animación `VERIFIED` visualmente. El siguiente gate legítimo es subir v0.15 a Hostinger y revisar a cámara MMO idle, locomoción, normal de báculo, cast completo, normal de arco, power draw y melee.
