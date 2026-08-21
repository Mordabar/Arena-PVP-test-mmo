# Animation Mapping v0.32

| State | Normal | Combat |
|---|---|---|
| Devastador idle | Idle_Loop | Sword_Idle |
| Guardian idle | Idle_Loop | Idle_Shield_Loop |
| Archer idle | Idle_Loop | Bow_Aim_Neutral -> Arena_Archer_VideoReady fallback |
| Caster idle | Idle_Loop | Spell_Simple_Idle_Loop |

## Combat-mode rule
A target is not combat mode. `hasTarget` is targeting information only. `combatMode` is a distinct simulation state. Normal auto-attacks set `autoAttackOn`, which sets `combatMode`; stopping auto-attack clears both.

## Archer flow
NORMAL -> COMBAT READY -> NOTCH/DRAW -> RELEASE -> RECOVER -> COMBAT READY

- NORMAL: Idle_Loop. Bow remains equipment but body does not aim or fire.
- COMBAT READY: Bow_Aim_Neutral requested; Arena_Archer_VideoReady fallback.
- NOTCH/DRAW: Bow_Notch requested; Arena_Archer_VideoNotch fallback; bow-string draw follows simulation cast progress.
- RELEASE: Bow_Shoot for normal / Bow_RapidShoot for power; Arena_Archer_VideoShoot fallback.
- RECOVER: returns to combat-ready, not normal idle, while combatMode remains true.

When combatMode becomes false the body returns to NORMAL even if a target is still selected.
