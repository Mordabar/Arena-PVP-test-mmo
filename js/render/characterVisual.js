/* =============================================================================
 * render/characterVisual.js — capa de INTENCIÓN de animación.
 *
 * El cuerpo es el maniquí nativo de Quaternius (65 huesos), aplicado por
 * `render/three/threeDirectAnim.js` directamente sobre sus clips originales.
 * Este fichero no dibuja nada: computa el ESTADO neutral de animación que ese
 * puente consume — locomoción, fase de acción, casteo, control de masas — y
 * expone dos datos de presentación que sí hacen falta (`archetypeOf` para
 * elegir clip, `paletteFor` para el color del brillo de casteo).
 *
 * LOCOMOCIÓN DIRECCIONAL. La simulación sólo dice dónde está el personaje; aquí
 * se deduce hacia dónde se mueve RESPECTO A SU PROPIO FRENTE. Correr de
 * espaldas con la animación de correr de frente es uno de los fallos que más
 * delata a un prototipo:
 *
 *   adelante   zancada amplia, torso inclinado, brazos contrarios
 *   atrás      pasos cortos y altos, torso erguido y echado atrás
 *   lateral    piernas que cruzan y se abren, cadera girada
 *   girar      pivote de pies sin desplazamiento
 *   parado     respiración, peso alternando y micro-balanceo
 *
 * COMBATE POR ARQUETIPO
 *   melee   normal = tajo lateral · poder = golpe descendente amplio
 *   archer  alza, tensa, suelta · el poder tensa más y gira el torso
 *   caster  normal = estocada de báculo · casteo = báculo en alto y luz
 * ========================================================================== */
