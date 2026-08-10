/* =============================================================================
 * data/classes.js — Las seis subclases (documento §12–§18).
 *
 * Cada una debe aportar algo que ninguna otra haga igual. La columna "identidad"
 * no es decorativa: si dos clases resuelven el mismo problema de la misma forma,
 * una de las dos sobra.
 * ========================================================================== */
Arena.define('data/classes', ['data/balance'], function (Arena) {
  'use strict';

  var B = Arena.Data.balance;
  var T = B.ARMOR_TIERS;

  var classes = {

    devastador: {
      id: 'devastador',
      name: 'Devastador',
      archetype: 'Guerrero ofensivo',
      role: 'Burst melee / iniciación',
      identity: 'Presión melee, burst, derribo, ruptura y ventanas de riesgo/recompensa.',
      tagline: 'Gana cuando alcanza al objetivo. Pierde si malgasta la entrada.',
      color: [0.85, 0.28, 0.22],
      hpMax: 1350,
      resourceType: 'vigor',
      resourceMax: 100,
      armor: T.high,           // 90
      resist: T.midLow,        // 45
      power: B.POWER.devastador,
      moveSpeed: B.MOVE_SPEED_BASE,
      autoAttackRange: 2.4,
      autoAttackCycle: B.AUTO_ATTACK.meleeCycle,
      autoAttackSchool: 'physical',
      passiveId: 'devastador_impetu',
      abilities: [
        'devastador_embestida',
        'devastador_impacto_sismico',
        'devastador_golpe_quebrador',
        'devastador_bramido',
        'devastador_furia',
        'devastador_profanador'
      ]
    },

    guardian: {
      id: 'guardian',
      name: 'Guardián',
      archetype: 'Guerrero defensivo',
      role: 'Protección / peel / counter',
      identity: 'Protección de aliados, bloqueo, cleanse, peel y reflejo.',
      tagline: 'No busca matar: controla el ritmo y salva aliados.',
      color: [0.35, 0.55, 0.85],
      hpMax: 1650,
      resourceType: 'vigor',
      resourceMax: 100,
      // Muy alta, pero no la 120 del tramo máximo: con 120 el 1v1 contra un
      // Devastador se iba a ~50 s y dejaba de ser un combate.
      armor: 100,
      resist: 55,
      power: B.POWER.guardian,
      moveSpeed: B.MOVE_SPEED_BASE * 0.97,
      autoAttackRange: 2.4,
      autoAttackCycle: B.AUTO_ATTACK.meleeCycle,
      autoAttackSchool: 'physical',
      passiveId: 'guardian_bastion',
      abilities: [
        'guardian_avasallamiento',
        'guardian_guardia_absoluta',
        'guardian_interponer',
        'guardian_egida',
        'guardian_proteccion_aliada',
        'guardian_postura'
      ]
    },

    centinela: {
      id: 'centinela',
      name: 'Centinela',
      archetype: 'Arquero largo alcance',
      role: 'Daño físico a distancia',
      identity: 'Daño de precisión, cast de rango, kiteo y control puntual.',
      tagline: 'Fuerte si prepara posición. Vulnerable cuando le cierran distancia.',
      color: [0.35, 0.75, 0.45],
      hpMax: 1100,
      resourceType: 'focus',
      resourceMax: 100,
      armor: T.midLow,         // 45
      resist: T.low,           // 30
      power: B.POWER.centinela,
      // El largo alcance paga movilidad: sin esto un melee de igual velocidad
      // nunca cierra distancia y el duelo se eterniza.
      moveSpeed: B.MOVE_SPEED_BASE * 0.95,
      autoAttackRange: 24,
      autoAttackCycle: B.AUTO_ATTACK.rangedCycle,
      autoAttackSchool: 'physical',
      passiveId: 'centinela_distancia',
      abilities: [
        'centinela_disparo_tensado',
        'centinela_flecha_perforante',
        'centinela_rafaga_disruptiva',
        'centinela_pulso_invernal',
        'centinela_retroceso',
        'centinela_lluvia_astillas'
      ]
    },

    rastreador: {
      id: 'rastreador',
      name: 'Rastreador',
      archetype: 'Arquero táctico',
      role: 'Control táctico / información',
      identity: 'Sigilo, información, trampas, antiheal y sabotaje de utility.',
      tagline: 'Pelea en sus términos: prepara el terreno antes de aparecer.',
      color: [0.55, 0.45, 0.30],
      hpMax: 1150,
      resourceType: 'focus',
      resourceMax: 100,
      armor: T.mid,            // 60
      resist: T.low,           // 30
      power: B.POWER.rastreador,
      moveSpeed: B.MOVE_SPEED_BASE * 0.97,
      autoAttackRange: 20,
      autoAttackCycle: B.AUTO_ATTACK.rangedCycle,
      autoAttackSchool: 'physical',
      passiveId: 'rastreador_instinto',
      abilities: [
        'rastreador_camuflaje',
        'rastreador_emboscada',
        'rastreador_trampa',
        'rastreador_marca_corrosiva',
        'rastreador_confusion',
        'rastreador_revelar'
      ]
    },

    arcanista: {
      id: 'arcanista',
      name: 'Arcanista',
      archetype: 'Mago de daño y control',
      role: 'Burst mágico / control / anti-soporte',
      identity: 'Burst mágico, área, root, silencio, estasis y anti-buff.',
      tagline: 'Su poder viene de elegir el momento. Frágil e interrumpible.',
      color: [0.62, 0.38, 0.85],
      hpMax: 1000,
      resourceType: 'mana',
      resourceMax: 120,
      armor: T.low,            // 30
      resist: T.mid,           // 60
      power: B.POWER.arcanista,
      moveSpeed: B.MOVE_SPEED_BASE * 0.97,
      autoAttackRange: 22,
      autoAttackCycle: B.AUTO_ATTACK.rangedCycle,
      autoAttackSchool: 'magical',
      passiveId: 'arcanista_resonancia',
      abilities: [
        'arcanista_descarga',
        'arcanista_prision',
        'arcanista_impacto_celeste',
        'arcanista_estasis',
        'arcanista_corrupcion',
        'arcanista_velo_nulo'
      ]
    },

    vinculador: {
      id: 'vinculador',
      name: 'Vinculador',
      archetype: 'Mago de soporte',
      role: 'Curación / escudos / counters',
      identity: 'Curación, HoT, barreras, intervención, cleanse y protección.',
      tagline: 'Fuerte si queda libre. Vulnerable si se le presiona.',
      color: [0.35, 0.80, 0.72],
      hpMax: 1050,
      resourceType: 'mana',
      resourceMax: 140,
      armor: T.low,            // 30
      resist: T.mid,           // 60
      power: B.POWER.vinculador,
      healPower: 100,          // cura con su propia escala, no con la de daño
      moveSpeed: B.MOVE_SPEED_BASE * 0.97,
      autoAttackRange: 20,
      autoAttackCycle: B.AUTO_ATTACK.rangedCycle,
      autoAttackSchool: 'magical',
      passiveId: 'vinculador_flujo',
      abilities: [
        'vinculador_pulso_vital',
        'vinculador_regeneracion',
        'vinculador_barrera',
        'vinculador_intervencion',
        'vinculador_purificacion',
        'vinculador_enlace'
      ]
    }
  };

  Arena.Data.classes = classes;
  Arena.Data.classOrder = ['devastador', 'guardian', 'centinela', 'rastreador', 'arcanista', 'vinculador'];

  /** Construye una entidad completa a partir de un id de clase. */
  Arena.Data.makeEntity = function (classId, cfg) {
    var c = classes[classId];
    if (!c) throw new Error('Clase desconocida: ' + classId);
    cfg = cfg || {};
    var e = new Arena.Core.Entity({
      id: cfg.id,
      name: cfg.name || c.name,
      classId: classId,
      team: cfg.team === undefined ? 0 : cfg.team,
      isPlayer: !!cfg.isPlayer,
      x: cfg.x || 0, y: 0, z: cfg.z || 0,
      yaw: cfg.yaw || 0,
      hpMax: cfg.hpMax || c.hpMax,
      resourceType: c.resourceType,
      resourceMax: c.resourceMax,
      armor: cfg.armor === undefined ? c.armor : cfg.armor,
      resist: cfg.resist === undefined ? c.resist : cfg.resist,
      power: cfg.power === undefined ? c.power : cfg.power,
      healPower: c.healPower,
      moveSpeed: c.moveSpeed,
      autoAttackRange: c.autoAttackRange,
      autoAttackCycle: c.autoAttackCycle,
      autoAttackSchool: c.autoAttackSchool,
      abilities: c.abilities,
      passiveId: c.passiveId,
      aiProfile: cfg.aiProfile || null,
      aiEnabled: cfg.aiEnabled !== false
    });
    e.profile = cfg.profile || null;
    return e;
  };
});
