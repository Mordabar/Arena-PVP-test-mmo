# Poderes de Champions of Regnum — trainer 1.35.19

> GENERADO por `node tools/extract-regnum-trainer.mjs <trainerdata.json>`.
> No editar a mano. Fuente: CoRT (cort.ovh), datos de juego de terceros.

Disciplinas: **32** · Poderes: **320** · Niveles por poder: 5

## Progresión de personaje

| Nivel | 1 | 2 | 3 | 4 | 5 | … |
|---|---|---|---|---|---|---|
| Puntos de nivel acumulados | 0 | 1 | 4 | 7 | 13 | … |

Puntos de poder disponibles por nivel: 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10

## Archer

### Short Bows

#### Dual shot
> The archer fires two arrows at the same time.

tipo Direct · cast 0.5s · GCD Short · recarga 7s · rango 0

- **Maná:** 40 / 60 / 80 / 95 / 110
- **Daño** Slashing damage: 50 / 75 / 100 / 125 / 150
- **Buff** Attack damage: +100% / +105% / +110% / +115% / +120%

#### Rapid shot
> The shooting frequency increases, at expenses of the accuracy.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 10 / 15 / 20 / 25 / 30

- **Maná:** 60 / 85 / 110 / 135 / 160
- **Buff** Attack speed: +25%
- **Debuff** Critical Chance: -50%

#### Grounding arrow
> The arrow is shot to the opponent's feet, hindering movement.

tipo Constant · cast 0.5s · GCD Short · recarga 40s · rango 20 · duración 1 / 2 / 3 / 4 / 5

- **Maná:** 95 / 120 / 145 / 170 / 195
- **Buff** Attack damage: +80% / +90% / +100% / +110% / +120%
- **Debuff** Immobilize: true

#### Lightness
> The archer is naturally fast and light.

tipo Passive

- **Buff** Dexterity: +5 / +7 / +9 / +12 / +15

#### Meditation
> A meditation period makes the archer be more aware of her surroundings.

tipo Constant · cast 0s · GCD Very Short · recarga 120s · duración 50 / 60 / 70 / 80 / 90

- **Maná:** 50 / 75 / 100 / 125 / 150
- **Buff** Concentration: +10 / +15 / +20 / +25 / +30

#### Adaptability
> The archer can rapidly adapt to combat conditions and get the best advantage.

tipo Constant · cast 0s · GCD Very Short · recarga 80s · duración 4 / 6 / 8 / 10 / 12

- **Maná:** 180 / 220 / 260 / 290 / 330
- **Buff** Critical Hit Chance: +200%

#### Tear apart
> The arrow tears apart the opponent's flesh, which bleeds over time.

tipo Constant · cast 1s · GCD Short · recarga 30s · rango 0 · duración 8 / 9 / 10 / 11 / 12

- **Maná:** 130 / 160 / 190 / 220 / 250
- **Daño** Health damage: 20 / 30 / 40 / 50 / 60

#### Duelist
> The archer is adept at firing rapidly and with precision.

tipo Passive

- **Buff** Critical Chance: +10% / +13% / +16% / +20% / +25%

#### Hinder
> The enemy movement and attack is hampered.

tipo Constant · cast 1s · GCD Short · recarga 60s · rango 0 · duración 30 · área 6

- **Maná:** 75 / 125 / 175 / 225 / 275
- **Debuff** Opponent damage: -2% / -4% / -6% / -8% / -10%
- **Debuff** Movement speed: -5% / -7% / -9% / -12% / -15%

#### Repetition shot
> Multiple shots in arc. Those in the area receive piercing damage.

tipo Direct · cast 1.5s · GCD Normal · recarga 180s · rango 10

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Daño** Attack (75° arc) damage: +100%
- **Daño** Piercing (75° arc) damage: 300 / 400 / 500 / 600 / 700

### Long Bows

#### Shield piercing
> An arrow is fired with such a strength it cuts through all defenses.

tipo Direct · cast 0.5s · GCD Short · recarga 10s · rango 0 · bloqueable true%

- **Maná:** 45 / 70 / 90 / 110 / 130
- **Daño** Attack damage: 100% / 105% / 110% / 120% / 135%

#### Parabolic shot
> The shot range increases, but the efficiency decreases.

tipo Constant · cast 0s · GCD Very Short · recarga 40s · duración 15 / 18 / 21 / 25 / 30

- **Maná:** 60 / 75 / 90 / 105 / 120
- **Buff** Attack range: +20% / +21% / +22% / +23% / +25%

#### Maneuver
> A quick analysis of the battle allows the archer to find the best evasive technique.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 40

- **Maná:** 100 / 130 / 160 / 190 / 220
- **Buff** Dexterity: +10 / +15 / +20 / +25 / +30

#### Eagle's eye
> The impact chances are increased.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 120

- **Maná:** 90 / 110 / 130 / 150 / 170
- **Debuff** Opponent evade chance: -10% / -15% / -20% / -25% / -35%

#### Point shot
> The archer observes air spots in armor, increasing critical hit chance.

tipo Constant · cast 0s · GCD Short · recarga 45s · duración 20

- **Maná:** 115 / 140 / 165 / 190 / 215
- **Buff** Critical Hit Chance: +130% / +140% / +150% / +160% / +180%
- **Debuff** Attack range: -30% / -25% / -20% / -10% / 0%

#### Omnipresent
> The archer rapidly finds the best way to penetrate defenses.

tipo Passive

- **Buff** Concentration: +5 / +7 / +9 / +12 / +15

#### Break apart
> The arrow tears away the opponent's flesh.

tipo Constant · cast 1.5s · GCD Short · recarga 40s · rango 0 · duración 15

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Daño** Raw (per second) damage: 8-12 / 12-18 / 13-20 / 31-40 / 40-50
- **Debuff** Constitution: -20

#### Specialist
> The archer is adept to finding the maximum weakness spots.

tipo Passive

- **Buff** Weapon damage bonus: +2% / +4% / +6% / +8% / +10%

#### Obfuscate
> The opponent loses hit visual focus, her critical hit chances decreases.

tipo Constant · cast 1s · GCD Short · recarga 45s · rango 0 · duración 30

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Debuff** Concentration: -15% / -20% / -25% / -30% / -35%
- **Debuff** Cast Speed: -10% / -15% / -20% / -25% / -30%
- **Debuff** Resist immobilize: -10% / -10% / -15% / -15% / -20%
- **Debuff** Resist dizzy: -10% / -10% / -15% / -15% / -20%

#### Projectile rain
> Multiple parabolic shots to an area damage those who are in it.

tipo Direct · cast 3s · GCD Short · recarga 180s · rango 0 · área 10

- **Maná:** 320 / 340 / 360 / 380 / 400
- **Daño** Attack damage: 100%
- **Daño** Piercing damage: 100 / 225 / 350 / 475 / 600

### Tricks

#### Ambush
> The enemy gets surprised. While disoriented, It won't be able to attack.

tipo Constant · cast 0.5s · GCD Normal · recarga 30s · rango 12 · duración 2 / 3 / 4 / 5 / 6 · bloqueable true%

- **Maná:** 50 / 75 / 95 / 115 / 130
- **Debuff** Knock down: true

#### Sudden strike
> The archer attacks while the opponent is off guard. The target defenses are lowered down.

tipo Constant · cast 1s · GCD Short · recarga 40s · rango 25 · duración 20 / 25 / 30 / 35 / 40

- **Maná:** 80 / 90 / 100 / 110 / 120
- **Debuff** Protection: -50%

#### Stunning fist
> Rapid punch to the nose with the hand that holds the bow.

tipo Constant · cast 0.5s · GCD Short · recarga 45s · duración 2 / 3 / 4 / 5 / 6

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Daño** Blunt damage: 150-200 / 225-300 / 300-400 / 375-500 / 400-600
- **Debuff** Stun: true

#### Retaliation
> Part of the damage received in the next enemy impact is returned to the attacker. This skill wears off by duration or when first attack is received.

tipo Constant · cast 0s · GCD Short · recarga 30s · duración 15

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Daño** Returned damage: +20% / +35% / +50% / +75% / +90%

#### Sticky touch
> The archer throws a sticky substance to the opponent, hindering her movement.

tipo Constant · cast 1.5s · GCD Short · recarga 45s · rango 25 · duración 45

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Debuff** Attack Speed: -10% / -15% / -20% / -25% / -30%

#### Dirty fighting
> Archer improves short ranged damage.

tipo Constant · cast 0s · GCD Short · recarga 30s · duración 10 / 15 / 20 / 25 / 30

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Buff** Weapon damage bonus: +30%
- **Debuff** Attack range: -50%

#### Finesse
> The archer is adept to maneuver and feint while fighting.

tipo Constant · cast 1s · GCD Short · recarga 40s · duración 10 / 15 / 20 / 25 / 40

- **Maná:** 70 / 100 / 130 / 160 / 190
- **Debuff** Opponent critical chance: -10% / -25% / -40% / -60% / -90%

#### Sentinel
> The hunter enhances her senses.

tipo Passive

- **Buff** Concentration: +5 / +7 / +9 / +12 / +15
- **Buff** Dexterity: +1 / +2 / +3 / +4 / +5

#### Distracting shot
> A random shot distracts the opponent, who fails to react.

tipo Constant · cast 1s · GCD Short · recarga 50s · rango 25 · duración 5 / 6 / 7 / 8 / 10 · bloqueable true%

- **Maná:** 75 / 100 / 125 / 150 / 175
- **Debuff** Stun: true

#### Caltrop's arrow
> An arrow that scatters caltrops damaging the opponent's feet. Reduces enemy movement speed on the impact area.

tipo Constant · cast 1.5s · GCD Short · recarga 180s · rango 25 · duración 15 · área 10

- **Maná:** 330 / 360 / 390 / 420 / 450
- **Debuff** Movement speed: -10% / -20% / -30% / -40% / -50%

### Evasion

#### Dodge
> Resists next crowd control effect

tipo Constant · cast 1s · GCD Short · recarga 80s · duración 2 / 4 / 6 / 8 / 10

- **Maná:** 120 / 140 / 160 / 180 / 200

#### Mobility
> The archer runs faster.

tipo Constant · cast 0s · GCD Short · recarga 60s · duración 20

- **Maná:** 130 / 155 / 180 / 205 / 230
- **Buff** Movement speed: +2% / +4% / +6% / +8% / +10%

#### Evasive tactics
> The archer fires while dodging. Her defenses increase, but her attack effectiveness decreases.

tipo Constant · cast 0s · GCD Short · recarga 60s · duración 40

- **Maná:** 70 / 100 / 130 / 160 / 190
- **Buff** Protection: +20% / +28% / +36% / +42% / +50%
- **Debuff** Casting speed: -8% / -7% / -7% / -6% / -5%

#### Cat reflexes
> The archer enhances their reflexes for a mayor capacity to elude attacks.

tipo Passive

- **Buff** Evade chance: +5% / +10% / +15% / +20% / +25%

#### Acrobatic
> Using acrobatics, the archer reduces the lethality of the received physical attacks.

tipo Constant · cast 0s · GCD Short · recarga 80s · duración 40 / 45 / 50 / 55 / 60

- **Maná:** 50 / 65 / 80 / 95 / 110
- **Buff** Resist physical damage: +5% / +10% / +15% / +20% / +25%

#### Spell elude
> The archer moves constantly to reduce enemy spell impact chances.

tipo Constant · cast 0s · GCD Short · recarga 80s · duración 20 / 25 / 30 / 35 / 40

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Buff** Resist magical damage: +5% / +9% / +14% / +20% / +30%

#### Escapist
> The archer becomes agile and evades almost every enemy attack.

tipo Constant · cast 0s · GCD Short · recarga 75s · duración 3 / 4 / 5 / 6 / 8

- **Maná:** 120 / 150 / 185 / 215 / 250
- **Buff** Absolute evasion chance: 100%

#### Wits
> The archer knows how to take advantage of the situation and power using.

tipo Passive

- **Buff** Intelligence: 5 / 7 / 9 / 12 / 15

