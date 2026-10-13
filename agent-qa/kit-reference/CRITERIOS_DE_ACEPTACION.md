# Matriz de aceptación del vertical slice 1v1

Marcar cada caso con: `NO_PROBADO`, `FALLA`, `PROVISIONAL`, `APROBADO_TECNICAMENTE`, `APROBADO_VISUALMENTE_POR_USUARIO`.

| ID | Escenario | Evidencia mínima | Requisito |
|---|---|---|---|
| A01 | Arranque local + arena 1v1 | captura HUD + consola sin errores bloqueantes | obligatorio |
| A02 | Movimiento adelante | 3+ frames espaciados / video | sin T-pose / sliding grave |
| A03 | Retroceso | secuencia de frames con inputs reales | clip semántico correcto, no `Walk_Loop` frontal disfrazado de FINAL |
| A04 | Strafe izq./der. | dos secuencias | cuerpo y desplazamiento concordantes |
| A05 | Giro + cámara + target lock | secuencia e input | yaw coherente, sin cámara rota |
| A06 | Idle/combat stance | captura + transición en secuencia | guardia correcta |
| A07 | Normal A/B | secuencia anticipación–impacto–recovery | coincide con `RELEASE` |
| A08 | Poder con casteo | clip durante windup + VFX release | temporización correcta |
| A09 | Daño recibido | impacto por ambos tipos, evento sim | reacción visible sin interrumpir simulación |
| A10 | CC knockdown/getup | fotogramas inicio, suelo, salida | sin quedar atascado |
| A11 | Muerte / resultado | video / log combate | estado final estable |
| A12 | Cooldown, castbar, GCD, icono y tooltips | capturas antes/después y log | corresponden a datos reales |
| A13 | Arquero: preparar/disparar | secuencia lado/frente | gesto de arco convincente o **PROVISIONAL** |
| A14 | Caster: cargar/soltar | secuencia | animación sincronizada con poder |
| A15 | 1v1 de inicio a fin con bot | video / reproducción + log | partida terminable y reiniciable |
| A16 | Auditoría clip / sintaxis / consola | logs adjuntos | sin errores introducidos |
| A17 | Build preview local | URL local y comando funcional | acceso en navegador |
| A18 | Rendimiento aproximado | mediciones dispositivo real | documentar hardware; no confundir SwiftShader con FPS GPU |
| A19 | Accesibilidad de pruebas | comandos exactos y archivos de QA | reproducible por otro operador |
| A20 | Inventario poderes según catálogo realmente disponible | informe de implementados / parciales / ausentes | no inventar IDs/nombres/efectos |

**Definición de terminado:** A01/A07/A08/A09/A11/A12/A15/A16/A17 sin defectos bloqueantes, A02–A06/A10/A13/A14 comprobados visualmente (los incompletos claramente marcados), una demo reproducible y lista honesta de pendientes. La aceptación artística final corresponde al usuario.

**No es definición de terminado:** “65 JS sin errores”, “69 clips verificados” o “todos los skills instalados”.


## Aceptación adicional para alcance Arena + equipo

| ID | Caso | Evidencia obligatoria |
|---|---|---|
| A21 | Mitigación física por armadura | mismo ataque / defensa distinta / daño medido |
| A22 | Resistencia mágica | mismo hechizo / resistencia distinta / daño medido |
| A23 | Ruptura temporal de armadura | daño antes/durante/después del efecto |
| A24 | Armas + escudos en movimiento | secuencias con sockets y poses |
| A25 | Armadura visual o falta de activos | pruebas visuales o estado `PENDIENTE_POR_ASSET`, sin fingir que está lista |
| A26 | Poderes de clases existentes | matriz habilidad/cast/GCD/CD/impacto/recurso/HUD + evidencia de pruebas |
| A27 | Sin dependencias externas obligatorias | agente pudo usar solo repo + recursos de su sandbox |

**Prioridad:** funcionar como juego de combate MMORPG en Arena 1v1; no extenderse a MMO completo. `A25` puede quedar pendiente si faltan mallas reales; documentarlo como límite de los activos disponibles, no presentarlo como éxito.
