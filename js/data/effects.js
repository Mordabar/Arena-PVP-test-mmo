/* =============================================================================
 * data/effects.js — Catálogo declarativo de estados (buffs / debuffs / CC).
 *
 * Un estado NO contiene lógica: declara qué impide, cómo se disipa, en qué
 * categoría de DR cae y por qué canales modifica las estadísticas. La lógica
 * vive una sola vez en combat/statusSystem.js y combat/resolver.js.
 *
 * Contrato de campos:
 *  kind ........... 'cc' | 'debuff' | 'buff'   (define si Cleanse o Purga lo tocan)
 *  drCategory ..... clave de Arena.Data.balance.DR.categories, o null
 *  prevents ....... { move, ability, weaponAttack, offensive }
 *  interruptsCast . corta el cast en curso al aplicarse
 *  isolate ........ Estasis: ni seleccionable, ni dañable, ni actuante
 *  dispel ......... { cleanse: 'hard'|'minor'|null, purge: bool }
 *  channels ....... canales de modificador que la instancia rellena en `data`
 *  stackRule ...... 'refresh' | 'strongest' | 'stack' | 'independent'
 * ========================================================================== */
Arena.define('data/effects', ['data/balance'], function (Arena) {
  'use strict';

  var defs = {};

  function def(id, o) {
    o.id = id;
    o.kind = o.kind || 'debuff';
    o.prevents = o.prevents || {};
    o.dispel = o.dispel || { cleanse: null, purge: false };
    o.stackRule = o.stackRule || 'refresh';
    o.channels = o.channels || [];
    defs[id] = o;
    return o;
  }

  /* =========================================================================
   * 1. HARD CROWD CONTROL
   * ====================================================================== */

  def('knockdown', {
    name: 'Noqueo',
    kind: 'cc',
    drCategory: 'hardDisable',
    prevents: { move: true, ability: true, weaponAttack: true },
    interruptsCast: true,
    dispel: { cleanse: 'hard', purge: false },
    icon: '⬇',
    color: '#ff5a4d',
    desc: 'Derribado: no puede moverse, atacar ni lanzar poderes.'
  });

  def('stun', {
    name: 'Aturdimiento',
    kind: 'cc',
    drCategory: 'hardDisable',
    prevents: { move: true, ability: true, weaponAttack: true },
    interruptsCast: true,
    dispel: { cleanse: 'hard', purge: false },
    icon: '✷',
    color: '#ff7a4d',
    desc: 'Aturdido: no puede moverse, atacar ni lanzar poderes.'
  });

  def('silence', {
    name: 'Mareo',
    kind: 'cc',
    drCategory: 'silence',
    prevents: { ability: true },
    interruptsCast: true,
    dispel: { cleanse: 'hard', purge: false },
    icon: '🚫',
    color: '#c46bff',
    desc: 'No puede lanzar habilidades. Sí puede moverse y usar ataque normal.'
  });

  def('root', {
    name: 'Enraizado',
    kind: 'cc',
    drCategory: 'root',
    prevents: { move: true },
    interruptsCast: false,
    dispel: { cleanse: 'hard', purge: false },
    icon: '⚓',
    color: '#8fbf5a',
    desc: 'No puede moverse. Sí puede atacar y castear si el objetivo está en rango.'
  });

  def('disarm', {
    name: 'Desarmado',
    kind: 'cc',
    drCategory: 'disarm',
    prevents: { weaponAttack: true },
    interruptsCast: false,
    dispel: { cleanse: 'hard', purge: false },
    icon: '⚔',
    color: '#d4a04d',
    desc: 'No puede usar ataque normal ni habilidades de arma.'
  });

  def('stasis', {
    name: 'Estasis',
    kind: 'cc',
    drCategory: 'stasis',
    prevents: { move: true, ability: true, weaponAttack: true },
    interruptsCast: true,
    isolate: true,
    // Aislar es simétrico: el objetivo no actúa, pero tampoco puede ser tocado.
    // Por eso NO es disipable: quitarlo sería un regalo, no un rescate.
    dispel: { cleanse: null, purge: false },
    icon: '❄',
    color: '#7fe3ff',
    desc: 'Aislado: no actúa, no puede ser seleccionado y no recibe daño.'
  });

  def('utilityLock', {
    name: 'Confusión táctica',
    kind: 'cc',
    drCategory: 'utilityLock',
    prevents: { nonDamaging: true },
    interruptsCast: false,
    dispel: { cleanse: 'hard', purge: false },
    icon: '⊘',
    color: '#b06bd6',
    desc: 'No puede usar habilidades que no causen daño (utility y defensivos).'
  });

  /* =========================================================================
   * 2. DEBUFFS
   * ====================================================================== */

  def('slow', {
    name: 'Ralentizado',
    kind: 'debuff',
    drCategory: null,               // §11: el slow no tiene DR, sólo cap global
    stackRule: 'strongest',         // §7: se usa el más fuerte, no se suman
    channels: ['slowPct'],
    dispel: { cleanse: 'minor', purge: false },
    icon: '🐌',
    color: '#6fa8dc',
    desc: 'Velocidad de movimiento reducida.'
  });

  def('armorBreak', {
    name: 'Armadura rota',
    kind: 'debuff',
    channels: ['armorReductionPct'],
    stackRule: 'refresh',
    dispel: { cleanse: 'minor', purge: false },
    icon: '🛡',
    color: '#e08b5a',
    desc: 'Armadura física reducida.'
  });

  def('resistBreak', {
    name: 'Resistencia rota',
    kind: 'debuff',
    channels: ['resistReductionPct'],
    stackRule: 'refresh',
    dispel: { cleanse: 'minor', purge: false },
    icon: '✧',
    color: '#a98be0',
    desc: 'Resistencia mágica reducida.'
  });

  def('antiHeal', {
    name: 'Heridas abiertas',
    kind: 'debuff',
    channels: ['antiHealPct'],
    stackRule: 'strongest',
    dispel: { cleanse: 'minor', purge: false },
    icon: '✚',
    color: '#d1495b',
    desc: 'Curación recibida reducida. No afecta a las barreras.'
  });

  def('antiBuff', {
    name: 'Velo nulo',
    kind: 'debuff',
    drCategory: 'utilityLock',
    blocksIncomingPositive: true,
    // Decisión de diseño (documento §30): AntiBuff bloquea también el Cleanse
    // entrante. Si no lo hiciera, un soporte lo anularía al instante y el poder
    // dejaría de ser una ventana real de presión sobre el equipo enemigo.
    // A cambio no es disipable, no se apila y dura poco.
    dispel: { cleanse: null, purge: false },
    icon: '⃠',
    color: '#7d5ba6',
    desc: 'Bloquea nuevos buffs, curaciones, barreras y cleanses. No elimina lo ya activo.'
  });

  def('dot', {
    name: 'Daño periódico',
    kind: 'debuff',
    stackRule: 'independent',       // varios DoT de distinta fuente coexisten
    periodic: true,
    dispel: { cleanse: 'minor', purge: false },
    icon: '☠',
    color: '#8bc34a',
    desc: 'Sufre daño cada intervalo.'
  });

  def('revealed', {
    name: 'Revelado',
    kind: 'debuff',
    dispel: { cleanse: null, purge: false },
    icon: '👁',
    color: '#ffd166',
    desc: 'No puede entrar en sigilo y es visible para todos.'
  });

  def('exposed', {
    name: 'Expuesto',
    kind: 'debuff',
    channels: ['damageTakenPct'],
    stackRule: 'refresh',
    // Autoinfligido por Furia desatada: quitarlo con un cleanse aliado sería
    // borrar el coste del buff. La contrapartida se paga entera.
    dispel: { cleanse: null, purge: false },
    icon: '◎',
    color: '#ff8a5c',
    desc: 'Recibe más daño.'
  });

  /* =========================================================================
   * 3. BUFFS
   * ====================================================================== */

  def('barrier', {
    name: 'Barrera',
    kind: 'buff',
    stackRule: 'strongest',         // §7: barreras iguales no se suman
    absorb: true,
    dispel: { cleanse: null, purge: true },
    icon: '◈',
    color: '#7ad7f0',
    desc: 'Absorbe daño ya mitigado antes de tocar la vida.'
  });

  def('hot', {
    name: 'Regeneración',
    kind: 'buff',
    periodic: true,
    stackRule: 'refresh',
    dispel: { cleanse: null, purge: true },
    icon: '❥',
    color: '#5ad18f',
    desc: 'Recupera vida cada intervalo.'
  });

  def('damageAmp', {
    name: 'Furia',
    kind: 'buff',
    channels: ['damageDealtPct', 'attackSpeedPct'],
    dispel: { cleanse: null, purge: true },
    purgePriority: 90,
    icon: '⚡',
    color: '#ff6b4a',
    desc: 'Aumenta el daño infligido y la velocidad de ataque.'
  });

  def('damageReduction', {
    name: 'Fortificado',
    kind: 'buff',
    channels: ['damageTakenPct'],
    dispel: { cleanse: null, purge: true },
    purgePriority: 85,
    icon: '🛡',
    color: '#8fd6ff',
    desc: 'Reduce el daño recibido.'
  });

  def('block', {
    name: 'Guardia absoluta',
    kind: 'buff',
    channels: ['slowPct'],
    blocksDirectHits: true,
    prevents: { offensive: true },
    dispel: { cleanse: null, purge: false },   // un counter activo no se purga
    purgePriority: 0,
    icon: '⛨',
    color: '#ffd166',
    desc: 'Bloquea impactos directos. No puede usar poderes ofensivos y se mueve más lento.'
  });

  def('reflect', {
    name: 'Égida reflectante',
    kind: 'buff',
    charges: 1,
    reflectsMagic: true,
    dispel: { cleanse: null, purge: false },
    purgePriority: 0,
    icon: '↩',
    color: '#c9a0ff',
    desc: 'Refleja el próximo hechizo mágico dirigido de objetivo único.'
  });

  def('intervention', {
    name: 'Intervención',
    kind: 'buff',
    ignoresNonDamaging: true,
    dispel: { cleanse: null, purge: false },
    purgePriority: 0,
    icon: '✦',
    color: '#ffe066',
    desc: 'Ignora las habilidades hostiles que no causan daño.'
  });

  def('stealth', {
    name: 'Camuflaje',
    kind: 'buff',
    stealth: true,
    channels: ['slowPct'],
    dispel: { cleanse: null, purge: true },
    purgePriority: 70,
    icon: '◐',
    color: '#9aa5b1',
    desc: 'Invisible para los enemigos. Atacar, castear o recibir daño lo rompe.'
  });

  def('damageRedirect', {
    name: 'Interponer',
    kind: 'buff',
    redirect: true,
    dispel: { cleanse: null, purge: true },
    purgePriority: 60,
    icon: '⇄',
    color: '#ffb26b',
    desc: 'Parte del daño recibido se desvía al protector.'
  });

  def('protectiveLink', {
    name: 'Enlace protector',
    kind: 'buff',
    channels: ['damageTakenPct'],
    linkShare: true,
    dispel: { cleanse: null, purge: true },
    purgePriority: 65,
    icon: '∞',
    color: '#8ce0c0',
    desc: 'Reduce el daño recibido; parte de lo mitigado lo paga el vinculador.'
  });

  def('slowImmunity', {
    name: 'Paso libre',
    kind: 'buff',
    immuneTo: ['slow'],
    dispel: { cleanse: null, purge: false },
    icon: '»',
    color: '#a0e7a0',
    desc: 'Inmune a ralentizaciones.'
  });

  def('haste', {
    name: 'Impulso',
    kind: 'buff',
    channels: ['moveSpeedPct'],
    dispel: { cleanse: null, purge: true },
    purgePriority: 50,
    icon: '➤',
    color: '#a0e7ff',
    desc: 'Aumenta la velocidad de movimiento.'
  });

  def('castHaste', {
    name: 'Resonancia',
    kind: 'buff',
    channels: ['castSpeedPct'],
    consumedOnCast: true,
    dispel: { cleanse: null, purge: true },
    purgePriority: 55,
    icon: '◉',
    color: '#b0c4ff',
    desc: 'Reduce el tiempo del próximo casteo.'
  });

  def('empowered', {
    name: 'Ímpetu cargado',
    kind: 'buff',
    channels: ['resourceCostPct'],
    consumedOnCast: true,
    dispel: { cleanse: null, purge: true },
    purgePriority: 45,
    icon: '✹',
    color: '#ffbe55',
    desc: 'La próxima habilidad ofensiva cuesta menos recurso.'
  });

  def('bastion', {
    name: 'Bastión',
    kind: 'buff',
    channels: ['damageTakenPct'],
    passiveAura: true,
    dispel: { cleanse: null, purge: false },  // pasiva de clase: no purgable
    icon: '⌂',
    color: '#9fd3ff',
    desc: 'Reducción de daño por estar cerca de un aliado.'
  });

  def('sharpshooter', {
    name: 'Distancia ideal',
    kind: 'buff',
    channels: ['damageDealtPct'],
    passiveAura: true,
    dispel: { cleanse: null, purge: false },
    icon: '◎',
    color: '#ffe0a0',
    desc: 'Más daño contra objetivos lejanos.'
  });

  def('noOffense', {
    name: 'Postura inexpugnable',
    kind: 'buff',
    channels: ['damageTakenPct'],
    prevents: { damageAbilities: true },
    dispel: { cleanse: null, purge: false },
    icon: '⬢',
    color: '#b8c7d9',
    desc: 'Gran reducción de daño, pero no puede lanzar habilidades dañinas.'
  });

  /* =========================================================================
   * Consultas de ayuda
   * ====================================================================== */

  Arena.Data.effects = defs;

  Arena.Data.getEffectDef = function (id) {
    var d = defs[id];
    if (!d) throw new Error('Efecto desconocido: "' + id + '"');
    return d;
  };

  /** Todo estado que un Cleanse "de CC duro" puede quitar. */
  Arena.Data.hardCCEffects = Object.keys(defs).filter(function (k) {
    return defs[k].dispel.cleanse === 'hard';
  });
});