#### Low profile
> The archer cannot attack or be attacked. (Removes any positive effect that is active on the archer)

tipo Constant · cast 0.5s · GCD Short · recarga 60s · duración 4 / 5 / 6 / 8 / 10

- **Maná:** 180 / 200 / 220 / 240 / 260
- **Buff** Sanctuary: true

#### Son of the wind
> The archer moves and evades easy as the wind. She evades almost any attack and spell.

tipo Constant · cast 0s · GCD Short · recarga 50s · duración 3 / 4 / 5 / 6 / 8

- **Maná:** 150 / 185 / 225 / 260 / 300
- **Buff** Absolute spell resistance chance: 100%
- **Debuff** Cannot be used with Escapist: true

## Hunter

### Scouting

#### Ensnaring arrow
> A fast arrow shot at the opponent's legs. Inflicts damage and reduces movement.

tipo Constant · cast 0.5s · GCD Short · recarga 8s · rango 0 · duración 7

- **Maná:** 100 / 125 / 150 / 175 / 200
- **Daño** Attack damage: 60% / 70% / 80% / 90% / 100%
- **Daño** Piercing damage: 50 / 90 / 120 / 160 / 200
- **Debuff** Movement speed: -5% / -7% / -9% / -12% / -15%

#### Death sentence
> The hunter marks the target. While the power is active, every attack from within 3 meters to the target cause extra damage.

tipo Constant · cast 1s · GCD Short · recarga 30s · rango 25 · duración 30

- **Maná:** 50 / 80 / 110 / 140 / 170
- **Debuff** Melee received damage: +5% / +8% / +12% / +16% / +20%

#### Enemy surveillance
> Gathers tactical information about realm enemies. (Can be used under the effects of Camouflage).

tipo Direct · cast 1.5s · GCD Short · recarga 20s

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Buff** Detection range (m): 150 / 200 / 250 / 300 / 400

#### Wild spirit
> The hunter is adept at moving through hostile environments.

tipo Passive

- **Buff** Movement speed: +2% / +3% / +4% / +5% / +7%

#### Camouflage
> The hunter merges with the surroundings. While the effect is active, the hunter causes an extra damage in his first attack.

The hunter loses control of his pet when launching this power.

tipo Constant · cast 4.5s · GCD Short · recarga 120s · duración 20 / 30 / 45 / 60 / 80

- **Maná:** 300 / 325 / 350 / 375 / 400
- **Daño** Piercing damage: 50 / 80 / 120 / 170 / 250
- **Buff** Invisibility: true
- **Debuff** Cannot cast Confuse for 5 seconds after it ends: true

#### Inherited Lightness
> The hunter has an aura that benefits allies in dexterity, which will help other archers, and basic mana regeneration.

tipo Aura · cast 1s · GCD Very Short · recarga 90s · rango 6 · duración 60

- **Maná:** 150 / 200 / 250 / 300 / 350
- **Buff** Mana regeneration: +5% / +10% / +20% / +30% / +50%
- **Buff** Dexterity: +3 / +6 / +9 / +12 / +15

#### Cold blood
> The hunter attacks his victim in cold blood, inflicting large amounts of damage.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 6

- **Maná:** 180 / 210 / 240 / 270 / 300
- **Buff** Damage bonus: +50% / +70% / +90% / +110% / +130%

#### Reveal
> Guided by her instinct and by hints from the environment, the hunter throws a flaming arrow, revealing the position of hidden enemies. It cancels the effects of Camouflage, <s>Camouflage Corpse</s> and Stalker Surroundings active on enemies.

tipo Constant · cast 1s · GCD Short · recarga 20s · rango 25 · duración 15 / 20 / 25 / 35 / 50 · afectado por intervalo de arma

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Reveal (75° arc): true

#### Confuse
> The enemy is constantly distracted. He cannot use non-offensive powers (Any spell that do not inflict direct damage).

tipo Constant · cast 1s · GCD Short · recarga 70s · rango 25 · duración 8 / 10 / 12 / 15 / 20 · bloqueable true%

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Debuff** Cannot cast non-damaging powers: true

#### Stalker surroundings
> Allies near the hunter become invisible when the power is cast. They also have their movement speed reduced. Getting away from the hunter, attacking a target or interacting with objects removes the effect.

tipo Constant · cast 5s · GCD Short · recarga 360s · duración 60 / 120 / 180 / 240 / 300 · área 10

- **Maná:** 440 / 480 / 520 / 560 / 600
- **Buff** Invisibility for the Hunter and (x) allies: 1 / 2 / 3 / 4 / 5
- **Debuff** Movement speed: -40%

### Pets

#### Natural Dominance
> Through a bond with the environment, the hunter has chances to tame a creature.

tipo Direct · cast 8s · GCD Short · recarga 25s · rango 20

- **Maná:** 150 / 225 / 300 / 350 / 400
- **Buff** Tame creatures up to level: 12 / 24 / 36 / 48 / 60

#### Heal Pet
> The hunter heals her pet.

tipo Direct · cast 0s · GCD Short · recarga 60s · resistible true%

- **Maná:** 50 / 75 / 110 / 150 / 200
- **Buff** Health: +250 / +350 / +600 / +1000 / +1400

#### Wild Defense
> Part of the damage received by the hunter is redirected to the pet.

tipo Constant · cast 1s · GCD Short · duración 30 · afectado por intervalo de arma

- **Maná:** 75 / 100 / 125 / 150 / 175
- **Buff** Redirected Damage: 5% / 10% / 15% / 20% / 30%

#### Prominent Sight
> The hunter uses the bond with the pet to enhance the sight scope. The pet loses part of its attack power due to being distracted with the environment.

tipo Activable · cast 0s · GCD Very Short · recarga 20s

- **Maná:** 60 / 75 / 90 / 105 / 120
- **Buff** Attack range: +5% / +8% / +12% / +17% / +30%
- **Debuff** Pet Attack Damage: -25%

#### Training
> Training keeps the pet strong and agile.

tipo Passive

- **Buff** Health: +30% / +45% / +60% / +75% / +100%

#### Revive Pet
> The hunter makes a pact with nature to return his pet to life.

When pet dies or the character has connected recently, the hunter will have to wait the specified time to use this skill.

The cast of this skill is lost if the is attacked.

It is required an appropriate level of Taming to use this skill.

tipo Direct · cast 5s · GCD Short · recarga 60s

- **Maná:** 320 / 340 / 360 / 380 / 400
- **Buff** Health: +20% / +40% / +60% / +80% / +100%

#### Bestial wrath
> The pet is overcome by a rage it cannot control. It gains strength at expenses of its dexterity.

tipo Direct · cast 1.5s · GCD Short · recarga 60s · duración 60

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Damage Bonus: +10% / +20% / +30% / +40% / +50%
- **Debuff** Evade Chance: -100%

#### Natural armor
> The creature gains more resistance to damage.

tipo Passive

- **Buff** Protection: +10% / +15% / +20% / +25% / +30%

#### Nature's Fury
> The pet makes a pact with nature and converts surrounding matter into a dangerous explosion.

tipo Direct · cast 2s · GCD Short · recarga 180s · área 10 · afectado por intervalo de arma

- **Maná:** 120 / 210 / 300 / 390 / 480
- **Daño** Piercing damage: 175 / 280 / 410 / 555 / 750
- **Daño** Fire damage: 125 / 200 / 290 / 395 / 500
- **Debuff** Knock down: 3s

#### Skin of the Beast
> The pet's thick contecture protects it from damage

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 15

- **Maná:** 225 / 250 / 275 / 300 / 325
- **Buff** Resist Damage: +40% / +50% / +60% / +70% / +80%

### Hunter WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Horn of the Wind
> The Warmaster inspires his allies, whom earn movement speed. This power can only be casted if the player is near at least 4 allies.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 30 · área 10 · afectado por intervalo de arma

- **Maná:** 100
- **Buff** Movement speed: +20%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> The Warmaster enhances his class main attribute.

tipo Passive

- **Buff** Class attribute: +15%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Head of the Pack
> The Warmaster improves her damage for a short period of time. This power can only be casted if the player is near at least 1 ally.

tipo Constant · cast 0s · GCD Very Short · recarga 120s · duración 30 · área 10

- **Maná:** 250
- **Buff** Weapon damage bonus: +10%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +500

## Marksman

### Arrow Mastery

#### Recharged arrows
> The marksman channels her vital energy into arrows to improve damage. Only the basic attack is affected by this power.

tipo Activable · cast 0s · GCD Short · recarga 15s

- **Maná:** 40 / 55 / 70 / 85 / 100
- **Buff** Weapon damage bonus: +20% / +25% / +30% / +35% / +40%
- **Debuff** Health per arrow: -10 / -15 / -20 / -25 / -30
- **Debuff** Mana per arrow: -20 / -25 / -30 / -35 / -40

#### Winter stroke
> The marksman throws an ice burst to her opponent, receiving cold damage and remaining frozen.

tipo Constant · cast 0.5s · GCD Short · recarga 40s · rango 30 · duración 3 / 4 / 5 / 6 / 7

- **Maná:** 80 / 110 / 140 / 170 / 200
- **Daño** Ice damage: 60 / 170 / 280 / 390 / 500
- **Debuff** Freeze: true

#### Burst of wind
> A burst of wind leaves the opponent dizzy.

tipo Constant · cast 0.5s · GCD Short · recarga 40s · rango 0 · duración 2 / 3 / 4 / 5 / 6

- **Maná:** 130 / 160 / 190 / 220 / 250
- **Debuff** Dizzy: true

#### Serpent bite
> Special arrow that inflicts poison damage.

tipo Constant · cast 0.5s · GCD Short · recarga 45s · rango 0 · duración 10

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Daño** Piercing damage: 100 / 200 / 300 / 400 / 500
- **Daño** Piercing (per second) damage: 60 / 70 / 90 / 110 / 130

#### Ignus scorch
> A flaming arrow burns whoever crosses its path.

tipo Direct · cast 0s · GCD Short · recarga 20s · rango 20 · duración 3 / 4 / 5 / 6 / 7

- **Maná:** 70 / 100 / 130 / 160 / 190
- **Daño** Fire (instant, 40° arc) damage: 80-120 / 190-240 / 300-360 / 410-480 / 520-600
- **Debuff** Movement speed (40° arc): -10% / -12% / -14% / -18% / -25%

#### Ethereal arrow
> An incorporeal arrow ignores the target's protections.

tipo Direct · cast 1s · GCD Short · recarga 40s · rango 0

- **Maná:** 75 / 110 / 145 / 180 / 215
- **Daño** Health damage: -100 / -225 / -350 / -475 / -600

#### Needle blast
> The marksman fires an arrow that blasts into tiny pieces, causing slash damage in the area.

tipo Direct · cast 1s · GCD Short · recarga 25s · área 10

- **Maná:** 250 / 275 / 300 / 325 / 350
- **Daño** Attack (45° arc) damage: +100%
- **Daño** Slashing (45° arc) damage: 90-120 / 180-230 / 270-340 / 360-450 / 450-560

#### Arcana strike
> An arrow that makes elemental damage.

tipo Direct · cast 0.5s · GCD Short · recarga 25s · rango 0

- **Maná:** 200 / 235 / 270 / 305 / 340
- **Daño** Fire damage: 45 / 95 / 150 / 195 / 250
- **Daño** Ice damage: 45 / 95 / 150 / 195 / 250
- **Daño** Lightning damage: 45 / 95 / 150 / 195 / 250

#### Fire rain
> The marksman fires an arrow that blows up in the sky and falls as a rain of fire.

tipo Direct · cast 2s · GCD Short · recarga 30s · rango 0 · área 6

- **Maná:** 280 / 310 / 340 / 370 / 400
- **Daño** Attack damage: +100%
- **Daño** Fire damage: 250-300 / 300-350 / 350-400 / 400-450 / 500-600

#### Lightning arrow
> An arrow that carries electrical damage strikes an objective and all of those that surround it.

tipo Constant · cast 2s · GCD Short · recarga 180s · rango 0 · duración 5 / 7 / 9 / 11 / 15 · área 10

