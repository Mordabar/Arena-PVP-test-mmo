/* =============================================================================
 * render/anim/locomotion.js — Controlador visual de locomoción.
 *
 * DESACOPLADO DE LA SIMULACIÓN. Lee dónde está la entidad y deduce cómo debería
 * verse moviéndose. No decide ni una sola posición real: la verdad sigue siendo
 * `entity.pos`, y este módulo jamás la escribe.
 *
 * TRES APORTACIONES SOBRE EL CICLO SINUSOIDAL ANTERIOR
 *
 * 1. MÁQUINA DE ESTADOS con transiciones interpoladas. Nunca hay un salto de
 *    pose: arrancar, correr, frenar y girar son estados con curvas propias.
 *
 * 2. CICLO DE PASO POR FASES DE CONTACTO, no por seno. Cada pierna recorre
 *    CONTACT → DOWN → PASSING → UP → SWING, y se sabe en todo momento si el pie
 *    está apoyado. De ahí sale el FOOT LOCKING: mientras el pie está plantado,
 *    conserva su punto de contacto en el mundo y la pierna se resuelve por IK
 *    para alcanzarlo. Eso es lo que elimina el deslizamiento.
 *
 * 3. CENTRO DE MASA. La pelvis se desplaza hacia la pierna que soporta el peso,
 *    cae en el apoyo, se adelanta al acelerar y se retrasa al frenar.
 *
 * Todos los parámetros vienen de data/animConfig.js. Aquí no hay números de
 * diseño, sólo la mecánica que los usa.
 * ========================================================================== */
