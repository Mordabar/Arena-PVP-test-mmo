# Project Arena · Combat Timing Matrix v0.6

La relación entre poderes, ataque normal y reloj de arma es **data-driven**. `RELEASE` es el punto de commit de recurso, cooldown y GCD.

## Devastador

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Embestida brutal | weaponSkill | no | independent | ignore | 0.55 | 0.00 |
| Impacto sísmico | utility | sí | weaveAfterNormal | ignore | 0.80 | 0.00 |
| Golpe quebrador | weaponSkill | sí | replacesNormal | respectReady | 0.80 | 0.40 |
| Bramido de ruptura | utility | sí | independent | ignore | 0.80 | 0.50 |
| Furia desatada | utility | no | independent | ignore | 0.55 | 0.00 |
| Golpe profanador | weaponSkill | sí | replacesNormal | respectReady | 0.80 | 0.60 |

## Guardián

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Avasallamiento | utility | sí | weaveAfterNormal | ignore | 0.80 | 0.00 |
| Guardia absoluta | utility | no | independent | ignore | 0.25 | 0.00 |
| Interponer | utility | no | independent | ignore | 0.55 | 0.00 |
| Égida reflectante | utility | no | independent | ignore | 0.25 | 0.00 |
| Protección aliada | utility | no | independent | ignore | 0.55 | 0.00 |
| Postura inexpugnable | utility | sí | blocksNormal | ignore | 0.55 | 0.40 |

## Centinela

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Disparo tensado | weaponSkill | sí | replacesNormal | respectReady | 0.80 | 1.20 |
| Flecha perforante | weaponSkill | sí | weaveAfterNormal | ignore | 0.80 | 0.70 |
| Ráfaga disruptiva | weaponSkill | sí | weaveAfterNormal | ignore | 0.55 | 0.50 |
| Pulso invernal | spell | sí | weaveAfterNormal | ignore | 0.80 | 0.80 |
| Retroceso táctico | utility | no | independent | ignore | 0.55 | 0.00 |
| Lluvia de astillas | weaponSkill | sí | replacesNormal | respectReady | 0.80 | 1.00 |

## Rastreador

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Camuflaje | utility | sí | blocksNormal | ignore | 0.55 | 3.00 |
| Emboscada | weaponSkill | sí | replacesNormal | respectReady | 0.80 | 0.40 |
| Trampa enredante | utility | sí | independent | ignore | 0.55 | 0.50 |
| Marca corrosiva | weaponSkill | sí | weaveAfterNormal | ignore | 0.80 | 0.60 |
| Confusión táctica | utility | sí | independent | ignore | 0.80 | 0.80 |
| Revelar presas | utility | no | independent | ignore | 0.55 | 0.00 |

## Arcanista

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Descarga ígnea | spell | sí | independent | ignore | 0.80 | 1.00 |
| Prisión etérea | spell | sí | independent | ignore | 0.80 | 0.80 |
| Impacto celeste | spell | sí | independent | ignore | 0.80 | 1.70 |
| Estasis glacial | spell | sí | independent | ignore | 0.80 | 1.20 |
| Corrupción vital | spell | sí | independent | ignore | 0.80 | 1.00 |
| Velo nulo | spell | sí | independent | ignore | 0.80 | 1.20 |

## Vinculador

| Poder | actionType | stationary | normalInteraction | weaponIntervalPolicy | GCD (s) | Cast (s) |
|---|---|---:|---|---|---:|---:|
| Pulso vital | spell | sí | independent | ignore | 0.80 | 1.00 |
| Regeneración vinculada | spell | sí | independent | ignore | 0.55 | 0.60 |
| Barrera etérea | spell | sí | independent | ignore | 0.80 | 0.70 |
| Intervención | spell | sí | independent | ignore | 0.80 | 0.80 |
| Purificación | spell | sí | independent | ignore | 0.55 | 0.60 |
| Enlace protector | spell | no | independent | ignore | 0.55 | 0.00 |