- **Maná:** 260 / 290 / 320 / 350 / 380
- **Daño** Lightning damage: 150-250 / 250-350 / 350-450 / 450-550 / 550-650
- **Debuff** Movement speed: -15%

### Aiming Mastery

#### Dead eye
> The marksman takes her time to choose the right spot, maximizing the damage of her shots.

tipo Constant · cast 1s · GCD Short · recarga 45s · duración 20

- **Maná:** 50 / 80 / 110 / 140 / 170
- **Buff** Weapon damage bonus: +10% / +14% / +18% / +24% / +30%
- **Debuff** Attack speed: -4% / -5% / -6% / -7% / -8%

#### Focus
> The marksman enhances the possibilities of descrying the enemy by moving slower..

tipo Constant · cast 0s · GCD Short · recarga 70s · duración 30

- **Maná:** 40 / 80 / 120 / 160 / 200
- **Buff** Attack Range: +2% / +4% / +6% / +8% / +10%
- **Debuff** Movement speed: -10%
- *Nota:* Power has no duration limits. (It may be deactivated)

#### Skin piercer
> Attack centered in the opponent's skin, considerably reducing their resistances. Works only if the enemy has these resistance raised.

tipo Constant · cast 0.5s · GCD Short · recarga 60s · rango 0 · duración 3 / 3 / 4 / 4 / 5 · bloqueable true%

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Daño** Piercing (instant) damage: 30 / 60 / 100 / 180 / 300
- **Debuff** Resistance to Physical and Magical Damage: -10% / -20% / -30% / -40% / -50%

#### Foresight
> Increases attack range.

tipo Passive

- **Buff** Attack range: 10% / 12% / 14% / 17% / 20%

#### Cyclops curse
> Strike oriented to the opponent's eyes.

tipo Constant · cast 1s · GCD Short · recarga 52s · rango 0 · duración 30

- **Maná:** 180 / 205 / 230 / 255 / 280
- **Daño** Attack damage: +125%
- **Debuff** Critical chance reduction: -20% / -30% / -40% / -50% / -75%
- **Debuff** Attack range reduction: -2% / -4% / -7% / -10% / -15%

#### Lethal strike
> It looks for critical areas in the blank.

tipo Direct · cast 1.5s · GCD Short · recarga 50s · rango 0

- **Maná:** 185 / 209 / 233 / 257 / 281
- **Daño** Attack damage: +100%
- **Daño** (extra) Attack damage: 20%-50% / 36%-66% / 50%-82% / 65%-99% / 80%-115%
- **Daño** (chance) +60% Attack damage: 20% / 24% / 28% / 32% / 36%

#### Strategic position
> The marskman knows how to locate herself in advantagous positions in battle.

tipo Constant · cast 1s · GCD Short · recarga 50s · duración 25

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Buff** Ranged received damage: -5% / -7% / -9% / -12% / 15%

#### Trained eye
> The marksman improves her impact chances.

tipo Passive

- **Buff** Critical hit chance: +10% / +30% / +50% / +70% / +100%

#### Seeking strike
> The arrow fired automatically seeks a weakening spot in the target.

tipo Constant · cast 1s · GCD Short · recarga 50s · rango 0 · duración 30 / 33 / 37 / 42 / 50

- **Maná:** 255 / 277 / 299 / 321 / 343
- **Debuff** Constitution: -15 / -19 / -23 / -27 / -31

#### Hawk's gaze
> The marksman can find her opponent and target her easily.

tipo Constant · cast 2s · GCD Short · recarga 160s · duración 40 / 45 / 50 / 55 / 60

- **Maná:** 260 / 290 / 320 / 350 / 380
- **Buff** Attack speed: +5% / +10% / +15% / +20% / +25%
- **Debuff** Opponent evade chance: -10% / -20% / -30% / -40% / -50%

### Marksman WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Fire Arrow
> Launches a fire arrow over the ally, melting the ice that prevents movement.

tipo Direct · cast 0.5s · GCD Very Short · recarga 30s · rango 20 · bloqueable true% · resistible true%

- **Maná:** 150
- **Buff** Dispel freeze: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> The Warmaster enhances his class main attribute.

tipo Passive

- **Buff** Class attribute: +15%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Killer Instinct
> The Warmaster ascends upon a state of absolute confidence, successfully hitting almost every shot.

tipo Activable · cast 0s · GCD Short · recarga 15s · duración 120 · afectado por intervalo de arma

- **Maná:** 150
- **Buff** Attack range: +15%
- **Debuff** Opponent evade chance: -100%
- **Debuff** Movement speed: -15%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +300

## Mage

### Mental

#### Arcane missile
> A small glowing ball hits the target, inflicting fire damage.

tipo Direct · cast 1s · GCD Very Short · recarga 5s · rango 25

- **Maná:** 50 / 70 / 90 / 110 / 130
- **Daño** Fire damage: 80-90 / 175-190 / 270-300 / 370-400 / 460-550

#### Beetle swarm
> A beetle swarm surrounds the target.

tipo Constant · cast 2s · GCD Normal · recarga 40s · rango 25 · duración 5 / 6 / 7 / 8 / 9

- **Maná:** 80 / 100 / 120 / 140 / 160
- **Daño** Piercing (per second) damage: 20-30 / 30-55 / 40-80 / 50-105 / 60-130
- **Debuff** Cannot attack: true

#### Blaze
> A burst of fire flows through the conjurer's hands, burning those in range.

tipo Direct · cast 1s · GCD Very Short · recarga 10s · área 6

- **Maná:** 75 / 90 / 105 / 120 / 135
- **Daño** Fire damage: 120-160 / 240-290 / 360-420 / 480-550 / 600-680

#### Mind push
> A mental expansive wave hits the objectives in the area.

tipo Constant · cast 0.5s · GCD Short · recarga 15s · duración 4 / 5 / 6 / 7 / 8 · área 10

- **Maná:** 90 / 105 / 120 / 135 / 150
- **Debuff** Movement speed: -25% / -30% / -35% / -40% / -50%

#### Pricking ivy
> A pricking ivy grows below the opponent's feet, surrounding and catching her.

tipo Constant · cast 1s · GCD Short · recarga 30s · rango 25 · duración 3 / 4 / 5 / 6 / 7

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Daño** Piercing damage: 100-200 / 225-325 / 350-450 / 475-575 / 600-700
- **Debuff** Immobilize: true

#### Will domain
> The wizard bends the opponent's will.

tipo Constant · cast 0.5s · GCD Normal · recarga 30s · rango 12 · duración 2 / 3 / 4 / 5 / 6 · bloqueable true%

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Debuff** Knock down: true

#### Silence
> The target cannot speak, so she cannot use powers.

tipo Constant · cast 1s · GCD Short · recarga 40s · rango 25 · duración 3 / 4 / 5 / 6 / 7 · bloqueable true%

- **Maná:** 150 / 175 / 200 / 225 / 250
- **Debuff** Dizzy: true

#### Splinter wall
> The spell caster renders a surrounding pikes wall that damages any melee attacker.

tipo Constant · cast 1s · GCD Very Short · recarga 90s · duración 10 · área 10

- **Maná:** 125 / 140 / 155 / 170 / 185
- **Daño** Piercing (per second) damage: 50-70 / 65-90 / 85-110 / 100-120 / 120-150

#### Time master
> The mage can manipulate temporal instances. Any opponent nearby remains static in time.

tipo Constant · cast 2s · GCD Very Short · recarga 120s · duración 10 · área 10

- **Maná:** 230 / 260 / 290 / 320 / 350
- **Debuff** Movement speed: -10% / -20% / -30% / -40% / -50%
- **Debuff** Attack speed: -10% / -20% / -30% / -40% / -50%
- **Debuff** Cast speed: -10% / -20% / -30% / -40% / -50%

#### Sultar's devouring mass
> A fog illusion devours the target, making her believe she is cut and torn.

tipo Constant · cast 2s · GCD Very Short · recarga 120s · rango 25 · duración 12

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Daño** Piercing (per second) damage: 33 / 42 / 50 / 58 / 70
- **Daño** Slashing (per second) damage: 33 / 42 / 50 / 58 / 70
- **Daño** Blunt (per second) damage: 33 / 42 / 50 / 58 / 70
- **Debuff** Regenerate health: -15% / -30% / -45% / -60% / -100%
- **Debuff** Healing bonus: -25% / -35% / -50% / -70% / -100%

### Mana Control

#### Energy barrier
> Creates a magical barrier that absorbs part of the damage received by the wizard.

tipo Constant · cast 1s · GCD Very Short · recarga 40s · duración 120

- **Maná:** 100 / 140 / 180 / 220 / 260
- **Buff** Magic barrier: +100 / +250 / +700 / +1000 / +1400

#### Mana burn
> Burns the opponent's mana, causing damage impossible to resist or soak.

tipo Constant · cast 1s · GCD Short · recarga 50s · rango 25 · duración 15

- **Maná:** 70 / 100 / 130 / 160 / 190
- **Debuff** Convert mana to damage: +5/10 / +10/15 / +15/25 / +25/35 / +35/50

#### Synergy bond
> The wizard passes some of his own mana to an ally.

tipo Direct · cast 0.5s · GCD Very Short · recarga 3s · rango 25

- **Maná:** 150 / 250 / 400 / 550 / 750
- **Buff** Mana: +150 / +250 / +400 / +550 / +750

#### Dragon's blood
> The wizard is naturally intelligent and gifted.

tipo Passive

- **Buff** Intelligence: +5 / +7 / +9 / +12 / +15

#### Energy borrow
> The wizard steals mana points from the opponent and adds them to his own reserve.

tipo Direct · cast 1s · GCD Short · recarga 60s · rango 25

- **Buff** Drain mana: +10% / +15% / +20% / +25% / +35%

#### Ambitious sacrifice
> The wizard sacrifices his health to recover magical power.

tipo Direct · cast 1s · GCD Very Short · recarga 25s

- **Buff** Mana: +300 / +450 / +600 / +750 / +900
- **Debuff** Health: -150 / -225 / -300 / -375 / -450

#### Arcane devotion
> Magic flows naturally inside the wizard. The casting speed is increased.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 60

- **Maná:** 115 / 130 / 145 / 160 / 175
- **Buff** Cast speed: +15% / +30% / +45% / +65% / +100%

#### Mana pool
> Increases the maximum mana reserve

tipo Passive

- **Buff** Mana: +100 / +200 / +300 / +400 / +500

#### Mana communion
> The wizard creates a mana regenerating zone in which the allies can recover.

tipo Aura · cast 1s · GCD Very Short · recarga 120s · duración 60 · área 6

- **Maná:** 440 / 480 / 520 / 560 / 600
- **Buff** Mana: +5 / +7 / +9 / +12 / +15

#### Mana pylon
> The wizard creates an aura of protective energy to cover its nearby allies.

Any ally close to the caster increments its protective barrier up to 2500 energy points limit.

Any ally that exits the aura's influence area loses immediately all stored barrier points.

tipo Aura · cast 1.5s · GCD Very Short · recarga 180s · duración 60 · área 10

- **Maná:** 460 / 480 / 520 / 560 / 600
- **Buff** Magic barrier: +25 / +30 / +35 / +40 / +50
- **Debuff** Caster is not affected: true

### Staff Mastery

#### Fire magnification
> The wizard channels fire damage into her staff.

tipo Activable · cast 1s · GCD Short · recarga 60s

- **Maná:** 150 / 180 / 210 / 240 / 270
- **Buff** Fire damage: +5 / +15 / +25 / +40 / +60
- **Buff** 1 extra damage point per Intelligence point after: 80 / 80 / 80 / 80 / 70
- **Debuff** Protection: -50% / -50% / -40% / -40% / -25%
- **Debuff** Cannot be used with another magnification: true

#### Arcane acceleration
> The wizard gets faster in all the attacks with her staff.

tipo Constant · cast 1s · GCD Very Short · recarga 60s · duración 20 / 30 / 40 / 50 / 60

- **Maná:** 70 / 85 / 100 / 115 / 130
- **Buff** Attack speed: +25%

#### Arcane projection
> The wizard projects his magic range beyond her limits.

