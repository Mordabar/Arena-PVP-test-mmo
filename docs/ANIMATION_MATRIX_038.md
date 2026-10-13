# Matriz de animaciones · v0.38

La simulación decide las restricciones, tiempos y resultados. Esta matriz enumera la selección real con fixtures: no es evidencia de una partida en navegador. Clips UAL nativos se cargan de los tres GLB incluidos. Las adaptaciones de arco, pies direccionales, caída/noqueo y poses sostenidas conservan su condición provisional. La calificación FINAL del contrato describe la elección de fuente; no acredita calidad artística AAA.

El arranque/parada combina locomoción con reposo mediante las mezclas existentes; no se inventan clips dedicados. No hay canalización independiente en el kit de duelo: las preparaciones largas usan el estado CAST_CHARGE. Evasión, absorción, resistencia, reflejo y escudo tienen texto/VFX por evento, sin mover al personaje ni cancelar casteo. Entrar/salir del modo mágico reutiliza Spell_Simple_Enter/Exit; estas transiciones nunca superan muerte, noqueo, aturdimiento o estasis.

El reinicio elimina las entidades y sus handles; crea reposo y cooldowns nuevos. Una acción repetida recibe un token nuevo aunque comparta clip. Las piernas siguen el movimiento real durante acciones compatibles. Bloqueo durante casteo/ataque conserva la acción y muestra VFX; daño leve añade una reacción de pecho.