Arena.define('render/anim/locomotion',
  ['render/anim/skeleton', 'data/animConfig'], function (Arena) {
  'use strict';

  var SK = Arena.Render.Skeleton;
  var V = Arena.Math.Vec3;
  var damp = SK.damp, clamp = SK.clamp, smooth = SK.smooth;

  var Loco = {};

  /* --- Estados de locomoción ---------------------------------------------- */
  Loco.STATE = {
    IDLE: 'IDLE',
    START: 'START',
    FORWARD: 'LOCOMOTION_FORWARD',
    BACKWARD: 'LOCOMOTION_BACKWARD',
    STRAFE_L: 'LOCOMOTION_STRAFE_LEFT',
    STRAFE_R: 'LOCOMOTION_STRAFE_RIGHT',
    DIAGONAL: 'LOCOMOTION_DIAGONAL',
    STOP: 'STOP',
    TURN_L: 'TURN_IN_PLACE_LEFT',
    TURN_R: 'TURN_IN_PLACE_RIGHT'
  };

  /* --- Fases del pie ------------------------------------------------------- */
  Loco.PHASE = { CONTACT: 'CONTACT', DOWN: 'DOWN', PASSING: 'PASSING', UP: 'UP', SWING: 'SWING' };

  /* =========================================================================
   * Estado por entidad
   * ====================================================================== */
  Loco.createState = function (cfg) {
    return {
      cfg: cfg,
      state: Loco.STATE.IDLE,
      statePrev: Loco.STATE.IDLE,
      stateBlend: 1,          // 0 = acaba de cambiar, 1 = asentado

      /* Parámetros continuos de intención (sección 3 del brief) */
      moveForward: 0, moveRight: 0, moveSpeed: 0,
      turnRate: 0, acceleration: 0, deceleration: 0,
      isMoving: false, isStarting: false, isStopping: false, isTurning: false,

      /* Ciclo de paso: un reloj normalizado 0..1, cada pierna desfasada 0.5.
         `duty`, `stride` y `stepFreq` se DERIVAN de la velocidad real en cada
         actualización; los valores iniciales sólo cubren el primer fotograma. */
      cycle: 0, duty: cfg.dutyFactor, stride: cfg.strideLength,
      stepFreq: cfg.stepFrequency, gait: 0,
      legs: [makeLeg(0.0), makeLeg(0.5)],

      /* Centro de masa */
      hipShiftX: 0, hipShiftZ: 0, hipHeight: 0, hipRoll: 0, hipYaw: 0,
      leanF: 0, leanR: 0,

      /* Torso */
      torsoYaw: 0, torsoPitch: 0, torsoRoll: 0,
      headYaw: 0, headPitch: 0,

      /* Arranque, frenado, giro */
      startTimer: 0, stopTimer: 0,
      turnAccum: 0, turnStepTimer: 0, turnStepSide: 1,

      /* Idle: tres relojes independientes. Con uno solo, el ciclo se reconoce
         a simple vista y el personaje parece maquinaria respirando. */
      breathe: 0, weightShift: 0, idleSway: 0, idleHead: 0,
      idleAmount: 0,          // 0..1 — cuánto pesa el idle, según quietud
      breathValue: 0, swayValue: 0, headIdleValue: 0,

      /* Reacción al daño */
      hitDir: { x: 0, z: 0 }, hitAmount: 0,

      /* Referencia previa para calcular velocidad y giro */
      lastPos: null, lastYaw: 0, lastSpeed: 0,
      _ik: { pitch: 0, roll: 0, bend: 0, reach: 0 }
    };
  };

  function makeLeg(offset) {
    return {
      offset: offset,
      phase: Loco.PHASE.SWING,
      t: offset,              // posición en el ciclo, 0..1
      planted: false,
      plantWeight: 0,         // 0..1, suaviza el enganche y la soltada
      lock: { x: 0, y: 0, z: 0 },   // punto de contacto en espacio MUNDO
      hasLock: false,
      footPos: { x: 0, y: 0, z: 0 },  // objetivo actual, espacio mundo
      ikPitch: 0, ikRoll: 0, ikBend: 0.1, ankle: 0
    };
  }

  /* =========================================================================
   * Actualización
   * ====================================================================== */

  /**
   * @param st     estado de locomoción
   * @param entity entidad de simulación (SÓLO LECTURA)
   * @param dt     segundos reales
   */
  Loco.update = function (st, entity, dt) {
    var cfg = st.cfg;
    if (!st.lastPos) { st.lastPos = V.clone(entity.pos); st.lastYaw = entity.yaw; }

    /* --- 1. Intención: velocidad y dirección en espacio local ------------ */
    var dx = entity.pos.x - st.lastPos.x;
    var dz = entity.pos.z - st.lastPos.z;
    V.copy(st.lastPos, entity.pos);

    var dist = Math.sqrt(dx * dx + dz * dz);
    var rawSpeed = dist / Math.max(dt, 1e-4);
    var norm = clamp(rawSpeed / Math.max(entity.moveSpeedBase, 0.001), 0, 1.2);

    // Aceleración y frenado con ritmos distintos: el cuerpo tarda más en
    // arrancar que en pararse, y esa asimetría es la que da sensación de peso.
    var rate = norm > st.moveSpeed ? cfg.accelRate : cfg.decelRate;
    var prevSpeed = st.moveSpeed;
    st.moveSpeed = damp(st.moveSpeed, norm, rate, dt);
    var dSpeed = (st.moveSpeed - prevSpeed) / Math.max(dt, 1e-4);
    st.acceleration = clamp(dSpeed / 8, 0, 1);
    st.deceleration = clamp(-dSpeed / 8, 0, 1);

    var f = 0, r = 0;
    if (dist > 1e-5) {
      var sy = Math.sin(entity.yaw), cy = Math.cos(entity.yaw);
      f = (dx * sy + dz * cy) / dist;
      r = (dx * cy - dz * sy) / dist;
    }
    st.moveForward = damp(st.moveForward, f * (norm > 0.02 ? 1 : 0), cfg.dirBlendRate, dt);
    st.moveRight = damp(st.moveRight, r * (norm > 0.02 ? 1 : 0), cfg.dirBlendRate, dt);

    var dyaw = V.angleDelta(st.lastYaw, entity.yaw);
    st.lastYaw = entity.yaw;
    st.turnRate = damp(st.turnRate, clamp((dyaw / Math.max(dt, 1e-4)) / 4, -1, 1), cfg.turnBlendRate, dt);

    Loco._updateIdle(st, dt);
    if (st.hitAmount > 0) st.hitAmount = Math.max(0, st.hitAmount - dt * cfg.hitReactDecay);

    /* --- 2. Máquina de estados -------------------------------------------- */
    Loco._updateState(st, entity, dt);

    /* --- 3. Reloj del ciclo de paso ---------------------------------------
     *
     * AQUÍ ESTÁ LA RELACIÓN QUE IMPIDE EL PATINAJE, y conviene entenderla antes
     * de tocar un número.
     *
     * En un ciclo de duración T el cuerpo avanza D = v·T. Cada pie planta una
     * vez por ciclo, así que mientras está apoyado —una fracción `duty` del
     * ciclo— retrocede respecto al cuerpo exactamente `duty·D`. Ese recorrido es
     * lo único que la pierna tiene que ser capaz de cubrir, y es lo que
     * configuramos como `strideLength`.
     *
     * De ahí sale la cadencia, no al revés:
     *
     *     zancada útil  s = strideLength ajustada por velocidad y dirección
     *     cadencia      f = v · duty / s
     *
     * Si la cadencia se fijara a mano, cualquier cambio de velocidad rompería la
     * correspondencia y el pie resbalaría, por muy bien anclado que estuviera.
     *
     * Y por eso el `duty` BAJA con la velocidad: corriendo aparece fase de vuelo
     * y el cuerpo cubre más terreno del que da la longitud de la pierna. Sin esa
     * fase, correr rápido obliga a estirar la zancada más allá de lo que la
     * cadera alcanza, y la pierna se queda clavada apuntando al horizonte.
     */
    var gait = smooth((st.moveSpeed - 0.25) / 0.55);      // 0 = andar · 1 = correr
    var dutyRun = cfg.dutyFactorRun === undefined ? cfg.dutyFactor : cfg.dutyFactorRun;
    st.duty = cfg.dutyFactor + (dutyRun - cfg.dutyFactor) * gait;
    st.gait = gait;

    // Retroceder y desplazarse de lado acortan el paso: eso es lo que los hace
    // verse distintos, no reproducir el mismo ciclo a otra velocidad.
    var dirRatio = 1;
    if (st.moveForward < -0.2) dirRatio = cfg.backwardRatio;
    else if (Math.abs(st.moveRight) > 0.5) dirRatio = cfg.strafeRatio;

    var gain = cfg.strideSpeedGain === undefined ? 0.45 : cfg.strideSpeedGain;
    st.stride = cfg.strideLength * ((1 - gain) + gain * clamp(st.moveSpeed, 0, 1.2)) * dirRatio;

    var speedU = st.moveSpeed * Math.max(0.001, entity.moveSpeedBase);
    var freq = speedU * st.duty / Math.max(0.05, st.stride);
    // Topes de cadencia: ni una máquina de coser ni un paso de procesión. Si la
    // velocidad los desborda, se alarga la zancada, que es lo que hace un
    // corredor de verdad.
    var maxFreq = cfg.stepFrequency * 2.1, minFreq = cfg.stepFrequency * 0.45;
    if (freq > maxFreq) { freq = maxFreq; st.stride = speedU * st.duty / freq; }
    else if (freq < minFreq && speedU > 0.05) { freq = minFreq; st.stride = speedU * st.duty / freq; }
    st.stepFreq = freq;

    if (st.isMoving) st.cycle = (st.cycle + dt * freq) % 1;

    /* --- 4. Pies: fases, plantado y foot locking -------------------------- */
    Loco._updateLegs(st, entity, dt);

    /* --- 5. Centro de masa ------------------------------------------------ */
    Loco._updateCenterOfMass(st, dt);

    /* --- 6. Torso y cabeza ------------------------------------------------ */
    Loco._updateTorso(st, dt);
  };

  /* =========================================================================
   * Máquina de estados
   * ====================================================================== */
  Loco._updateState = function (st, entity, dt) {
    var cfg = st.cfg;
    var S = Loco.STATE;
    var moving = st.moveSpeed > 0.06;
    var wasMoving = st.isMoving;
    st.isMoving = moving;

    var next = st.state;

    if (!moving) {
      // Parado. ¿Está girando lo bastante para justificar un paso de pivote?
      var turning = Math.abs(st.turnRate) > 0.12;
      st.turnAccum = turning ? st.turnAccum + Math.abs(st.turnRate) * dt * 4 : st.turnAccum * 0.90;
      st.isTurning = turning;

      if (wasMoving) { next = S.STOP; st.stopTimer = cfg.stopAbsorb; }
      else if (st.stopTimer > 0) { st.stopTimer -= dt; next = S.STOP; }
      else if (st.turnAccum > cfg.turnInPlaceThreshold) {
        next = st.turnRate > 0 ? S.TURN_R : S.TURN_L;
        // Un giro grande necesita un paso real, no sólo torsión de cuerpo.
        if (st.turnAccum > cfg.turnStepThreshold && st.turnStepTimer <= 0) {
          st.turnStepTimer = 0.30;
          st.turnStepSide = st.turnRate > 0 ? 1 : -1;
        }
      } else {
        next = S.IDLE;
      }
    } else {
      st.turnAccum = 0;
      st.isTurning = Math.abs(st.turnRate) > 0.20;
      if (!wasMoving) { next = S.START; st.startTimer = cfg.startAnticipation; }
      else if (st.startTimer > 0) { st.startTimer -= dt; next = S.START; }
      else {
        var af = Math.abs(st.moveForward), ar = Math.abs(st.moveRight);
        if (af > 0.45 && ar > 0.45) next = S.DIAGONAL;
        else if (ar > af) next = st.moveRight > 0 ? S.STRAFE_R : S.STRAFE_L;
        else next = st.moveForward < 0 ? S.BACKWARD : S.FORWARD;
      }
    }

    if (st.turnStepTimer > 0) st.turnStepTimer -= dt;

    if (next !== st.state) {
      st.statePrev = st.state;
      st.state = next;
      st.stateBlend = 0;
    }
    // Nunca hay salto de pose: el cambio de estado se interpola siempre.
    st.stateBlend = Math.min(1, st.stateBlend + dt * 6.5);
    st.isStarting = st.state === S.START;
    st.isStopping = st.state === S.STOP;
  };

  /* =========================================================================
   * Pies: fases de contacto y foot locking
   * ====================================================================== */

  /** Clasifica la posición del ciclo en una fase legible. */
  Loco.phaseOf = function (t, duty) {
    if (t < 0.06) return Loco.PHASE.CONTACT;
    if (t < duty * 0.55) return Loco.PHASE.DOWN;
    if (t < duty * 0.90) return Loco.PHASE.PASSING;
    if (t < duty) return Loco.PHASE.UP;
    return Loco.PHASE.SWING;
  };

  Loco._updateLegs = function (st, entity, dt) {
    var cfg = st.cfg;
    var duty = st.duty;
    var yaw = entity.yaw;
    var sy = Math.sin(yaw), cy = Math.cos(yaw);

    // Dirección de avance en espacio mundo, para colocar el pie por delante.
    var fwdX = st.moveForward * sy + st.moveRight * cy;
    var fwdZ = st.moveForward * cy - st.moveRight * sy;
    // `stride` es el recorrido del pie RESPECTO AL CUERPO, ya derivado en
    // Loco.update junto con la cadencia. Aquí sólo se reparte: medio por delante
    // al plantar, medio por detrás al despegar.
    var stride = st.stride * clamp(st.moveSpeed / 0.25, 0, 1);

    for (var i = 0; i < 2; i++) {
      var leg = st.legs[i];
      var side = (i === 0) ? -1 : 1;
      leg.t = (st.cycle + leg.offset) % 1;
      leg.phase = Loco.phaseOf(leg.t, duty);

      var plantedNow = st.isMoving ? (leg.t < duty) : true;
      // Enganche y soltada suavizados: un cambio brusco produce un tirón.
      var blendRate = 1 / Math.max(0.02, cfg.footPlantBlend);
      leg.plantWeight = damp(leg.plantWeight, plantedNow ? 1 : 0, blendRate, dt);

      // Posición de reposo del pie bajo la cadera, con la base del arquetipo.
      var restX = entity.pos.x + cy * side * cfg.stanceWidth;
      var restZ = entity.pos.z - sy * side * cfg.stanceWidth;

      if (plantedNow) {
        /* FOOT LOCK: al empezar el contacto se captura el punto del suelo y el
           pie NO se mueve de ahí mientras dure el apoyo. La pierna se resuelve
           por IK para alcanzarlo. Sin esto el pie se desliza siempre. */
        if (!leg.hasLock) {
          var ahead = st.isMoving ? stride * 0.5 : 0;
          leg.lock.x = restX + fwdX * ahead;
          leg.lock.z = restZ + fwdZ * ahead;
          leg.lock.y = 0;
          leg.hasLock = true;
        }
        leg.footPos.x = leg.lock.x;
        leg.footPos.z = leg.lock.z;
        leg.footPos.y = leg.lock.y;
      } else {
        /* SWING: el pie vuela hacia delante siguiendo un arco. */
        leg.hasLock = false;
        var sw = (leg.t - duty) / Math.max(0.02, 1 - duty);   // 0..1 en vuelo
        var arc = Math.sin(sw * Math.PI);
        var reach = (sw - 0.5) * stride;
        leg.footPos.x = restX + fwdX * reach;
        leg.footPos.z = restZ + fwdZ * reach;
        leg.footPos.y = arc * cfg.stepHeight;
      }

      /* Paso de pivote al girar en el sitio: un pie ancla, el otro reposiciona. */
      if (st.turnStepTimer > 0 && side === st.turnStepSide) {
        var tp = 1 - (st.turnStepTimer / 0.30);
        leg.footPos.y = Math.sin(tp * Math.PI) * cfg.stepHeight * 0.7;
        leg.hasLock = false;
      }
    }
  };

  /* =========================================================================
   * Centro de masa
   * ====================================================================== */
  Loco._updateCenterOfMass = function (st, dt) {
    var cfg = st.cfg;

    // ¿Sobre qué pierna recae el peso? Es la que está más plantada.
    var wL = st.legs[0].plantWeight, wR = st.legs[1].plantWeight;
    var total = wL + wR;
    var balance = total > 0.01 ? (wR - wL) / total : 0;   // −1 izquierda, +1 derecha

    var idle = Math.sin(st.weightShift);
    if (!st.isMoving) balance = idle;    // parado, el peso alterna lentamente

    // La pelvis se desplaza HACIA la pierna que soporta.
    st.hipShiftX = damp(st.hipShiftX, balance * cfg.hipShiftAmount, 10, dt);
    st.hipRoll = damp(st.hipRoll, balance * cfg.hipRollAmount, 9, dt);

    // Caída de cadera en el doble apoyo: el cuerpo baja dos veces por zancada.
    var drop = st.isMoving
      ? Math.abs(Math.sin(st.cycle * Math.PI * 2)) * cfg.hipDropAmount * st.moveSpeed
      : st.breathValue * cfg.breathAmount;
    // Al parar, las rodillas absorben: la cadera baja un poco más.
    if (st.isStopping) drop += cfg.hipDropAmount * 1.4 * clamp(st.stopTimer / cfg.stopAbsorb, 0, 1);
    st.hipHeight = damp(st.hipHeight, -drop, 14, dt);

    // Inclinación: adelante al acelerar, atrás al frenar, lateral al strafear.
    var targetLeanF = st.moveForward * cfg.accelLean * st.moveSpeed
                    + st.acceleration * cfg.accelLean * 0.8
                    - st.deceleration * cfg.decelLean;
    // Al arrancar, el centro de masa se adelanta ANTES del primer paso: ésa es
    // la anticipación que hace que arrancar no parezca teletransporte.
    if (st.isStarting) targetLeanF += cfg.accelLean * 1.1 * (1 - st.stateBlend * 0.4);
    st.leanF = damp(st.leanF, targetLeanF, 10, dt);

    var targetLeanR = -st.moveRight * cfg.strafeLean * st.moveSpeed
                    - st.turnRate * cfg.turnLean * (0.4 + st.moveSpeed * 0.6);
    st.leanR = damp(st.leanR, targetLeanR, 9, dt);

    st.hipYaw = damp(st.hipYaw, st.turnRate * 0.18 + st.moveRight * 0.12, 8, dt);
  };

  /* =========================================================================
   * Torso y cabeza
   * ====================================================================== */
  Loco._updateTorso = function (st, dt) {
    var cfg = st.cfg;

    // El pecho contrarrota respecto a la cadera: es lo que hace que caminar no
    // parezca un bloque rígido desplazándose.
    var twist = st.isMoving
      ? Math.sin(st.cycle * Math.PI * 2) * cfg.torsoTwist * st.moveSpeed * Math.max(0, st.moveForward)
      : 0;
    // Parado, una deriva lentísima del tronco. No es un ciclo: son dos relojes
    // desfasados cuyo periodo aparente dura decenas de segundos.
    var sway = st.swayValue * cfg.idleSwayAmount * st.idleAmount;
    st.torsoYaw = damp(st.torsoYaw, twist - st.hipYaw * 0.5 + st.turnRate * 0.22 + sway, 9, dt);
    st.torsoPitch = damp(st.torsoPitch, st.leanF, 11, dt);
    st.torsoRoll = damp(st.torsoRoll, st.leanR + sway * 0.45, 10, dt);
  };

  /* =========================================================================
   * Idle orgánico
   *
   * Un solo Math.sin() se reconoce: el ojo detecta el periodo perfecto y lo lee
   * como maquinaria. Tres osciladores de frecuencias inconmensurables y pesos
   * distintos producen una señal que no se repite de forma audible, sin coste
   * ni aleatoriedad — sigue siendo perfectamente determinista.
   * ====================================================================== */
  Loco._updateIdle = function (st, dt) {
    var cfg = st.cfg;
    st.breathe += dt * cfg.breathRate;
    st.weightShift += dt * cfg.weightShiftRate;
    st.idleSway += dt * cfg.idleSwayRate;
    st.idleHead += dt * cfg.idleHeadRate;

    var h2 = cfg.breathHarmonic2 === undefined ? 0.41 : cfg.breathHarmonic2;
    var h3 = cfg.breathHarmonic3 === undefined ? 0.23 : cfg.breathHarmonic3;
    var m2 = cfg.breathMix2 === undefined ? 0.42 : cfg.breathMix2;
    var m3 = cfg.breathMix3 === undefined ? 0.24 : cfg.breathMix3;
    var norm = 1 / (1 + m2 + m3);
    st.breathValue = (Math.sin(st.breathe)
                    + Math.sin(st.breathe * h2 + 1.7) * m2
                    + Math.sin(st.breathe * h3 + 4.1) * m3) * norm;

    st.swayValue = Math.sin(st.idleSway) * 0.62 + Math.sin(st.idleSway * 0.47 + 2.3) * 0.38;
    st.headIdleValue = Math.sin(st.idleHead) * 0.58 + Math.sin(st.idleHead * 0.61 + 0.9) * 0.42;

    // El idle sólo pesa cuando el personaje está realmente quieto, y entra y
    // sale despacio: aparecer de golpe al soltar la tecla se nota.
    st.idleAmount = damp(st.idleAmount, st.isMoving ? 0 : 1, 2.6, dt);
  };

  /**
   * Seguimiento de objetivo con la cabeza y parte del pecho.
   * NO gira el personaje: sólo mira. El movimiento sigue siendo libre, que es
   * lo que separa un MMO táctico de un lock-on de acción.
   */
  Loco.trackTarget = function (st, entity, targetPos, dt) {
    var cfg = st.cfg;
    var yawTo = 0, pitchTo = 0;
    if (targetPos) {
      var want = Math.atan2(targetPos.x - entity.pos.x, targetPos.z - entity.pos.z);
      yawTo = clamp(V.angleDelta(entity.yaw, want), -cfg.headTrackMaxYaw, cfg.headTrackMaxYaw);
      var dy = (targetPos.y + 1.2) - (entity.pos.y + 1.5);
      var dxz = Math.max(0.5, V.distXZ(entity.pos, targetPos));
      pitchTo = clamp(Math.atan2(dy, dxz), -cfg.headTrackMaxPitch, cfg.headTrackMaxPitch);
    }
    // Estar quieto no es estar congelado: la cabeza deriva mínimamente incluso
    // fijando un objetivo. Sin esto, el seguimiento parece una torreta.
    var idleYaw = st.headIdleValue * cfg.idleHeadAmount * st.idleAmount;
    st.headYaw = damp(st.headYaw, yawTo + idleYaw, 7, dt);
    st.headPitch = damp(st.headPitch, pitchTo + idleYaw * 0.35, 7, dt);
  };

  /** Reacción direccional al daño, aditiva: no interrumpe la locomoción. */
  Loco.applyHit = function (st, entity, fromPos) {
    var dx = entity.pos.x - (fromPos ? fromPos.x : entity.pos.x);
    var dz = entity.pos.z - (fromPos ? fromPos.z : entity.pos.z);
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var sy = Math.sin(entity.yaw), cy = Math.cos(entity.yaw);
    // Guardado en espacio local: front/back/left/right respecto al personaje.
    st.hitDir.z = (dx / len * sy + dz / len * cy);
    st.hitDir.x = (dx / len * cy - dz / len * sy);
    st.hitAmount = 1;
  };

  Arena.Render.Locomotion = Loco;
});