tipo Constant · cast 1s · GCD Very Short · recarga 80s · duración 20 / 30 / 40 / 50 / 60

- **Maná:** 60 / 75 / 90 / 105 / 120
- **Buff** Attack range: +15%

#### Combat magic
> The wizard can manipulate and focus magic through her staff, increasing damage.

tipo Passive

- **Buff** Weapon damage bonus: +5% / +7% / +9% / +12% / +15%

#### Static field
> The wizard creates an energy field that reduces the movement of any foe that enters its area of influence.

tipo Aura · cast 0.5s · GCD Very Short · recarga 60s · duración 40 · área 10

- **Maná:** 40 / 60 / 80 / 100 / 120
- **Daño** Electrical (per second) damage: 40 / 50 / 60 / 80 / 100
- **Debuff** Movement speed: -10% / -15% / -20% / -25% / -30%

#### Ice magnification
> The wizard channels ice damage into her staff.

tipo Activable · cast 1s · GCD Short · recarga 60s

- **Maná:** 150 / 180 / 210 / 240 / 270
- **Buff** Ice damage: +5 / +15 / +25 / +40 / +60
- **Buff** 1 extra damage point per Intelligence point after: 80 / 80 / 80 / 80 / 70
- **Debuff** Protection: -50% / -50% / -40% / -40% / -25%
- **Debuff** Cannot be used with another magnification: true

#### Protection dome
> Allies under the cover of the dome improve their resistance to physical damage.

tipo Constant · cast 3s · GCD Very Short · recarga 90s · duración 20 · área 10

- **Maná:** 160 / 200 / 240 / 280 / 320
- **Buff** Resist physical damage: +4% / +8% / +12% / +16% / +20%
- **Debuff** Caster is not affected: true

#### Metabolic control
> The wizard is capable of manipulating her body's energies, arriving at optimal mind state.

tipo Constant · cast 1s · GCD Very Short · recarga 100s · duración 60

- **Maná:** 170 / 190 / 210 / 230 / 250
- **Buff** Spell damage: +5% / +10% / +15% / +20% / +30%
- **Debuff** Protection: -25%

#### Lightning magnification
> The wizard channels lightning damage into her staff.

tipo Activable · cast 1s · GCD Short · recarga 60s

- **Maná:** 150 / 180 / 210 / 240 / 270
- **Buff** Lightning damage: +5 / +15 / +25 / +40 / +60
- **Buff** 1 extra damage point per Intelligence point after: 80 / 80 / 80 / 80 / 70
- **Debuff** Protection: -50% / -50% / -40% / -40% / -25%
- **Debuff** Cannot be used with another magnification: true

#### Evendim's fury
> An explosion creates a magical interference transforming enemy mana into damage.

tipo Direct · cast 2s · GCD Very Short · recarga 180s · área 10

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Debuff** Convert mana to damage: +125 / +250 / +375 / +500 / +650

### Enchantments

#### Curse
> The target reduces her attack chance, and damage while the curse is active.

tipo Constant · cast 0.5s · GCD Very Short · recarga 20s · rango 25 · duración 60 · bloqueable true%

- **Maná:** 40 / 60 / 80 / 100 / 120
- **Debuff** Opponent damage: -2% / -4% / -6% / -8% / -10%
- **Debuff** Opponent critical hit chance: -10% / -15% / -20% / -25% / -30%

#### Feline dexterity
> The wizard increases an ally's dexterity.

tipo Constant · cast 1.5s · GCD Very Short · recarga 5s · rango 20 · duración 180

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Buff** Dexterity: +5 / +7 / +9 / +12 / +15

#### Blindness
> A flash of light blinds the objective that gets miss chance until recovery.

tipo Constant · cast 0.5s · GCD Very Short · recarga 60s · rango 25 · duración 10 / 15 / 20 / 25 / 30

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Debuff** Opponent evasion chance: +50% / +50% / +50% / +50% / +50%
- **Debuff** Resist dizzy: -10% / -15% / -20% / -25% / -30%

#### Bless
> The target increases her attack, damage and critical chance while the blessing is active.

tipo Constant · cast 1s · GCD Very Short · recarga 15s · rango 20 · duración 30 / 60 / 90 / 120 / 150

- **Maná:** 40 / 60 / 80 / 100 / 120
- **Buff** Cast speed: +5% / +5% / +7% / +7% / +10%
- **Buff** Attack speed: +5% / +5% / +7% / +7% / +10%

#### Bear strength
> The wizard increases an ally's strength.

tipo Constant · cast 1.5s · GCD Very Short · recarga 5s · rango 20 · duración 180

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Buff** Strength: +5 / +7 / +9 / +12 / +15

#### Bless weapon
> Increments weapon damage on any ally.

tipo Constant · cast 1s · GCD Very Short · recarga 5s · rango 20 · duración 180

- **Maná:** 100 / 125 / 150 / 175 / 200
- **Buff** Damage bonus: +5% / +7% / +9% / +12% / +15%

#### Dispel magic
> Dispels enemy active effects on the caster or an ally.

tipo Direct · cast 0.5s · GCD Very Short · recarga 15s · rango 25

- **Maná:** 130 / 150 / 170 / 190 / 210
- **Buff** Dispel negative powers (chance): 40% / 55% / 70% / 85% / 100%

#### Fox wits
> The wizard increases an ally's intelligence.

tipo Constant · cast 1.5s · GCD Very Short · recarga 5s · rango 20 · duración 180

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Buff** Intelligence: +5 / +7 / +9 / +12 / +15

#### Clumsiness
> The objective becomes clumsy, gawky and slow.

tipo Constant · cast 1s · GCD Very Short · recarga 60s · rango 20 · duración 40

- **Maná:** 230 / 260 / 290 / 320 / 350
- **Debuff** Class attribute: -10% / -15% / -20% / -25% / -30%
- **Debuff** Movement speed: -5% / -8% / -11% / -15% / -20%

#### Mass dispel magic
> Dispels active effects on all allies in the effect area.

tipo Direct · cast 1s · GCD Very Short · recarga 120s · rango 25 · área 10

- **Maná:** 300 / 340 / 380 / 420 / 460
- **Buff** Dispel negative powers (chance): 20% / 40% / 60% / 80% / 100%

## Conjurer

### Life

#### Heal ally
> Heals an ally.

tipo Direct · cast 0.5s · GCD Very Short · recarga 5s · rango 25

- **Maná:** 50 / 70 / 95 / 120 / 145
- **Buff** Health: +100 / +250 / +400 / +550 / +700
- **Buff** Health bonus: +1% / +2% / +3% / +4% / +5%

#### Heal self
> Heals the caster.

tipo Direct · cast 1s · GCD Short · recarga 15s

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Buff** Health: +200 / +300 / +400 / +500 / +600

#### Resurrect
> Brings an ally back to life.

tipo Constant · cast 6s · GCD Very Short · recarga 120s · rango 8

- **Maná:** 400 / 430 / 460 / 490 / 520
- **Buff** Health: +200 / +800 / +1400 / +1400 / +2000
- **Buff** Mana: - / +30% / +30% / +30% / +30%
- **Buff** Sanctuary (seconds): - / - / - / 3 / 8
- **Buff** Revive: true

#### Regenerate ally
> Heals an ally over time.

tipo Constant · cast 0.5s · GCD Very Short · recarga 20s · rango 25 · duración 30

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Buff** Health: +10 / +21 / +32 / +43 / +55

#### Regenerate self
> Heals the caster over time.

tipo Constant · cast 1s · GCD Short · recarga 30s · duración 30

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Buff** Health: +20 / +25 / +30 / +35 / +40

#### Divine intervention
> The ally becomes invulnerable to curses, sorcery and enchantments that diminish her efficiency. She remains vulnerable to damaging spells, even those that have negative side effects.

tipo Constant · cast 1s · GCD Very Short · recarga 110s · rango 25 · duración 10 / 20 / 35 / 50 / 70

- **Maná:** 75 / 100 / 125 / 150 / 175
- **Buff** Immunity to non-damaging powers: true

#### Life savior
> Heals an ally.

tipo Direct · cast 1.5s · GCD Very Short · recarga 60s · rango 20

- **Maná:** 240 / 280 / 320 / 360 / 400
- **Buff** Health: +20% / +30% / +40% / +50% / +60%

#### Greater regeneration
> Heals all allies nearby the caster.

tipo Constant · cast 1.5s · GCD Very Short · recarga 180s · duración 30 · área 10

- **Maná:** 320 / 360 / 400 / 440 / 480
- **Buff** Health (instant): +50 / +75 / +100 / +125 / +150
- **Buff** Health (per tick): +10 / +15 / +20 / +25 / +30

#### Greater healing
> Heals all allies nearby the target.

tipo Direct · cast 1.5s · GCD Short · recarga 120s · rango 20 · área 6

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Buff** Health: +150/200 / +250/300 / +350/400 / +450/500 / +550/600

#### Mass resurrection
> Revive the allies near the conjurer.

tipo Constant · cast 5s · GCD Very Long · recarga 300s · área 6

- **Maná:** 500 / 600 / 700 / 800 / 900
- **Buff** Resurrection Dizziness: true
- **Buff** Revive: true
- **Buff** Health: +500 / +600 / +700 / +800 / +1000
- **Buff** Sanctuary (s): - / - / - / - / 8

### Summon

#### Summon imps
> Summons imps that attack the selected target.

tipo Constant · cast 1.5s · GCD Normal · recarga 60s · duración 13

- **Maná:** 50 / 75 / 100 / 120 / 140
- **Buff** Summon imps: 2 / 4 / 6 / 8 / 10

#### Extraplanar bond
> The conjurer magically bonds to its summoning. Part of the received damage is redirected to it. (10% each spell level)

tipo Constant · cast 0.5s · GCD Very Short · recarga 60s · duración 45

- **Maná:** 40 / 55 / 70 / 85 / 100
- **Debuff** Cannot be used with Karma mirror: true

#### Summon demon
> Summons a demon that fights for the conjurer.

tipo Constant · cast 3s · GCD Normal · recarga 50s · duración 30 / 35 / 40 / 45 / 60

- **Maná:** 90 / 110 / 130 / 150 / 200
- **Buff** Controllable: - / - / - / - / yes

#### Material bond
> Improves the bond between the summoned creature and the material plane.

tipo Passive

- **Buff** Health: +10% / +15% / +22% / +30% / +50%

#### Summon zombies
> Summons zombies that attack the selected target.

tipo Constant · cast 2s · GCD Long · recarga 60s · duración 18

- **Maná:** 140 / 160 / 180 / 200 / 220
- **Buff** Summon zombies: 1 / 2 / 3 / 4 / 5

#### Demonic rage
> Summoned creatures become aggressive, causing additional damage but losing all their armor.

tipo Constant · cast 1.5s · GCD Short · recarga 60s · duración 25 · afectado por intervalo de arma

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Weapon damage bonus: +10% / +20% / +30% / +40% / +50%
- **Debuff** Protection: -75%

#### Summon golem
> Summons a stone golem that fights for the conjurer.

tipo Constant · cast 10s · GCD Normal · recarga 120s · duración 240

- **Maná:** 300 / 350 / 400 / 450 / 500
- **Buff** Summon: Tiny Stone Golem / Small Magma Golem / Crystal Golem / Large Fire Golem / Enormous Metal Golem

#### Magical armor
> The creature gains more resistance to magical damage.

tipo Passive

- **Buff** Protection: +5% / +10% / +15% / +20% / +25%

#### Blood drinker
> Summoning earns life draining attacks. Part of the inflicted damage is taken as health for the current creature.

tipo Constant · cast 4s · GCD Very Short · recarga 180s · duración 60

- **Maná:** 400 / 450 / 500 / 550 / 600
- **Buff** Vitality absorption: +20% / +40% / +60% / +80% / +100%

#### Summon lich
> Summons a lich that fights for the conjurer.

tipo Constant · cast 3s · GCD Normal · recarga 60s · duración 40 / 45 / 50 / 55 / 70