| Clase | Estado real | Selección / clip | Origen y adaptación | Prioridad | Transición y salida |
|---|---|---|---|---:|---|
| devastador | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| devastador | Guardia | COMBAT_IDLE · Sword_Idle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Modo de combate; sale al moverse o actuar |
| devastador | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| devastador | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| devastador | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| devastador | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| devastador | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| devastador | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| devastador | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| devastador | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| devastador | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| devastador | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| devastador | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| devastador | Normal preparación | ACTION · Sword_Regular_A | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | WINDUP real; cancelar o RELEASE |
| devastador | Normal ejecución | ACTION · Sword_Regular_A | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| devastador | Normal recuperación | ACTION · Sword_Regular_A_Rec | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| devastador | Preparación de poder | CAST_CHARGE · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | CastStarted; termina en RELEASE, cancelación o control |
| devastador | Poder ofensivo | ACTION · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | AbilityReleased; animación no decide el daño |
| devastador | Curación / buff | ACTION · Yes | EXTERNAL_CC0 / PROVISIONAL · full | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| devastador | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| devastador | Daño durante casteo | CAST_CHARGE · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| devastador | Bloqueo | BLOCK · Sword_Block | EXTERNAL_CC0 / PROVISIONAL · upper | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| devastador | Interrupción | COMBAT_IDLE · Sword_Idle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| devastador | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| devastador | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| devastador | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| devastador | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| devastador | Enraizamiento | COMBAT_IDLE · Sword_Idle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| devastador | Silencio | COMBAT_IDLE · Sword_Idle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| devastador | Desarme | COMBAT_IDLE · Sword_Idle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe arma; permite magia legal |
| devastador | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| devastador | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| devastador | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
| guardian | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| guardian | Guardia | COMBAT_IDLE · Idle_Shield_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Modo de combate; sale al moverse o actuar |
| guardian | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| guardian | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| guardian | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| guardian | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| guardian | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| guardian | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| guardian | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| guardian | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| guardian | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| guardian | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| guardian | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| guardian | Normal preparación | ACTION · Sword_Regular_A | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | WINDUP real; cancelar o RELEASE |
| guardian | Normal ejecución | ACTION · Sword_Regular_A | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| guardian | Normal recuperación | ACTION · Sword_Regular_A_Rec | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| guardian | Preparación de poder | CAST_CHARGE · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | CastStarted; termina en RELEASE, cancelación o control |
| guardian | Poder ofensivo | ACTION · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 3 | AbilityReleased; animación no decide el daño |
| guardian | Curación / buff | ACTION · Yes | EXTERNAL_CC0 / PROVISIONAL · full | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| guardian | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| guardian | Daño durante casteo | CAST_CHARGE · Sword_Regular_C | EXTERNAL_CC0 / FINAL_USER_LOCKED · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| guardian | Bloqueo | BLOCK · Sword_Block | EXTERNAL_CC0 / PROVISIONAL · upper | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| guardian | Interrupción | COMBAT_IDLE · Idle_Shield_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| guardian | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| guardian | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| guardian | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| guardian | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| guardian | Enraizamiento | COMBAT_IDLE · Idle_Shield_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| guardian | Silencio | COMBAT_IDLE · Idle_Shield_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| guardian | Desarme | COMBAT_IDLE · Idle_Shield_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe arma; permite magia legal |
| guardian | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| guardian | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| guardian | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
| centinela | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| centinela | Guardia | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Modo de combate; sale al moverse o actuar |
| centinela | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| centinela | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| centinela | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| centinela | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| centinela | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| centinela | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| centinela | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| centinela | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| centinela | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| centinela | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| centinela | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| centinela | Normal preparación | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | WINDUP real; cancelar o RELEASE |
| centinela | Normal ejecución | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| centinela | Normal recuperación | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| centinela | Preparación de poder | CAST_CHARGE · Arena_Archer_Notch | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | CastStarted; termina en RELEASE, cancelación o control |
| centinela | Poder ofensivo | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; animación no decide el daño |
| centinela | Curación / buff | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| centinela | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| centinela | Daño durante casteo | CAST_CHARGE · Arena_Archer_Notch | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| centinela | Bloqueo | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · VFX por evento | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| centinela | Interrupción | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| centinela | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| centinela | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| centinela | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| centinela | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| centinela | Enraizamiento | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| centinela | Silencio | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| centinela | Desarme | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación restringe arma; permite magia legal |
| centinela | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| centinela | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| centinela | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
| rastreador | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| rastreador | Guardia | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Modo de combate; sale al moverse o actuar |
| rastreador | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| rastreador | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| rastreador | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| rastreador | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| rastreador | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| rastreador | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| rastreador | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| rastreador | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| rastreador | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| rastreador | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| rastreador | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| rastreador | Normal preparación | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | WINDUP real; cancelar o RELEASE |
| rastreador | Normal ejecución | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| rastreador | Normal recuperación | ACTION · Arena_Archer_Shoot | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| rastreador | Preparación de poder | CAST_CHARGE · Arena_Archer_Notch | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · upper | 3 | CastStarted; termina en RELEASE, cancelación o control |
| rastreador | Poder ofensivo | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; animación no decide el daño |
| rastreador | Curación / buff | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| rastreador | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| rastreador | Daño durante casteo | CAST_CHARGE · Arena_Archer_Notch | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| rastreador | Bloqueo | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · VFX por evento | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| rastreador | Interrupción | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| rastreador | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| rastreador | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| rastreador | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| rastreador | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| rastreador | Enraizamiento | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| rastreador | Silencio | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| rastreador | Desarme | COMBAT_IDLE · Arena_Archer_Ready | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 0 | Simulación restringe arma; permite magia legal |
| rastreador | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| rastreador | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| rastreador | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
| arcanista | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| arcanista | Guardia | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Modo de combate; sale al moverse o actuar |
| arcanista | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| arcanista | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| arcanista | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| arcanista | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| arcanista | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| arcanista | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| arcanista | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| arcanista | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| arcanista | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| arcanista | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| arcanista | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| arcanista | Normal preparación | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | WINDUP real; cancelar o RELEASE |
| arcanista | Normal ejecución | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| arcanista | Normal recuperación | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| arcanista | Preparación de poder | CAST_CHARGE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | CastStarted; termina en RELEASE, cancelación o control |
| arcanista | Poder ofensivo | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | AbilityReleased; animación no decide el daño |
| arcanista | Curación / buff | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| arcanista | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| arcanista | Daño durante casteo | CAST_CHARGE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| arcanista | Bloqueo | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · VFX por evento | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| arcanista | Interrupción | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| arcanista | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| arcanista | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| arcanista | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| arcanista | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| arcanista | Enraizamiento | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| arcanista | Silencio | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| arcanista | Desarme | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe arma; permite magia legal |
| arcanista | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| arcanista | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| arcanista | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
| vinculador | Reposo | IDLE · Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Sin entrada; mezcla a guardia al entrar en combate |
| vinculador | Guardia | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Modo de combate; sale al moverse o actuar |
| vinculador | Caminar | WALK · Walk_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| vinculador | Correr | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Desplazamiento real; sale al detenerse |
| vinculador | Sprint | SPRINT · Sprint_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Buff de velocidad y desplazamiento |
| vinculador | Retroceso | BACKPEDAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| vinculador | Lateral izquierdo | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| vinculador | Lateral derecho | STRAFE · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| vinculador | Diagonal | DIAGONAL · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Ajuste de pies nativo provisional |
| vinculador | Giro | TURN · Idle_Loop | ARENA_NATIVE_FOOT_IK / PROVISIONAL · lower | 1 | Rotación real; pie pivota, adaptación provisional |
| vinculador | Salto inicio | JUMP_START · Jump_Start | EXTERNAL_CC0 / FINAL · full | 5 | Evento de salto; transición a vuelo |
| vinculador | Salto vuelo | AIRBORNE · Jump_Loop | EXTERNAL_CC0 / FINAL · full | 5 | En el aire; transición al contacto con suelo |
| vinculador | Aterrizaje | LAND · Jump_Land | EXTERNAL_CC0 / FINAL · full | 5 | Contacto con suelo; peso visual llega a cero |
| vinculador | Normal preparación | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | WINDUP real; cancelar o RELEASE |
| vinculador | Normal ejecución | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | RELEASE autoritativo; nuevo evento reinicia clip |
| vinculador | Normal recuperación | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | RECOVERY/readyAt; disponible al cumplir ciclo |
| vinculador | Preparación de poder | CAST_CHARGE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | CastStarted; termina en RELEASE, cancelación o control |
| vinculador | Poder ofensivo | ACTION · Spell_Simple_Shoot | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 3 | AbilityReleased; animación no decide el daño |
| vinculador | Curación / buff | ACTION · Spell_Simple_Enter | EXTERNAL_CC0 / PROVISIONAL · upper | 3 | AbilityReleased; reutiliza gesto nativo de utilidad |
| vinculador | Daño leve | HIT · Hit_Chest | EXTERNAL_CC0 / FINAL_USER_LOCKED · upper | 4 | DamageApplied; decae sin alterar simulación |
| vinculador | Daño durante casteo | CAST_CHARGE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · Chest quaternion aditivo | 3 | Capa aditiva breve de pecho; conserva casteo |
| vinculador | Bloqueo | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · VFX por evento | 4 | AbilityBlocked; melee usa Sword_Block, demás VFX; respeta acciones |
| vinculador | Interrupción | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | CastCancelled; vuelve a guardia, sin commit anticipado |
| vinculador | Aturdimiento | STUN · Hit_Head | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | StatusApplied/Removed; pose sostenida |
| vinculador | Noqueo caída | KNOCKDOWN_START · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Primeros 0.38 s; reutiliza Death01 |
| vinculador | Noqueo tendido | KNOCKDOWN_LOOP · Death01 | SOURCE_DERIVED_CC0 / SOURCE_DERIVED_PROVISIONAL · full | 8 | Control activo; mantiene último fotograma de Death01 |
| vinculador | Levantarse | KNOCKDOWN_EXIT · LayToIdle | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 7 | Control eliminado; LayToIdle durante salida visual |
| vinculador | Enraizamiento | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación bloquea desplazamiento; permite acciones legales |
| vinculador | Silencio | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe poderes; locomoción y arma según reglas |
| vinculador | Desarme | COMBAT_IDLE · Spell_Simple_Idle_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 0 | Simulación restringe arma; permite magia legal |
| vinculador | Ralentización | RUN · Jog_Fwd_Loop | EXTERNAL_CC0 / FINAL_USER_LOCKED · lower | 1 | Velocidad real gobierna paso; no inmovilización total |
| vinculador | Estasis | STASIS · Idle_Loop | EXTERNAL_CC0 / FINAL · full | 9 | Pose anterior congelada; continúa al eliminar estado |
| vinculador | Muerte | DEATH · Death01 | EXTERNAL_CC0 / FINAL_USER_LOCKED · full | 10 | EntityDied; supera acciones y controles; pose final sostenida |
