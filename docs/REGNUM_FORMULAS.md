# Modelo de armadura y daño del Excel aportado

Fuente: «Champions of Regnum - Plantilla de cálculo (v.1.8)». La pestaña Índice B1 dice **2016**. No se ha editado el original. Extracción de fórmulas XML, incluyendo referencias compartidas: una fórmula compartida sin texto no es una celda vacía; se traslada su referencia desde la celda base. Este documento describe la transcripción del archivo recibido, no verifica el servidor actual.

## Fórmulas y coordenadas

| Cálculo | Fórmula del modelo | Coordenadas de origen |
|---|---|---|
| Daño de arma | (arma + joyas + buffs planos) × (1 + bonus) + K × (atributo − 20) | Hoja del pj C33, D42:I43; Daño y Armadura C76 |
| K por clase | Bárbaro 2, Caballero 1.5, Tirador 1.5, Cazador 1, Brujo 1.75, Conjurador 1.33 | Hoja del pj D42:I42; Atributos E9:E29 |
| Protección por pieza | K_pieza × armadura_base + bonus_plano; sumar, después × (1 + bonus_protección) | Daño y Armadura E32:E40, J32:J39, O32:O38 |
| Resistencia por elemento | sumar peso_pieza × resistencia_pieza, después + bonus_resistir_daño | Daño y Armadura G122:U175 |
| Calidad de resistencia | Excelente +45%, Muy Buena +30%, Buena +15%, Normal 0%, Mala −15%, Muy Mala −30% | Daño y Armadura F122, M122, T122 y fórmulas compartidas |
| Daño recibido | suma(daño_elemental × (1 − resistencia_elemental)) + neutro − armadura × 0.52 | Daño y Armadura F186:F193, G181, G193; se repite por clase |
| Crítico recibido | daño_normal_ya_mitigado × 1.33 | Daño y Armadura G194 = G193 × 1.33, fórmula compartida desde F194; G203, N194, U194 y demás |
| Probabilidad crítico | max(0, concentración/10 − 3) × (1 + bonus), expresado en puntos porcentuales | Hoja del pj D68 |
| Probabilidad evasión | max(0, destreza × 0.066 − 100/nivel) × (1 + bonus), puntos porcentuales | Hoja del pj D80 |
| Resistencia poderes | max(0, .02 × (constitución + inteligencia) + .026364 × nivel − 1.25 + buff) × (1 + bonus), puntos porcentuales | Hoja del pj D94 |
| Vida guerreros | 47 × (constitución/2 + nivel) + bonus − 270 | Hoja del pj D16 |
| Vida otras clases | 37 × (constitución/2 + nivel) + bonus − 170 | Hoja del pj F16 |
| Maná | 18 × (inteligencia/2 + nivel) + bonus − 80; Conjurador −75 | Hoja del pj D28, G28 |
| Ataques/s | tasa_base × (1 + VA); intervalo = 1/tasa | V.A. C17:J19, C25:J27 |
| Tiempo casteo | tiempo_base / (1 + VI) | Hoja del pj D116 |
| Recarga global | recarga_base × (1 − VA) | V.A. E31:E35; comentario B29 |
| Movimiento | 4.8 × (1 + bonus), bonus limitado a −70% / +50% | V.M. D17, B21:B23 |

En la API JavaScript los bonus y probabilidades son fracciones: `0.15` es 15%, `2` es +200%. No pasar puntos porcentuales `15` en lugar de `0.15`.

### Coeficientes exactos de protección

| Familia | Piezas y coeficientes |
|---|---|
| Caballero | pecho .305, escudo .29, yelmo .285, piernas .265, hombros .245, guantes .225 |
| Arquero/Bárbaro | pecho .3075, yelmo .28510638, piernas .26808511, hombros .246808511, guantes .22553191 |
| Mago | túnica .484375, sombrero .2890625, brazalete .265625, guantes .2265625 |

Los pesos de resistencia son distintos de estos coeficientes y están transcritos en `resistanceWeights`. Sus sumas originales son .9887955182 / .9918032786 / .9941520467: **no se normalizan silenciosamente a 1**.

### Tasas base de ataque

| Familia | Rápida | Media | Lenta | Muy lenta |
|---|---|---|---|---|
| Guerrero | .61 | .52 | .45 | .39 |
| Arquero | .66 | .60 | .53 | No disponible |
| Mago | .65 | .63 | .54 | No disponible |

## Límites y decisiones explícitas

- El autor llama a la sección de daño/armadura «en fase beta» (Índice F14). El comentario Daño y Armadura F181 dice que **.52 se probó solamente en arqueros** y que podría variar por subclase. El módulo lo expone configurable; usarlo en otras clases es una adaptación declarada, no una confirmación de Regnum actual.
- La armadura se resta **una vez por golpe compuesto**, no por cada componente elemental. Sumar los componentes antes de mitigar evita penalizar artificialmente golpes multielemento.
- Daño neutro no es daño puro: el neutro no tiene resistencia elemental, pero sí pierde armadura. El canal `pure` del juego puede seguir ignorando ambos por reglas propias; no equipararlo al neutro del Excel.
- El crítico del resultado final usa una fórmula compartida trasladada: G194 = G193 × 1.33. Aplicar 1.33 antes de restar armadura daría otro resultado.
- El Excel permite resultados negativos en la resta de armadura y contiene #DIV/0 en D80 con nivel vacío/0. El módulo protege el runtime con piso de daño/vida/maná 0 y nivel válido; son guardas adicionales documentadas.
- Hoja del pj D105 escribe `(concentración−69)×0.1% + VI_base` solo si concentración >70, pero D116 divide VI por 100. Hay una **ambigüedad de unidades** entre VI decimal y puntos porcentuales y discrepancia del umbral textual (>69 frente a >70). No se integra automáticamente ese incremento de concentración. `castTime` recibe VI explícita como fracción.
- El bonus de daño de arma no aumenta la parte pasiva del atributo (comentario Daño y Armadura B74). No usar `damageDealtPct` indiscriminadamente para el aumento de daño del arma si el total incluye atributo.
- No se han cambiado HP/maná iniciales de la arena automáticamente a los del Excel: esas funciones están disponibles para perfiles de equipo/nivel. Un cambio de esas escalas exige comprobar todos los costes, curaciones y duelos.

## Interfaz de integración

`Arena.Combat.RegnumFormulas` contiene funciones puras. `weaponDamage({classId,weaponFlat,jewelryFlat,buffFlat,bonusPct,attribute,k?})`. `protection(classId,pieces,bonusPct)` acepta piezas por slot con `{base,bonusFlat,resistances:{fire:'Buena',...}}`. `resistance(classId,pieces,element,bonusPct)` devuelve la resistencia elemental combinada.

`mitigate({components:{slashing:100,fire:200,neutral:50},resistances:{slashing:.15,fire:.3},armor:100,ignoreDefensePct:0,critical:false,criticalBonusPct:0,armorFactor:.52})` devuelve `{raw,afterResistance,byElement,armorReduction,beforeCritical,damage,criticalMultiplier}`. Debe llamarse una vez por golpe compuesto, antes de las barreras. Los modificadores propios de la arena siguen separados.

Prueba independiente: `node tools/tests/regnum-formulas.mjs`. El archivo original se conserva intacto.