- **Maná:** 300 / 350 / 400 / 450 / 500
- **Buff** Summon: Old Lich / Lich Apprentice / Lich Necromancer / Lord Lich / Lich Shaman
- **Buff** Controllable: - / - / - / yes / yes

### Sorcery

#### Force armor
> A force field is created that grants the conjurer extra protection.

tipo Constant · cast 2s · GCD Short · recarga 70s · duración 60

- **Maná:** 60 / 75 / 90 / 105 / 120
- **Buff** Protection: +10% / +15% / +20% / +25% / +30%

#### Shifting silhouette
> The objective ally silhouette gets blurry and confusing.

tipo Constant · cast 2s · GCD Very Short · recarga 80s · duración 40

- **Maná:** 220 / 260 / 300 / 340 / 380
- **Buff** Ranged received damage: - / - / - / - / -10%
- **Debuff** Opponent attack speed: -3% / -6% / -9% / -12% / -15%
- **Debuff** Opponent casting speed: -3% / -6% / -9% / -12% / -15%

#### Friendly shielding
> A force field is created surrounding an ally, it provides extra armor.

tipo Constant · cast 1.5s · GCD Very Short · recarga 25s · rango 25 · duración 60

- **Maná:** 50 / 65 / 80 / 95 / 110
- **Buff** Protection: +10% / +15% / +20% / +25% / +30%

#### Mind blank
> The conjurer gets resistance to crowd control effects.

tipo Activable · cast 1s · GCD Very Short · recarga 60s

- **Maná:** 100 / 130 / 160 / 190 / 220
- **Buff** Resist dizzy: +20% / +25% / +30% / +35% / +40%
- **Buff** Resist freeze: +20% / +25% / +30% / +35% / +40%
- **Buff** Resist stun: +20% / +25% / +30% / +35% / +40%
- **Buff** Resist knock: +20% / +25% / +30% / +35% / +40%
- **Buff** Cannot cast damaging powers: true

#### Karma mirror
> Reflects part of the damage received while the spell is active.

tipo Constant · cast 1s · GCD Short · recarga 60s · duración 30

- **Maná:** 75 / 90 / 105 / 120 / 135
- **Buff** Return damage: +10% / +15% / +20% / +25% / +30%
- **Debuff** Cannot be used with Extraplanar bond: true

#### Magic barrier
> Gives magic resistance to the target.

tipo Constant · cast 2s · GCD Very Short · recarga 120s · rango 25 · duración 120

- **Maná:** 250 / 275 / 300 / 325 / 350
- **Buff** Resist magical damage: +10% / +15% / +20% / +25% / +30%

#### Material wall
> Gives physical resistance to the target.

tipo Constant · cast 2s · GCD Very Short · recarga 120s · rango 25 · duración 120

- **Maná:** 250 / 275 / 300 / 325 / 350
- **Buff** Resist physical damage: +10% / +15% / +20% / +25% / +30%

#### Sanctuary
> The conjurer creates an invulnerability zone. He will not be able to attack or be attacked, but he will be able to move.

(Removes any positive effect that is active on the caster)

tipo Constant · cast 1.5s · GCD Very Short · recarga 70s · duración 10 / 12 / 14 / 17 / 20

- **Maná:** 230 / 260 / 290 / 320 / 350
- **Buff** Sanctuary: true

#### Insightful
> The caster gains a duration bonus to all powers received from allies or herself.

tipo Passive

- **Buff** Spell duration: +5% / +7% / +9% / +12% / +20%

#### Steel skin
> The conjurer creates a magic mantle that significantly reduces slashing, piercing and blunt damage.

tipo Constant · cast 1s · GCD Short · recarga 180s · duración 20 / 25 / 30 / 35 / 40

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Buff** Resist physical damage: +50% / +55% / +60% / +65% / +70%

### Conjurer WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Defensive Portal
> Creates a portal that allows teleporting up to 25 allies to one of the available realm's locations.

tipo Direct · cast 10s · GCD Very Short · recarga 1200s · duración 15

- **Maná:** 100

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> Thanks to his/her years of experience the Warmaster can cast any spell faster than others.

tipo Passive

- **Buff** Cast speed: +15%
- **Buff** Intelligence: +5%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Divine Protection
> The Warmaster learns a protection spell that can be casted upon allies.

tipo Constant · cast 1s · GCD Short · recarga 45s · rango 20 · duración 60

- **Maná:** 200
- **Buff** Healing Bonus: +25%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +700

## Warlock

### Arcania

#### Stalagmite
> A sharp rock comes out the earth, below the objective, who receives piercing and ice damage.

tipo Direct · cast 1s · GCD Very Short · recarga 25s · rango 25

- **Maná:** 90 / 120 / 150 / 180 / 210
- **Daño** Piercing damage: 100 / 150 / 200 / 250 / 400
- **Daño** Ice damage: 100 / 150 / 200 / 250 / 400

#### Slow
> Decreases an opponent's movement speed.

tipo Constant · cast 1s · GCD Very Short · recarga 60s · rango 25 · duración 30

- **Maná:** 60 / 100 / 140 / 180 / 250
- **Debuff** Movement speed: -10% / -12% / -15% / -17% / -20%

#### Petrify hands
> The hands of the opponent become stiff, hindering the attacks.

tipo Constant · cast 1.5s · GCD Very Short · recarga 60s · rango 25 · duración 15 / 20 / 25 / 30 / 35

- **Maná:** 130 / 160 / 190 / 220 / 250
- **Debuff** Critical hit chance: -15% / -20% / -25% / -30% / -35%
- **Debuff** Attack speed: -5% / -10% / -15% / -20% / -25%

#### Laziness
> The opponent feels tired and unwilling to fight.

tipo Constant · cast 2s · GCD Very Short · recarga 45s · rango 25 · duración 12 / 14 / 16 / 18 / 20 · bloqueable true%

- **Maná:** 170 / 190 / 210 / 230 / 250
- **Debuff** Weapon damage bonus: -30% / -40% / -50% / -60% / -70%
- **Debuff** Attack speed: -10%

#### Meteor
> A huge flaming rock strikes the opponent.

tipo Constant · cast 2s · GCD Normal · recarga 15s · rango 30 · duración 3 / 4 / 5 / 6 / 7

- **Maná:** 140 / 160 / 180 / 200 / 220
- **Daño** Blunt damage: 150-200 / 200-250 / 250-300 / 300-350 / 350-400
- **Daño** Fire damage: 150-200 / 200-250 / 250-300 / 300-350 / 350-400
- **Debuff** Dizzy: true

#### Wind wall
> A wind wall that surrounds the caster improves normal attacks and powers defense.

tipo Constant · cast 0.5s · GCD Very Short · recarga 60s · duración 20 / 22 / 24 / 26 / 30

- **Maná:** 160 / 185 / 210 / 235 / 260
- **Buff** Range received damage: -5% / -10% / -15% / -20% / -25%

#### Crystal blast
> A blast of sharp crystals damages all the opponents in the area.

tipo Direct · cast 1s · GCD Short · recarga 20s · área 6

- **Maná:** 100 / 125 / 150 / 175 / 200
- **Daño** Piercing damage: 220-255 / 350-470 / 475-635 / 600-800 / 850-1150

#### Fragility
> The objective becomes weak, fragile and vulnerable to physical damage.

tipo Constant · cast 1s · GCD Very Short · recarga 60s · rango 30 · duración 60 · bloqueable true%

- **Maná:** 80 / 110 / 140 / 170 / 200
- **Debuff** Resist physical damage: -5% / -15% / -25% / -35% / -50%

#### Golem fist
> An illusory golem falls from the sky inflicting blunt damage over the target.

tipo Direct · cast 2s · GCD Short · recarga 60s · rango 25

- **Maná:** 130 / 180 / 225 / 280 / 320
- **Daño** Health damage: -200 / -250 / -300 / -350 / -650

#### Sultar's Terror
> An illusory giant skull provokes fear over its enemies, pertifying and inflicting slashing and piercing damage to them.

tipo Constant · cast 3s · GCD Long · recarga 180s · rango 30 · duración 2 / 3 / 4 / 5 / 6 · área 10

- **Maná:** 400 / 425 / 450 / 475 / 500
- **Daño** Blunt damage: 70-100 / 115-160 / 160-225 / 205-285 / 250-350
- **Daño** Piercing damage: 70-100 / 115-160 / 160-225 / 205-285 / 250-350
- **Daño** Slashing damage: 70-100 / 115-160 / 160-225 / 205-285 / 250-350
- **Debuff** Knock down: true

### Necromancy

#### Vampirism
> The warlock drains health from a target, and adds it to her own reserve. She cannot drain more health than what is required to fully heal or more health than the objective's current points.

tipo Direct · cast 1s · GCD Very Short · recarga 30s · rango 20

- **Maná:** 80 / 110 / 140 / 170 / 200
- **Buff** Drain health: +90/120 / +180/240 / +270/360 / +360/480 / +450/600

#### Darkness
> The objective cannot be target of positive spells.

tipo Constant · cast 2s · GCD Very Short · recarga 50s · rango 20 · duración 7 / 9 / 11 / 15 / 20

- **Maná:** 160 / 180 / 200 / 220 / 240
- **Debuff** Block positive powers: true

#### Infuriate
> The warlock makes the target get enraged involuntarily and without noticing.

tipo Constant · cast 1.5s · GCD Very Short · recarga 30s · rango 25 · duración 30 · bloqueable true%

- **Maná:** 80 / 100 / 120 / 140 / 160
- **Debuff** Protection: -30% / -35% / -40% / -45% / -50%
- **Debuff** Concentration: -10 / -15 / -20 / -25 / -30

#### Vitality absorption
> The caster transforms a share of the damage dealt to the opponents, while the spell lasts, into health.

tipo Passive

- **Buff** Vitality absorption: +2% / +4% / +6% / +8% / +10%

#### Sadistic guards
> The wandering souls controlled by the warlock surround a victim, weakening her defenses.

tipo Constant · cast 1s · GCD Very Short · recarga 90s · rango 25 · duración 4 / 8 / 12 / 16 / 20 · bloqueable true% · resistible true%

- **Maná:** 140 / 155 / 160 / 175 / 190
- **Debuff** Resistance to knock down: -100% / -100% / -100% / -100% / -100%
- **Debuff** Resistance to stun: -100% / -100% / -100% / -100% / -100%

#### Sadistic servants
> It calls the earth wandering souls. They attack a realm enemy from whom they drain mana.

tipo Constant · cast 1s · GCD Short · recarga 45s · rango 25 · duración 30

- **Buff** Drain mana: +5 / +10 / +15 / +20 / +25

#### Soulkeeper
> The warlock weakens the target and drains its health, adding it to her own reserve. She cannot drain more health than what is required to fully heal or more health than the objective's current points. Cannot be casted on mobs.

tipo Constant · cast 2s · GCD Short · recarga 60s · rango 25 · duración 30

- **Maná:** 240 / 280 / 320 / 360 / 400
- **Buff** Drain health (per second): +40 / +55 / +70 / +85 / +100
- **Debuff** Strength: -5 / -7 / -9 / -12 / -15

#### Cremation
> The warlock invokes a powerful spell that incinerates the corpse of an enemy. If the spell is successful, the enemy is sent to the Resurrection Altar

tipo Constant · cast 4s · GCD Very Short · recarga 80s · rango 2 · duración 5 · bloqueable true% · resistible true%

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Cremate corpse (chance): 15% / 40% / 65% / 85% / 100%

#### Possess summoning
> If the spell is not resisted, the warlock has chances of controlling a summoned creature. The creature remains until killed (no duration).

tipo Direct · cast 4s · GCD Normal · recarga 60s · rango 20

- **Maná:** 300 / 325 / 350 / 375 / 400
- **Buff** Possess summon (chance): 40% / 55% / 70% / 85% / 100%

#### Master of doom
> A darkness aura surrounds the warlock breaking opponent's will in its area. The enemy has reduced constitution and cannot cast spells.

tipo Aura · cast 2.5s · GCD Very Short · recarga 180s · duración 30 · área 10