Arena.define('render/characterVisual',
  ['render/anim/locomotion', 'render/anim/actions', 'anim/animationIntent', 'data/balance'],
  function (Arena) {
  'use strict';

  var Loco = Arena.Render.Locomotion;
  var Act = Arena.Render.Actions;
  var AI = Arena.Anim.AnimationIntent;
  var B = Arena.Data.balance;

  var CV = {};

  /* =========================================================================
   * Arquetipo y atuendo
   * ====================================================================== */
  // Arquetipo y arma son hechos de la clase, no decisiones de dibujo: viven en
  // data/animConfig.js para que la capa neutral de animación pueda leerlos sin
  // arrastrar consigo nada de presentación.
  CV.archetypeOf = function (classId) { return Arena.Data.archetypeOf(classId); };

  /* =========================================================================
   * Estado de animación
   * ====================================================================== */
  /**
   * @param seed semilla visual estable por entidad. Determinista a propósito:
   *        el brief prohíbe Math.random() en cualquier cosa que altere lo que
   *        el jugador interpreta, y una pose desincronizada entre dos partidas
   *        con la misma semilla de mundo sería exactamente eso.
   */
  CV.createState = function (seed) {
    var n = 0;
    if (typeof seed === 'number') n = seed | 0;
    else if (seed) {   // los ids de entidad son cadenas: se resumen a entero
      var s = String(seed);
      for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
    }
    return {
      // El controlador de locomoción se crea perezosamente en el primer update,
      // cuando ya se conoce la clase y por tanto su configuración.
      loco: null, cfg: null, seed: n,
      /* Intención de animación: la descripción NEUTRAL de qué está haciendo el
         personaje. Es lo que consumiría un backend con malla real. */
      intent: AI.create(),
      // Capa UPPER BODY: acciones de combate, reacción aditiva y CC.
      action: Act.createState(n),
      cast: 0, casting: false, castMovable: false,
      hurt: 0, hurtReaction: 'chest', downed: 0, deadTime: 0,
      // Mezcla de la pose de control: 0 = normal, 1 = pose de CC completa.
      ccBlend: 0, cc: null,
      // Compatibilidad de lectura para VFX, HUD y depuración.
      speed: 0, phase: 0
    };
  };

  CV.update = function (st, entity, dt, world) {
    // El controlador de locomoción se crea al conocer la clase, no antes.
    if (!st.loco) {
      st.cfg = Arena.Data.animConfigFor(entity.classId, CV.archetypeOf(entity.classId));
      st.loco = Loco.createState(st.cfg);
    }

    // Toda la locomoción vive en render/anim/locomotion.js: estados, ciclo de
    // paso por fases de contacto, foot locking y centro de masa.
    Loco.update(st.loco, entity, dt);

    // Seguimiento visual del objetivo. NO gira al personaje ni le pega al
    // enemigo: sólo mueve cabeza y parte del pecho, que es lo que separa un
    // MMO táctico de un lock-on de acción.
    var tgt = entity.targetId && world.getEntity ? world.getEntity(entity.targetId) : null;
    Loco.trackTarget(st.loco, entity, (tgt && tgt.alive) ? tgt.pos : null, dt);

    // Capa UPPER BODY. Independiente de las piernas: por eso un arquero puede
    // disparar mientras strafea sin que ninguna de las dos capas se entere.
    Act.update(st.action, st.cfg, dt);

    /* El reloj de la acción normal lo gobierna weaponState. La animación sigue
       teniendo blend/inercia propios, pero su ANTICIPATION/IMPACT se alinea al
       RELEASE real de simulación. Así arco, espada y pulso de báculo no pueden
       golpear visualmente antes o después del evento autoritativo. */
    var ws = entity.weaponState;
    if (st.action.family && !st.action.isPower && ws) {
      var aph = st.cfg.phases[st.action.family] || st.cfg.phases.light;
      var releaseT = aph.impact;
      if (ws.phase === 'WINDUP') {
        var wp = (world.time - ws.windupStartedAt) / Math.max(0.001, ws.releaseAt - ws.windupStartedAt);
        wp = Math.max(0, Math.min(1, wp));
        /* Nunca cruzar el marker visual antes del RELEASE autoritativo. */
        st.action.t = wp * Math.max(0.01, releaseT - 0.012);
      } else if (ws.phase === 'RELEASE') {
        st.action.t = Math.max(st.action.t, releaseT);
      } else if (ws.phase === 'RECOVERY' && ws.lastReleaseAt > -900) {
        var ar = CV.archetypeOf(entity.classId);
        var rr = (B.AUTO_ATTACK.releaseRecoveryVisual && B.AUTO_ATTACK.releaseRecoveryVisual[ar]) || 0.30;
        var rp = Math.max(0, Math.min(1, (world.time - ws.lastReleaseAt) / rr));
        st.action.t = Math.max(st.action.t, releaseT + rp * (1 - releaseT));
      } else if (ws.phase === 'READY' && ws.lastCancelAt > -900 && world.time - ws.lastCancelAt < 0.20) {
        Act.cancelVisual(st.action);
      }
    }

    // Espejos de lectura para VFX, HUD y depuración.
    st.speed = st.loco.moveSpeed;
    st.phase = st.loco.cycle * Math.PI * 2;

    if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 3.5);

    /* --- Control: la simulación decide QUÉ, esto sólo decide CÓMO se ve ---- */
    var cc = Act.ccPose(entity, 1);
    // Un control duro entra deprisa (el impacto se lee al instante) y sale más
    // despacio: levantarse tiene que costar algo. Mientras dura la salida se
    // conserva la última pose, o el personaje se enderezaría de golpe.
    if (cc) st.cc = cc;
    var target = cc ? 1 : 0;
    st.ccBlend += (target - st.ccBlend) * Math.min(1, dt * (target > st.ccBlend ? 11 : 5.5));
    if (st.ccBlend < 0.002) { st.ccBlend = 0; st.cc = null; }
    st.downed = st.ccBlend;
    st.ccTime = (st.ccTime || 0) + dt;

    if (entity.cast) {
      st.casting = true;
      var c = entity.cast;
      // El progreso lo dicta la simulación: si el cuerpo usara su propio reloj,
      // la barra de casteo y el personaje contarían cosas distintas.
      st.cast = Math.min(1, (world.time - c.startTime) / Math.max(c.duration, 1e-3));
      st.castMovable = !!c.movable;
    } else {
      st.casting = false;
      st.castMovable = false;
      st.cast += (0 - st.cast) * Math.min(1, dt * 9);
    }
    if (!entity.alive) st.deadTime += dt; else st.deadTime = 0;

    /* La INTENCIÓN se construye al final, cuando locomoción y acción ya han
       avanzado: describe el fotograma que se va a pintar, no el anterior. Un
       backend con malla con skinning leería sólo esto. */
    AI.build(st.intent, entity, world, st.loco, st.action);
    st.intent.crowdControlBlend = st.ccBlend;
  };

  /**
   * Dispara la acción de combate. `kind` es el ARQUETIPO, no el arma: la
   * elección de familia vive en render/anim/actions.js, que es quien conoce
   * las fases.
   */
  CV.triggerAttack = function (st, kind, isPower, castFamily, visualAction, visualVariant, spellGesture, releaseDelay) {
    if (!st.cfg) return;   // aún no ha corrido el primer update
    var family = Act.familyFor(kind || 'melee', isPower, visualAction);
    Act.trigger(st.action, family, st.cfg, isPower, castFamily, visualAction, visualVariant, spellGesture);
    var ph = st.cfg.phases[family] || st.cfg.phases.cast || st.cfg.phases.heavy;
    /* NORMAL: WeaponWindupStarted trae el tiempo autoritativo que falta para
       RELEASE. La animación ajusta SU reloj para que `ph.impact` caiga justo
       allí. Antes v0.18/v0.19 usaban actionTime fijo: melee quedaba cerca por
       casualidad, pero arco podía liberar visualmente ~68 ms tarde. El combate
       no cambia: sólo retimeamos presentación. */
    if (!isPower && isFinite(releaseDelay) && releaseDelay > 0 && ph && ph.impact > 0.001) {
      st.action.duration = Math.max(0.05, releaseDelay / ph.impact);
      st.action.authoritativeReleaseDelay = releaseDelay;
      st.action.authoritativeReleasePending = true;
      st.action.normalReleaseImpact = ph.impact;
    } else {
      st.action.authoritativeReleaseDelay = 0;
      st.action.authoritativeReleasePending = false;
      st.action.normalReleaseImpact = 0;
    }
    /* Los poderes llegan aquí en AbilityReleased: RELEASE ya ocurrió en la
       simulación. La presentación entra exactamente en el marker de impacto,
       no reproduce otro windup después de que el proyectil ya salió.

       v0.36: eso es correcto para arco/mago —ahí sí hay un proyectil que ya
       viajó, y mostrar recorrido después se vería al revés— pero un poder
       melee es contacto físico, no un disparo: arrancar en seco justo en
       ph.impact hacía que espada/pierna "aparecieran" ya en la pose de golpe
       sin ningún tránsito. Se reportó exactamente así: "el poder no se ve
       completo" y "el puntapié se ve pobre". Un tránsito corto (~8% de la
       duración de la acción, unos 40-60 ms) hacia ph.impact deja ver el arma
       LLEGANDO al golpe sin retrasar ni el daño ni el VFX, que siguen
       disparando en el instante autoritativo real: sólo se suaviza la pose. */
    if (isPower) {
      var meleeContact = kind === 'melee';
      st.action.t = meleeContact ? Math.max(0, ph.impact - 0.08) : ph.impact;
      st.action.weight = 1;
    }
  };

  /** RELEASE del ataque normal confirmado por simulación. La presentación
   * se lleva exactamente al marker de impacto y desde ahí continúa recovery. */
  CV.confirmNormalRelease = function (st) {
    if (!st || !st.action || !st.action.family || !st.action.authoritativeReleasePending) return;
    st.action.t = st.action.normalReleaseImpact || st.action.t;
    st.action.authoritativeReleasePending = false;
    st.action.weight = 1;
  };

  /** Cancelación autoritativa pre-RELEASE: disuelve el windup sin producir
   * impacto/follow-through fantasma. */
  CV.cancelNormalWindup = function (st) {
    if (!st || !st.action || !st.action.authoritativeReleasePending) return;
    st.action.authoritativeReleasePending = false;
    st.action.normalReleaseImpact = 0;
    Act.cancelVisual(st.action);
  };

  /**
   * La simulación ha empezado un casteo. `castFamily` viene de
   * data/castFamilies.js: la presentación conoce siete categorías visuales, no
   * el catálogo de habilidades.
   */
  CV.beginCast = function (st, castFamily, visualAction, spellGesture) {
    if (st.action) Act.beginCast(st.action, castFamily, visualAction, spellGesture);
  };

  /**
   * Reacción al daño. ADITIVA: sacude el torso sin congelar las piernas.
   * `fromPos` es opcional; con él la sacudida es direccional.
   */
  CV.triggerHurt = function (st, entity, fromPos, reactionKind) {
    st.hurt = 1;
    st.hurtReaction = reactionKind === 'head' ? 'head' : 'chest';
    if (!st.loco || !entity) return;
    Loco.applyHit(st.loco, entity, fromPos);
    Act.react(st.action, -st.loco.hitDir.z, -st.loco.hitDir.x);
  };


  /* =========================================================================
   * Paleta
   *
   * Lo único que el renderer del maniquí nativo consume de aquí es `accent`:
   * el color del brillo de casteo (luz, runa, motas). El maniquí trae su
   * propio material bakeado en el GLB; esta capa no lo repinta.
   * ====================================================================== */
  var ACCENT = mix3([1.00, 0.26, 0.22], [1, 1, 1], 0.25);
  function mix3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  CV.paletteFor = function () {
    return { accent: ACCENT };
  };

  Arena.Render.CharacterVisual = CV;
});
