/* =============================================================================
 * tests/classIdentityTests.js — Las seis clases tienen que ser seis siluetas.
 *
 * QUÉ PROTEGE ESTA SUITE
 *
 * `CLAUDE.md` §5 dice que las seis sub-clases NO pueden homogeneizarse. Durante
 * varios commits el ledger daba el bloque por bueno porque existían tres
 * familias de arquetipo —espada, arco y báculo— y eso era verdad y era
 * insuficiente: `devastador ≈ guardian` diferían un 1.2 % de masa,
 * `centinela ≈ rastreador` un 0.3 %, y `devastador ≈ rastreador` un 4.5 %
 * cruzando arquetipos. Tres parejas de gemelos.
 *
 * Aquí se mide el CONTORNO, no la masa: cuánto ocupa cada personaje a cada
 * altura, desde tres vistas. Dos clases distintas tienen que diferir en el
 * perfil Y en varios descriptores gruesos a la vez. Un solo número puede
 * coincidir por casualidad; cuatro rasgos independientes, no.
 *
 * Esta suite NO sustituye al juicio visual. Detecta lo contrario, que es lo que
 * un test puede detectar: si dos perfiles coinciden banda a banda, no hay
 * captura de pantalla que salve esa pareja.
 * ========================================================================== */
Arena.define('tests/classIdentityTests',
  ['tests/testRunner', 'render/characterVisual', 'render/poseMetrics',
   'data/classVisuals'], function (Arena) {
  'use strict';

  var T = Arena.Tests;
  var CV = Arena.Render.CharacterVisual;
  var PM = Arena.Render.PoseMetrics;
  var D = Arena.Data;
  var CLASSES = D.CLASS_VISUAL_ORDER;

  /* Biblioteca de mallas y cajas locales: se construyen una sola vez. */
  var MESHES = null, BOUNDS = null;
  function meshes() {
    if (!MESHES) { MESHES = CV.buildMeshes(); BOUNDS = PM.boundsOf(MESHES); }
    return MESHES;
  }

  /* =========================================================================
   * Fixture: un personaje real, animado el tiempo que haga falta
   * ====================================================================== */
  function fakeWorld() {
    return {
      time: 0,
      getEntity: function () { return null; }
    };
  }

  function fakeEntity(classId, opts) {
    opts = opts || {};
    return {
      id: 'ci-' + classId,
      classId: classId,
      raceId: 'darkElf',
      pos: { x: 0, y: 0, z: 0 },
      yaw: 0,
      height: 1.85,
      moveSpeedBase: 5.4,
      alive: opts.alive === undefined ? true : opts.alive,
      targetId: null,
      cast: opts.cast || null,
      weaponState: opts.weaponState || null,
      _statuses: opts.statuses || [],
      hasStatus: function (id) { return this._statuses.indexOf(id) >= 0; }
    };
  }

  /**
   * Construye la pose de una clase después de `frames` de simulación visual.
   * `move` es la velocidad en espacio local del personaje: eso permite pedir
   * FORWARD, BACKWARD y STRAFE sin duplicar el arnés.
   */
  function poseOf(classId, opts) {
    opts = opts || {};
    meshes();
    var e = fakeEntity(classId, opts);
    var w = fakeWorld();
    var st = CV.createState(e.id);
    var dt = 1 / 30;
    var frames = opts.frames === undefined ? 20 : opts.frames;
    var vf = opts.forward || 0, vr = opts.right || 0;
    // F = (sin yaw, cos yaw) y R = F × up = (−cos yaw, sin yaw). Escribirlo de
    // memoria es exactamente cómo se invirtieron A y D en su día.
    var yaw = e.yaw;
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    var rx = -Math.cos(yaw), rz = Math.sin(yaw);
    for (var i = 0; i < frames; i++) {
      e.pos.x += (fx * vf + rx * vr) * dt;
      e.pos.z += (fz * vf + rz * vr) * dt;
      w.time += dt;
      if (opts.before) opts.before(st, e, w, i);
      CV.update(st, e, dt, w);
    }
    var out = [];
    CV.buildPose(out, st, e, e.pos, e.yaw, CV.paletteFor(e, true));
    return { pose: out, state: st, entity: e };
  }

  function profileOf(classId, azimuth, opts) {
    var r = poseOf(classId, opts);
    return PM.profile(r.pose, BOUNDS, { azimuth: azimuth });
  }

  /** Conjunto de nombres de malla usados por una pose. */
  function meshSet(pose) {
    var s = {};
    for (var i = 0; i < pose.length; i++) s[pose[i].mesh] = true;
    return Object.keys(s).sort();
  }

  /* Tres vistas para el CONTORNO.
   *
   * No incluye la espalda a propósito: en proyección ortográfica la silueta
   * trasera es el espejo exacto de la frontal, así que medirla daría los mismos
   * números y aparentaría una tercera comprobación que no existe. La captura de
   * espalda sí se hace, pero en el árbitro visual, donde lo que cambia es el
   * sombreado y qué piezas quedan a la vista, no el contorno. */
  var VIEWS = [
    { name: 'frontal', az: 0 },
    { name: 'tres cuartos', az: Math.PI * 0.25 },
    { name: 'perfil', az: Math.PI * 0.5 }
  ];

  /* =========================================================================
   * 1 · Contrato del perfil de clase
   * ====================================================================== */
  T.suite('Identidad de clase · contrato de datos', function () {

    T.test('las seis clases declaran perfil visual', function () {
      T.assertEqual(CLASSES.length, 6, 'clases con perfil');
      for (var i = 0; i < CLASSES.length; i++) {
        var p = D.CLASS_VISUAL[CLASSES[i]];
        T.assert(!!p.palette, CLASSES[i] + ' sin paleta');
        T.assert(!!D.VISUAL_PALETTES[p.palette], CLASSES[i] + ' con paleta inexistente');
        T.assert(!!p.build, CLASSES[i] + ' sin proporciones');
        T.assert(!!p.right, CLASSES[i] + ' sin arma principal');
        T.assert(!!p.reads, CLASSES[i] + ' sin intención de lectura declarada');
        T.assert(!!p.attach, CLASSES[i] + ' sin piezas de equipo');
      }
    });

    T.test('el arma declarada coincide con la de animConfig', function () {
      for (var i = 0; i < CLASSES.length; i++) {
        var id = CLASSES[i], p = D.CLASS_VISUAL[id];
        T.assertEqual(p.right.kind, D.weaponOf(id), 'arma de ' + id);
        T.assertEqual(p.archetype, D.archetypeOf(id), 'arquetipo de ' + id);
      }
    });

    T.test('toda malla declarada por una clase existe en la biblioteca', function () {
      var lib = meshes(), faltan = [];
      function need(name, who) { if (name && !lib[name]) faltan.push(who + ' → ' + name); }
      for (var i = 0; i < CLASSES.length; i++) {
        var id = CLASSES[i], p = D.CLASS_VISUAL[id];
        need(p.right && p.right.mesh, id + '.right');
        need(p.right && p.right.string, id + '.right.string');
        need(p.left && p.left.mesh, id + '.left');
        need(p.robe && p.robe.mesh, id + '.robe');
        need(p.robe && p.robe.trim, id + '.robe.trim');
        need(p.cloak && p.cloak.mesh, id + '.cloak');
        for (var socket in p.attach) {
          if (!Object.prototype.hasOwnProperty.call(p.attach, socket)) continue;
          var list = p.attach[socket];
          for (var k = 0; k < list.length; k++) need(list[k].mesh, id + '.' + socket);
        }
      }
      T.assert(!faltan.length, 'mallas declaradas y no fabricadas: ' + faltan.join(', '));
    });

    T.test('no hay geometría muerta subida a GPU', function () {
      var usadas = {}, i;
      for (i = 0; i < CLASSES.length; i++) {
        var r = poseOf(CLASSES[i]);
        var ms = meshSet(r.pose);
        for (var k = 0; k < ms.length; k++) usadas[ms[k]] = true;
      }
      var muertas = [];
      for (var name in D.EQUIPMENT) {
        if (!Object.prototype.hasOwnProperty.call(D.EQUIPMENT, name)) continue;
        if (!usadas[name]) muertas.push(name);
      }
      T.assert(!muertas.length,
        'equipo fabricado y nunca colocado: ' + muertas.join(', '));
    });

    T.test('ningún color declarado cae en el reserva por estar mal escrito', function () {
      /* `colorOf` devuelve `cloth` cuando no reconoce el nombre. Es un reserva
         razonable en ejecución y una trampa en los datos: un `metall` con dos
         eles pintaría una hombrera de acero del color de la túnica y nadie
         sabría por qué. La lista válida es la que compone `paletteFor`. */
      var validos = {};
      var pal = CV.paletteFor({ classId: 'devastador', raceId: 'darkElf' }, true);
      for (var k in pal) if (Object.prototype.hasOwnProperty.call(pal, k)) validos[k] = true;
      // `eye` y `skin` salen de la raza y no se declaran como color de pieza.
      var malos = [];
      function check(name, quien) {
        if (name === undefined || name === null) return;
        if (!validos[name]) malos.push(quien + ' → «' + name + '»');
      }
      for (var i = 0; i < CLASSES.length; i++) {
        var id = CLASSES[i], p = D.CLASS_VISUAL[id];
        if (p.right) check(p.right.color, id + '.right');
        if (p.left) check(p.left.color, id + '.left');
        if (p.robe) check(p.robe.color, id + '.robe');
        if (p.cloak) check(p.cloak.color, id + '.cloak');
        for (var socket in p.attach) {
          if (!Object.prototype.hasOwnProperty.call(p.attach, socket)) continue;
          var list = p.attach[socket];
          for (var n = 0; n < list.length; n++) check(list[n].color, id + '.' + socket);
        }
      }
      T.assert(!malos.length, 'colores que no existen en la paleta: ' + malos.join(', '));
    });

    T.test('cada pieza declara de qué material está hecha', function () {
      var lib = meshes(), sinMaterial = [];
      for (var name in lib) {
        if (!Object.prototype.hasOwnProperty.call(lib, name)) continue;
        if (!CV.materialOf(name)) sinMaterial.push(name);
      }
      T.assert(!sinMaterial.length, 'mallas sin material: ' + sinMaterial.join(', '));
    });

    T.test('la constitución compuesta de cada clase cabe en el rig', function () {
      var race = D.getRace('darkElf');
      for (var i = 0; i < CLASSES.length; i++) {
        var id = CLASSES[i];
        var b = D.composeBuild(race.build, D.CLASS_VISUAL[id].build);
        T.assert(D.buildWithinLimits(b), id + ' fuera de BUILD_LIMITS');
        // La altura de simulación no cambia: la variación es de lectura.
        T.assert(b.height >= 0.90 && b.height <= 1.12, id + ' con altura extrema');
      }
    });

    T.test('el renderer no decide identidad por identificador de clase', function () {
      // La regla de CLAUDE.md §10: nada de `if (classId === ...)` en la capa de
      // presentación. Si vuelve a aparecer, esta prueba lo dice por su nombre.
      // Se comparan las funciones SIN comentarios: la primera versión de esta
      // prueba se disparaba con el comentario que explica por qué no hay ramas.
      var src = (CV.buildPose.toString() + CV.paletteFor.toString())
        .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
      T.assert(src.indexOf("classId ===") < 0 && src.indexOf("classId==") < 0,
        'buildPose vuelve a ramificar por classId en vez de leer el perfil');
      for (var i = 0; i < CLASSES.length; i++) {
        T.assert(src.indexOf("'" + CLASSES[i] + "'") < 0,
          'buildPose menciona la clase ' + CLASSES[i] + ' por su nombre');
      }
    });
  });

  /* =========================================================================
   * 2 · Silueta: seis contornos, no tres
   * ====================================================================== */
  T.suite('Identidad de clase · silueta', function () {

    T.test('cada clase produce una pose no vacía y sin NaN', function () {
      for (var i = 0; i < CLASSES.length; i++) {
        var id = CLASSES[i];
        var r = poseOf(id);
        T.assert(r.pose.length >= 25, id + ' con sólo ' + r.pose.length + ' piezas');
        for (var k = 0; k < r.pose.length; k++) {
          var m = r.pose[k].matrix;
          for (var j = 0; j < 16; j++) {
            T.assert(m[j] === m[j] && isFinite(m[j]),
              id + ': matriz no finita en ' + r.pose[k].mesh);
          }
        }
      }
    });

    T.test('ningún par de clases comparte el mismo juego de piezas', function () {
      var sets = {}, i;
      for (i = 0; i < CLASSES.length; i++) sets[CLASSES[i]] = meshSet(poseOf(CLASSES[i]).pose).join('|');
      var repes = [];
      for (i = 0; i < CLASSES.length; i++) {
        for (var j = i + 1; j < CLASSES.length; j++) {
          if (sets[CLASSES[i]] === sets[CLASSES[j]]) {
            repes.push(CLASSES[i] + ' = ' + CLASSES[j]);
          }
        }
      }
      T.assert(!repes.length, 'mismo equipo exacto: ' + repes.join(', '));
    });

    /* El umbral es 0.15, no 0.05. Una diferencia del 5 % en un contorno es
       ruido de postura: el mismo personaje en dos fotogramas distintos ya la
       supera. Se exige que al menos el 15 % del área del contorno sea distinta
       EN LAS TRES VISTAS, no en la que mejor salga. */
    var UMBRAL = 0.15;

    for (var v = 0; v < VIEWS.length; v++) {
      (function (view) {
        T.test('seis contornos distinguibles · vista ' + view.name, function () {
          var prof = {}, i;
          for (i = 0; i < CLASSES.length; i++) prof[CLASSES[i]] = profileOf(CLASSES[i], view.az);
          var confusas = [];
          for (i = 0; i < CLASSES.length; i++) {
            for (var j = i + 1; j < CLASSES.length; j++) {
              var a = CLASSES[i], b = CLASSES[j];
              var d = PM.distance(prof[a], prof[b]);
              if (d < UMBRAL) {
                confusas.push(a + ' ≈ ' + b + ' (' + (d * 100).toFixed(1) + ' %)');
              }
            }
          }
          T.assert(!confusas.length,
            'contornos confundibles en vista ' + view.name + ': ' + confusas.join(', '));
        });
      })(VIEWS[v]);
    }

    T.test('cada pareja difiere en al menos dos rasgos gruesos', function () {
      /* La condición independiente. Un perfil puede separarse por acumulación
         de diferencias pequeñas repartidas; esto exige que además haya rasgos
         NOMBRABLES distintos: la altura, el ancho, el estrechamiento de
         cintura, la campana del bajo, el descentramiento o la esbeltez. */
      var desc = {}, i;
      for (i = 0; i < CLASSES.length; i++) {
        desc[CLASSES[i]] = PM.descriptors(profileOf(CLASSES[i], 0));
      }
      var MIN_REL = { height: 0.04, width: 0.10, taper: 0.10, flare: 0.14, slender: 0.12 };
      var pobres = [];
      for (i = 0; i < CLASSES.length; i++) {
        for (var j = i + 1; j < CLASSES.length; j++) {
          var A = desc[CLASSES[i]], B = desc[CLASSES[j]];
          var n = 0, cuales = [];
          for (var k in MIN_REL) {
            if (!Object.prototype.hasOwnProperty.call(MIN_REL, k)) continue;
            var rel = Math.abs(A[k] - B[k]) / Math.max(Math.abs(A[k]), Math.abs(B[k]), 1e-6);
            if (rel >= MIN_REL[k]) { n++; cuales.push(k); }
          }
          // El descentramiento se mide en unidades, no en proporción: dos
          // personajes centrados dan casi cero y dividir amplificaría el ruido.
          if (Math.abs(A.asym - B.asym) >= 0.045) { n++; cuales.push('asym'); }
          if (n < 2) {
            pobres.push(CLASSES[i] + ' vs ' + CLASSES[j] + ' (sólo ' + n + ': ' + cuales.join(',') + ')');
          }
        }
      }
      T.assert(!pobres.length, 'parejas sin dos rasgos gruesos distintos: ' + pobres.join(' · '));
    });

    T.test('las dos clases de cada arquetipo son las más difíciles y aun así separan', function () {
      /* Las tres parejas que el ledger tenía abiertas. Se comprueban aparte y
         con nombre para que un fallo diga exactamente cuál volvió a colapsar. */
      var pares = [['devastador', 'guardian'], ['centinela', 'rastreador'],
                   ['arcanista', 'vinculador'], ['devastador', 'rastreador']];
      for (var i = 0; i < pares.length; i++) {
        var a = profileOf(pares[i][0], 0), b = profileOf(pares[i][1], 0);
        var d = PM.distance(a, b);
        T.assert(d >= 0.15, pares[i][0] + ' ≈ ' + pares[i][1] + ': sólo ' +
          (d * 100).toFixed(1) + ' % de contorno distinto');
      }
    });

    T.test('cada clase cumple la lectura que declara', function () {
      var p = {}, i;
      for (i = 0; i < CLASSES.length; i++) p[CLASSES[i]] = PM.descriptors(profileOf(CLASSES[i], 0));

      // Guardián es el más ancho y el menos esbelto: es la muralla.
      for (i = 0; i < CLASSES.length; i++) {
        if (CLASSES[i] === 'guardian') continue;
        T.assert(p.guardian.width > p[CLASSES[i]].width,
          'guardián no es más ancho que ' + CLASSES[i]);
      }
      // Arcanista es el más alto: báculo y pico de sombrero.
      for (i = 0; i < CLASSES.length; i++) {
        if (CLASSES[i] === 'arcanista') continue;
        T.assert(p.arcanista.height > p[CLASSES[i]].height,
          'arcanista no es el más alto frente a ' + CLASSES[i]);
      }
      // Centinela es más esbelto que su hermano de arquetipo: columna contra
      // contorno roto.
      T.assert(p.centinela.slender > p.rastreador.slender,
        'centinela no se lee más esbelto que rastreador');
      // Devastador estrecha la cintura respecto a los hombros más que Guardián.
      T.assert(p.devastador.taper < p.guardian.taper,
        'devastador no tiene la V que el guardián no tiene');
      // El vinculador abre la túnica y redondea hombros: más campana que el
      // arcanista y menos altura.
      T.assert(p.vinculador.height < p.arcanista.height,
        'vinculador no queda por debajo del arcanista');
    });
  });

  /* =========================================================================
   * 3 · El equipo tiene que aguantar la animación
   *
   * Una hombrera preciosa que se queda flotando donde estaba el hombro hace dos
   * segundos destruye el personaje más que no llevarla. Estos tests recorren
   * los estados que pide el brief y comprueban que ninguna pieza se desprende,
   * se sale del cuerpo ni salta entre fotogramas.
   * ====================================================================== */
  T.suite('Identidad de clase · el equipo sigue al cuerpo', function () {

    var ESTADOS = [
      { name: 'IDLE', opts: {} },
      { name: 'FORWARD', opts: { forward: 4.2, frames: 30 } },
      { name: 'BACKWARD', opts: { forward: -3.0, frames: 30 } },
      { name: 'STRAFE', opts: { right: 3.6, frames: 30 } },
      { name: 'DIAGONAL', opts: { forward: 3.0, right: 3.0, frames: 30 } }
    ];

    T.test('ninguna pieza se desprende del cuerpo en locomoción', function () {
      /* «Desprenderse» es medible: la pieza más lejana no puede estar a más de
         dos alturas de personaje del centro. Un arma larga y un báculo alto
         entran holgadamente; una pieza que se queda anclada al origen del mundo
         se sale por varios órdenes de magnitud. */
      for (var c = 0; c < CLASSES.length; c++) {
        for (var s = 0; s < ESTADOS.length; s++) {
          var id = CLASSES[c], est = ESTADOS[s];
          var r = poseOf(id, est.opts);
          var cx = r.entity.pos.x, cz = r.entity.pos.z;
          for (var i = 0; i < r.pose.length; i++) {
            var m = r.pose[i].matrix;
            var dx = m[12] - cx, dy = m[13], dz = m[14] - cz;
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            T.assert(dist < 3.7,
              id + '/' + est.name + ': ' + r.pose[i].mesh + ' a ' + dist.toFixed(2) +
              ' del cuerpo — la pieza se ha soltado del socket');
          }
        }
      }
    });

    T.test('el equipo no se queda quieto mientras el cuerpo camina', function () {
      /* Lo contrario del test anterior y igual de importante: una pieza atada a
         un socket que NO se mueve al caminar es una pieza dibujada en espacio de
         mundo por error. Se compara la pose al principio y al final de una
         zancada: el conjunto tiene que haberse desplazado con el personaje. */
      for (var c = 0; c < CLASSES.length; c++) {
        var id = CLASSES[c];
        var a = poseOf(id, { frames: 6 });
        var b = poseOf(id, { forward: 4.2, frames: 36 });
        var avanzado = b.entity.pos.z - a.entity.pos.z;
        T.assert(avanzado > 1.0, 'el fixture no avanzó: ' + avanzado.toFixed(2));
        var quietas = [], i;
        T.assertEqual(b.pose.length, a.pose.length, id + ': la pose cambia de tamaño al caminar');
        for (i = 0; i < b.pose.length; i++) {
          if (Math.abs(b.pose[i].matrix[14] - a.pose[i].matrix[14]) < avanzado * 0.5) {
            quietas.push(b.pose[i].mesh);
          }
        }
        T.assert(!quietas.length,
          id + ': piezas que ignoran la locomoción → ' + quietas.join(', '));
      }
    });

    T.test('el equipo no introduce jitter entre fotogramas', function () {
      /* Se compara la pose en dos fotogramas consecutivos a media zancada. Una
         pieza que salta más de lo que el cuerpo se desplaza en ese fotograma
         está haciendo pop, y a cámara de MMO eso se ve como parpadeo. */
      for (var c = 0; c < CLASSES.length; c++) {
        var id = CLASSES[c];
        var a = poseOf(id, { forward: 4.2, frames: 30 });
        var b = poseOf(id, { forward: 4.2, frames: 31 });
        var paso = 4.2 / 30;
        var saltos = [], i;
        /* Se comparan por ÍNDICE, no por nombre de malla: una hombrera existe
           dos veces en la pose y emparejarlas por nombre comparaba el hombro
           izquierdo contra el derecho. Eso daba medio metro de «salto» que no
           existía — un informe falso del arnés, no un defecto del producto. */
        T.assertEqual(b.pose.length, a.pose.length, id + ': la pose cambia de tamaño entre fotogramas');
        for (i = 0; i < b.pose.length; i++) {
          T.assertEqual(b.pose[i].mesh, a.pose[i].mesh, id + ': el orden de la pose no es estable');
          var m0 = a.pose[i].matrix;
          var m1 = b.pose[i].matrix;
          var dx = m1[12] - m0[12], dy = m1[13] - m0[13], dz = m1[14] - m0[14];
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          // Tres veces el desplazamiento del cuerpo en un fotograma es margen
          // de sobra para la punta de un báculo que además rota.
          if (d > paso * 3.2 + 0.05) saltos.push(b.pose[i].mesh + ' ' + d.toFixed(3));
        }
        T.assert(!saltos.length, id + ': pop entre fotogramas → ' + saltos.join(', '));
      }
    });

    T.test('la silueta sobrevive a los estados de combate y de control', function () {
      /* NORMAL, ABILITY, CAST, HIT y DEATH. Lo que se comprueba no es que se
         vean bien —eso es juicio humano— sino que la pose sigue siendo la de un
         personaje: número de piezas estable, sin NaN y sin que el contorno se
         desplome. */
      for (var c = 0; c < CLASSES.length; c++) {
        var id = CLASSES[c];
        var arche = D.archetypeOf(id);
        var base = profileOf(id, 0);

        var estados = [
          { name: 'NORMAL', o: { before: function (st, e, w, i) { if (i === 4) CV.triggerAttack(st, arche, false); } } },
          { name: 'ABILITY', o: { before: function (st, e, w, i) { if (i === 4) CV.triggerAttack(st, arche, true, 'projectile', 'none'); } } },
          { name: 'HIT', o: { before: function (st, e, w, i) { if (i === 4) CV.triggerHurt(st, e, { x: 0, y: 0, z: 2 }); } } },
          { name: 'DEATH', o: { alive: false, frames: 30 } }
        ];
        if (arche === 'caster') {
          estados.push({ name: 'CAST', o: { before: function (st, e, w, i) {
            if (i === 3) { e.cast = { startTime: w.time, duration: 1.2, movable: false }; CV.beginCast(st, 'bolt', 'none'); }
          } } });
        }

        for (var s = 0; s < estados.length; s++) {
          var r = poseOf(id, estados[s].o);
          var p = PM.profile(r.pose, BOUNDS, { azimuth: 0 });
          T.assert(p.valid, id + '/' + estados[s].name + ': matrices no finitas en la pose');
          T.assert(r.pose.length >= 25,
            id + '/' + estados[s].name + ': la pose cae a ' + r.pose.length + ' piezas');
          // El contorno puede cambiar mucho (un derribo es horizontal), pero no
          // puede desaparecer: un perfil de altura cero significa pose rota.
          T.assert(p.height > 0.5 && p.width > 0.2,
            id + '/' + estados[s].name + ': contorno degenerado ' +
            p.height.toFixed(2) + '×' + p.width.toFixed(2));
        }
        T.assert(base.height > 1.0, id + ': el fixture base ya venía roto');
      }
    });

    T.test('el arma nunca tapa la cabeza en reposo', function () {
      /* Un arma que en IDLE cruza por delante de la cara bloquea la lectura del
         personaje y, en combate, la del telegraph. Se comprueba que ninguna
         pieza de arma invade la banda de la cabeza por delante del torso. */
      for (var c = 0; c < CLASSES.length; c++) {
        var id = CLASSES[c];
        var prof = D.CLASS_VISUAL[id];
        var armas = {};
        if (prof.right) armas[prof.right.mesh] = true;
        if (prof.left) armas[prof.left.mesh] = true;
        var r = poseOf(id);
        // Altura de la cabeza: la pieza `skull` de esta misma pose.
        var headY = 0, i;
        for (i = 0; i < r.pose.length; i++) {
          if (r.pose[i].mesh === 'skull') headY = r.pose[i].matrix[13];
        }
        T.assert(headY > 1.2, id + ': no se encontró la cabeza en la pose');
        for (i = 0; i < r.pose.length; i++) {
          if (!armas[r.pose[i].mesh]) continue;
          var m = r.pose[i].matrix;
          var frente = m[14] - r.entity.pos.z;   // +Z es el frente con yaw = 0
          var alturaOk = Math.abs(m[13] - headY) > 0.22;
          T.assert(alturaOk || frente < 0.24,
            id + ': ' + r.pose[i].mesh + ' se cruza por delante de la cara');
        }
      }
    });
  });

  T.suite('Modelo skinned v0.14 · puente de rig', function () {
    var joints = ['Hips','Spine','Chest','Neck','Head',
      'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
      'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'];

    T.test('las seis subclases producen los 17 pivotes del rig humanoide', function () {
      for (var c=0; c<CLASSES.length; c++) {
        var r = poseOf(CLASSES[c], { frames: 12, forward: 1.8 });
        T.assert(r.state.rigPose, CLASSES[c] + ': no expone rigPose');
        for (var j=0; j<joints.length; j++) {
          var m = r.state.rigPose[joints[j]];
          T.assert(m && m.length === 16, CLASSES[c] + ': falta ' + joints[j]);
          for (var k=0;k<16;k++) T.assert(isFinite(m[k]), CLASSES[c] + '/' + joints[j] + ': matriz no finita');
        }
      }
    });

    T.test('izquierda y derecha conservan pivotes separados', function () {
      var r = poseOf('devastador');
      var p = r.state.rigPose;
      T.assert(p.LeftUpperArm[12] < p.RightUpperArm[12], 'brazos invertidos o colapsados');
      T.assert(p.LeftUpperLeg[12] < p.RightUpperLeg[12], 'piernas invertidas o colapsadas');
    });
  });
});
