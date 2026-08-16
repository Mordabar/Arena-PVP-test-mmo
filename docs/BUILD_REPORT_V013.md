# Project Arena v0.13 — Source Power Parity

## Objetivo

Esta iteración usa `reference/Regnum_Documento_Maestro_Poderes.docx` como única fuente de verdad del catálogo jugable. Se eliminaron del libro/barra los poderes que no pertenecen a la fuente y cada poder real conserva un nombre fácilmente rastreable mediante una variación sistemática: por ejemplo `Meteorito → Meteorito del Vacío`.

## Cobertura

- 320 registros fuente auditados.
- 290 poderes reales.
- 30 placeholders `undefined` excluidos, no convertidos en habilidades.
- 410 asignaciones a las seis subclases.
- 344 asignaciones activas y 66 pasivas.
- Devastador 65 · Guardián 65 · Centinela 65 · Rastreador 65 · Arcanista 75 · Vinculador 75.

El `powerBook` y las barras del producto contienen únicamente poderes `sourceDerived`. Los poderes históricos de Arena que permanecen en `js/data/abilities.js` son fixtures internos para que la suite de regresión siga comprobando el núcleo; no aparecen en el libro ni pueden equiparse desde el flujo normal del jugador.

## Contrato fuente

El runtime actual usa rango 5 y preserva en `sourceMechanics` las cinco columnas fuente. Para cada poder se auditan:

- tipo;
- tiempo de lanzamiento;
- categoría GCD;
- cooldown;
- duración;
- maná;
- rango;
- área;
- escalado con arma;
- resistible/bloqueable;
- todos los bullets de daño, buffs y debuffs;
- valor exacto de rango 5 de cada bullet.

No existe un reescalado de daño propio de Arena en este catálogo. Los rangos fuente se conservan: con RNG desactivado se usa el punto medio determinista; con RNG activado se samplea dentro del intervalo fuente.

## Fix Waves adversariales

Durante la revisión v0.13 el árbitro encontró y se corrigieron diferencias que un simple conteo de poderes no detectaba:

1. **Asistencia del Paladín** se estaba autoaplicando. Ahora se aplica al aliado objetivo y redirige 100% de su daño al Guardián durante 8 s.
2. **Represalia** ya no reutiliza el reflector mágico legacy. Devuelve 90% del siguiente daño realmente recibido y consume la carga.
3. **Espejo del karma** ya no se comporta como una carga única. Devuelve 30% de cada paquete de daño recibido durante 30 s.
4. **Campo estático** pulsa 100 de daño eléctrico por segundo durante 40 s y mantiene slow 30% sólo sobre enemigos dentro de radio 10; no genera un tick extra al crear el aura.
5. **Comunión de mana** restaura 15 de recurso por segundo a lanzador/aliados dentro de radio 6, nunca a enemigos.
6. **Curación mayor** usa área 6 centrada en el objetivo a rango 20 y cura sólo al bando aliado.
7. **Muro protector / Escudo estelar / Barrera mágica / Muralla material** dejaron de compartir una resistencia genérica: físico y mágico conservan canales distintos.
8. **Furia natural**, **Vampirismo**, **Sirvientes sádicos**, **Lazo extraplanar**, **Defensa salvaje**, **Revivir mascota** y la purga de **Aplasta mentes** conservan sus mecánicas especiales y tienen regresiones explícitas.

## Controles

Se corrigió la inversión solicitada:

- `A` gira a la izquierda.
- `D` gira a la derecha.
- `Q` strafe izquierda.
- `E` strafe derecha.

La cámara conserva el seguimiento del giro corporal ya implementado en v0.12.

## QA de cierre

- Suite completa: **353/353**.
- Auditor independiente del DOCX: **20/20**.
- Agentes especializados: **14/14**.
- Árbitro adversarial: **APROBADO**.
- El auditor independiente vuelve a leer el DOCX y no importa el generador, por lo que un error de parsing/generación no puede autoaprobarse comparándose consigo mismo.

## Límite deliberado de esta wave

El Documento Maestro define poderes, pero no contiene la fórmula global que transforma atributos base (`Fuerza`, `Destreza`, `Inteligencia`, `Constitución`, `Concentración`, etc.) en daño, vida, precisión o evasión. v0.13 preserva exactamente esos deltas como canales autoritativos de estado, pero **no inventa una fórmula externa que la fuente no proporciona**. La integración de esas fórmulas globales y del modelo completo de armadura pertenece a la posterior wave de atributos/armadura.