- **Maná:** 520 / 540 / 560 / 580 / 600
- **Debuff** Dizzy (chance): 20% / 40% / 60% / 80% / 100%
- **Debuff** Constitution: -10 / -15 / -20 / -25 / -30

### Elements

#### Fire ball
> The caster launches a flame sphere that produces damage to all enemies in the impact area.

tipo Direct · cast 1.5s · GCD Short · recarga 15s · rango 25 · área 6

- **Maná:** 125 / 140 / 155 / 170 / 185
- **Daño** Fire damage: 110-160 / 245-320 / 380-480 / 515-640 / 650-800

#### Ice blast
> The target is struck by an ice blast.

tipo Constant · cast 1s · GCD Very Short · recarga 20s · rango 25 · duración 10

- **Maná:** 125 / 140 / 155 / 170 / 185
- **Daño** Ice damage: 70-100 / 90-120 / 100-140 / 130-160 / 170-200
- **Debuff** Movement speed: -5% / -10% / -15% / -25% / -40%
- **Debuff** Movement speed duration: 2s

#### Lightning
> An electrical burst hits the target.

tipo Constant · cast 2s · GCD Very Short · recarga 20s · rango 25 · duración 5

- **Maná:** 125 / 140 / 155 / 170 / 185
- **Daño** Lightning damage: 80 / 120 / 160 / 200 / 240

#### Elemental conjunction
> The warlock develops natural resistance to elements damage.

tipo Passive

- **Buff** Resist fire: +5% / +7% / +9% / +12% / +15%
- **Buff** Resist electrical damage: +5% / +7% / +9% / +12% / +15%
- **Buff** Resist cold: +5% / +7% / +9% / +12% / +15%

#### Freeze
> The target becomes frozen. She cannot attack nor be attacked.

tipo Constant · cast 1.5s · GCD Short · recarga 30s · rango 25 · duración 3 / 4 / 5 / 6 / 7

- **Maná:** 100 / 130 / 160 / 190 / 220
- **Debuff** Freeze: true

#### Frozen storm
> Opponents in the storm area will be damaged and get stunned.

tipo Constant · cast 2s · GCD Normal · recarga 120s · rango 25 · duración 6 / 7 / 8 / 9 / 10 · área 6

- **Maná:** 180 / 210 / 240 / 270 / 300
- **Daño** Ice damage: 40 / 50 / 60 / 70 / 80
- **Debuff** Stun: true

#### Element exposure
> The target becomes vulnerable to the elements.

tipo Constant · cast 1s · GCD Very Short · recarga 30s · rango 25 · duración 30 · bloqueable true%

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Debuff** Fire protection: -20% / -25% / -30% / -35% / -40%
- **Debuff** Ice protection: -20% / -25% / -30% / -35% / -40%
- **Debuff** Lightning protection: -20% / -25% / -30% / -35% / -40%
- **Debuff** Magical damage resistance: -10% / -15% / -23% / -34% / -50%

#### Magma blast
> A magma ball strikes the target.

tipo Constant · cast 2s · GCD Short · recarga 45s · rango 30 · duración 15

- **Maná:** 250 / 280 / 310 / 340 / 370
- **Daño** Fire (instant) damage: 200-240 / 260-330 / 350-430 / 450-540 / 580-680
- **Daño** Fire damage (per second): 25 / 30 / 35 / 45 / 60

#### Twister
> An air eddy devours the opponents in the area.

tipo Constant · cast 3s · GCD Normal · recarga 60s · rango 25 · duración 5 / 6 / 7 / 8 / 9 · área 6

- **Maná:** 290 / 320 / 350 / 380 / 410
- **Daño** Blunt damage: 20-30 / 40-57 / 60-85 / 80-110 / 110-140
- **Debuff** Immobilize: true

#### Summon lightning
> The warlock creates lightning bolts that strike all the opponents in an area.

tipo Constant · cast 2s · GCD Short · recarga 180s · rango 0 · duración 10 · área 10

- **Maná:** 440 / 480 / 520 / 560 / 600
- **Daño** Lightning damage: 40-80 / 70-120 / 100-160 / 130-200 / 160-240
- **Debuff** Strength: -10%

### Warlock WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Offensive Portal
> Creates a portal that allows teleporting up to 25 allies to one of the available location.

tipo Direct · cast 10s · GCD Very Short · recarga 1200s · duración 15 · afectado por intervalo de arma

- **Maná:** 100

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> Thanks to his/her years of experience the Warmaster can cast any spell faster than others.

tipo Passive

- **Buff** Cast speed: +15%
- **Buff** Intelligence: +5%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Mass Pricking Ivy
> A Pricking ivy grows surrounding the Warlock to damage and immobolise near enemies.

tipo Constant · cast 0.5s · GCD Short · recarga 90s · duración 5 · área 10

- **Maná:** 500
- **Daño** Piercing damage: +750
- **Debuff** Immobilize: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +550

## Warrior

### Slashing Weapons

#### Charge
> Increases the effectiveness of attack and damage.

tipo Direct · cast 0s · GCD Normal · recarga 6s · afectado por intervalo de arma

- **Maná:** 40 / 65 / 90 / 110 / 130
- **Daño** Attack damage: 100%
- **Daño** Slashing damage: 30-50 / 50-80 / 90-130 / 120-150 / 150-200

#### Accurate swings
> Improves slashing damage while active.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 90

- **Maná:** 60 / 80 / 100 / 120 / 140
- **Buff** Slashing damage: +15 / +30 / +45 / +60 / +75

#### Disable limb
> A strike to the limbs hinders mobility.

tipo Constant · cast 0s · GCD Very Short · recarga 30s · duración 30 · afectado por intervalo de arma · bloqueable true%

- **Maná:** 84 / 111 / 138 / 165 / 192
- **Debuff** Movement speed: -10% / -15% / -20% / -26% / -33%

#### Athletic
> Enhanced agility and superior physical condition allows the warrior to be more effective while wielding a weapon, making each cut caused to the enemy take less effort and save energy in each attack

tipo Passive

- **Buff** Slashing damage: +2% / +4% / +6% / +8% / +10%
- **Buff** Mana recover per hit: +4 / +4 / +6 / +6 / +10

#### South cross
> A double cross cut is executed.

tipo Direct · cast 0s · GCD Normal · recarga 10s · afectado por intervalo de arma

- **Maná:** 120 / 140 / 160 / 180 / 200
- **Daño** Attack damage: 100%
- **Daño** (Bonus) Attack damage: +20/25% / +30/35% / +40/45% / +50/55% / +60/65%

#### Crash
> A mighty attack shocks the opponent, who receives damage and loses evasive abilities.

tipo Constant · cast 0s · GCD Normal · recarga 50s · duración 15 / 20 / 25 / 30 / 35 · afectado por intervalo de arma · resistible true%

- **Maná:** 60 / 90 / 120 / 150 / 180
- **Daño** Attack damage: 110%
- **Debuff** Evade Chance: -50% / -60% / -70% / -80% / -100%
- **Debuff** Resist stun: -10% / -15% / -20% / -25% / -30%

#### Devastate
> Executes an arc sweeping blow. All of the enemies in the area receive the weapon damage.

tipo Direct · cast 1.5s · GCD Normal · recarga 70s · afectado por intervalo de arma

- **Maná:** 140 / 170 / 200 / 230 / 260
- **Daño** Attack damage: 60% / 75% / 90% / 105% / 120%
- **Daño** Slashing damage: 120 / 140 / 160 / 180 / 200

#### Iron skin
> The fighter has resistance against blunt damage.

tipo Passive

- **Buff** Blunt Resistance: +5% / +6% / +7% / +8% / +10%

#### Fatal strike
> A cut to the forehead fills with blood the opponent's vision.

tipo Constant · cast 0s · GCD Normal · recarga 80s · duración 40 · afectado por intervalo de arma

- **Maná:** 198 / 219 / 240 / 261 / 282
- **Daño** Attack damage: 100%
- **Debuff** Protection: -10% / -20% / -30% / -40% / -50%

#### Typhoon
> A 360 degree atack, destabilizes and damages the enemies that are next to the warrior.

tipo Constant · cast 1.5s · GCD Normal · recarga 180s · duración 1 / 2 / 3 / 4 / 5 · área 6 · afectado por intervalo de arma

- **Maná:** 380 / 410 / 440 / 470 / 500
- **Daño** Attack damage: 80% / 90% / 100% / 120% / 150%
- **Daño** Slashing damage: 50 / 100 / 150 / 200 / 250
- **Debuff** Knock down: true

### Blunt Weapons

#### Forceful blow
> A strong blow causes additional damage.

tipo Direct · cast 0s · GCD Normal · recarga 6s · afectado por intervalo de arma

- **Maná:** 40 / 65 / 90 / 110 / 130
- **Daño** Attack damage: 100%
- **Daño** Blunt damage: 40-60 / 60-100 / 100-140 / 140-180 / 180-240

#### Brutal impacts
> Improves blunt damage while active.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 90

- **Maná:** 60 / 80 / 100 / 120 / 140
- **Buff** Blunt damage: +15 / +30 / +45 / +60 / +75

#### Ribs breaker
> A blow to the ribs takes the air of the opponent lungs, he can't move.

tipo Constant · cast 0s · GCD Normal · recarga 40s · duración 4 / 5 / 6 / 7 / 8 · afectado por intervalo de arma

- **Maná:** 90 / 100 / 110 / 120 / 130
- **Daño** Blunt damage: 100-120 / 150-170 / 210-230 / 275-295 / 350-370
- **Debuff** Immobilize: true

#### Lethal anatomy
> The warrior is naturally strong and powerful.

tipo Passive

- **Buff** Blunt damage: +3% / +6% / +9% / +12% / +15%

#### Crushing
> Strong blow that breaks bones.

tipo Constant · cast 0s · GCD Normal · recarga 60s · duración 10 / 14 / 18 / 23 / 30 · afectado por intervalo de arma

- **Maná:** 102 / 128 / 154 / 180 / 206
- **Daño** Attack damage: +100%
- **Debuff** Constitution: -5 / -10 / -15 / -20 / -25

#### Execution
> The warrior fights seeking the way to counter the attacks more effectively.

tipo Constant · cast 0s · GCD Normal · recarga 200s · duración 10 / 12 / 14 / 16 / 20

- **Maná:** 180 / 220 / 260 / 290 / 330
- **Buff** Critical hit chance: +100% / +175% / +250% / +375% / +500%

#### Mind squasher
> Strong blow that removes positive effects that remain active on the target. Can only be used when the main weapon is of blunt damage.

tipo Direct · cast 0s · GCD Normal · recarga 100s · afectado por intervalo de arma

- **Maná:** 100 / 125 / 150 / 175 / 200
- **Daño** Attack damage: +100%
- **Debuff** Dispel positive powers: 1 / 1 / 1 / 2 / 2
- **Debuff** Dispel chance: 15% / 30% / 45% / 70% / 100%

#### Steel temper
> The warrior is resistant to piercing damage.

tipo Passive

- **Buff** Resist piercing damage: +5% / +6% / +7% / 8% / 10%

#### Jaw breaker
> A blow to the jaw makes the opponent dizzy.

tipo Constant · cast 0s · GCD Normal · recarga 40s · duración 2 / 3 / 4 / 5 / 6 · afectado por intervalo de arma

- **Maná:** 120 / 150 / 180 / 210 / 240
- **Daño** Attack damage: +100%
- **Debuff** Dizzy: true

#### Thunder strike
> The warrior strikes the floor with his weapon, making it tremble and affecting the surrounding area.

tipo Constant · cast 1.5s · GCD Normal · recarga 180s · duración 1 / 2 / 3 / 4 / 5 · área 6 · afectado por intervalo de arma

- **Maná:** 380 / 410 / 440 / 470 / 500
- **Daño** Attack damage: 80% / 90% / 100% / 120% / 150%
- **Daño** Blunt damage: 50 / 100 / 150 / 200 / 250
- **Debuff** Stun: true

### Piercing Weapons

#### Gutting
> The weapon nails the opponent and reaps her appart, causing additional slashing damage.

tipo Direct · cast 0s · GCD Normal · recarga 6s · rango 0 · afectado por intervalo de arma

