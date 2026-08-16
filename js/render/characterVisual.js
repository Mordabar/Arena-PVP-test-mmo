/* =============================================================================
 * render/characterVisual.js — Humanoide procedural, raza, locomoción y combate.
 *
 * ESQUELETO REAL, no palos rígidos. Cada extremidad tiene dos segmentos y una
 * articulación intermedia:
 *
 *   hombro → [brazo] → codo → [antebrazo] → muñeca → mano
 *   cadera → [muslo] → rodilla → [espinilla] → tobillo → pie
 *
 * Sin codo ni rodilla, un personaje corriendo parece un compás abriéndose: el
 * doblez es lo que convierte un balanceo en una zancada.
 *
 * Convención: cada hueso cuelga desde su pivote (malla hacia −Y).
 *   pitch = 0 → colgando · pitch > 0 → atrás (−Z) · pitch < 0 → adelante (+Z)
 *
 * LOCOMOCIÓN DIRECCIONAL. La simulación sólo dice dónde está el personaje; aquí
 * se deduce hacia dónde se mueve RESPECTO A SU PROPIO FRENTE y se elige el
 * ciclo. Correr de espaldas con la animación de correr de frente es uno de los
 * fallos que más delata a un prototipo:
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
  ['render/primitives', 'math/mat4', 'data/races', 'data/classVisuals',
   'render/equipment',
   'render/anim/skeleton', 'render/anim/locomotion', 'render/anim/actions',
   'anim/animationIntent', 'data/balance'],
  function (Arena) {
  'use strict';

  var P = Arena.Render.primitives;
  var M = Arena.Math.Mat4;
  var V = Arena.Math.Vec3;
  var SK = Arena.Render.Skeleton;
  var Loco = Arena.Render.Locomotion;
  var Act = Arena.Render.Actions;
  var AI = Arena.Anim.AnimationIntent;
  var B = Arena.Data.balance;
  var Eq = Arena.Render.Equipment;

  var CV = {};
  /* Compartido y NUNCA mutado: es el valor por defecto de `pos` y `rot` de una
     pieza de equipo, y se lee decenas de veces por fotograma. */
  var ZERO3 = [0, 0, 0];

  /* Longitudes de hueso, sobre una altura total de ~1.85 */
  var UPPER_ARM = 0.30, LOWER_ARM = 0.29;
  var THIGH = 0.45, SHIN = 0.43;

  /* =========================================================================
   * Proporciones derivadas — NO son números sueltos
   *
   * La altura de la cadera NO se elige: se deduce de la longitud de la pierna.
   * Si se fija a mano y no cuadra con los huesos, la IK resuelve la única pose
   * posible —rodillas dobladas— y el personaje se pasa la partida en cuclillas.
   * Es exactamente lo que pasaba antes: 0.96 de cadera contra una pierna de
   * 0.93 daba 123° de rodilla, es decir, media sentadilla permanente.
   *
   * De pie, una pierna humana está casi recta. `STAND_EXTENSION` dice cuánto,
   * y el resto sale solo. Cambiar THIGH o SHIN ya no puede volver a romperlo.
   * ====================================================================== */
  var ANKLE_HEIGHT = 0.075;     // del suelo al centro del tobillo
  var HIP_SOCKET = 0.04;        // de la cadera al pivote real del muslo
  var STAND_EXTENSION = 0.985;  // fracción de pierna usada de pie
  var TORSO_ABOVE_HIP = 0.845;  // de la cadera a la coronilla, medido del rig

  /** Altura de la cadera en reposo para una escala de miembros dada. */
  function hipRestFor(limbScale) {
    return ANKLE_HEIGHT + (THIGH + SHIN) * limbScale * STAND_EXTENSION + HIP_SOCKET;
  }

  /** Hueso que cuelga: pivote arriba, malla hacia −Y, ligeramente cónico. */
  function bone(rTop, rBot, len, segs) {
    return P.scale(P.cylinder(rTop, len, segs || 9, rBot / rTop), 1, -1, 1);
  }
  function joint(r) { return P.sphere(r, 7, 9); }

  /* =========================================================================
   * Mallas
   *
   * Aquí viven SÓLO el cuerpo y las piezas que comparten todas las clases. El
   * equipo que define la identidad de cada clase —hombreras, petos, faldones,
   * capas, tocados y armas— se fabrica en `render/equipment.js` a partir de las
   * medidas declaradas en `data/classVisuals.js`, y se funde al final de esta
   * función. La razón es simple: mientras las piezas de clase vivían en este
   * diccionario, distinguir dos clases significaba escribir dos mallas más y
   * dos condiciones más, y eso no escala más allá de las seis actuales.
   * ====================================================================== */
  CV.buildMeshes = function () {
    var body = {
      /* --- Anatomía v0.11 ---------------------------------------------------
       * La silueta deja de construirse con cajas apiladas. El cuerpo base usa
       * elipsoides faceteados, cápsulas y cuñas orgánicas; el equipo conserva
       * planos duros donde corresponde. Así la armadura se lee como armadura
       * ENCIMA de una persona, no como otra caja sustituyendo a la persona. */
      ribcage: P.merge([
        P.translate(P.ellipsoid(0.222, 0.192, 0.142, 13, 20), 0, 0.145, 0),
        P.translate(P.ellipsoid(0.188, 0.112, 0.130, 11, 18), 0, 0.285, 0.004)
      ]),
      abdomen: P.translate(P.ellipsoid(0.158, 0.140, 0.118, 11, 18), 0, 0.025, 0),
      pelvis: P.merge([
        P.translate(P.ellipsoid(0.188, 0.122, 0.142, 11, 18), 0, -0.015, 0),
        P.translate(P.ellipsoid(0.124, 0.080, 0.114, 9, 16), 0, -0.085, 0.005)
      ]),

      /* Cara estilizada de planos suaves. A distancia MMO queremos una cabeza
       * humana reconocible, no microdetalle. Pómulo, mandíbula y nariz rompen el
       * contorno sin convertir la cara en un cubo. */
      skull: P.merge([
        P.ellipsoid(0.132, 0.150, 0.136, 14, 22),
        P.translate(P.ellipsoid(0.114, 0.075, 0.108, 10, 18), 0, -0.065, 0.042)
      ]),
      jaw: P.merge([
        P.translate(P.ellipsoid(0.098, 0.072, 0.090, 10, 16), 0, -0.112, 0.050),
        P.translate(P.scale(P.cone(0.070, 0.080, 8), 1, -1, 0.82), 0, -0.070, 0.040)
      ]),
      brow: P.merge([
        P.translate(P.rotateZ(P.capsule(0.014, 0.096, 8), Math.PI * 0.52), -0.055, 0.040, 0.115),
        P.translate(P.rotateZ(P.capsule(0.014, 0.096, 8), -Math.PI * 0.52), 0.055, 0.040, 0.115)
      ]),
      nose: P.merge([
        P.translate(P.ellipsoid(0.022, 0.052, 0.028, 7, 9), 0, -0.018, 0.132),
        P.translate(P.rotateX(P.cone(0.026, 0.060, 7), Math.PI * 0.44), 0, -0.045, 0.125)
      ]),
      neck: bone(0.058, 0.066, 0.115, 10),
      ear: P.scale(P.rotateZ(P.cone(0.040, 0.13, 8), -Math.PI/2), 0.70, 1, 0.62),
      eye: P.ellipsoid(0.024, 0.015, 0.014, 6, 9),

      /* Pelo por masas curvas y mechones: evita el “casco de LEGO”. */
      hairCap: P.merge([
        P.translate(P.ellipsoid(0.132, 0.122, 0.138, 11, 17), 0, 0.030, -0.020),
        P.translate(P.rotateZ(P.capsule(0.030, 0.190, 8), 0.14), -0.103, -0.020, -0.012),
        P.translate(P.rotateZ(P.capsule(0.030, 0.190, 8), -0.14), 0.103, -0.020, -0.012),
        P.translate(P.rotateX(P.capsule(0.036, 0.215, 8), 0.20), 0, -0.010, -0.104)
      ]),
      hairTail: P.merge([
        P.translate(P.ellipsoid(0.070, 0.060, 0.074, 7, 11), 0, -0.018, -0.150),
        P.translate(P.rotateX(P.cone(0.058, 0.285, 10), Math.PI), 0, -0.050, -0.165)
      ]),

      /* Extremidades con radios más anatómicos y articulaciones menos enormes. */
      upperArm: bone(0.066, 0.052, UPPER_ARM, 13),
      lowerArm: bone(0.055, 0.042, LOWER_ARM, 12),
      elbow: P.ellipsoid(0.054, 0.057, 0.052, 9, 13),
      shoulderBall: P.ellipsoid(0.078, 0.073, 0.073, 10, 14),
      hand: P.merge([
        P.translate(P.ellipsoid(0.057, 0.076, 0.041, 10, 14), 0, -0.046, 0),
        P.translate(P.rotateZ(P.capsule(0.012, 0.070, 7), -0.55), 0.046, -0.044, 0.002),
        P.translate(P.rotateZ(P.capsule(0.010, 0.062, 7), 0.05), -0.028, -0.080, 0.004)
      ]),

      thigh: bone(0.100, 0.074, THIGH, 13),
      shin: bone(0.078, 0.055, SHIN, 12),
      knee: P.ellipsoid(0.073, 0.076, 0.069, 10, 14),
      foot: P.merge([
        P.translate(P.ellipsoid(0.078, 0.055, 0.125, 10, 16), 0, -0.037, 0.065),
        P.translate(P.scale(P.ellipsoid(0.082, 0.044, 0.088, 9, 14), 1, 0.82, 1), 0, -0.043, 0.145)
      ]),

      /* --- Piezas comunes a varias clases -----------------------------------
       * Estas cuatro sobreviven aquí porque NO son identidad: son soporte que
       * tres o más clases reutilizan con el mismo tamaño. Cualquier cosa que
       * distinga a una clase de otra vive en data/classVisuals.js.           */
      // Tira estrecha de color de bando. Va en una pieza ANGOSTA a propósito:
      // si el tinte lo baña todo, el atuendo deja de contar quién es quién.
      tabard: P.translate(P.scale(P.box(0.115, 0.40, 0.235), 1, 1, 1), 0, 0.00, 0),
      stole: P.translate(P.scale(P.box(0.062, 0.46, 0.034), 1, 1, 1), 0, -0.21, 0),
      strap: P.translate(P.scale(P.box(0.062, 0.44, 0.030), 1, 1, 1), 0, -0.02, 0),
      bracer: P.translate(P.cylinder(0.060, 0.15, 8, 1), 0, -LOWER_ARM * 0.85, 0),
      chestBadge: P.merge([
        P.scale(P.box(0.085, 0.105, 0.020), 1, 1, 1),
        P.translate(P.scale(P.cone(0.040, 0.070, 4), 1, 1, 0.55), 0, -0.070, 0.008)
      ]),
      // Cuerpo de la túnica: cubre el tronco y enlaza con la falda. Sin él, la
      // caja torácica quedaba a la vista como un panel plano encima de la
      // campana de tela, y el mago parecía dos objetos apilados.
      // Se ensancha HACIA ARRIBA, de la cintura a los hombros, y termina ahí:
      // la malla se construye de y=0 a y=h, así que el radio base es el de la
      // cintura y `taper` es cuánto abre en el pecho.
      robeBodice: P.merge([
        P.scale(P.cylinder(0.150, 0.40, 14, 1.42), 1, 1, 0.86),
        P.translate(P.scale(P.sphere(0.5, 8, 11), 0.40, 0.20, 0.30), 0, 0.375, 0)
      ]),
      // Flecha encajada: la comparten los dos arquetipos de arco.
      arrow: P.merge([
        P.cylinder(0.013, 0.60, 5, 1),
        P.translate(P.cone(0.027, 0.082, 5), 0, 0.60, 0)
      ]),
      gem: P.sphere(0.078, 8, 10),
      orb: P.sphere(0.112, 8, 12)
    };

    /* El equipo de las seis clases, fabricado a partir de sus medidas. Si una
       clase declara una pieza que no existe, esto revienta en el arranque en
       vez de dejar a un personaje a medio vestir sin que nadie se entere. */
    return Eq.build(Arena.Data.EQUIPMENT, body);
  };

  /* =========================================================================
   * Arquetipo y atuendo
   * ====================================================================== */
  // Arquetipo y arma son hechos de la clase, no decisiones de dibujo: viven en
  // data/animConfig.js para que la capa neutral de animación pueda leerlos sin
  // arrastrar consigo nada de presentación.
  CV.archetypeOf = function (classId) { return Arena.Data.archetypeOf(classId); };

  /* El perfil visual de cada clase vive en data/classVisuals.js. Aquí sólo se
     deriva el `loadout` que espera la capa de acciones —que únicamente
     necesita saber qué hay en cada mano— para no obligarla a conocer la
     estructura completa del perfil. */
  var LOADOUT = {};
  (function () {
    var order = Arena.Data.CLASS_VISUAL_ORDER;
    for (var i = 0; i < order.length; i++) {
      var p = Arena.Data.CLASS_VISUAL[order[i]];
      LOADOUT[p.id] = {
        classId: p.id,
        right: p.right ? p.right.kind : null,
        left: p.left ? p.left.kind : null,
        scale: p.right && p.right.scale !== undefined ? p.right.scale : 1,
        profile: p
      };
    }
  })();
  CV.loadoutOf = function (classId) { return LOADOUT[classId] || LOADOUT.devastador; };
  CV.profileOf = function (classId) { return Arena.Data.classVisualOf(classId); };

  /* =========================================================================
   * Materiales
   *
   * Que todo el personaje comparta una misma rugosidad es lo que hace que un
   * modelo se lea como plástico. La piel dispersa, el metal refleja duro, el
   * cuero apaga, la tela no brilla nada y lo mágico casi no tiene rugosidad.
   * Es la diferencia más barata entre "figura de acción" y "personaje".
   * ====================================================================== */
  /* OJO CON rimPower: el contorno es pow(1 − N·V, rimPower), así que un valor
     ALTO da un borde estrecho y uno BAJO baña la silueta entera. Con valores
     bajos en metal, el tinte de bando se comía el color de todas las piezas y
     el personaje entero se leía azul. El metal quiere el borde MÁS estrecho de
     todos, no el más ancho. */
  CV.MATERIALS = {
    SKIN:    { roughness: 0.64, metallic: 0.02, rimPower: 3.2, rim: 0.55 },
    CLOTH:   { roughness: 0.92, metallic: 0.00, rimPower: 2.6, rim: 0.75 },
    LEATHER: { roughness: 0.72, metallic: 0.05, rimPower: 3.0, rim: 0.60 },
    METAL:   { roughness: 0.38, metallic: 0.62, rimPower: 4.5, rim: 0.85 },
    WOOD:    { roughness: 0.78, metallic: 0.02, rimPower: 3.2, rim: 0.45 },
    MAGIC:   { roughness: 0.16, metallic: 0.10, rimPower: 2.0, rim: 1.00 }
  };

  /* Material por malla. Una tabla, no una condición esparcida por el código.
     Sólo cubre el cuerpo y las piezas compartidas: cada pieza de equipo declara
     su material en `data/classVisuals.js`, junto a sus medidas, para que no
     pueda existir una malla nueva sin decir de qué está hecha. */
  var MESH_MATERIAL = {
    skull: 'SKIN', jaw: 'SKIN', brow: 'SKIN', nose: 'SKIN', neck: 'SKIN', ear: 'SKIN',
    upperArm: 'SKIN', lowerArm: 'SKIN', elbow: 'SKIN', shoulderBall: 'SKIN', hand: 'SKIN',

    ribcage: 'CLOTH', abdomen: 'CLOTH', pelvis: 'CLOTH', thigh: 'CLOTH', shin: 'CLOTH',
    knee: 'CLOTH', tabard: 'CLOTH', stole: 'CLOTH', robeBodice: 'CLOTH',
    hairCap: 'CLOTH', hairTail: 'CLOTH',

    bracer: 'LEATHER', foot: 'LEATHER', strap: 'LEATHER',

    chestBadge: 'METAL',

    arrow: 'WOOD',

    eye: 'MAGIC', gem: 'MAGIC', orb: 'MAGIC'
  };
  CV.materialOf = function (mesh) {
    var kind = MESH_MATERIAL[mesh] || Arena.Data.EQUIPMENT_MATERIAL[mesh] || 'CLOTH';
    return CV.MATERIALS[kind];
  };

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
      hurt: 0, downed: 0, deadTime: 0,
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
  CV.triggerAttack = function (st, kind, isPower, castFamily, visualAction, visualVariant, spellGesture) {
    if (!st.cfg) return;   // aún no ha corrido el primer update
    var family = Act.familyFor(kind || 'melee', isPower, visualAction);
    Act.trigger(st.action, family, st.cfg, isPower, castFamily, visualAction, visualVariant, spellGesture);
    /* Los poderes llegan aquí en AbilityReleased: RELEASE ya ocurrió en la
       simulación. La presentación entra exactamente en el marker de impacto,
       no reproduce otro windup después de que el proyectil ya salió. */
    if (isPower) {
      var ph = st.cfg.phases[family] || st.cfg.phases.cast || st.cfg.phases.heavy;
      st.action.t = ph.impact;
      st.action.weight = 1;
    }
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
  CV.triggerHurt = function (st, entity, fromPos) {
    st.hurt = 1;
    if (!st.loco || !entity) return;
    Loco.applyHit(st.loco, entity, fromPos);
    Act.react(st.action, -st.loco.hitDir.z, -st.loco.hitDir.x);
  };

  /* --- Curvas ------------------------------------------------------------- */
  function smooth(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); }

  /* =========================================================================
   * Pose
   * ====================================================================== */
  CV.buildPose = function (out, st, entity, pos, yaw, palette) {
    out.length = 0;
    /* v0.14: además de las piezas procedurales exponemos los pivotes de un
       esqueleto humanoide. El backend GLB consume estas matrices para animar
       la malla skinned SIN crear un segundo sistema de locomoción/combate. */
    var rig = st.rigPose || (st.rigPose = {});

    var loadout = LOADOUT[entity.classId] || LOADOUT.devastador;
    var prof = loadout.profile;
    var arche = CV.archetypeOf(entity.classId);
    var race = Arena.Data.getRace(entity.raceId);
    var feat = race.features;
    /* CONSTITUCIÓN COMPUESTA: raza × clase, acotada por `BUILD_LIMITS`. Un
       Guardián es ancho ANTES de ser elfo y un Centinela enjuto ANTES de ser
       elfo; multiplicar las dos tablas es lo que permite añadir una raza sin
       reescribir seis clases. El resultado se cachea por personaje: esto se
       consulta cada fotograma. */
    var build = st._build = Arena.Data.composeBuild(race.build, prof.build, st._build);

    var lc = st.loco;
    var cfg = st.cfg;
    // Adaptador: el resto de buildPose sigue leyendo un objeto `L`, así que la
    // salida del controlador se traduce una sola vez aquí.
    var L = {
      lean: lc.leanF, sideLean: lc.leanR,
      torsoTwist: lc.torsoYaw, hipRoll: lc.hipRoll,
      bob: lc.hipHeight,
      armSwing: Math.sin(lc.cycle * Math.PI * 2) * (cfg.armSwing + cfg.armSwingRun * lc.moveSpeed)
                * lc.moveSpeed * Math.max(0.22, Math.abs(lc.moveForward) + Math.abs(lc.moveRight) * 0.55)
                * (lc.motionProfile ? lc.motionProfile.arm : 1)
    };
    var breath = Math.sin(lc.breathe) * cfg.breathAmount * (1 - lc.moveSpeed);

    /* --- Capa de control -------------------------------------------------
     * Cada estado se lee distinto a veinte unidades: derribo en el suelo,
     * aturdimiento DE PIE y tambaleante, raíz clavada y tensa, silencio sólo en
     * cabeza y manos. Las reglas ya han decidido qué impide cada uno; aquí sólo
     * se decide cómo se ve. La mezcla evita que enderezarse sea un corte. */
    var ccW = st.ccBlend;
    var cc = st.cc;
    var ccPitch = 0, ccRoll = 0, ccLift = 0, ccKnee = 0, ccArm = 0, ccHead = 0;
    // Un cuerpo TENDIDO estira las piernas a lo largo del suelo. Si siguen
    // persiguiendo el punto donde estaban los pies de pie, el personaje se
    // pliega sobre sí mismo y el derribo parece un ovillo, no una caída.
    var ccProne = (cc && cc.rootPitch > 0.8) ? ccW : 0;
    if (cc && ccW > 0.001) {
      // El tambaleo del aturdimiento es un ciclo lento propio, no ruido.
      var sway = cc.sway ? Math.sin(st.ccTime * 4.3) * 0.09 * cc.sway : 0;
      ccPitch = cc.rootPitch * ccW;
      ccRoll = (sway + (cc.headTilt ? 0 : 0)) * ccW;
      ccLift = cc.rootLift * ccW;
      ccKnee = cc.kneeBend * ccW;
      ccArm = cc.armDrop * ccW;
      ccHead = cc.headTilt * ccW;
    }

    // La altura visible se ancla a la del cuerpo simulado: el modelo mide lo que
    // dice la simulación, y el rasgo racial sólo lo modula. Así el nameplate, la
    // cámara y las cápsulas de colisión no se despegan nunca del modelo.
    var lbScale = build.limbs;
    var hipRest = hipRestFor(lbScale);
    var modelHeight = hipRest + TORSO_ABOVE_HIP;
    var vScale = (entity.height / modelHeight) * build.height;
    var hScale = vScale * build.shoulders;

    var root = M.create();
    M.composeFull(root,
      { x: pos.x, y: pos.y + ccLift, z: pos.z },
      yaw, -ccPitch, ccRoll,
      { x: hScale, y: vScale, z: hScale });

    var skin = palette.skin, cloth = palette.cloth, metal = palette.metal;
    var accent = palette.accent, steel = palette.steel, hair = palette.hair;
    var trim = palette.trim, team = palette.team, eyeCol = palette.eye;

    function node(parent, x, y, z, pitch, yawL, roll, sx, sy, sz) {
      var local = M.create();
      M.composeFull(local, { x: x, y: y, z: z }, yawL || 0, pitch || 0, roll || 0,
        { x: sx === undefined ? 1 : sx, y: sy === undefined ? 1 : sy, z: sz === undefined ? 1 : sz });
      var w = M.create();
      M.multiply(w, parent, local);
      return w;
    }
    function draw(m, mesh, color, emissive) {
      out.push({
        mesh: mesh, matrix: m, color: color || cloth, emissive: emissive || null,
        material: CV.materialOf(mesh)
      });
    }

    /* --- SOCKETS DE EQUIPO ------------------------------------------------
     *
     * Todo lo que distingue a una clase de otra —hombreras, peto, faldar,
     * capucha, bolsas, trampas, talismanes— entra por aquí. El perfil de
     * `data/classVisuals.js` dice qué pieza va en qué socket, con qué
     * desplazamiento y de qué color; este bloque sólo compone matrices.
     *
     * Sin esto habría seis ramas de `if (classId === ...)` en mitad del
     * renderer, que es exactamente la deuda que el pase de identidad venía a
     * evitar. Añadir una séptima clase no toca una sola línea de este fichero.
     *
     * Los sockets terminados en `Pair` se emiten una vez por lado con `x`,
     * `yaw` y `roll` invertidos; una pieza con `side` sale sólo en ese lado, y
     * ahí es donde vive la asimetría del Devastador y del Rastreador.        */
    /* La tabla se REUTILIZA entre fotogramas. Un objeto literal aquí serían
       cuatro asignaciones por fotograma en partida —una por personaje—, y
       `CLAUDE.md` §14 es explícito con las reservas en rutas calientes. */
    var COLORS = st._colors || (st._colors = {});
    COLORS.cloth = cloth; COLORS.metal = metal; COLORS.steel = steel;
    COLORS.leather = palette.leather; COLORS.wood = palette.wood;
    COLORS.trim = trim; COLORS.accent = accent; COLORS.skin = skin;
    COLORS.hair = hair; COLORS.team = team; COLORS.teamDark = palette.teamDark;
    function colorOf(name) { return (name && COLORS[name]) || cloth; }

    function emit(socket, parent, side, counterAngle) {
      var list = prof.attach && prof.attach[socket];
      if (!list) return;
      side = side || 1;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (it.side !== undefined && it.side !== side) continue;
        var p = it.pos || ZERO3, r = it.rot || ZERO3;
        var sc = it.scale === undefined ? 1 : it.scale;
        var sx, sy, sz;
        if (typeof sc === 'number') { sx = sy = sz = sc; }
        else { sx = sc[0]; sy = sc[1]; sz = sc[2]; }
        // `counterPitch` compensa el ángulo del hueso padre: un faldón atado al
        // muslo tiene que seguirlo SIN girar tanto como él, o el paso lo
        // atraviesa. El renderer no elige el número; el perfil sí.
        var pitch = r[0] + (it.counterPitch ? -(counterAngle || 0) * it.counterPitch : 0);
        var col = colorOf(it.color);
        var em = null;
        if (it.glow) em = [col[0] * it.glow, col[1] * it.glow, col[2] * it.glow];
        draw(node(parent, p[0] * side, p[1], p[2], pitch, r[1] * side, r[2] * side, sx, sy, sz),
          it.mesh, col, em);
      }
    }

    /* --- CAPA SUPERIOR ----------------------------------------------------
     * Se resuelve ANTES que el tronco porque la acción de combate contribuye
     * rotación de pecho —la cadena pecho → hombro → codo → arma es lo que hace
     * que un golpe parezca un acto físico— y flexión de rodillas al aterrizar
     * un golpe pesado. Las piernas siguen siendo asunto exclusivo de la
     * locomoción: por eso un arquero dispara mientras strafea. */
    var A = Act.upperBodyPose(st.action, cfg, arche, loadout, st.cast, st.casting, L.armSwing);
    // Un control duro deja caer los brazos y hunde las rodillas.
    if (ccArm > 0) {
      A.left.pitch += (0.15 - A.left.pitch) * ccArm;
      A.right.pitch += (0.15 - A.right.pitch) * ccArm;
      A.left.elbow += (0.25 - A.left.elbow) * ccArm;
      A.right.elbow += (0.25 - A.right.elbow) * ccArm;
      A.chestPitch *= (1 - ccArm);
      A.chestYaw *= (1 - ccArm);
      A.draw *= (1 - ccArm);
    }

    // Centro de masa: la pelvis se desplaza hacia la pierna que soporta el peso
    // y cae en el apoyo. Sin esto el personaje flota sobre sus piernas.
    var kneeSink = (A.kneeAbsorb || 0) + ccKnee * 0.18;
    var hipY = hipRest + L.bob + breath - kneeSink;
    var hipX = lc.hipShiftX;

    /* --- Cadera y tronco articulado --------------------------------------
     *
     * `gk` separa el GROSOR del tronco de la ANCHURA de hombros. Sin él,
     * `build.shoulders` escalaba el personaje entero en horizontal y `girth`
     * no hacía absolutamente nada: un Devastador de hombros anchos tenía
     * también la cintura ancha, y la V del atacante no existía. Se aplica en
     * nodos HOJA para que no arrastre a brazos ni cabeza. */
    var gk = build.girth / Math.max(0.05, build.shoulders);
    var hips = node(root, hipX, hipY, 0, 0, lc.hipYaw, L.hipRoll);
    rig.Hips = hips;
    draw(node(hips, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'pelvis', cloth);
    emit('hips', hips, 1);
    emit('hipsPair', hips, -1);
    emit('hipsPair', hips, 1);

    var abdomen = node(hips, 0, 0.06, 0, -lc.torsoPitch * 0.45, lc.torsoYaw * 0.3, lc.torsoRoll * 0.4);
    rig.Spine = abdomen;
    draw(node(abdomen, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'abdomen', cloth);

    // El pecho asume parte del seguimiento del objetivo, la cabeza completa el
    // resto, y la acción de combate suma su propia torsión encima.
    var chest = node(abdomen, 0, 0.14, 0,
      -lc.torsoPitch * 0.55 + A.chestPitch,
      lc.torsoYaw * 0.5 + lc.headYaw * cfg.chestTrackRatio + A.chestYaw,
      lc.torsoRoll * 0.6 + (A.chestRoll || 0));
    rig.Chest = chest;
    draw(node(chest, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'ribcage', cloth);

    /* Torso y hombros, según el perfil de la clase. */
    emit('chest', chest, 1);
    emit('chestPair', chest, -1);
    emit('chestPair', chest, 1);

    /* --- Cabeza ----------------------------------------------------------- */
    var hs = build.head;
    var neckM = node(chest, 0, 0.30, 0, L.lean * 0.3, 0, 0, 1, build.neck, 1);
    rig.Neck = neckM;
    draw(neckM, 'neck', skin);
    // La cabeza contrarresta la inclinación del torso: la mirada se mantiene al
    // frente aunque el cuerpo se incline, como en cualquier ser vivo.
    var head = node(chest, 0, 0.40, 0.005,
      lc.torsoPitch * cfg.torsoCounterRate + lc.headPitch + ccHead * 0.5,
      lc.headYaw * (1 - cfg.chestTrackRatio) - lc.torsoYaw * 0.4,
      -lc.torsoRoll * 0.3 + ccHead, hs, hs, hs);
    rig.Head = head;
    draw(head, 'skull', skin);
    draw(head, 'jaw', skin);
    draw(head, 'brow', skin);
    draw(head, 'nose', skin);

    // El pelo se ve o no según lo tape el tocado. Es un dato del perfil, no una
    // condición sobre el atuendo: el Vinculador lleva diadema y melena, el
    // Guardián yelmo cerrado y nada.
    if (prof.hair) {
      draw(node(head, 0, 0.012, -0.005), 'hairCap', hair);
      draw(node(head, 0, 0.010, 0, 0.42, 0, 0), 'hairTail', hair);
    }

    var el = feat.earLength;
    draw(node(head, -0.100, 0.005, -0.02, feat.earPitch, -0.60, -feat.earFlare, el, el, el), 'ear', skin);
    draw(node(head, 0.100, 0.005, -0.02, feat.earPitch, 0.60, feat.earFlare, el, el, el), 'ear', skin);

    var eg = race.palette.eyeGlow;
    var eyeEm = feat.glowingEyes ? [eyeCol[0] * eg, eyeCol[1] * eg, eyeCol[2] * eg] : null;
    // Los ojos van justo bajo la ceja y por delante del plano de los pómulos:
    // es lo que hace que a distancia se sepa hacia dónde mira el personaje.
    draw(node(head, -0.052, 0.008, 0.104, 0, -0.18, 0), 'eye', eyeCol, eyeEm);
    draw(node(head, 0.052, 0.008, 0.104, 0, 0.18, 0), 'eye', eyeCol, eyeEm);

    emit('head', head, 1);

    /* --- Piernas con rodilla y tobillo ------------------------------------ */
    var robed = prof.legs === 'hidden';
    if (robed && prof.robe) {
      /* La túnica no es física de tela, pero tampoco puede ser una campana
         soldada a la pelvis. Combina paso, aceleración, strafe y giro en una
         respuesta pequeña: el dobladillo acusa el movimiento sin convertirse
         en gelatina ni alterar un solo dato de simulación. */
      var robeStep = Math.sin(lc.cycle * Math.PI * 2) * 0.052 * lc.moveSpeed
                   * (lc.motionProfile ? lc.motionProfile.lift : 1);
      var robePitch = lc.leanF * 0.38 + robeStep * (lc.moveForward >= 0 ? 1 : -0.52)
                    - lc.acceleration * 0.020 + lc.deceleration * 0.016;
      var robeRoll = lc.torsoRoll * 0.32 - lc.moveRight * lc.moveSpeed * 0.060;
      var robeYaw = -lc.turnRate * 0.035;
      var robeM = node(hips, 0, 0.06, 0, robePitch, robeYaw, robeRoll);
      draw(robeM, prof.robe.mesh, colorOf(prof.robe.color));
      if (prof.robe.trim) draw(robeM, prof.robe.trim, trim);
    }
    {
      /* PIERNAS POR CINEMÁTICA INVERSA.
       *
       * El controlador ya decidió DÓNDE está cada pie en el mundo, y mientras
       * está apoyado ese punto no se mueve (foot locking). Aquí sólo se resuelve
       * qué ángulos de cadera y rodilla hacen falta para alcanzarlo. Es
       * exactamente el orden inverso al de antes —donde se elegían ángulos y el
       * pie caía donde cayera— y es la razón por la que ya no patina.
       */
      var lb = lbScale;
      var thighLen = THIGH * lb, shinLen = SHIN * lb;
      var cosY = Math.cos(-yaw), sinY = Math.sin(-yaw);

      for (var i = 0; i < 2; i++) {
        var leg = lc.legs[i];
        var side = (i === 0) ? -1 : 1;
        var hipLocalX = side * cfg.stanceWidth + hipX * 0.5;

        // Pie de espacio mundo a espacio local del personaje.
        var wx = leg.footPos.x - pos.x;
        var wz = leg.footPos.z - pos.z;
        var lx = wx * cosY + wz * sinY;
        var lz = -wx * sinY + wz * cosY;

        var hipOrigin = { x: hipLocalX, y: hipY - HIP_SOCKET, z: 0 };
        var footTarget = { x: lx, y: (leg.footPos.y - pos.y) + ANKLE_HEIGHT, z: lz };

        /* Puntapié procedural del guerrero: la pierna derecha deja temporalmente
           el objetivo de locomoción y extiende el pie hacia delante. Es sólo
           presentación; el RELEASE y el CC siguen siendo de simulación. */
        if (side > 0 && A.kick > 0.001 && arche === 'melee') {
          var kk = A.kick;
          footTarget.z += 0.54 * kk;
          footTarget.y += 0.24 * Math.sin(Math.min(1, kk) * Math.PI * 0.72);
          footTarget.x += 0.035 * kk;
        }

        if (ccProne > 0) {
          // Objetivo "tendido": pierna extendida en la prolongación del cuerpo.
          // Como la raíz ya está girada hacia el suelo, extender hacia abajo en
          // espacio local ES tumbarse cuan largo es.
          var flatY = hipOrigin.y - (thighLen + shinLen) * 0.97;
          footTarget.x += (hipLocalX * 1.35 - footTarget.x) * ccProne;
          footTarget.y += (flatY - footTarget.y) * ccProne;
          footTarget.z += (0 - footTarget.z) * ccProne;
        }

        var ik = SK.solveTwoBoneIK(hipOrigin, footTarget, thighLen, shinLen, st._ik);

        var thighM = node(hips, hipLocalX - hipX, -HIP_SOCKET, 0, ik.pitch, 0, ik.roll, 1, lb, 1);
        var kneeM, ankleM, toe;
        if (robed) {
          /* Bajo la túnica no se ve la pierna, pero los PIES SÍ asoman, y por
             eso siguen resolviéndose por IK. Sin ellos el mago se desplaza como
             un cono deslizándose: no hay ni un fotograma que diga que camina. */
          kneeM = node(thighM, 0, -THIGH, 0, ik.bend, 0, 0);
          toe = (1 - leg.plantWeight) * 0.35;
          ankleM = node(kneeM, 0, -SHIN, 0, -ik.pitch - ik.bend + toe, 0, -ik.roll);
          if (side < 0) { rig.LeftUpperLeg = thighM; rig.LeftLowerLeg = kneeM; rig.LeftFoot = ankleM; }
          else { rig.RightUpperLeg = thighM; rig.RightLowerLeg = kneeM; rig.RightFoot = ankleM; }
          draw(ankleM, 'foot', palette.leather);
          emit('anklePair', ankleM, side);
          continue;
        }
        draw(node(thighM, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'thigh', cloth);
        // Faldones y quijotes: cada pieza sigue a SU muslo, así el paso los abre
        // en vez de atravesarlos. `counterPitch` la deja seguir al hueso sin
        // girar tanto como él; una pieza rígida se delata como decorado.
        emit('thighPair', thighM, side, ik.pitch);
        kneeM = node(thighM, 0, -THIGH, 0, ik.bend, 0, 0);
        draw(node(kneeM, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'knee', cloth);
        draw(node(kneeM, 0, 0, 0, 0, 0, 0, gk, 1, gk), 'shin', cloth);
        emit('kneePair', kneeM, side);
        // El tobillo cancela cadera y rodilla: el pie queda plano en el suelo
        // durante el apoyo y sólo se inclina en el vuelo.
        toe = (1 - leg.plantWeight) * 0.35;
        ankleM = node(kneeM, 0, -SHIN, 0, -ik.pitch - ik.bend + toe, 0, -ik.roll);
        if (side < 0) { rig.LeftUpperLeg = thighM; rig.LeftLowerLeg = kneeM; rig.LeftFoot = ankleM; }
        else { rig.RightUpperLeg = thighM; rig.RightLowerLeg = kneeM; rig.RightFoot = ankleM; }
        draw(ankleM, 'foot', palette.leather);
        emit('anklePair', ankleM, side);
      }
    }

    /* Capa: NO es una pieza estática colgada del pecho. Acusa la velocidad, la
       aceleración, el strafe y el giro, porque una capa quieta sobre un
       personaje que corre es lo que más delata a un maniquí. */
    if (prof.cloak) {
      var capePitch = (prof.cloak.rest || 0.12) + lc.moveSpeed * 0.34
                    + lc.acceleration * 0.05 - lc.deceleration * 0.025;
      var capeRoll = -lc.moveRight * lc.moveSpeed * 0.045
                   + Math.sin(lc.cycle * Math.PI * 2) * 0.018 * lc.moveSpeed;
      var capeYaw = -lc.turnRate * 0.040;
      var cpos = prof.cloak.pos || [0, 0.22, -0.13];
      draw(node(chest, cpos[0], cpos[1], cpos[2], capePitch, capeYaw, capeRoll),
        prof.cloak.mesh, colorOf(prof.cloak.color));
    }

    /* --- Brazos con codo -------------------------------------------------- */
    var arms = [{ x: -0.205, s: A.left, side: -1 }, { x: 0.205, s: A.right, side: 1 }];
    var hands = [null, null];
    for (var a = 0; a < 2; a++) {
      var q = arms[a];
      var upper = node(chest, q.x, 0.20, 0, q.s.pitch, q.s.yaw, q.s.roll);
      draw(upper, 'shoulderBall', skin);
      draw(upper, 'upperArm', skin);
      var elbowM = node(upper, 0, -UPPER_ARM, 0, q.s.elbow, 0, 0);
      draw(elbowM, 'elbow', skin);
      draw(elbowM, 'lowerArm', skin);
      emit('elbowPair', elbowM, q.side);
      hands[a] = node(elbowM, 0, -LOWER_ARM, 0, q.s.wrist || 0, 0, 0);
      if (q.side < 0) { rig.LeftUpperArm = upper; rig.LeftLowerArm = elbowM; rig.LeftHand = hands[a]; }
      else { rig.RightUpperArm = upper; rig.RightLowerArm = elbowM; rig.RightHand = hands[a]; }
      draw(hands[a], 'hand', skin);
    }
    var handL = hands[0], handR = hands[1];
    emit('handL', handL, 1);
    emit('handR', handR, 1);

    /* --- Armas ------------------------------------------------------------
     *
     * El TIPO de arma (espada/arco/báculo) lo fija `data/animConfig.js` y es lo
     * que gobierna la animación. La MALLA concreta la elige el perfil de clase:
     * por eso el espadón del Devastador y la hoja corta del Guardián comparten
     * timings sin compartir silueta, y el arco largo del Centinela y el recurvo
     * del Rastreador se disparan igual midiendo el doble uno que otro.        */
    var W = prof.right;
    var sc = loadout.scale;
    /* Corrección de agarre por clase. La POSE del arma la decide la capa de
       acciones —es animación, y es común al arquetipo—; esto sólo ladea la
       pieza en la mano, que es una decisión de modelo. Sin ello un arco largo
       queda perfectamente de canto a la cámara y el rasgo que define al
       Centinela desaparece justo en la vista frontal. */
    var wr = (W && W.rot) || ZERO3;
    if (W && W.kind === 'sword') {
      draw(node(handR, 0, -0.045, 0.015, A.weaponPitch + wr[0], (A.weaponYaw || 0) + wr[1],
        A.weaponRoll + wr[2], sc, sc, sc), W.mesh, colorOf(W.color));

    } else if (W && W.kind === 'bow') {
      // Al soltar, el arco vibra un instante: sin ese retroceso el disparo no
      // tiene consecuencia física, sólo desaparece una flecha.
      var shake = A.bowShake || 0;
      var bowM = node(handL, 0, -0.05, 0.03,
        A.bowPitch + wr[0] + Math.sin(st.action.idleNoise * 47) * shake,
        A.bowYaw + wr[1] + Math.cos(st.action.idleNoise * 61) * shake, wr[2], sc, sc, sc);
      draw(bowM, W.mesh, colorOf(W.color));
      // La cuerda mide lo que mide el arco: un arco largo con la cuerda del
      // recurvo se lee como un arco roto.
      if (W.string) draw(node(bowM, 0, 0, -0.015 - A.draw * 0.24), W.string, [0.62, 0.60, 0.54]);
      if (A.draw > 0.05) {
        draw(node(bowM, 0, 0, -0.28 - A.draw * 0.18, Math.PI / 2, 0, 0), 'arrow', [0.60, 0.48, 0.32]);
      }

    } else if (W && W.kind === 'staff') {
      /* `offset` separa el arma del cuerpo. Un báculo pegado al costado y un
         arco pegado al costado dan el mismo contorno; con el hueco entre brazo
         y vara, el mago deja de leerse como un arquero con un palo. */
      var wo = W.offset || ZERO3;
      var staffM = node(handR, (A.weaponOffsetX || 0) + wo[0], -0.045 + (A.weaponOffsetY || 0) + wo[1],
        0.01 + (A.weaponOffsetZ || 0) + wo[2], A.weaponPitch + wr[0], (A.weaponYaw || 0) + wr[1],
        A.weaponRoll + wr[2], sc, sc, sc);
      draw(staffM, W.mesh, colorOf(W.color));
      var glow = 0.5 + st.cast * 2.6 + A.gemFlash * 2.2;
      // El foco del báculo brilla con el casteo: es el ancla visual del cast y
      // la fuente de la luz puntual del caster en el backend de Three.js.
      draw(node(staffM, 0, W.gemY === undefined ? 0.90 : W.gemY, 0), 'gem', accent,
        [accent[0] * glow, accent[1] * glow, accent[2] * glow]);
    }

    var LW = prof.left;
    if (LW) {
      var lp = LW.pos || ZERO3, lr = LW.rot || ZERO3;
      var lem = null, lcol = colorOf(LW.color);
      // El orbe del Vinculador responde al casteo igual que la gema del báculo.
      if (LW.kind === 'orb') {
        var og = 0.6 + st.cast * 2.2;
        lem = [lcol[0] * og, lcol[1] * og, lcol[2] * og];
      }
      draw(node(handL, lp[0], lp[1], lp[2], lr[0], lr[1], lr[2]), LW.mesh, lcol, lem);
    }

    if (st.cast > 0.04) {
      var g2 = 0.5 + st.cast * 0.8, e2 = 1.6 + st.cast * 4;
      draw(node(chest, 0, 0.10, 0.38, 0, 0, 0, g2, g2, g2), 'orb', accent,
        [accent[0] * e2, accent[1] * e2, accent[2] * e2]);
    }
    return out;
  };

  /* =========================================================================
   * Paleta
   * ====================================================================== */
  /**
   * Paleta de un personaje. La familia cromática la elige la CLASE, no el
   * arquetipo: antes las dos clases de cada arquetipo compartían atuendo y sólo
   * se distinguían por el tinte de bando, que es exactamente lo que hacía que
   * `centinela` y `rastreador` fueran el mismo muñeco.
   *
   * El tinte de bando se mezcla MUY poco (5–7 %) y va concentrado en piezas
   * estrechas: si baña el traje entero, el atuendo deja de contar quién es el
   * personaje y sólo cuenta de qué equipo es.
   */
  CV.paletteFor = function (entity, isFriendly) {
    var race = Arena.Data.getRace(entity.raceId);
    var prof = Arena.Data.classVisualOf(entity.classId);
    var pal = Arena.Data.VISUAL_PALETTES[prof.palette] || Arena.Data.VISUAL_PALETTES.vanguard;
    var teamTint = isFriendly ? [0.18, 0.48, 1.00] : [1.00, 0.20, 0.14];
    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    return {
      skin: entity.skinTone || race.palette.skin,
      hair: entity.hairColor || race.palette.hair,
      eye: race.palette.eye,
      cloth: mix(pal.cloth, teamTint, 0.065),
      metal: mix(pal.metal, teamTint, 0.055),
      steel: pal.metal,
      leather: pal.leather,
      wood: pal.wood,
      trim: pal.trim,
      accent: mix(race.palette.eye, [1, 1, 1], 0.25),
      team: teamTint,
      teamDark: [teamTint[0] * 0.62, teamTint[1] * 0.62, teamTint[2] * 0.62]
    };
  };

  Arena.Render.CharacterVisual = CV;
});
