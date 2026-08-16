/* =============================================================================
 * data/castFamilies.js — De qué VA un hechizo, para que se vea distinto.
 *
 * POR QUÉ ESTE FICHERO ESTÁ EN data/ Y NO EN render/
 *
 * La capa de presentación no puede conocer habilidades. Si `actions.js` tuviera
 * dentro una lista de ids de hechizo, cada habilidad nueva obligaría a tocar el
 * renderer, y el renderer pasaría a saber de reglas de combate. Aquí se traduce
 * una habilidad a una FAMILIA VISUAL —un puñado de categorías estables— y la
 * presentación sólo conoce esas categorías.
 *
 * La familia se DEDUCE de los datos que ya existen (target, flags, efectos,
 * tiempo de casteo). No hay una tabla escrita a mano que haya que mantener en
 * paralelo: una habilidad nueva recibe familia automáticamente, y si la
 * heurística se equivoca se corrige con un override explícito.
 *
 * Estas familias NO afectan a ninguna regla. Son puramente cómo se ve.
 * ========================================================================== */
Arena.define('data/castFamilies', ['data/abilities'], function (Arena) {
  'use strict';

  /* Las siete familias visuales. El nombre describe la INTENCIÓN del gesto, no
     el efecto mecánico: dos hechizos que hacen cosas distintas pueden compartir
     lenguaje corporal si el gesto es el mismo. */
  var FAMILY = {
    PROJECTILE: 'projectile',  // energía concentrada y lanzada al frente
    CONTROL:    'control',     // la mano libre domina, gesto deliberado
    BUFF:       'buff',        // energía recogida hacia uno mismo o un aliado
    HEAL:       'heal',        // pose abierta, palma en alto
    AOE:        'aoe',         // base amplia, el báculo marca el suelo
    CHANNEL:    'channel',     // canalización larga y sostenida
    INSTANT:    'instant'      // gesto corto, sin telegrafía falsa
  };

  /* Por encima de este casteo, el gesto se lee como canalización sostenida
     antes que como cualquier otra cosa: el cuerpo lleva tanto tiempo en tensión
     que ESO es lo que el espectador ve. */
  var CHANNEL_SECONDS = 1.5;

  /* Overrides explícitos. Vacío a propósito: la heurística cubre el catálogo
     actual. Se rellena sólo cuando un hechizo concreto deba verse distinto de
     lo que sus datos sugieren, y con un comentario que diga por qué. */
  var OVERRIDES = {};

  function hasEffect(ability, types) {
    var fx = ability.effects || [];
    for (var i = 0; i < fx.length; i++) {
      if (types.indexOf(fx[i].type) >= 0) return true;
    }
    return false;
  }

  /** ¿Alguno de sus efectos es un estado de control sobre el objetivo? */
  function appliesControl(ability) {
    var fx = ability.effects || [];
    var EFF = Arena.Data.effects;
    for (var i = 0; i < fx.length; i++) {
      if (fx[i].type !== 'status') continue;
      var def = EFF[fx[i].effect];
      if (def && def.kind === 'cc') return true;
    }
    return false;
  }

  /**
   * Familia visual de una habilidad.
   *
   * ORDEN DE PRECEDENCIA — importa, y este es el razonamiento:
   *
   *   1. instantáneo   sin tiempo de casteo no hay nada que telegrafiar, y
   *                    fingir una animación larga es mentirle al que juega
   *                    enfrente sobre cuándo llega el golpe;
   *   2. canalización  un casteo muy largo se lee como canalización aunque
   *                    además sea un proyectil;
   *   3. área          una zona necesita telegrafía de suelo, sea lo que sea;
   *   4. curación      la pose abierta es inconfundible y debe ganar;
   *   5. control       el gesto de la mano libre distingue un CC de un daño;
   *   6. proyectil     energía concentrada y lanzada;
   *   7. buff          resto de lo que va a un aliado o a uno mismo.
   *
   * @param abilityOrId registro de habilidad o su id
   * @returns una de FAMILY. Nunca null: un hechizo sin clasificar es un hechizo
   *          que se vería como ninguno, y eso es peor que clasificarlo mal.
   */
  function castFamilyOf(abilityOrId) {
    var ab = (typeof abilityOrId === 'string')
      ? Arena.Data.abilities[abilityOrId] : abilityOrId;
    if (!ab) return FAMILY.INSTANT;
    if (OVERRIDES[ab.id]) return OVERRIDES[ab.id];

    var castTime = ab.castTime || 0;
    if (castTime <= 0) return FAMILY.INSTANT;
    if (castTime >= CHANNEL_SECONDS) return FAMILY.CHANNEL;

    if (ab.target === 'ground' || ab.target === 'aoeSelf' ||
        ab.radius > 0 || hasEffect(ab, ['zone'])) return FAMILY.AOE;

    if (hasEffect(ab, ['heal', 'hot', 'sourceHeal', 'sourceHot'])) return FAMILY.HEAL;
    if (appliesControl(ab)) return FAMILY.CONTROL;
    if (ab.flags && ab.flags.projectile) return FAMILY.PROJECTILE;

    var friendly = ab.target === 'ally' || ab.target === 'allyOrSelf' ||
                   ab.target === 'self';
    if (friendly || hasEffect(ab, ['barrier', 'cleanse'])) return FAMILY.BUFF;

    // Ofensivo sin proyectil declarado: sigue siendo energía lanzada al frente.
    return FAMILY.PROJECTILE;
  }

  Arena.Data.CAST_FAMILY = FAMILY;
  Arena.Data.castFamilyOf = castFamilyOf;
  Arena.Data.castFamilies = { FAMILY: FAMILY, OVERRIDES: OVERRIDES, CHANNEL_SECONDS: CHANNEL_SECONDS };


  /* ===========================================================================
   * GRAMÁTICA VISUAL DE EFECTOS — el idioma que el rival tiene que leer
   *
   * Las familias de arriba dicen QUÉ GESTO hace el cuerpo. Lo que sigue dice
   * QUÉ SE VE EN EL MUNDO: color, forma, ritmo y tamaño de las partículas.
   *
   * POR QUÉ ESTO TAMBIÉN VIVE EN data/
   *
   * En un MMO PvP el VFX no es decoración: es la única información que el rival
   * tiene a veinte unidades de distancia. Si vive en el renderer, cada habilidad
   * nueva obliga a tocar presentación y acaba en la lista de ids que §15 prohíbe.
   * Aquí una habilidad se traduce a una FIRMA —escuela, papel, magnitud— y la
   * presentación sólo sabe pintar firmas.
   *
   * Las tres preguntas que una firma debe contestar de un vistazo:
   *
   *   ¿DE QUÉ ES?      → escuela   (color)
   *   ¿QUÉ ME HACE?    → papel     (forma y movimiento)
   *   ¿CUÁNTO DUELE?   → magnitud  (tamaño, cantidad, duración)
   *
   * Nada de esto afecta a ninguna regla de combate. Es sólo cómo se ve.
   * ======================================================================== */

  /* --- 1. Escuelas visuales -------------------------------------------------
   * Se derivan de `ability.school`, que ya existe como dato (es la categoría de
   * bloqueo por interrupción). No hay una segunda taxonomía que mantener.
   *
   * REGLA DE COLOR: dos escuelas nunca comparten firma. La distancia mínima
   * entre dos paletas está verificada en tests/vfxTests.js; si alguien añade una
   * escuela demasiado parecida a otra, la prueba lo dice antes que un jugador.
   */
  var SCHOOL = {
    steel: {                                   // acero: daño físico de arma
      id: 'steel',
      core:   [1.00, 0.86, 0.62],
      accent: [0.72, 0.80, 0.95],
      style: 'shard',
      desc: 'Impacto físico: chispa caliente y esquirla fría.'
    },
    ember: {                                   // brasa: furia, ímpetu, tácticas
      id: 'ember',
      core:   [1.00, 0.42, 0.18],
      accent: [1.00, 0.78, 0.30],
      style: 'ember',
      desc: 'Potenciación agresiva del propio cuerpo.'
    },
    ward: {                                    // égida: protección del Guardián
      id: 'ward',
      core:   [0.42, 0.80, 1.00],
      accent: [1.00, 0.84, 0.40],
      style: 'rune',
      desc: 'Defensa activa: escudo, reflejo, interposición.'
    },
    wind: {                                    // viento: evasión y desplazamiento
      id: 'wind',
      core:   [0.80, 0.95, 0.92],
      accent: [0.55, 0.75, 0.80],
      style: 'wisp',
      desc: 'Movimiento: polvo y estela, nunca daño.'
    },
    venom: {                                   // veneno: rastreo, trampas, corrosión
      id: 'venom',
      core:   [0.62, 0.95, 0.30],
      accent: [0.35, 0.65, 0.20],
      style: 'mote',
      desc: 'Control diferido y desgaste.'
    },
    arcane: {                                  // arcano: burst mágico y control
      id: 'arcane',
      core:   [0.72, 0.45, 1.00],
      accent: [0.95, 0.60, 1.00],
      style: 'spark',
      desc: 'Magia dirigida: lo que la resistencia mágica mitiga.'
    },
    vital: {                                   // vital: curación, barreras, enlaces
      id: 'vital',
      core:   [0.35, 1.00, 0.62],
      accent: [0.90, 1.00, 0.60],
      style: 'wisp',
      desc: 'Soporte: lo que hay que cortar antes de comprometer el burst.'
    }
  };

  /* Traducción escuela-de-combate → escuela visual. Es una tabla sobre un campo
     que TODA habilidad ya declara, no sobre ids. Una habilidad nueva de una
     escuela conocida hereda su color sin tocar nada. */
  var SCHOOL_OF_COMBAT_SCHOOL = {
    weapon:   'steel',
    archery:  'steel',
    tactics:  'ember',
    shield:   'ward',
    evasion:  'wind',
    scouting: 'venom',
    arcane:   'arcane',
    vital:    'vital'
  };

  /* --- 2. Papeles visuales --------------------------------------------------
   * El papel decide FORMA y MOVIMIENTO. Un proyectil viaja, un área se marca en
   * el suelo, una curación sube, una maldición cae, un control implosiona.
   */
  var ROLE = {
    AREA:       'area',
    HEAL:       'heal',
    BARRIER:    'barrier',
    PROJECTILE: 'projectile',
    STRIKE:     'strike',
    CONTROL:    'control',
    CURSE:      'curse',
    DISPEL:     'dispel',
    MOBILITY:   'mobility',
    BUFF:       'buff',
    UTILITY:    'utility'
  };

  /* Cómo se mueve cada papel. La física concreta la aplica render/vfx.js: aquí
     sólo se nombra la intención. */
  var ROLE_MOTION = {
    area:       'ground',      // anillo plano, se lee antes de que caiga
    heal:       'rise',        // sube: nadie confunde subir con recibir daño
    barrier:    'shell',       // cáscara alrededor del cuerpo
    projectile: 'forward',     // sale hacia delante, en la dirección del tiro
    strike:     'outward',     // estalla en el punto de impacto
    control:    'implode',     // converge hacia el objetivo: algo se cierra
    curse:      'fall',        // cae y se queda: desgaste
    dispel:     'sweep',       // barrido de fuera adentro
    mobility:   'trail',       // polvo bajo, sin altura
    buff:       'rise',
    utility:    'orbit'
  };

  /* --- 3. Magnitud ----------------------------------------------------------
   * Un normal no puede verse como un burst. La magnitud sale del dato que ya
   * describe cuánto pesa la habilidad: coeficiente, recuperación y casteo.
   */
  var MAX_COEFFICIENT = 2.60;    // Impacto celeste, el techo del catálogo
  var MAX_COOLDOWN    = 42;      // Égida reflectante
  var MAX_CAST        = 3.0;     // Camuflaje

  var TIER = {
    MINOR:    'minor',       // ataque normal, tics periódicos
    STANDARD: 'standard',    // relleno
    MAJOR:    'major',       // poder serio
    ULTIMATE: 'ultimate'     // el botón que decide la pelea
  };

  /* Escalado por nivel. Es UNA tabla, no treinta números sueltos por habilidad. */
  var TIER_SCALE = {
    minor:    { count: 5,  size: 0.055, life: 0.30, speed: 1.9, telegraph: 0.55 },
    standard: { count: 11, size: 0.090, life: 0.46, speed: 3.2, telegraph: 0.85 },
    major:    { count: 18, size: 0.125, life: 0.62, speed: 4.4, telegraph: 1.15 },
    ultimate: { count: 28, size: 0.165, life: 0.82, speed: 5.6, telegraph: 1.55 }
  };

  function tierOf(magnitude) {
    if (magnitude < 0.24) return TIER.MINOR;
    if (magnitude < 0.50) return TIER.STANDARD;
    if (magnitude < 0.74) return TIER.MAJOR;
    return TIER.ULTIMATE;
  }

  /** Mayor coeficiente de daño/curación del payload, ramas condicionales incluidas. */
  function peakCoefficient(list) {
    var best = 0;
    for (var i = 0; list && i < list.length; i++) {
      var fx = list[i];
      if (fx.coefficient > best) best = fx.coefficient;
      if (fx.then) best = Math.max(best, peakCoefficient(fx.then));
      if (fx.otherwise) best = Math.max(best, peakCoefficient(fx.otherwise));
      if (fx.onTrigger) best = Math.max(best, peakCoefficient(fx.onTrigger));
    }
    return best;
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /**
   * Peso visual de una habilidad, en [0,1].
   *
   * Las tres señales son las que un jugador ya usa para decidir si algo merece
   * respeto: cuánto pega, cuánto tarda en volver y cuánto hay que quedarse
   * quieto para lanzarlo.
   */
  function magnitudeOf(abilityOrId) {
    var ab = resolveAbility(abilityOrId);
    if (!ab) return 0.2;
    var coef = clamp01(peakCoefficient(ab.effects) / MAX_COEFFICIENT);
    var cd   = clamp01((ab.cooldown || 0) / MAX_COOLDOWN);
    var cast = clamp01((ab.castTime || 0) / MAX_CAST);
    return clamp01(0.50 * coef + 0.32 * cd + 0.18 * cast);
  }

  /* --- 4. Marcas de control -------------------------------------------------
   * Un control duro es la información más cara de la pelea: decide si hay que
   * gastar el cleanse, entrar o huir. Cada uno lleva marca propia, y la
   * diferencia es ESTRUCTURAL —color, forma y movimiento a la vez— para que
   * siga siendo legible de lejos y para quien no distinga bien los colores.
   *
   * La tabla va por id de ESTADO, no por id de habilidad: los estados son un
   * vocabulario cerrado y estable (data/effects.js), las habilidades no. Un
   * estado nuevo sin marca cae en la derivación por categoría de DR de abajo,
   * que existe para que nunca se quede mudo.
   */
  var CONTROL_MARK = {
    knockdown: {
      effect: 'knockdown', shape: 'slam', motion: 'ground', color: [1.00, 0.30, 0.22],
      height: 0.10, spread: 1.30, desc: 'Impacto contra el suelo: onda baja y ancha.'
    },
    stun: {
      effect: 'stun', shape: 'orbit', motion: 'halo', color: [1.00, 0.80, 0.25],
      height: 1.75, spread: 0.42, desc: 'Aturdido de pie: chispas girando sobre la cabeza.'
    },
    silence: {
      effect: 'silence', shape: 'seal', motion: 'front', color: [0.95, 0.35, 0.85],
      height: 1.35, spread: 0.34, desc: 'Sello delante del pecho: la magia no sale.'
    },
    root: {
      effect: 'root', shape: 'spike', motion: 'rise', color: [0.55, 0.85, 0.30],
      height: 0.05, spread: 0.62, desc: 'Púas desde el suelo: los pies, no el cuerpo.'
    },
    disarm: {
      effect: 'disarm', shape: 'shard', motion: 'fall', color: [0.80, 0.72, 0.62],
      height: 1.05, spread: 0.45, desc: 'El arma cae: metal que se desprende.'
    },
    stasis: {
      effect: 'stasis', shape: 'crystal', motion: 'freeze', color: [0.42, 0.86, 1.00],
      height: 0.95, spread: 0.55, desc: 'Cristal quieto: ni actúa ni puede ser tocado.'
    },
    utilityLock: {
      effect: 'utilityLock', shape: 'glyph', motion: 'orbitLow', color: [0.42, 0.45, 0.95],
      height: 0.75, spread: 0.50, desc: 'Glifos bajos: los botones que no hacen daño están cerrados.'
    }
  };

  /* Red de seguridad por categoría de DR: un control nuevo sin marca propia
     sigue teniendo una lectura, aunque genérica. `derived: true` lo delata para
     que la prueba correspondiente obligue a darle marca antes de enviarlo. */
  var MARK_BY_DR = {
    hardDisable: { shape: 'orbit',  motion: 'halo',  color: [1.00, 0.55, 0.25], height: 1.70, spread: 0.45 },
    silence:     { shape: 'seal',   motion: 'front', color: [0.92, 0.40, 0.80], height: 1.35, spread: 0.34 },
    root:        { shape: 'spike',  motion: 'rise',  color: [0.58, 0.82, 0.34], height: 0.05, spread: 0.60 },
    disarm:      { shape: 'shard',  motion: 'fall',  color: [0.78, 0.74, 0.64], height: 1.05, spread: 0.45 },
    stasis:      { shape: 'crystal',motion: 'freeze',color: [0.45, 0.85, 1.00], height: 0.95, spread: 0.55 },
    utilityLock: { shape: 'glyph',  motion: 'orbitLow', color: [0.45, 0.48, 0.92], height: 0.75, spread: 0.50 }
  };

  var GENERIC_MARK = {
    shape: 'glyph', motion: 'halo', color: [0.95, 0.55, 0.45],
    height: 1.40, spread: 0.45, derived: true, generic: true
  };

  /**
   * Marca visual de un estado de control.
   * @returns siempre un objeto. `generic:true` significa "esto no se declaró".
   */
  function controlMarkOf(effectId) {
    var mark = CONTROL_MARK[effectId];
    if (mark) return mark;
    var def = Arena.Data.effects[effectId];
    var byDr = def && def.drCategory ? MARK_BY_DR[def.drCategory] : null;
    if (byDr) {
      var derived = { effect: effectId, derived: true };
      for (var k in byDr) if (has(byDr, k)) derived[k] = byDr[k];
      return derived;
    }
    return GENERIC_MARK;
  }

  /* --- 5. Firma completa ----------------------------------------------------- */

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function resolveAbility(abilityOrId) {
    if (!abilityOrId) return null;
    return (typeof abilityOrId === 'string')
      ? (Arena.Data.abilities[abilityOrId] || null) : abilityOrId;
  }

  function effectTypes(ability, types) {
    var fx = ability.effects || [];
    for (var i = 0; i < fx.length; i++) if (types.indexOf(fx[i].type) >= 0) return true;
    return false;
  }

  function selfEffectTypes(ability, types) {
    var fx = ability.selfEffects || [];
    for (var i = 0; i < fx.length; i++) if (types.indexOf(fx[i].type) >= 0) return true;
    return false;
  }

  function hasDirectDamage(ability) {
    return effectTypes(ability, ['physicalDamage', 'magicalDamage', 'pureDamage', 'sourceDamage', 'sourceWeaponDamage', 'sourceDrain', 'manaBurn']) ||
      (function () {
        var fx = ability.effects || [];
        for (var i = 0; i < fx.length; i++) {
          if (fx[i].type !== 'conditional') continue;
          var branches = (fx[i].then || []).concat(fx[i].otherwise || []);
          for (var j = 0; j < branches.length; j++) {
            var t = branches[j].type;
            if (t === 'physicalDamage' || t === 'magicalDamage' || t === 'pureDamage') return true;
          }
        }
        return false;
      })();
  }

  function isFriendly(ability) {
    return ability.target === 'self' || ability.target === 'ally' ||
           ability.target === 'allyOrSelf';
  }

  function groundShaped(ability) {
    return ability.target === 'ground' || ability.target === 'aoeSelf' ||
           ability.target === 'cone' || ability.radius > 0 ||
           effectTypes(ability, ['zone']);
  }

  /** ¿Aplica algún estado hostil que no sea control duro? */
  function appliesHostileStatus(ability) {
    var fx = ability.effects || [];
    var EFF = Arena.Data.effects;
    for (var i = 0; i < fx.length; i++) {
      if (fx[i].type !== 'status') continue;
      var def = EFF[fx[i].effect];
      if (def && def.kind === 'debuff') return true;
    }
    return false;
  }

  /**
   * Papel visual de una habilidad.
   *
   * ORDEN DE PRECEDENCIA — el razonamiento es siempre el mismo: gana lo que el
   * rival necesita leer ANTES para reaccionar a tiempo.
   *
   *   1. área        hay que verla en el suelo antes de que caiga;
   *   2. curación    la lectura que decide si el burst llega o no;
   *   3. barrera     idem, y no se parece a una cura;
   *   4. proyectil   viaja: la trayectoria es información en sí misma;
   *   5. golpe       daño directo, aquí y ahora;
   *   6. control     sin daño: lo único que hace es cerrarte;
   *   7. maldición   desgaste sin impacto;
   *   8. disipar     quitar algo de alguien;
   *   9. movilidad   desplazamiento sin daño;
   *  10. mejora      va a un aliado o a uno mismo;
   *  11. utilidad    declarado explícitamente (revelar, información).
   */
  function roleOf(abilityOrId) {
    var ab = resolveAbility(abilityOrId);
    if (!ab) return ROLE.STRIKE;
    if (groundShaped(ab)) return ROLE.AREA;
    if (effectTypes(ab, ['heal', 'hot', 'sourceHeal', 'sourceHot'])) return ROLE.HEAL;
    if (effectTypes(ab, ['barrier'])) return ROLE.BARRIER;
    if (ab.flags && ab.flags.projectile) return ROLE.PROJECTILE;
    /* Un execute sin payload de daño explícito sigue siendo una amenaza de
       remate: visualmente debe leerse como golpe decisivo, no caer al genérico. */
    if (effectTypes(ab, ['execute'])) return ROLE.STRIKE;
    if (hasDirectDamage(ab)) return ROLE.STRIKE;
    if (appliesControl(ab)) return ROLE.CONTROL;
    if (!isFriendly(ab) && (effectTypes(ab, ['dot', 'sourceDot', 'sourceDrainDot', 'sourceManaDrain', 'sourceManaDrainDot', 'drainResource']) || appliesHostileStatus(ab))) return ROLE.CURSE;
    if (effectTypes(ab, ['cleanse', 'purge'])) return ROLE.DISPEL;
    if (effectTypes(ab, ['dash'])) return ROLE.MOBILITY;
    /* Tomar control de una invocación enemiga no es un buff amistoso ni un
       golpe. Se lee como control táctico aunque no use la categoría de DR de
       un CC corporal. Esto evita que una mecánica completa caiga al fallback
       visual y le da una silueta de VFX coherente con su función. */
    if (effectTypes(ab, ['possessCompanion'])) return ROLE.CONTROL;
    /* Cremar/sellar un cadáver cambia el estado táctico de una baja: impide
       futuras resurrecciones. No es un hit ni un CC corporal, pero sí una
       utilidad hostil que necesita lectura propia y nunca debe caer al fallback. */
    if (effectTypes(ab, ['cremate'])) return ROLE.UTILITY;
    if (effectTypes(ab, ['companionEffect', 'companionProtectOwner', 'companionAoE', 'summon', 'companionRevive', 'tameCreature']) || selfEffectTypes(ab, ['companionEffect', 'companionProtectOwner', 'companionAoE', 'summon', 'companionRevive', 'tameCreature'])) return ROLE.BUFF;
    if (isFriendly(ab)) return ROLE.BUFF;
    if (effectTypes(ab, ['reveal'])) return ROLE.UTILITY;
    return null;                                  // sin clasificar: lo dirá la firma
  }

  /** Escuela visual de una habilidad. `null` si su escuela de combate no se mapeó. */
  function schoolOf(abilityOrId) {
    var ab = resolveAbility(abilityOrId);
    if (!ab) return null;
    var mapped = SCHOOL_OF_COMBAT_SCHOOL[ab.school];
    if (mapped) return mapped;
    // Segunda derivación antes de rendirse: la magia se ve como magia.
    if (ab.flags && ab.flags.magic) return 'arcane';
    return null;
  }

  /* Escuela visual del ataque normal, por escuela de daño del arma. El normal
     no está en el catálogo de habilidades y aun así necesita firma. */
  var NORMAL_SCHOOL = { physical: 'steel', magical: 'arcane' };

  /* Firma de reserva, DECLARADA. Existe para que nada salga mudo, y `fallback`
     la delata: tests/vfxTests.js exige que ninguna habilidad del catálogo la
     use. Un hueco silencioso es peor que un hueco ruidoso. */
  var FALLBACK = { school: 'steel', role: ROLE.STRIKE };

  var _cache = Object.create(null);

  /**
   * Firma visual completa de una habilidad.
   *
   * Se memoiza: el combate pide firmas por evento y §14 prohíbe construir
   * objetos en caminos calientes. La firma devuelta es COMPARTIDA — quien la
   * reciba la lee, nunca la modifica.
   */
  function vfxFamilyOf(abilityOrId) {
    var ab = resolveAbility(abilityOrId);
    var key = ab ? ab.id : ('#none:' + String(abilityOrId));
    var hit = _cache[key];
    if (hit) return hit;

    var school = schoolOf(ab);
    var role = roleOf(ab);
    var source = 'derived';
    if (!school) { school = FALLBACK.school; source = 'fallback'; }
    if (!role) { role = FALLBACK.role; source = 'fallback'; }

    var sig = buildSignature({
      school: school, role: role, magnitude: ab ? magnitudeOf(ab) : 0.2,
      source: source, abilityId: ab ? ab.id : null,
      castTime: ab ? (ab.castTime || 0) : 0,
      radius: ab ? (ab.radius || 0) : 0
    });
    _cache[key] = sig;
    return sig;
  }

  /* Umbral de telegrafía: por debajo de esto no hay nada que anunciar y fingir
     un aviso mentiría al rival sobre cuándo llega el golpe (§4.7). */
  var TELEGRAPH_MIN_CAST = 0.35;

  function buildSignature(o) {
    var pal = SCHOOL[o.school];
    var scale = TIER_SCALE[tierOf(o.magnitude)];
    var motion = ROLE_MOTION[o.role];
    var mag = o.magnitude;

    return {
      id: o.school + '.' + o.role,
      abilityId: o.abilityId || null,
      school: o.school,
      role: o.role,
      motion: motion,
      magnitude: mag,
      tier: tierOf(mag),
      core: pal.core,
      accent: pal.accent,
      style: pal.style,
      count: scale.count,
      size: scale.size,
      life: scale.life,
      speed: scale.speed,
      /* Telegrafía: radio y ritmo salen de la magnitud, así que un ultimate se
         ve desde la otra punta de la arena y un relleno no ensucia la pantalla.
         El radio ENCOGE con el progreso del casteo: ver el anillo cerrarse es
         lo que dice cuánto falta sin leer una barra. */
      telegraph: {
        enabled: o.castTime >= TELEGRAPH_MIN_CAST,
        castTime: o.castTime,
        radius: 0.85 + scale.telegraph * (0.55 + mag),
        rate: 6 + Math.round(14 * mag),
        ground: o.role === ROLE.AREA,
        groundRadius: o.radius || 0,
        color: pal.core,
        accent: pal.accent
      },
      source: o.source
    };
  }

  /** Firma del ataque normal. El escalón más bajo de la jerarquía, siempre. */
  function normalAttackFamily(damageSchool) {
    var school = NORMAL_SCHOOL[damageSchool] || NORMAL_SCHOOL.physical;
    var key = '#normal:' + school;
    if (_cache[key]) return _cache[key];
    var sig = buildSignature({
      school: school, role: ROLE.STRIKE, magnitude: 0.10,
      source: 'normal', abilityId: 'auto_attack', castTime: 0, radius: 0
    });
    _cache[key] = sig;
    return sig;
  }

  /**
   * Firma de un impacto que no viene de una habilidad del catálogo (daño de
   * laboratorio, escenario, reflejo sin id). Declarada, no accidental.
   */
  function impactFamily(damageSchool, magnitude) {
    var school = NORMAL_SCHOOL[damageSchool] || NORMAL_SCHOOL.physical;
    var mag = magnitude === undefined ? 0.35 : clamp01(magnitude);
    var key = '#impact:' + school + ':' + tierOf(mag);
    if (_cache[key]) return _cache[key];
    var sig = buildSignature({
      school: school, role: ROLE.STRIKE, magnitude: mag,
      source: 'impact', abilityId: null, castTime: 0, radius: 0
    });
    _cache[key] = sig;
    return sig;
  }

  /* --- 6. Crítico -----------------------------------------------------------
   * Un crítico no es "lo mismo pero más": cambia de forma. Blanco al rojo vivo,
   * esquirlas en vez de chispas y un empujón de tamaño y duración. Si sólo
   * subiera la cantidad, nadie lo distinguiría de un golpe grande normal.
   */
  var CRIT = {
    core:   [1.00, 0.97, 0.86],
    accent: [1.00, 0.62, 0.30],
    style:  'shard',
    countMult: 1.9,
    sizeMult:  1.45,
    lifeMult:  1.35,
    speedMult: 1.30
  };

  Arena.Data.VFX = {
    SCHOOL: SCHOOL,
    SCHOOL_OF_COMBAT_SCHOOL: SCHOOL_OF_COMBAT_SCHOOL,
    ROLE: ROLE,
    ROLE_MOTION: ROLE_MOTION,
    TIER: TIER,
    TIER_SCALE: TIER_SCALE,
    CONTROL_MARK: CONTROL_MARK,
    MARK_BY_DR: MARK_BY_DR,
    CRIT: CRIT,
    TELEGRAPH_MIN_CAST: TELEGRAPH_MIN_CAST,

    familyOf: vfxFamilyOf,
    schoolOf: schoolOf,
    roleOf: roleOf,
    magnitudeOf: magnitudeOf,
    tierOf: tierOf,
    controlMarkOf: controlMarkOf,
    normalAttackFamily: normalAttackFamily,
    impactFamily: impactFamily,

    /** Distancia euclídea entre dos colores lineales. La usan las pruebas de
     *  legibilidad para exigir que dos escuelas nunca se confundan. */
    colorDistance: function (a, b) {
      var dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }
  };

  Arena.Data.vfxFamilyOf = vfxFamilyOf;
});