- **Maná:** 40 / 65 / 90 / 110 / 130
- **Daño** Attack damage: 100%
- **Daño** Piercing damage: 40 / 70 / 110 / 140 / 175

#### Agile maneuvers
> Improves piercing damage when active.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 90

- **Maná:** 60 / 80 / 100 / 120 / 140
- **Buff** Piercing damage: +15 / +30 / +45 / +60 / +75

#### Balestra
> The warrior attacks swiftly and rapidly, getting ahead of her opponent actions.

tipo Constant · cast 0s · GCD Normal · recarga 40s · rango 0 · duración 2 / 3 / 4 / 5 / 6 · afectado por intervalo de arma

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Daño** Piercing damage: 90-110 / 140-160 / 200-220 / 265-285 / 340-360
- **Debuff** Immobilize: true

#### Versatility
> The warrior combines agility with potency

tipo Passive

- **Buff** Piercing damage: +2% / +4% / +6% / +8% / +10%
- **Buff** Health recover per hit: +4 / +4 / +6 / +6 / +10

#### Ripost
> The warrior takes advantage of an opponent's bad move, and strikes with lethal accuracy.

tipo Direct · cast 0.5s · GCD Normal · recarga 30s · rango 0 · afectado por intervalo de arma

- **Maná:** 80 / 95 / 110 / 125 / 140
- **Daño** Attack damage: +120% / +130% / +140% / +150% / +170%
- **Debuff** Convert mana to damage: 100 / 150 / 200 / 250 / 350

#### Impale
> The spear crosses the opponent from side to side.

tipo Constant · cast 0.5s · GCD Normal · recarga 60s · rango 8 · duración 12 / 15 / 17 / 19 / 21 · afectado por intervalo de arma

- **Maná:** 125 / 150 / 175 / 200 / 225
- **Daño** Attack damage: +100%
- **Daño** Piercing (5 ticks) damage: 80-125
- **Daño** Piercing damage: 80-100 / 100-120 / 120-150 / 150-190 / 190-220
- **Debuff** Dexterity: -15 / -19 / -23 / -27 / -35

#### Brain piercing
> Distracting attack that allows the interruption of power casting.

tipo Constant · cast 0s · GCD Normal · recarga 10s · rango 0 · duración 10 / 12 / 12 / 15 / 15 · afectado por intervalo de arma

- **Maná:** 120 / 150 / 180 / 210 / 250
- **Daño** Attack damage: +100%
- **Debuff** Cast speed: -10% / -15% / -20% / -25% / -40%
- **Debuff** Healing Bonus: -10% / -20% / -30% / -40% / -60%

#### Bendable
> The warrior has resistance against slashing damage.

tipo Passive

- **Buff** Resist slashing damage: +5% / 6% / 7% / 8% / 10%

#### Multiple thrust
> Multiple attacks strike in an arc area. Opponents in the area receive weapon damage.

tipo Direct · cast 1.5s · GCD Normal · recarga 70s · afectado por intervalo de arma

- **Maná:** 200 / 230 / 255 / 280 / 300
- **Daño** Piercing damage: 120 / 140 / 160 / 180 / 200
- **Daño** Attack damage: +60% / +75% / +90% / +105% / +120%

#### Lightning strike
> 360-degree strike. Opponents in area receive damage.

tipo Direct · cast 1.5s · GCD Normal · recarga 180s · duración 1 / 2 / 3 / 4 / 5 · área 6 · afectado por intervalo de arma

- **Maná:** 380 / 410 / 440 / 470 / 500
- **Daño** Attack damage: +80% / +90% / +100% / +120% / +150%
- **Daño** Piercing damage: 50 / 100 / 150 / 200 / 250
- **Debuff** Dizzy: true

### Tactics

#### Kick
> With a powerful kick, the enemy is thrown to the ground.

tipo Constant · cast 0s · GCD Normal · recarga 35s · duración 2 / 3 / 4 / 5 / 6

- **Maná:** 70 / 100 / 130 / 160 / 200
- **Daño** Blunt damage: 40-60 / 80-120 / 120-180 / 160-240 / 200-300
- **Debuff** Knock down: true

#### Caution
> The warrior watches his defenses.

tipo Constant · cast 0s · GCD Short · recarga 80s · duración 60

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Buff** Protection: 10% / 15% / 20% / 25% / 30%

#### Throat cutter
> Inflicts a lethal attack. The objective dies instantly.

The victim should not have health over:
Level 1:150
Level 2:275
Level 3:400
Level 4:525
Level 5:650

tipo Constant · cast 0s · GCD Normal · recarga 40s · afectado por intervalo de arma

- **Maná:** 100 / 140 / 180 / 220 / 260

#### Martial defense
> The warrior is trained in evasive techniques.
Reduce chances of receiving critical attacks.

tipo Passive

- **Debuff** Target critical hit chance: -10% / -20% / -30% / -50% / -70%

#### Rigorous Preparation
> Resists next crowd control effect

tipo Constant · cast 0s · GCD Short · recarga 90s · duración 3 / 6 / 9 / 12 / 15

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Buff** Resist next crowd control effect: true

#### Back slam
> A rapid fist slam to the face leaves the enemy dizzy.

tipo Constant · cast 0s · GCD Short · recarga 30s · duración 15 · afectado por intervalo de arma

- **Maná:** 120 / 145 / 170 / 195 / 220
- **Daño** Blunt damage: 160-200 / 190-230 / 220-260 / 250-290 / 280-320
- **Debuff** Resist dizzy: -10% / -20% / -30% / -40% / -50%

#### Onslaught
> The allies that hear the call win movement speed until their first attack. This attack receives a damage bonus by charge.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 14 · área 6

- **Maná:** 150 / 190 / 230 / 270 / 310
- **Buff** Movement Speed: +10% / +15% / +20% / +25% / +30%
- **Buff** Blunt damage: +50 / +75 / +100 / +125 / +150

#### Intimidate
> The knight shouts a howl that slows his enemy.

tipo Constant · cast 0s · GCD Short · recarga 6s · rango 12 · duración 6 / 7 / 8 / 9 / 10

- **Maná:** 80 / 90 / 110 / 130 / 150
- **Debuff** Movement speed: -6% / -7% / -9% / -11% / -15%

#### Disabling
> Strike to the opponent's leg that hinders her mobility.

tipo Constant · cast 0s · GCD Normal · recarga 60s · duración 40 · afectado por intervalo de arma

- **Maná:** 200 / 220 / 240 / 260 / 280
- **Debuff** Protection: -40% / -47% / -54% / -61% / -68%
- **Debuff** Block chance: -40% / -45% / -50% / -55% / -60%

#### Martial reflexes
> The warrior increases twice the normal rate, her critical chance.

tipo Constant · cast 1.5s · GCD Short · recarga 180s · duración 30 / 35 / 40 / 50 / 70

- **Maná:** 340 / 380 / 420 / 460 / 500
- **Buff** Critical hit chance: +100% / +200% / +300% / +400% / +500%
- **Buff** Resist stun: 5% / 10% / 15% / 20% / 25%

## Barbarian

### Warcries

#### Colossus
> The barbarian is possessed by a rage she cannot control. She wins strength at the expense of health

tipo Constant · cast 0s · GCD Short · recarga 60s · duración 40

- **Maná:** 50 / 80 / 110 / 130 / 150
- **Buff** Strength: +10% / +20% / +30% / +40% / +50%
- **Debuff** Health: -10%

#### Frenzy
> The barbarian becomes frenzied, ignoring the real amount of damage she receives.

tipo Constant · cast 0s · GCD Short · recarga 90s · duración 80

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Buff** Resist physical damage: +5% / +8 / +12% / +16% / +20%

#### Off with their heads!!
> Gives damage bonus to any ally.

tipo Constant · cast 0s · GCD Very Short · recarga 60s · duración 60 · área 10

- **Maná:** 100 / 115 / 130 / 145 / 160
- **Buff** Damage Bonus: +5% / +7% / +9% / +12% / +15%

#### Thirst for blood
> The barbarian channels all her fury. Normal attacks receive a damage bonus that increments on every successful impact. Power wears off by duration and also when inflicting 5 successful blows. Evaded and blocked attacks are not counted toward power expiration.

tipo Constant · cast 0.5s · GCD Short · recarga 60s · duración 45

- **Maná:** 80 / 120 / 160 / 200 / 240
- **Buff** Attack Speed: +5% / +6% / +7% / +8% / +10%
- **Buff** Damage per impact (two handed weapon only): +10 / +20 / +30 / +40 / +50
- **Buff** Attack speed bonus (dual handed weapons only): +5% / +7% / +9% / +11% / +15%

#### Challenging Roar
> The barbarian gains confidence in frightening the opponent and improves her attacks. At level 5, she resists the enxt crowd control effect.

tipo Constant · cast 0s · GCD Short · recarga 120s · duración 20

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Buff** Casting speed: +10% / +15% / +20% / +25% / +30%
- **Buff** Resist next crowd control effect: - / - / - / - / yes

#### Deafening roar
> A powerful roar affects everyone who crosses its path

tipo Constant · cast 0.5s · GCD Normal · recarga 40s · duración 4 / 5 / 6 / 7 / 8 · afectado por intervalo de arma

- **Maná:** 100 / 130 / 160 / 190 / 220
- **Debuff** Stun: true

#### Berserk
> Raging state in which the barbarian is not aware of anything but what she destroys.

tipo Constant · cast 0s · GCD Short · recarga 50s · duración 90

- **Maná:** 100 / 130 / 160 / 180 / 200
- **Buff** Damage Bonus: +20% / +28% / +36% / +42% / +50%
- **Buff** Attack Speed bonus (dual handed weapons only): - / - / - / - / +10%
- **Debuff** Evade chance: -100%

#### Overwhelming strength
> The barbarian gets a damage bonus on all attacks.

tipo Passive

- **Buff** Damage Bonus: +5% / +7% / +9% / +12% / +15%

#### Spring
> Allows the barbarian to quickly get closer to the enemy.

tipo Constant · cast 0s · GCD Very Short · recarga 30s · duración 10

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Buff** Movement speed: +10% / +15% / +20% / +25% / +30%
- **Buff** Range received damage: -15% / -15% / -15% / -30% / -30%

#### Unstoppable Madness
> The barbarian enters a madness state in which he is almost immune to crowd control attempts.

tipo Constant · cast 0s · GCD Very Short · recarga 40s · duración 5 / 6 / 7 / 8 / 10

- **Maná:** 220 / 240 / 260 / 300 / 340
- **Buff** Resist immobilize: +75% / +80% / +85% / +90% / +100%
- **Buff** Resist knock: +75% / +80% / +85% / +90% / +100%
- **Buff** Resist freeze: +75% / +80% / +85% / +90% / +100%
- **Buff** Resist stun: +75% / +80% / +85% / +90% / +100%
- **Buff** Resist dizzy: +75% / +80% / +85% / +90% / +100%
- **Buff** Resist cannot attack: +75% / +80% / +85% / +90% / +100%

### Two Handed Mastery

#### Threat
> Anyone near the barbarian will be intimidated and the critical hits they receive will be stronger.

tipo Constant · cast 0s · GCD Short · recarga 60s · duración 10 / 14 / 16 / 18 / 25

- **Maná:** 100 / 120 / 140 / 160 / 180
- **Buff** Critical damage: +10% / +13% / +16% / +20% / +30%

#### Spiritual blow
> The Barbarian extends an attack beyond her normal distance.

tipo Constant · cast 0s · GCD Normal · recarga 30s · rango 8 · duración 30 · afectado por intervalo de arma

- **Maná:** 80 / 110 / 140 / 170 / 200
- **Buff** Attack damage: +40% / +55% / +70% / +85% / +100%
- **Debuff** Concentration: -15% / -20% / -25% / -30% / -35%

#### Rend
> Tears away the target's flesh. The opponent keeps on bleeding.

tipo Direct · cast 0.5s · GCD Normal · recarga 30s · rango 0 · afectado por intervalo de arma

