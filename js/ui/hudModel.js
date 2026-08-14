/* =============================================================================
 * ui/hudModel.js — Modelo de lectura del HUD, del lobby y de los resultados.
 *
 * TODO lo que hay aquí es una FUNCIÓN PURA sobre datos ya decididos por la
 * simulación. No hay DOM, no hay estado mutable compartido, no hay Math.random
 * y no se escribe ni un campo de ninguna entidad.
 *
 * Existe por dos razones:
 *
 *  1. El HUD es un espejo (CLAUDE.md §3). Separar "qué hay que contar" de "cómo
 *     se pinta" hace imposible que una decisión de combate se cuele en el DOM:
 *     este fichero no tiene forma de tocar el mundo aunque quisiera.
 *
 *  2. El runner de pruebas corre en Node SIN DOM. Toda la lógica interpretable
 *     por el jugador —cuánto queda de un debuff, por qué no salió la habilidad,
 *     qué relación tiene un poder con el ataque normal, cómo se cuenta la
 *     partida— es comprobable aquí sin abrir un navegador.
 *
 * Regla de contenido: NADA de `if (ability.id === '...')`. Todo se deriva de la
 * metadata declarada en data/abilities.js y data/effects.js.
 * ========================================================================== */
Arena.define('ui/hudModel', ['data/effects', 'data/abilities'], function (Arena) {
  'use strict';

  var M = {};
  var EFF = Arena.Data.effects;

  /* =========================================================================
   * 1. Formato de números y tiempos
   *
   * Un número que cambia sesenta veces por segundo sólo se lee si su ANCHURA
   * es estable. Por eso el corte por tramos: enteros arriba, un decimal en la
   * zona donde un decimal decide (los últimos segundos de un CC).
   * ====================================================================== */

  M.clamp01 = function (v) {
    v = Number(v);
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  };

  /** Porcentaje 0..100 listo para un `width`. Nunca NaN, nunca fuera de rango. */
  M.barPercent = function (value, max) {
    max = Number(max);
    if (!isFinite(max) || max <= 0) return 0;
    return M.clamp01(Number(value) / max) * 100;
  };

  /** Reparto de una barra dividida (vida + barrera) sin que la suma pase de 100. */
  M.splitBar = function (value, shield, max) {
    var base = M.barPercent(value, max);
    var extra = M.barPercent(shield, max);
    if (base + extra > 100) extra = Math.max(0, 100 - base);
    return { value: base, shield: extra, offset: base };
  };

  /**
   * Tiempo restante de un estado / cooldown.
   *   ≥ 60 s → "2m"      (nadie cuenta 118)
   *   ≥ 10 s → "12"
   *   ≥ 0.1  → "3.4"
   *   ≤ 0    → ""
   *   sin duración → "∞"
   */
  M.fmtDuration = function (seconds, permanent) {
    if (permanent) return '∞';
    seconds = Number(seconds);
    if (!isFinite(seconds) || seconds <= 0.049) return '';
    if (seconds >= 60) return Math.round(seconds / 60) + 'm';
    if (seconds >= 10) return String(Math.ceil(seconds));
    return seconds.toFixed(1);
  };

  /** Reloj de partida. */
  M.fmtClock = function (seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  /** Números grandes de resultados: 12480 → "12.5k". */
  M.fmtCompact = function (n) {
    n = Number(n);
    if (!isFinite(n)) return '0';
    var sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    if (n >= 10000) return sign + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return sign + String(Math.round(n));
  };

  M.fmtSigned = function (n) {
    n = Math.round(Number(n) || 0);
    return (n > 0 ? '+' : '') + n;
  };

  /** Segundos de control acumulados: "4.5 s". */
  M.fmtSeconds = function (n) {
    n = Number(n) || 0;
    return (n >= 10 ? Math.round(n) : n.toFixed(1)) + ' s';
  };

  M.resourceName = function (type) {
    var r = Arena.Data.balance && Arena.Data.balance.RESOURCE
      ? Arena.Data.balance.RESOURCE[type] : null;
    return r ? r.name : 'recurso';
  };

  /* =========================================================================
   * 2. Estados: qué se enseña, en qué orden y con cuánto tiempo
   *
   * El orden es DETERMINISTA y estable entre fotogramas (categoría → id →
   * inicio). Ordenar por tiempo restante parece más útil hasta que los iconos
   * empiezan a saltar de sitio en mitad de un burst y dejan de reconocerse.
   *
   * La categoría manda porque el control es lo que decide si atacas o esperas:
   * un CC nunca puede quedar fuera por desbordamiento.
   * ====================================================================== */

  M.KIND_RANK = { cc: 0, debuff: 1, buff: 2 };

  /* Marca de forma, no de color. Un daltónico tiene que poder distinguir un
     buff de un CC sin depender del borde rojo/verde. */
  M.KIND_MARK = { cc: '■', debuff: '▼', buff: '▲' };
  M.KIND_LABEL = { cc: 'control', debuff: 'perjuicio', buff: 'beneficio' };

  /**
   * @param statuses lista de instancias de estado tal cual las guarda la entidad
   * @param now      world.time
   * @param opts     { max, kinds }
   * @returns {{items:Array, hidden:number, signature:string}}
   */
  M.statusEntries = function (statuses, now, opts) {
    opts = opts || {};
    var max = opts.max === undefined ? 10 : opts.max;
    now = Number(now) || 0;

    var list = [];
    for (var i = 0; i < (statuses || []).length; i++) {
      var st = statuses[i];
      if (!st) continue;
      var d = EFF[st.defId];
      if (!d) continue;
      if (opts.kinds && opts.kinds.indexOf(d.kind) < 0) continue;

      var permanent = !!st.permanent || !(st.duration > 0);
      var remaining = Math.max(0, (st.endTime || 0) - now);
      var data = st.data || {};
      list.push({
        key: st.id || (st.defId + ':' + i),
        defId: st.defId,
        kind: d.kind,
        name: d.name,
        desc: d.desc || '',
        icon: d.icon || '•',
        color: d.color || '#ffffff',
        mark: M.KIND_MARK[d.kind] || '•',
        kindLabel: M.KIND_LABEL[d.kind] || d.kind,
        permanent: permanent,
        remaining: remaining,
        fraction: permanent ? 1 : M.clamp01(st.duration > 0 ? remaining / st.duration : 0),
        timeText: M.fmtDuration(remaining, permanent),
        stacks: Number(data.stacks) > 1 ? Math.round(data.stacks) : 0,
        amount: Number(data.amount) > 0 ? Math.round(data.amount) : 0,
        urgent: !permanent && remaining > 0 && remaining <= 1.0,
        rank: M.KIND_RANK[d.kind] === undefined ? 9 : M.KIND_RANK[d.kind],
        startTime: Number(st.startTime) || 0
      });
    }

    list.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.defId !== b.defId) return a.defId < b.defId ? -1 : 1;
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0);
    });

    var hidden = 0;
    if (list.length > max) {
      hidden = list.length - max;
      list = list.slice(0, max);
    }

    var sig = '';
    for (var j = 0; j < list.length; j++) {
      sig += list[j].key + '|' + list[j].stacks + ';';
    }
    return { items: list, hidden: hidden, signature: sig + '#' + hidden };
  };

  /** Etiqueta corta de control para nameplates: lo que decide atacar o esperar. */
  M.CC_PRIORITY = ['stasis', 'knockdown', 'stun', 'silence', 'root', 'disarm',
    'utilityLock', 'antiBuff', 'intervention', 'reflect', 'block'];

  M.controlLabel = function (statuses) {
    var present = Object.create(null);
    for (var i = 0; i < (statuses || []).length; i++) {
      if (statuses[i]) present[statuses[i].defId] = true;
    }
    for (var j = 0; j < M.CC_PRIORITY.length; j++) {
      var id = M.CC_PRIORITY[j];
      if (present[id] && EFF[id]) return { id: id, text: EFF[id].name, kind: EFF[id].kind };
    }
    return null;
  };

  /** Barrera activa agregada, para el chip "◈ 240 absorbiendo". */
  M.barrierReadout = function (statuses) {
    var total = 0, remaining = 0, has = false;
    for (var i = 0; i < (statuses || []).length; i++) {
      var st = statuses[i];
      if (!st) continue;
      var d = EFF[st.defId];
      if (!d || !d.absorb) continue;
      has = true;
      total += Math.max(0, Number(st.data && st.data.amount) || 0);
      remaining = Math.max(remaining, Math.max(0, Number(st.endTime) || 0));
    }
    if (!has || total <= 0.5) return null;
    return { amount: Math.round(total), endTime: remaining };
  };

  /* =========================================================================
   * 3. Barra de casteo
   *
   * Lo que el rival necesita saber de un cast enemigo son tres cosas y en este
   * orden: QUÉ es, CUÁNTO queda y SI se puede cortar. Lo tercero jamás puede
   * comunicarse sólo por el color de la barra.
   * ====================================================================== */

  M.castReadout = function (cast, now) {
    if (!cast) return null;
    now = Number(now) || 0;
    var duration = Math.max(1e-3, Number(cast.duration) || 0);
    var elapsed = now - (Number(cast.startTime) || 0);
    var remaining = Math.max(0, (Number(cast.endTime) || 0) - now);
    var ab = Arena.Data.abilities[cast.abilityId];
    var interruptible = cast.interruptible !== false;
    var stationary = !!cast.stationary;

    return {
      abilityId: cast.abilityId,
      name: ab ? ab.name : (cast.abilityId || 'Lanzando'),
      school: ab ? (ab.school || 'general') : 'general',
      progress: M.clamp01(elapsed / duration),
      remaining: remaining,
      remainingText: remaining >= 10 ? String(Math.ceil(remaining)) : remaining.toFixed(1),
      interruptible: interruptible,
      interruptText: interruptible ? 'INTERRUMPIBLE' : 'NO INTERRUMPIBLE',
      interruptMark: interruptible ? '⌁' : '⛊',
      interruptHint: interruptible
        ? 'Un golpe con interrupción corta este casteo y bloquea su escuela.'
        : 'Este casteo no se puede cortar: prepara el counter para el RELEASE.',
      stationary: stationary,
      stationaryText: stationary ? 'MOVERSE LO CANCELA' : ''
    };
  };

  /* =========================================================================
   * 4. Relación de un poder con el ataque normal
   *
   * Es la información que hace legible el ritmo del juego (CLAUDE.md §4.6), y
   * sale ENTERA de la metadata. Ningún id aparece aquí.
   * ====================================================================== */

  M.NORMAL_INTERACTION = {
    independent: {
      label: 'Independiente',
      text: 'No espera al ataque normal ni lo cancela: los dos relojes conviven.'
    },
    weaveAfterNormal: {
      label: 'Weaving',
      text: 'Se encadena justo después del RELEASE del ataque normal. Pulsado dentro de la ventana, se encola en vez de perderse.'
    },
    replacesNormal: {
      label: 'Reemplaza el normal',
      text: 'Sustituye al swing pendiente: el ataque normal en preparación se cancela sin daño fantasma.'
    },
    blocksNormal: {
      label: 'Bloquea el normal',
      text: 'Mientras dura impide el ataque normal.'
    }
  };

  M.WEAPON_INTERVAL = {
    ignore:       { label: 'Ignora el intervalo', text: 'No mira el reloj del arma.' },
    respectReady: { label: 'Exige arma lista',    text: 'Sólo sale si el intervalo de arma ya está preparado.' },
    consume:      { label: 'Consume el intervalo', text: 'Gasta la preparación del arma al usarse.' },
    reset:        { label: 'Reinicia el intervalo', text: 'Deja el arma empezando un ciclo nuevo.' }
  };

  M.ACTION_TYPE = {
    weaponSkill: { label: 'Golpe de arma', mark: '⚔' },
    spell:       { label: 'Hechizo',       mark: '✦' },
    utility:     { label: 'Utilidad',      mark: '◇' }
  };

  /**
   * Traduce la metadata temporal de una habilidad a frases legibles.
   * @returns {{tags:Array<{label:string,text:string,code:string}>, lines:string[]}}
   */
  M.abilityTiming = function (ability) {
    var t = (ability && ability.combatTiming) || {};
    var tags = [];
    var action = M.ACTION_TYPE[t.actionType];
    if (action) tags.push({ code: 'action', label: action.label, mark: action.mark, text: '' });

    var normal = M.NORMAL_INTERACTION[t.normalInteraction];
    if (normal) tags.push({ code: 'normal', label: normal.label, mark: '↹', text: normal.text });

    var interval = M.WEAPON_INTERVAL[t.weaponIntervalPolicy];
    if (interval && t.weaponIntervalPolicy !== 'ignore') {
      tags.push({ code: 'interval', label: interval.label, mark: '⧗', text: interval.text });
    }

    if (t.stationary) {
      tags.push({
        code: 'stationary', label: 'Requiere quietud', mark: '⏸',
        text: 'Hay que estar parado: moverse antes del RELEASE lo cancela sin gastar recurso ni cooldown.'
      });
    }
    if (ability && ability.castTime > 0) {
      tags.push({
        code: 'cast', label: 'Casteo ' + Number(ability.castTime).toFixed(2) + ' s', mark: '⧖',
        text: 'El coste, el cooldown y el GCD se pagan en el RELEASE, no al empezar.'
      });
    }

    var lines = [];
    for (var i = 0; i < tags.length; i++) if (tags[i].text) lines.push(tags[i].text);
    return { tags: tags, lines: lines };
  };

  /* =========================================================================
   * 5. Por qué NO salió la habilidad
   *
   * El jugador tiene que entenderlo sin abrir el registro. Cada motivo que
   * devuelve AbilitySystem.canUse tiene aquí un título corto, una marca de
   * forma y una pista ACCIONABLE con los números reales de la situación.
   * ====================================================================== */

  function n1(v) { return (Math.round((Number(v) || 0) * 10) / 10).toFixed(1); }

  M.FAILURES = {
    dead: { title: 'ESTÁS MUERTO', mark: '✝', tone: 'state',
      hint: function () { return 'Espera al final de la ronda.'; } },
    unknown: { title: 'RANURA VACÍA', mark: '?', tone: 'state',
      hint: function () { return 'Esa tecla no tiene ningún poder asignado.'; } },
    silenced: { title: 'ESTÁS MAREADO', mark: '⊘', tone: 'control',
      hint: function (i) { return 'No puedes lanzar poderes' + secsLeft(i) + '. El ataque normal y el movimiento siguen disponibles.'; } },
    stunned: { title: 'ESTÁS BAJO CONTROL', mark: '■', tone: 'control',
      hint: function (i) { return 'Incapacitado' + secsLeft(i) + ': ni moverte, ni atacar, ni lanzar.'; } },
    disarmed: { title: 'ESTÁS DESARMADO', mark: '⚔', tone: 'control',
      hint: function (i) { return 'Sin arma' + secsLeft(i) + ': los golpes de arma están bloqueados. Los hechizos no.'; } },
    noOffense: { title: 'POSTURA DEFENSIVA ACTIVA', mark: '⛨', tone: 'state',
      hint: function () { return 'Tu propio counter te impide usar poderes ofensivos: cancélalo primero.'; } },
    noDamage: { title: 'SIN HABILIDADES DAÑINAS', mark: '∅', tone: 'state',
      hint: function () { return 'Un estado activo bloquea todo lo que haga daño.'; } },
    utilityLocked: { title: 'UTILIDAD BLOQUEADA', mark: '⊗', tone: 'control',
      hint: function (i) { return 'Confusión táctica' + secsLeft(i) + ': sólo puedes usar habilidades que causen daño.'; } },
    lockout: { title: 'ESCUELA BLOQUEADA', mark: '⌧', tone: 'control',
      hint: function (i) { return 'Te interrumpieron: esa escuela queda cerrada' + secsLeft(i) + '. Usa otra escuela mientras tanto.'; } },
    gcd: { title: 'GLOBAL EN CURSO', mark: '◔', tone: 'timing',
      hint: function (i) {
        return 'Faltan ' + n1(i && i.gcdLeft) + ' s de GCD. Dentro de los últimos 0.20 s la pulsación se encola sola.';
      } },
    cooldown: { title: 'EN RECARGA', mark: '⏱', tone: 'timing',
      hint: function (i) { return 'Disponible en ' + n1(i && i.cooldownLeft) + ' s.'; } },
    weaponInterval: { title: 'ARMA NO PREPARADA', mark: '⧗', tone: 'timing',
      hint: function (i) { return 'Ese poder exige el arma lista: faltan ' + n1(i && i.weaponLeft) + ' s de intervalo.'; } },
    resource: { title: 'RECURSO INSUFICIENTE', mark: '◈', tone: 'resource',
      hint: function (i) {
        i = i || {};
        var missing = Math.max(0, Math.ceil((Number(i.cost) || 0) - (Number(i.have) || 0)));
        return 'Te faltan ' + missing + ' de ' + (i.resourceName || 'recurso') +
          ' (' + Math.floor(Number(i.have) || 0) + ' / ' + Math.round(Number(i.cost) || 0) + ').';
      } },
    noTarget: { title: 'SIN OBJETIVO', mark: '⌖', tone: 'target',
      hint: function () { return 'Selecciona con un clic corto o con Tab.'; } },
    badTarget: { title: 'OBJETIVO NO VÁLIDO', mark: '⌖', tone: 'target',
      hint: function () { return 'Ese poder no se lanza sobre ese tipo de objetivo. F te selecciona a ti mismo.'; } },
    targetDead: { title: 'OBJETIVO MUERTO', mark: '✝', tone: 'target',
      hint: function () { return 'Cambia de objetivo con Tab.'; } },
    untargetable: { title: 'OBJETIVO NO SELECCIONABLE', mark: '◐', tone: 'target',
      hint: function () { return 'Está en sigilo o aislado: revélalo o espera a que salga.'; } },
    range: { title: 'FUERA DE ALCANCE', mark: '↔', tone: 'range',
      hint: function (i) {
        i = i || {};
        var gap = Math.max(0, (Number(i.distance) || 0) - (Number(i.range) || 0));
        return 'Acércate ' + n1(gap) + ' u — estás a ' + n1(i.distance) +
          ' u y el alcance es ' + n1(i.range) + ' u.';
      } },
    facing: { title: 'MAL ENCARADO', mark: '⟲', tone: 'facing',
      hint: function (i) {
        i = i || {};
        var deg = Math.round(Math.abs(Number(i.angleOff) || 0) * 180 / Math.PI);
        var side = (Number(i.angleOff) || 0) > 0 ? 'derecha' : 'izquierda';
        return 'Gira ' + deg + '° a tu ' + side + '. Seleccionar no te gira: apuntas tú (arrastre izquierdo o Q/E).';
      } },
    los: { title: 'SIN LÍNEA DE VISIÓN', mark: '▨', tone: 'los',
      hint: function () { return 'Hay geometría entre los dos: desplázate lateralmente para abrir el ángulo.'; } },
    casting: { title: 'YA ESTÁS LANZANDO', mark: '⧖', tone: 'timing',
      hint: function (i) {
        return 'Quedan ' + n1(i && i.castLeft) + ' s. Esc cancela sin gastar recurso, cooldown ni GCD.';
      } },
    noGround: { title: 'FALTA PUNTO DE DESTINO', mark: '⌗', tone: 'target',
      hint: function () { return 'Apunta con el ratón al suelo antes de lanzarlo.'; } },
    moving: { title: 'DEBES DETENERTE', mark: '⏸', tone: 'timing',
      hint: function () { return 'Este poder se lanza plantado: suelta W/A/S/D y vuelve a pulsar.'; } },
    airborne: { title: 'ESTÁS EN EL AIRE', mark: '↑', tone: 'timing',
      hint: function () { return 'Aterriza antes de lanzarlo.'; } },
    weaponWindup: { title: 'ATAQUE NORMAL EN PREPARACIÓN', mark: '⧗', tone: 'timing',
      hint: function (i) {
        return 'El swing todavía no ha liberado (' + n1(i && i.weaponLeft) +
          ' s). Dentro de la ventana de 0.20 s se encola solo.';
      } }
  };

  function secsLeft(info) {
    var v = info && Number(info.statusLeft);
    return (isFinite(v) && v > 0.05) ? ' durante ' + n1(v) + ' s' : '';
  }

  /**
   * @param reason  código devuelto por AbilitySystem.canUse / AbilityRejected
   * @param info    contexto numérico ya leído de la simulación
   * @returns {{code,title,hint,mark,tone,abilityName}}
   */
  M.failure = function (reason, info) {
    info = info || {};
    var def = M.FAILURES[reason];
    if (!def) {
      var sim = Arena.Combat && Arena.Combat.AbilitySystem && Arena.Combat.AbilitySystem.REASONS
        ? Arena.Combat.AbilitySystem.REASONS[reason] : null;
      return {
        code: reason || 'unknown',
        title: (info.message || sim || 'ACCIÓN RECHAZADA').toUpperCase(),
        hint: info.message && sim && info.message !== sim ? info.message : '',
        mark: '!', tone: 'state',
        abilityName: info.abilityName || ''
      };
    }
    return {
      code: reason,
      title: def.title,
      hint: def.hint(info),
      mark: def.mark,
      tone: def.tone,
      abilityName: info.abilityName || ''
    };
  };

  /** ¿Un motivo se puede resolver moviéndote? Sirve para pintar el anillo de rango. */
  M.POSITIONAL = { range: true, los: true, facing: true, moving: true };

  /**
   * Estado visual de una ranura de la barra de acción.
   * `ready` no basta: el botón tiene que decir QUÉ falta, y la marca es una
   * forma, no un color (requisito de accesibilidad).
   */
  M.slotState = function (check, extra) {
    extra = extra || {};
    var reason = check && check.ok ? 'ok' : ((check && check.reason) || 'unknown');
    if (reason === 'ok') {
      return { state: 'ready', reason: 'ok', mark: '', label: 'Lista', dim: false };
    }
    var def = M.FAILURES[reason];
    return {
      state: reason === 'gcd' ? 'gcd' : 'blocked',
      reason: reason,
      mark: def ? def.mark : '!',
      label: def ? def.title : 'No disponible',
      tone: def ? def.tone : 'state',
      dim: reason !== 'gcd',
      queued: !!extra.queued
    };
  };

  /* =========================================================================
   * 6. Codex de clase para el lobby
   *
   * Fantasía, plan de juego y matchups. El grafo de counters es DATO y está
   * cerrado: cada clase gana a dos y pierde contra dos, y las dos direcciones
   * son coherentes entre sí (uiTests lo comprueba). Un lobby que dice
   * "fuerte contra X" mientras X dice "fuerte contra ti" no informa: confunde.
   * ====================================================================== */

  M.CODEX = {
    devastador: {
      fantasy: 'Entras el último y sales el primero. Toda tu ficha está en elegir el momento de cerrar distancia.',
      plan: [
        'Abre con la carga sólo cuando el rival ya haya gastado su escape.',
        'Rompe armadura antes del burst: el orden multiplica, no suma.',
        'Teje normal → poder: parar un instante pega más que correr pegando.'
      ],
      pressure: 'Alta',
      survivability: 'Media',
      range: 'Cuerpo a cuerpo',
      difficulty: 'Media'
    },
    guardian: {
      fantasy: 'No matas: decides quién puede matar. Tu victoria se mide en ventanas enemigas desperdiciadas.',
      plan: [
        'Guarda el bloqueo para el burst, no para el chip damage.',
        'Interponerte a tiempo vale más que cualquier daño que dejes de hacer.',
        'Reflejo contra magos: convierte su mejor turno en el tuyo.'
      ],
      pressure: 'Baja',
      survivability: 'Muy alta',
      range: 'Cuerpo a cuerpo',
      difficulty: 'Media'
    },
    centinela: {
      fantasy: 'Un metro de más y un segundo de quietud. Ése es todo el juego: pararse en el sitio correcto.',
      plan: [
        'Ritmo stop-shot: para, suelta el normal, teje el poder, vuelve a moverte.',
        'Nunca gastes el empuje por pánico: es tu única forma de rehacer distancia.',
        'Si te alcanzan, el duelo cambia de dueño: no dejes que llegue a eso.'
      ],
      pressure: 'Alta',
      survivability: 'Baja',
      range: 'Largo',
      difficulty: 'Alta'
    },
    rastreador: {
      fantasy: 'Peleas antes de que empiece la pelea. Cuando apareces, el terreno ya está a tu favor.',
      plan: [
        'Coloca la trampa donde el rival TENDRÁ que estar, no donde está.',
        'La marca antiheal se pone antes del burst aliado, no después.',
        'Revelar no es información: es negar la salida a quien se esconde.'
      ],
      pressure: 'Media',
      survivability: 'Media',
      range: 'Medio-largo',
      difficulty: 'Alta'
    },
    arcanista: {
      fantasy: 'Plantas los pies, aceptas el riesgo y conviertes dos segundos de quietud en una partida ganada.',
      plan: [
        'Castea con la columna a tu espalda: el movimiento enemigo es tu enemigo.',
        'Encadena control y burst en la misma ventana, no en dos separadas.',
        'El velo nulo se lanza sobre el soporte antes de que empiece a curar.'
      ],
      pressure: 'Muy alta',
      survivability: 'Baja',
      range: 'Largo',
      difficulty: 'Alta'
    },
    vinculador: {
      fantasy: 'Aguantas lo que nadie aguanta. Tu recurso es finito y cada decisión te acerca al final del pozo.',
      plan: [
        'La barrera antes del golpe vale el doble que la cura después.',
        'Cleansea el control que corta, no el que sólo molesta.',
        'Si te presionan a ti, reposicionar es curar: el mejor cast es el que llegas a terminar.'
      ],
      pressure: 'Baja',
      survivability: 'Media',
      range: 'Medio',
      difficulty: 'Muy alta'
    }
  };

  /* Cada clase gana a las DOS siguientes del ciclo. Grafo cerrado y simétrico. */
  M.COUNTER_CYCLE = ['devastador', 'centinela', 'arcanista', 'vinculador', 'rastreador', 'guardian'];

  M.COUNTER_REASON = {
    'devastador>centinela': 'Cierras distancia y su ritmo stop-shot se rompe.',
    'devastador>arcanista': 'Cada metro que avanzas le cancela un casteo plantado.',
    'centinela>arcanista': 'Le superas en alcance y cortas su ventana antes del RELEASE.',
    'centinela>vinculador': 'Presión sostenida contra un pozo de recurso finito.',
    'arcanista>vinculador': 'El velo nulo apaga la curación justo cuando hace falta.',
    'arcanista>rastreador': 'Burst mágico contra armadura ligera y sin bloqueo.',
    'vinculador>rastreador': 'Limpias su antiheal y le sobrevives a su propio plan.',
    'vinculador>guardian': 'Su daño no basta para superar tu sostenimiento.',
    'rastreador>guardian': 'Bloqueas su utilidad y su kit defensivo se queda sin uso.',
    'rastreador>devastador': 'Trampas y sigilo le niegan la entrada que necesita.',
    'guardian>devastador': 'Bloqueo y reflejo convierten su burst en su problema.',
    'guardian>centinela': 'Peel y avance constante le quitan el metro que necesita.'
  };

  M.counters = function (classId) {
    var cycle = M.COUNTER_CYCLE;
    var idx = cycle.indexOf(classId);
    if (idx < 0) return { beats: [], losesTo: [] };
    var beats = [cycle[(idx + 1) % cycle.length], cycle[(idx + 2) % cycle.length]];
    var losesTo = [];
    for (var i = 0; i < cycle.length; i++) {
      if (cycle[i] === classId) continue;
      var theirs = M.counters === undefined ? [] : null; // evita recursión
      var j = i;
      var a = cycle[(j + 1) % cycle.length], b = cycle[(j + 2) % cycle.length];
      if (a === classId || b === classId) losesTo.push(cycle[i]);
    }
    return { beats: beats, losesTo: losesTo };
  };

  M.counterReason = function (winnerId, loserId) {
    return M.COUNTER_REASON[winnerId + '>' + loserId] || '';
  };

  /** Ficha completa de clase para la tarjeta del lobby. Sólo lectura de datos. */
  M.classDossier = function (classId) {
    var c = Arena.Data.classes ? Arena.Data.classes[classId] : null;
    if (!c) return null;
    var codex = M.CODEX[classId] || {};
    var cnt = M.counters(classId);
    var kit = [];
    for (var i = 0; i < (c.abilities || []).length; i++) {
      var ab = Arena.Data.abilities[c.abilities[i]];
      if (!ab) continue;
      kit.push({
        id: ab.id, name: ab.name, key: ab.key || String(i + 1),
        timing: M.abilityTiming(ab)
      });
    }
    return {
      id: c.id, name: c.name, role: c.role, archetype: c.archetype,
      identity: c.identity, tagline: c.tagline,
      fantasy: codex.fantasy || c.identity,
      plan: codex.plan || [],
      traits: [
        { label: 'PRESIÓN', value: codex.pressure || '—' },
        { label: 'AGUANTE', value: codex.survivability || '—' },
        { label: 'ALCANCE', value: codex.range || '—' },
        { label: 'EXIGENCIA', value: codex.difficulty || '—' }
      ],
      vitals: [
        { label: 'VIDA', value: c.hpMax, max: 1700 },
        { label: 'ARMADURA', value: c.armor, max: 120 },
        { label: 'RESIST.', value: c.resist, max: 120 },
        { label: 'ALCANCE NORMAL', value: c.autoAttackRange, max: 26, unit: ' u' }
      ],
      beats: cnt.beats, losesTo: cnt.losesTo,
      kit: kit
    };
  };

  Arena.UI = Arena.UI || {};
  Arena.UI.Model = M;
});
