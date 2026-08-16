# Project Arena v0.12 — Research de personajes y animación

Fecha: 2026-08-14

## Objetivo

Buscar referencias legales y técnicamente compatibles para abandonar progresivamente el aspecto de maniquí procedural sin acoplar la simulación a un renderer concreto.

## Opciones verificadas

### Quaternius — Universal Base Characters

- 6 personajes base.
- rig humanoide retargetable.
- aproximadamente 13k triángulos por base.
- FBX + glTF.
- CC0.
- compatible con Universal Animation Library.

Fuente oficial: https://quaternius.com/packs/universalbasecharacters.html

### Quaternius — Universal Animation Library / Library 2

- Library 1: 120+ animaciones, incluyendo locomoción en 8 direcciones.
- Library 2: 130+ animaciones adicionales, combos melee/armados y otras familias.
- rig humanoide universal y retargeting.
- CC0.

Fuentes oficiales:
- https://quaternius.com/packs/universalanimationlibrary.html
- https://quaternius.com/packs/universalanimationlibrary2.html

### Quaternius — Modular Character Outfits Fantasy

- 12 outfits / 62 piezas modulares.
- rig humanoide compatible con Universal Base Characters.
- glTF / FBX.
- CC0.

Fuente oficial: https://quaternius.com/packs/modularcharacteroutfitsfantasy.html

### KayKit — Adventurers + Character Animations

- personajes fantasy stylized, incluidos perfiles knight/wizard/archer.
- rigged/animated, armas y accesorios.
- glTF / FBX.
- pack de animaciones separado con 161 animaciones humanoides.
- CC0.

Fuentes:
- https://kaylousberg.itch.io/kaykit-adventurers
- https://kaylousberg.itch.io/kaykit-character-animations
- repositorio público: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0

## Decisión v0.12

No se incrusta un pack externo de 100+ MB dentro del vertical slice web sin un backend GLTF/skinned y un presupuesto de descarga definido. En esta wave se mejora el renderer procedural existente y se conserva `AnimationIntent` como frontera portable.

El candidato técnico preferido para el siguiente cambio de backend es **Quaternius Universal Base Characters + Universal Animation Library**, porque base, outfits y animaciones comparten una gramática de rig y son CC0. KayKit queda como alternativa fuerte para prototipado rápido.

## Cambios visuales aplicados ahora

- torso, abdomen, pelvis, cráneo, mandíbula, brazos, manos, piernas y pies con elipsoides/cápsulas de mayor densidad;
- pelo por masas curvas;
- arco curvo y equipo con rotación tridimensional;
- aro real de báculo mediante torus;
- materiales diferenciados piel/tela/cuero/metal/madera/magia;
- poses de caster por gesto semántico, no por un único “cast genérico”.