- **Maná:** 120 / 150 / 180 / 210 / 240
- **Daño** Attack damage: +100%
- **Debuff** Mana: -20% / -25% / -30% / -35% / -40%

#### Beast attack
> A strike made with might deals a great amount of damage and shocks the opponent

tipo Constant · cast 0s · GCD Normal · recarga 45s · rango 0 · duración 3 / 4 / 5 / 6 / 7 · afectado por intervalo de arma

- **Maná:** 160 / 190 / 220 / 250 / 280
- **Daño** Attack damage: +40/50% / +65/75% / +90/100% / +115/125% / 140/150%
- **Debuff** Dizzy (chance 50%): true

#### Howl
> The barbarian screams, insults and howls. His opponents can't concentrate enough to use their powers.

tipo Constant · cast 0.5s · GCD Normal · recarga 60s · duración 3 / 4 / 5 / 6 / 7 · área 6

- **Maná:** 150 / 180 / 210 / 240 / 270
- **Debuff** Dizzy: true

#### Expansive wave
> An energy wave is created with the weapon. It makes blunt damage to all opponents in an arc area.

tipo Direct · cast 1.5s · GCD Normal · recarga 45s · afectado por intervalo de arma

- **Maná:** 200 / 240 / 280 / 320 / 360
- **Daño** Blunt damage: 80-100 / 130-160 / 180-210 / 230-260 / 280-310
- **Daño** Attack damage: +20% / +40% / +60% / +80% / +100%

#### Destabilize
> The barbarian reduces opponent evade chances by destabilizing her

tipo Constant · cast 0s · GCD Normal · recarga 15s · rango 0 · duración 60 · afectado por intervalo de arma

- **Maná:** 65 / 80 / 95 / 110 / 125
- **Daño** Attack damage: +100%
- **Debuff** Evade Chance: -10% / -20% / -30% / -40% / -50%

#### Fulminating
> The barbarian raises his damage significantly for a very short period of time.

tipo Constant · cast 0.5s · GCD Very Long · recarga 20s · duración 5

- **Maná:** 160 / 180 / 200 / 220 / 240
- **Buff** Damage bonus: +10% / +20% / +30% / +40% / +50%
- **Debuff** Cannot cast area spells: true

#### Hands of Steel
> Increase range and damage

tipo Passive

- **Buff** Attack Range: +5% / +10% / +15% / +20% / +25%
- **Buff** Damage Bonus: +10% / +13% / +16% / +20% / +30%

#### Rage of the earth
> A mighty blow on the earth provokes a tremor. Opponents in its path are damaged and knocked down

tipo Constant · cast 0.5s · GCD Normal · recarga 90s · duración 2 / 3 / 4 / 5 / 6 · afectado por intervalo de arma

- **Maná:** 190 / 230 / 270 / 310 / 350
- **Daño** (60° arc) Weapon damage: 100% / 105% / 110% / 115% / 125%
- **Debuff** Knock down: true

### Barbarian WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Beacon
> Places a beacon on the ground. Allies interacting with it will receive Warmaster's Defensive Blessing, which raises the maximum health.

tipo Direct · cast 0.3s · GCD Very Short · recarga 600s · duración 60

- **Maná:** 150
- **Buff** Health for allies: +2000

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> The Warmaster enhances his class main attribute.

tipo Passive

- **Buff** Class attribute: +15%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Heroic Shout
> A powerful shout intimidates all near-by opponents, reducing their movement speed.

tipo Constant · cast 0.5s · GCD Normal · recarga 30s · duración 5 · área 6

- **Maná:** 150
- **Buff** Movement speed: -25%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +300

## Knight

### Vanguard

#### Challenge
> The taunted enemy loses focus and makes mistakes.

tipo Constant · cast 1s · GCD Short · recarga 15s · rango 25 · duración 5 / 5 / 10 / 10 / 15 · bloqueable true%

- **Maná:** 50 / 75 / 100 / 125 / 150
- **Debuff** Resist knock: -20% / -40% / -60% / -80% / -100%
- **Debuff** Concentration: -10% / -15% / -20% / -25% / -30%

#### Taunt
> Makes the monster angry, increasing her aggressiveness towards the knight and reducing its protection drastically. A pet or summoning under the effect of this spell will stop obeying its master. The creature will become wild until the effect wears off. Dispel magic may return control to its owner.

tipo Constant · cast 0.5s · GCD Short · recarga 20s · rango 25 · duración 20 / 25 / 30 / 35 / 40

- **Maná:** 50 / 65 / 80 / 95 / 110
- **Debuff** Increase aggressiveness: 150 / 300 / 500 / 1000 / 1500
- **Debuff** Protection: -20% / -30% / -40% / -50% / -60%
- **Debuff** Damage malus: -3% / -5% / -7% / -10% / -15%

#### Feint
> Misleading maneuver.

tipo Constant · cast 0s · GCD Normal · recarga 35s · rango 0 · duración 2 / 3 / 4 / 5 / 6 · bloqueable true%

- **Maná:** 70 / 90 / 110 / 130 / 150
- **Debuff** Knock down: true

#### Protector Temple
> The knight is used to endure damage.

tipo Passive

- **Buff** Constitution: +5 / +7 / +9 / +12 / +15
- **Buff** Resist magical damage: +2% / +4% / +6% / +8% / +10%
- **Buff** Resist physical damage: +2% / +4% / +6% / +8% / +10%

#### Offensive stance
> The knight focuses his mind in maximizing the damage caused to his enemies. The power can be deactivated.

tipo Activable · cast 0.5s · GCD Very Short · recarga 10s

- **Buff** Damage bonus: +5% / +10% / +15% / +20% / +25%
- **Debuff** Protection: -95%
- **Debuff** Evade chance: -100%

#### Defensive Support
> The warrior adopts a tactic defense against crowd control effects, but moves more slowly.

tipo Constant · cast 1.5s · GCD Short · recarga 30s · duración 40

- **Maná:** 105 / 120 / 135 / 150 / 165
- **Buff** Resist dizzy: +25% / +35% / +45% / +55% / +65%
- **Buff** Resist stun: +25% / +35% / +45% / +55% / +65%
- **Buff** Resist knock: +25% / +35% / +45% / +55% / +65%
- **Buff** Resist freeze: +25% / +35% / +45% / +55% / +65%
- **Debuff** Movement speed: -10%

#### Troll's skin
> The knight's built constitution allows him to receive more strikes without being beaten.

tipo Constant · cast 1s · GCD Normal · recarga 270s · rango 0 · duración 240

- **Maná:** 100 / 130 / 160 / 190 / 210
- **Buff** Health: +200 / +300 / +450 / +600 / +1000

#### Knight's Haste
> The knight moves extremely fast for a very short duration, providing higher chances of helping an ally in need or to hunt down a foe.

tipo Constant · cast 0s · GCD Very Short · recarga 100s · duración 4

- **Maná:** 50 / 80 / 110 / 140 / 170
- **Buff** Movement speed: +5% / +10% / +15% / +20% / +50%

#### Heroic presence
> The knight confers protective tactical abilities to any ally that is within his area of influence.

tipo Aura · cast 1.5s · GCD Very Short · recarga 90s · duración 60 · área 6

- **Maná:** 320 / 340 / 360 / 380 / 400
- **Buff** Protection: +40% / +50% / +60% / +70% / +80%

#### Army of one
> The knight is almost immune to damage.

tipo Constant · cast 0.5s · GCD Long · recarga 50s · duración 20

- **Maná:** 220 / 240 / 260 / 280 / 300
- **Buff** Resist magical damage: +40% / +50% / +60% / +70% / +80%
- **Buff** Resist physical damage: +40% / +50% / +60% / +70% / +80%

### Shields

#### Block
> The knight earns 150% of blocking chances.

tipo Constant · cast 0s · GCD Very Short · recarga 50s · duración 12 / 15 / 18 / 21 / 25

- **Maná:** 60 / 80 / 100 / 120 / 140
- **Buff** Block Chance: +150%

#### Shield bash
> A rapid shield strike damages the opponent, making her dizzy.

tipo Constant · cast 0s · GCD Normal · recarga 45s · rango 2 · duración 3 / 4 / 5 / 6 / 7 · afectado por intervalo de arma

- **Maná:** 110 / 135 / 160 / 175 / 190
- **Daño** Blunt damage: 80-120 / 160-210 / 260-320 / 380-460 / 540-640
- **Debuff** Dizzy: true

#### Protect ally
> Dispels crowd control active effects on an ally.

tipo Direct · cast 0s · GCD Short · recarga 30s · rango 2

- **Maná:** 130 / 150 / 170 / 190 / 210
- **Buff** Health (chance): +100 (30%) / +110 (45%) / +120 (60%) / +130 (80%) / +150 (100%)
- **Buff** Dispel: freeze / freeze / stun / freeze / immobilize / stun / freeze / immobilize / stun / knock down / negative powers

#### Precise block
> The knight blocks all attacks and spells.

tipo Constant · cast 0s · GCD Very Short · recarga 30s · duración 4 / 5 / 6 / 7 / 9

- **Maná:** 80 / 100 / 120 / 140 / 160
- **Buff** Absolute block chance: 100%
- **Debuff** Stop on move: true
- **Debuff** Cannot attack: true

#### Defensive stance
> The knight focuses his mind in minimizing the damage from enemies. The power can be deactivated.

tipo Activable · cast 0.5s · GCD Very Short · recarga 10s

- **Buff** Resist damage: +20% / +25% / +30% / +35% / +40%
- **Debuff** Cannot cast damaging powers: true
- **Debuff** Weapon damage bonus: -90%

#### Ethereal mantle
> The knight can shield one ally against magic damage.

tipo Constant · cast 0.5s · GCD Very Short · recarga 120s · rango 2 · duración 60

- **Maná:** 200 / 230 / 260 / 290 / 320
- **Buff** Resist magical damage: +10% / +15% / +20% / +25% / +30%
- **Buff** Resist physical damage: +10% / +15% / +20% / +25% / +30%

#### Shield wall
> The knight shields the allies against physical damage.

tipo Constant · cast 0s · GCD Short · recarga 40s · duración 10 · área 10

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Resist physical damage: +10% / +20% / +30% / +40% / +50%

#### Steadiness
> The knight walks straight and grips to the floor. Reducing falling chances.

tipo Passive

- **Buff** Resist knock: +5% / +10% / +15% / +20% / +25%

#### Stars shield
> The knight grants a protection aura against magical damage to the allies in the area.

tipo Constant · cast 0s · GCD Short · recarga 40s · duración 10 · área 10

- **Maná:** 200 / 225 / 250 / 275 / 300
- **Buff** Resist magical damage: +10% / +20% / +30% / +40% / +50%
- **Debuff** Cannot cast Deflecting barrier: true

#### Deflecting barrier
> The knight shields the allies in the rear against received ranged attacks. Reduces damage substantially.

tipo Aura · cast 1s · GCD Short · recarga 180s · duración 120 · área 6

- **Maná:** 250 / 300 / 350 / 400 / 450
- **Buff** Ranged damage received: -10% / -15% / -20% / -30% / -40%
- **Debuff** Cannot cast Stars shield: true

### Knight WM

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### War Council
> The Warmaster learns a war language that allows her to communicate with her status in secret.

tipo Passive

- **Buff** War chat: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Paladin's Aid
> Thanks to the warring devotion, the Warmasters receives all of the attacks directed to the ally.

tipo Constant · cast 0s · GCD Very Short · recarga 50s · duración 8

- **Maná:** 200
- **Buff** Absorb all attacks received on targeted ally: true

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster's Might
> The Warmaster enhances his Constitution.

tipo Passive

- **Buff** Constitution: +15%

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Blessed
> Thanks to his/her devotion the Warmaster receives a blessing to health.

tipo Direct · cast 1s · GCD Short · recarga 90s

- **Maná:** 250
- **Buff** Health: +400

#### (sin datos en la fuente)
> Entrada placeholder del trainer 1.35.19: nombre y descripción vacíos. Pendiente de datos reales.

#### Warmaster Blood
> The Warmaster athletic capabilities increase due to long years of training.

tipo Passive

- **Buff** Health: +350
