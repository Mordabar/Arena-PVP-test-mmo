/* =============================================================================
 * data/abilities.js — Los 36 poderes activos (6 por subclase, documento §13–§18).
 *
 * Todo poder es DATO. El motor implementa los efectos genéricos una sola vez
 * (resolver.js) y aquí sólo se combinan (documento §25). Añadir un poder nuevo
 * no debería requerir tocar ni una línea de lógica.
 *
 * Campos:
 *   target ....... self | enemy | ally | allyOrSelf | cone | aoeSelf | ground
 *   gcd .......... 'reactive' (0.25) | 'short' (0.55) | 'standard' (0.80) | 'none'
 *   school ....... categoría de bloqueo por interrupción
 *   flags ........ magic, projectile, weaponAttack, offensive, movableCast,
 *                  requiresFacing, uninterruptible, mobility, defensive
 *   effects ...... payload sobre el objetivo
 *   selfEffects .. payload sobre el lanzador (nunca lo frenan los counters ajenos)
 * ========================================================================== */
Arena.define('data/abilities', ['data/classes', 'data/effects'], function (Arena) {
  'use strict';

  var abilities = {};


  /* =========================================================================
   * Contrato temporal de combate
   *
   * Es DATA, no inferencia por daño. Dos poderes físicamente parecidos pueden
   * relacionarse de forma distinta con el swing normal. El motor sólo consume
   * esta tabla y nunca pregunta por ids concretos.
   * ====================================================================== */
  var COMBAT_TIMING = {
    devastador_embestida:          { actionType:'weaponSkill', normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'charge' },
    devastador_impacto_sismico:    { actionType:'utility',     normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'kick' },
    devastador_golpe_quebrador:    { actionType:'weaponSkill', normalInteraction:'replacesNormal', weaponIntervalPolicy:'respectReady',stationary:true,  visualAction:'heavy' },
    devastador_bramido:            { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'cry' },
    devastador_furia:              { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'cry' },
    devastador_profanador:         { actionType:'weaponSkill', normalInteraction:'replacesNormal', weaponIntervalPolicy:'respectReady',stationary:true,  visualAction:'heavy' },

    guardian_avasallamiento:       { actionType:'utility',     normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'shield' },
    guardian_guardia_absoluta:     { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'guardBuff' },
    guardian_interponer:           { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'guardBuff' },
    guardian_egida:                { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'guardBuff' },
    guardian_proteccion_aliada:    { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'guardBuff' },
    guardian_postura:              { actionType:'utility',     normalInteraction:'blocksNormal',   weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'guardBuff' },

    centinela_disparo_tensado:     { actionType:'weaponSkill', normalInteraction:'replacesNormal', weaponIntervalPolicy:'respectReady',stationary:true,  visualAction:'archer' },
    centinela_flecha_perforante:   { actionType:'weaponSkill', normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'archer' },
    centinela_rafaga_disruptiva:   { actionType:'weaponSkill', normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'archer' },
    centinela_pulso_invernal:      { actionType:'spell',       normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'archer' },
    centinela_retroceso:           { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'none' },
    centinela_lluvia_astillas:     { actionType:'weaponSkill', normalInteraction:'replacesNormal', weaponIntervalPolicy:'respectReady',stationary:true,  visualAction:'archer' },

    rastreador_camuflaje:          { actionType:'utility',     normalInteraction:'blocksNormal',   weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'none' },
    rastreador_emboscada:          { actionType:'weaponSkill', normalInteraction:'replacesNormal', weaponIntervalPolicy:'respectReady',stationary:true,  visualAction:'archer' },
    rastreador_trampa:             { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'none' },
    rastreador_marca_corrosiva:    { actionType:'weaponSkill', normalInteraction:'weaveAfterNormal',weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'archer' },
    rastreador_confusion:          { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true,  visualAction:'none' },
    rastreador_revelar:            { actionType:'utility',     normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'none' },

    arcanista_descarga:            { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    arcanista_prision:             { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    arcanista_impacto_celeste:     { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    arcanista_estasis:             { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    arcanista_corrupcion:          { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    arcanista_velo_nulo:           { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },

    vinculador_pulso_vital:        { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    vinculador_regeneracion:       { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    vinculador_barrera:            { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    vinculador_intervencion:       { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    vinculador_purificacion:       { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:true, visualAction:'cast' },
    vinculador_enlace:             { actionType:'spell',       normalInteraction:'independent',    weaponIntervalPolicy:'ignore',       stationary:false, visualAction:'cast' }
  };

  function ab(id, o) {
    o.id = id;
    o.flags = o.flags || {};
    o.effects = o.effects || [];
    if (o.gcd === undefined) o.gcd = 'standard';
    if (o.castTime === undefined) o.castTime = 0;
    if (o.cooldown === undefined) o.cooldown = 0;
    if (o.cost === undefined) o.cost = 0;
    if (o.school === undefined) o.school = 'general';
    var timing = COMBAT_TIMING[id];
    if (!timing) throw new Error('Falta combatTiming para ' + id);
    o.combatTiming = {
      actionType: timing.actionType,
      normalInteraction: timing.normalInteraction,
      weaponIntervalPolicy: timing.weaponIntervalPolicy,
      stationary: !!timing.stationary,
      visualAction: timing.visualAction || (timing.actionType === 'spell' ? 'cast' : 'none'),
      cooldownCommit: 'onRelease',
      resourceCommit: 'onRelease',
      gcdCommit: 'onRelease'
    };
    abilities[id] = o;
    return o;
  }

  /* =========================================================================
   * DEVASTADOR — presión melee / iniciación
   * ====================================================================== */

  ab('devastador_embestida', {
    classId: 'devastador', name: 'Embestida brutal', icon: '⇉', key: '1',
    // El slow dura 2.5 s y no 1.5: la carga es la herramienta de adherencia del
    // Devastador, y con 1.5 s el objetivo a distancia recuperaba el hueco antes
    // de que llegara el primer golpe. Es lo que separa "alcanzar" de "amenazar".
    target: 'enemy', range: 8, castTime: 0, gcd: 'short', cooldown: 14, cost: 18,
    school: 'weapon',
    flags: { weaponAttack: true, offensive: true, mobility: true },
    effects: [
      { type: 'dash', mode: 'toTarget', gap: 0.2 },
      { type: 'physicalDamage', coefficient: 1.10 },
      { type: 'status', effect: 'slow', duration: 2.5, data: { slowPct: 0.30 } }
    ],
    desc: 'Carga hacia el objetivo, inflige daño moderado y lo ralentiza un 30 % durante 2.5 s.',
    tip: 'No atraviesa paredes: la carga se detiene contra el obstáculo.'
  });

  ab('devastador_impacto_sismico', {
    classId: 'devastador', name: 'Impacto sísmico', icon: '⬇', key: '2',
    target: 'enemy', range: 2.4, castTime: 0, gcd: 'standard', cooldown: 22, cost: 28,
    school: 'weapon',
    flags: { weaponAttack: true, offensive: true },
    effects: [
      { type: 'conditional', check: 'hasCharges', key: 'impetu', value: 5,
        then: [{ type: 'physicalDamage', coefficient: 1.65 }],
        otherwise: [{ type: 'physicalDamage', coefficient: 1.45 }] },
      { type: 'status', effect: 'knockdown', duration: 1.30 }
    ],
    desc: 'Daño físico alto y derribo de 1.3 s. Con 5 cargas de Ímpetu golpea un 15 % más fuerte.',
    tip: 'Es la apertura del burst: encadénalo con Golpe quebrador.'
  });

  ab('devastador_golpe_quebrador', {
    classId: 'devastador', name: 'Golpe quebrador', icon: '✖', key: '3',
    // CD 9 s y debuff de 5 s: es el relleno del Devastador. Con 14 s el kit se
    // quedaba sin botones y el melee pasaba media pelea sólo con ataque normal.
    target: 'enemy', range: 2.4, castTime: 0.4, gcd: 'standard', cooldown: 9, cost: 20,
    school: 'weapon',
    flags: { weaponAttack: true, offensive: true },
    effects: [
      { type: 'physicalDamage', coefficient: 1.60 },
      { type: 'status', effect: 'armorBreak', duration: 5, data: { armorReductionPct: 0.25 } }
    ],
    desc: 'Daño físico medio y reduce la armadura del objetivo un 25 % durante 5 s.',
    tip: 'Ábrelo siempre antes del burst propio o del de un aliado físico.'
  });

  ab('devastador_bramido', {
    classId: 'devastador', name: 'Bramido de ruptura', icon: '≋', key: '4',
    target: 'aoeSelf', radius: 5, castTime: 0.5, gcd: 'standard', cooldown: 34, cost: 26,
    school: 'weapon',
    flags: { offensive: true },
    effects: [
      { type: 'physicalDamage', coefficient: 0.15 },
      { type: 'status', effect: 'silence', duration: 1.50 }
    ],
    desc: 'Mareo de 1.5 s a todos los enemigos en 5 unidades. Daño testimonial.',
    tip: 'Corta casteos de grupo: úsalo sobre el soporte enemigo, no sobre el tanque.'
  });

  ab('devastador_furia', {
    classId: 'devastador', name: 'Furia desatada', icon: '⚡', key: '5',
    target: 'self', castTime: 0, gcd: 'short', cooldown: 38, cost: 12,
    school: 'tactics',
    flags: { defensive: false },
    effects: [
      { type: 'status', effect: 'damageAmp', duration: 5,
        data: { damageDealtPct: 0.20, attackSpeedPct: 0.15 } },
      { type: 'status', effect: 'exposed', duration: 5, data: { damageTakenPct: 0.18 } }
    ],
    desc: 'Durante 5 s: +20 % daño y +15 % velocidad de ataque, pero recibes un 18 % más de daño.',
    tip: 'Riesgo real: si lo activas sin ventana de CC, se vuelve en tu contra.'
  });

  ab('devastador_profanador', {
    classId: 'devastador', name: 'Golpe profanador', icon: '☠', key: '6',
    target: 'enemy', range: 2.4, castTime: 0.6, gcd: 'standard', cooldown: 28, cost: 24,
    school: 'weapon',
    flags: { weaponAttack: true, offensive: true },
    effects: [
      { type: 'physicalDamage', coefficient: 1.00 },
      { type: 'purge', count: 1 }
    ],
    desc: 'Daño medio y elimina un buff positivo prioritario del objetivo.',
    tip: 'Los counters activos (bloqueo, reflejo, intervención) no se purgan.'
  });

  /* =========================================================================
   * GUARDIÁN — protección / peel / counter
   * ====================================================================== */

  ab('guardian_avasallamiento', {
    classId: 'guardian', name: 'Avasallamiento', icon: '⛊', key: '1',
    target: 'enemy', range: 2.5, castTime: 0, gcd: 'standard', cooldown: 20, cost: 20,
    school: 'weapon',
    flags: { weaponAttack: true, offensive: true },
    effects: [
      { type: 'physicalDamage', coefficient: 0.90 },
      { type: 'status', effect: 'silence', duration: 1.20 }
    ],
    desc: 'Golpe de escudo con daño bajo-medio y Mareo de 1.2 s.',
    tip: 'Tu herramienta de corte a melee. Guárdala para el cast decisivo.'
  });

  ab('guardian_guardia_absoluta', {
    classId: 'guardian', name: 'Guardia absoluta', icon: '⛨', key: '2',
    target: 'self', castTime: 0, gcd: 'reactive', cooldown: 30, cost: 14,
    school: 'shield',
    flags: { defensive: true },
    effects: [
      { type: 'status', effect: 'block', duration: 2.5, data: { slowPct: 0.35 } }
    ],
    desc: 'Durante 2.5 s bloquea todos los impactos directos. No puedes usar poderes ofensivos y te mueves un 35 % más lento.',
    tip: 'Determinista, no probabilístico: si lo lees bien, anulas el burst entero.'
  });

  ab('guardian_interponer', {
    classId: 'guardian', name: 'Interponer', icon: '⇄', key: '3',
    target: 'ally', range: 8, castTime: 0, gcd: 'short', cooldown: 24, cost: 18,
    school: 'shield',
    flags: { defensive: true, mobility: true },
    effects: [
      { type: 'dash', mode: 'toAlly' },
      { type: 'status', effect: 'damageRedirect', duration: 4, data: { redirectPct: 0.35 } }
    ],
    desc: 'Te desplazas junto al aliado y absorbes el 35 % del daño que reciba durante 4 s.',
    tip: 'El daño desviado se resuelve contra TU armadura: por eso funciona.'
  });

  ab('guardian_egida', {
    classId: 'guardian', name: 'Égida reflectante', icon: '↩', key: '4',
    target: 'self', castTime: 0, gcd: 'reactive', cooldown: 42, cost: 22,
    school: 'shield',
    flags: { defensive: true },
    effects: [
      { type: 'status', effect: 'reflect', duration: 5 }
    ],
    desc: 'Durante 5 s o hasta activarse, refleja el próximo hechizo mágico dirigido de objetivo único.',
    tip: 'No refleja área, suelo, auras ni curas. Una sola carga.'
  });

  ab('guardian_proteccion_aliada', {
    classId: 'guardian', name: 'Protección aliada', icon: '✚', key: '5',
    target: 'ally', range: 6, castTime: 0, gcd: 'short', cooldown: 28, cost: 22,
    school: 'shield',
    flags: { defensive: true },
    effects: [
      { type: 'cleanse', hard: 1, minor: 2 },
      { type: 'heal', coefficient: 0.55 }
    ],
    desc: 'Elimina 1 control duro o 2 debuffs menores del aliado y restaura algo de vida.',
    tip: 'Segundo cleanse del equipo: cubre al Vinculador cuando el suyo está en recarga.'
  });

  ab('guardian_postura', {
    classId: 'guardian', name: 'Postura inexpugnable', icon: '⬢', key: '6',
    target: 'self', castTime: 0.4, gcd: 'short', cooldown: 36, cost: 18,
    school: 'shield',
    flags: { defensive: true },
    effects: [
      { type: 'status', effect: 'noOffense', duration: 5, data: { damageTakenPct: -0.35 } }
    ],
    desc: 'Durante 5 s recibes un 35 % menos de daño, pero no puedes lanzar habilidades dañinas.',
    tip: 'Sobrevives, pero dejas de amenazar: es una cesión de tempo deliberada.'
  });

  /* =========================================================================
   * CENTINELA — daño físico de largo alcance
   * ====================================================================== */

  ab('centinela_disparo_tensado', {
    classId: 'centinela', name: 'Disparo tensado', icon: '➶', key: '1',
    target: 'enemy', range: 25, castTime: 1.2, gcd: 'standard', cooldown: 8, cost: 16,
    school: 'archery', projectileSpeed: 52,
    flags: { weaponAttack: true, offensive: true, projectile: true },
    effects: [
      { type: 'physicalDamage', coefficient: 2.20 }
    ],
    desc: 'Ataque de alto daño físico. El casteo se cancela al moverte.',
    tip: 'Tu golpe más fuerte a cambio de quedarte quieto 1.2 s. Elige el momento.'
  });

  ab('centinela_flecha_perforante', {
    classId: 'centinela', name: 'Flecha perforante', icon: '⟶', key: '2',
    target: 'enemy', range: 22, castTime: 0.7, gcd: 'standard', cooldown: 15, cost: 18,
    school: 'archery', projectileSpeed: 56,
    flags: { weaponAttack: true, offensive: true, projectile: true },
    effects: [
      { type: 'physicalDamage', coefficient: 1.50, ignoreDefensePct: 0.40 },
      { type: 'status', effect: 'armorBreak', duration: 4, data: { armorReductionPct: 0.15 } }
    ],
    desc: 'Ignora un 40 % de la armadura y la reduce otro 15 % durante 4 s.',
    tip: 'Contra objetivos muy blindados pega más que Disparo tensado.'
  });

  ab('centinela_rafaga_disruptiva', {
    classId: 'centinela', name: 'Ráfaga disruptiva', icon: '≡', key: '3',
    target: 'enemy', range: 18, castTime: 0.5, gcd: 'short', cooldown: 26, cost: 20,
    school: 'archery', projectileSpeed: 60,
    flags: { weaponAttack: true, offensive: true, projectile: true },
    effects: [
      { type: 'physicalDamage', coefficient: 0.60 },
      { type: 'status', effect: 'silence', duration: 1.40 }
    ],
    desc: 'Daño bajo y Mareo de 1.4 s. Corte de casteo a distancia.',
    tip: 'Es la única forma de interrumpir a 18 unidades: no la gastes por daño.'
  });

  ab('centinela_pulso_invernal', {
    classId: 'centinela', name: 'Pulso invernal', icon: '❄', key: '4',
    target: 'enemy', range: 20, castTime: 0.8, gcd: 'standard', cooldown: 36, cost: 24,
    school: 'archery', projectileSpeed: 46,
    flags: { offensive: true, projectile: true },
    effects: [
      { type: 'physicalDamage', coefficient: 0.40 },
      { type: 'status', effect: 'stasis', duration: 1.70 }
    ],
    desc: 'Daño bajo y congela al objetivo 1.7 s: no actúa, no puede ser seleccionado y no recibe daño.',
    tip: 'Sirve para resetear el ritmo, no para preparar burst: en estasis nadie le hace daño.'
  });

  ab('centinela_retroceso', {
    classId: 'centinela', name: 'Retroceso táctico', icon: '↤', key: '5',
    target: 'self', castTime: 0, gcd: 'short', cooldown: 22, cost: 12,
    school: 'evasion',
    flags: { defensive: true, mobility: true },
    effects: [
      { type: 'dash', mode: 'backward', distance: 6.5 },
      { type: 'status', effect: 'slowImmunity', duration: 1.0 }
    ],
    desc: 'Salto atrás corto y 1 s de inmunidad a ralentizaciones. No rompe Enraizar.',
    tip: 'Si estás enraizado no te desplaza: guarda el cleanse o pierde el escape.'
  });

  ab('centinela_lluvia_astillas', {
    classId: 'centinela', name: 'Lluvia de astillas', icon: '⁂', key: '6',
    target: 'cone', range: 12, coneAngle: Math.PI / 5, castTime: 1.0, gcd: 'standard',
    cooldown: 24, cost: 22, school: 'archery', splitDamage: true,
    flags: { weaponAttack: true, offensive: true },
    effects: [
      { type: 'physicalDamage', coefficient: 1.80 }
    ],
    desc: 'Ataques físicos en cono de 12 unidades. El daño se reparte entre los objetivos alcanzados.',
    tip: 'Contra un solo objetivo pega fuerte; contra tres, poco. Es presión, no burst de área.'
  });

  /* =========================================================================
   * RASTREADOR — control táctico / sigilo / información
   * ====================================================================== */

  ab('rastreador_camuflaje', {
    classId: 'rastreador', name: 'Camuflaje', icon: '◐', key: '1',
    target: 'self', castTime: 3.0, gcd: 'short', cooldown: 36, cost: 18,
    school: 'scouting',
    flags: { defensive: true },
    effects: [
      { type: 'status', effect: 'stealth', duration: 12, data: { slowPct: 0.15 } }
    ],
    desc: 'Entra en sigilo hasta 12 s. Atacar o castear lo rompe; recibir daño directo te revela.',
    tip: 'Tres segundos de casteo: sólo funciona si te desenganchas antes.'
  });

  ab('rastreador_emboscada', {
    classId: 'rastreador', name: 'Emboscada', icon: '⚔', key: '2',
    target: 'enemy', range: 12, castTime: 0.4, gcd: 'standard', cooldown: 24, cost: 22,
    school: 'scouting', projectileSpeed: 50,
    flags: { weaponAttack: true, offensive: true, projectile: true },
    effects: [
      { type: 'conditional', check: 'casterFromStealth',
        then: [{ type: 'physicalDamage', coefficient: 1.80 }],
        otherwise: [{ type: 'physicalDamage', coefficient: 1.50 }] },
      { type: 'status', effect: 'knockdown', duration: 1.20 }
    ],
    desc: 'Daño medio y derribo de 1.2 s. Desde sigilo inflige un 20 % más.',
    tip: 'La apertura de sigilo es tu única ventana de iniciación real.'
  });

  ab('rastreador_trampa', {
    classId: 'rastreador', name: 'Trampa enredante', icon: '◎', key: '3',
    target: 'ground', range: 14, radius: 1.8, castTime: 0.5, gcd: 'short',
    cooldown: 26, cost: 20, school: 'scouting',
    flags: { offensive: true },
    effects: [
      { type: 'zone', kind: 'trap', radius: 1.8, duration: 25, armDelay: 0.5, triggers: 1,
        onTrigger: [{ type: 'status', effect: 'root', duration: 2.0 }] }
    ],
    desc: 'Coloca una trampa visible. Al pisarla, Enraizar de 2.0 s.',
    tip: 'Es control diferido: colócala donde el enemigo querrá huir, no donde está.'
  });

  ab('rastreador_marca_corrosiva', {
    classId: 'rastreador', name: 'Marca corrosiva', icon: '☣', key: '4',
    target: 'enemy', range: 18, castTime: 0.6, gcd: 'standard', cooldown: 18, cost: 18,
    school: 'scouting', projectileSpeed: 44,
    flags: { offensive: true, projectile: true },
    effects: [
      { type: 'dot', coefficient: 1.10, duration: 6, interval: 1.0, school: 'physical' },
      { type: 'status', effect: 'antiHeal', duration: 6, data: { antiHealPct: 0.35 } }
    ],
    desc: 'Daño periódico durante 6 s y reduce un 35 % la curación recibida.',
    tip: 'Póntela antes de comprometer el burst: sin ella el soporte enemigo repone todo.'
  });

  ab('rastreador_confusion', {
    classId: 'rastreador', name: 'Confusión táctica', icon: '⊘', key: '5',
    target: 'enemy', range: 18, castTime: 0.8, gcd: 'standard', cooldown: 32, cost: 24,
    school: 'scouting',
    flags: { offensive: true },
    effects: [
      { type: 'status', effect: 'utilityLock', duration: 4.0 }
    ],
    desc: 'Durante 4 s el objetivo no puede usar habilidades sin componente de daño: ni defensivos, ni curas, ni utility.',
    tip: 'Es el counter al soporte enemigo. No causa daño: la Intervención lo anula.'
  });

  ab('rastreador_revelar', {
    classId: 'rastreador', name: 'Revelar presas', icon: '👁', key: '6',
    target: 'cone', range: 18, coneAngle: Math.PI / 3, castTime: 0, gcd: 'short',
    cooldown: 20, cost: 14, school: 'scouting',
    flags: {},
    effects: [
      { type: 'reveal', duration: 5 },
      { type: 'status', effect: 'slow', duration: 2, data: { slowPct: 0.15 } }
    ],
    desc: 'Revela enemigos ocultos durante 5 s y los ralentiza un 15 % durante 2 s.',
    tip: 'Sin daño: pasa por Intervención y por Confusión táctica propia.'
  });

  /* =========================================================================
   * ARCANISTA — burst mágico / control / anti-soporte
   * ====================================================================== */

  ab('arcanista_descarga', {
    classId: 'arcanista', name: 'Descarga ígnea', icon: '✦', key: '1',
    target: 'enemy', range: 22, castTime: 1.0, gcd: 'standard', cooldown: 7, cost: 14,
    school: 'arcane', projectileSpeed: 40,
    flags: { magic: true, offensive: true, projectile: true },
    effects: [
      { type: 'magicalDamage', coefficient: 1.70 }
    ],
    desc: 'Daño mágico directo. Tu poder de presión y la prueba básica de casteo.',
    tip: 'Es magia dirigida de objetivo único: la Égida reflectante te la devuelve.'
  });

  ab('arcanista_prision', {
    classId: 'arcanista', name: 'Prisión etérea', icon: '⚓', key: '2',
    target: 'enemy', range: 20, castTime: 0.8, gcd: 'standard', cooldown: 20, cost: 20,
    school: 'arcane',
    flags: { magic: true, offensive: true },
    effects: [
      { type: 'status', effect: 'root', duration: 2.20 }
    ],
    desc: 'Enraizar de 2.2 s sin daño alguno.',
    tip: 'Al no hacer daño, la Intervención la bloquea por completo.'
  });

  ab('arcanista_impacto_celeste', {
    classId: 'arcanista', name: 'Impacto celeste', icon: '☄', key: '3',
    target: 'enemy', range: 24, castTime: 1.7, gcd: 'standard', cooldown: 18, cost: 28,
    school: 'arcane', projectileSpeed: 38,
    flags: { magic: true, offensive: true, projectile: true },
    effects: [
      { type: 'magicalDamage', coefficient: 2.60 },
      { type: 'status', effect: 'silence', duration: 1.30 }
    ],
    desc: 'Daño mágico alto y Mareo de 1.3 s. Casteo largo y muy telegrafiado.',
    tip: '1.7 s quieto: si nadie te cubre, es una invitación a que te interrumpan.'
  });

  ab('arcanista_estasis', {
    classId: 'arcanista', name: 'Estasis glacial', icon: '❄', key: '4',
    target: 'enemy', range: 18, castTime: 1.2, gcd: 'standard', cooldown: 32, cost: 26,
    school: 'arcane',
    // Es la defensiva real del Arcanista: saca de la pelea a quien le presiona.
    flags: { magic: true, offensive: true, defensive: true },
    effects: [
      { type: 'status', effect: 'stasis', duration: 1.80 }
    ],
    desc: 'Aísla al objetivo 1.8 s: no actúa, no puede ser seleccionado y no recibe daño.',
    tip: 'Saca a un enemigo de la pelea sin matarlo. Después queda 8 s inmune a Estasis.'
  });

  ab('arcanista_corrupcion', {
    classId: 'arcanista', name: 'Corrupción vital', icon: '☠', key: '5',
    target: 'enemy', range: 20, castTime: 1.0, gcd: 'standard', cooldown: 24, cost: 22,
    school: 'arcane',
    flags: { magic: true, offensive: true },
    effects: [
      { type: 'dot', coefficient: 1.30, duration: 7, interval: 1.0, school: 'magical' },
      { type: 'status', effect: 'antiHeal', duration: 7, data: { antiHealPct: 0.40 } }
    ],
    desc: 'Daño mágico periódico durante 7 s y reduce un 40 % la curación recibida.',
    tip: 'Prepara el burst del equipo: aplícala antes de comprometer los cooldowns.'
  });

  ab('arcanista_velo_nulo', {
    classId: 'arcanista', name: 'Velo nulo', icon: '⃠', key: '6',
    target: 'enemy', range: 18, castTime: 1.2, gcd: 'standard', cooldown: 34, cost: 28,
    school: 'arcane',
    flags: { magic: true, offensive: true },
    effects: [
      { type: 'status', effect: 'antiBuff', duration: 4.0 }
    ],
    desc: 'Durante 4 s el objetivo no puede recibir buffs, curaciones, barreras ni cleanses. No elimina lo ya activo.',
    tip: 'No purga: aísla. Combínalo con presión, no con más control.'
  });

  /* =========================================================================
   * VINCULADOR — soporte / curación / counters
   * ====================================================================== */

  ab('vinculador_pulso_vital', {
    classId: 'vinculador', name: 'Pulso vital', icon: '✚', key: '1',
    // Sin cooldown a propósito: es la curación de relleno y su único freno debe
    // ser el maná. Con CD de 5 s el Vinculador nunca se quedaba seco y su
    // limitación pasaba a ser un temporizador, no una decisión de recurso.
    target: 'allyOrSelf', range: 18, castTime: 1.0, gcd: 'standard', cooldown: 0, cost: 24,
    school: 'vital',
    flags: { magic: true },
    effects: [
      { type: 'heal', coefficient: 1.70 }
    ],
    desc: 'Curación directa moderada, sin recuperación. No sobrecura por encima del máximo.',
    tip: 'Tu relleno: puedes encadenarla, pero unos ocho lanzamientos te dejan sin maná.'
  });

  ab('vinculador_regeneracion', {
    classId: 'vinculador', name: 'Regeneración vinculada', icon: '❥', key: '2',
    target: 'allyOrSelf', range: 18, castTime: 0.6, gcd: 'short', cooldown: 12, cost: 24,
    school: 'vital',
    flags: { magic: true },
    effects: [
      { type: 'hot', coefficient: 2.20, duration: 8, interval: 1.0 }
    ],
    desc: 'Curación periódica durante 8 s. Reaplicarla refresca la duración.',
    tip: 'Adelántate: puesta antes del burst rinde el doble que puesta después.'
  });

  ab('vinculador_barrera', {
    classId: 'vinculador', name: 'Barrera etérea', icon: '◈', key: '3',
    target: 'allyOrSelf', range: 18, castTime: 0.7, gcd: 'standard', cooldown: 16, cost: 26,
    school: 'vital',
    flags: { magic: true },
    effects: [
      { type: 'barrier', coefficient: 1.90, duration: 8 }
    ],
    desc: 'Barrera que absorbe daño durante 8 s o hasta romperse.',
    tip: 'AntiHeal no la reduce: es tu respuesta cuando el equipo enemigo corta las curas.'
  });

  ab('vinculador_intervencion', {
    classId: 'vinculador', name: 'Intervención', icon: '✦', key: '4',
    target: 'ally', range: 18, castTime: 0.8, gcd: 'standard', cooldown: 38, cost: 28,
    school: 'vital',
    flags: { magic: true },
    effects: [
      { type: 'status', effect: 'intervention', duration: 5 }
    ],
    desc: 'Durante 5 s el aliado ignora las habilidades hostiles que no causan daño.',
    tip: 'Anula root, silencio, antibuff y utility. No para el daño ni el CC que lo acompaña.'
  });

  ab('vinculador_purificacion', {
    classId: 'vinculador', name: 'Purificación', icon: '✧', key: '5',
    target: 'allyOrSelf', range: 16, castTime: 0.6, gcd: 'short', cooldown: 24, cost: 24,
    school: 'vital',
    flags: { magic: true },
    effects: [
      { type: 'cleanse', hard: 1, minor: 3 }
    ],
    desc: 'Elimina 1 control duro o hasta 3 debuffs menores.',
    tip: 'Bajo Velo nulo no funciona: el AntiBuff bloquea también el cleanse.'
  });

  ab('vinculador_enlace', {
    classId: 'vinculador', name: 'Enlace protector', icon: '∞', key: '6',
    target: 'ally', range: 16, castTime: 0, gcd: 'short', cooldown: 28, cost: 24,
    school: 'vital',
    flags: { magic: true, defensive: true },
    effects: [
      { type: 'status', effect: 'protectiveLink', duration: 5,
        data: { reductionPct: 0.25, sharePct: 0.50 } }
    ],
    desc: 'Durante 5 s el aliado recibe un 25 % menos de daño; la mitad de lo evitado lo pagas tú.',
    tip: 'Nunca te mata: el enlace se detiene a 1 punto de vida.'
  });

  Arena.Data.abilities = abilities;

  /** Índice por clase, con el orden de la barra de acción. */
  Arena.Data.abilitiesByClass = (function () {
    var out = {};
    for (var id in abilities) {
      if (!Object.prototype.hasOwnProperty.call(abilities, id)) continue;
      var a = abilities[id];
      if (!out[a.classId]) out[a.classId] = [];
      out[a.classId].push(a);
    }
    return out;
  })();
});
