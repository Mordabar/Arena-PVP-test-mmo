/* Formula model transcribed from user-supplied Champions of Regnum v1.8 (2016).
 * Percentage API inputs are FRACTIONS: .15 means 15%, except resistance grades.
 * This is a historical community model, not a claim about the current server.
 * Cell provenance and deliberate safety guards: docs/REGNUM_FORMULAS.md.
 */
Arena.define('combat/regnumFormulas', [], function (Arena) {
  'use strict';
  var F = {};
  var coefficients = {
    knight: {chest:0.305, shield:0.29, helmet:0.285, legs:0.265, shoulders:0.245, gloves:0.225},
    archer: {chest:0.3075, helmet:0.28510638, legs:0.26808511, shoulders:0.246808511, gloves:0.22553191},
    mage: {robe:0.484375, helmet:0.2890625, bracelet:0.265625, gloves:0.2265625}
  };
  var resistanceWeights = {
    knight: {chest:0.1848739496, shield:0.1764705882, helmet:0.1736694678, legs:0.162464986, shoulders:0.1512605042, gloves:0.1400560224},
    archer: {chest:0.2240437158, helmet:0.2103825137, legs:0.1994535519, shoulders:0.1857923497, gloves:0.1721311475},
    mage: {robe:0.3742690058, helmet:0.2280701754, bracelet:0.2105263158, gloves:0.1812865497}
  };
  var classK = {devastador:2, guardian:1.5, centinela:1.5, rastreador:1, arcanista:1.75, vinculador:1.33, protector:1.33,
    barbarian:2, knight:1.5, marksman:1.5, hunter:1, warlock:1.75, conjurer:1.33};
  var grades = {'excellent':45,'very good':30,'good':15,'normal':0,'bad':-15,'very bad':-30,
    'excelente':45,'muy buena':30,'buena':15,'mala':-15,'muy mala':-30};
  function number(v, fallback) { return typeof v === 'number' && isFinite(v) ? v : (fallback || 0); }
  function clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }
  function copy(v) { var out={}; Object.keys(v).forEach(function(k) {out[k]=v[k];}); return out; }
  F.family = function (classId) {
    if (classId === 'guardian' || classId === 'knight') return 'knight';
    if (classId === 'arcanista' || classId === 'vinculador' || classId === 'protector' || classId === 'mage' || classId === 'warlock' || classId === 'conjurer') return 'mage';
    return 'archer'; // Barbarian uses exactly the archer armour table in the workbook.
  };
  F.attributeCoefficient = function (classId) { return number(classK[classId]); };
  F.armorCoefficients = function (classId) { return copy(coefficients[F.family(classId)]); };
  F.resistanceWeights = function (classId) { return copy(resistanceWeights[F.family(classId)]); };
  F.CRITICAL_MULTIPLIER = 1.33;
  F.ARMOR_ABSORPTION_FACTOR = 0.52;
  F.source = {title:'Champions of Regnum - Plantilla de cálculo (v.1.8)', year:2016,
    armorFactorStatus:'community-beta-archer-tested-only'};

  // Hoja del pj!D42:I43: active bonuses never amplify passive attribute damage.
  F.weaponDamage = function (p) {
    p = p || {};
    var active = number(p.weaponFlat) + number(p.jewelryFlat) + number(p.buffFlat);
    var k = p.k === undefined ? F.attributeCoefficient(p.classId) : number(p.k);
    var passive = k * (number(p.attribute,20) - 20);
    return Math.max(0,active * (1 + number(p.bonusPct)) + passive);
  };
  // Daño y Armadura!E32:E40/J32:J39/O32:O38. Bonus is NOT multiplied by slot K.
  F.protection = function (classId, pieces, bonusPct) {
    var ks = coefficients[F.family(classId)], total=0;
    pieces = pieces || {};
    Object.keys(ks).forEach(function (slot) {
      var piece=pieces[slot];
      if (!piece) return;
      total += ks[slot] * number(piece.base) + number(piece.bonusFlat);
    });
    return Math.max(0,total * (1 + number(bonusPct)));
  };
  F.resistanceGradePct = function (grade) {
    if (typeof grade === 'number') return grade; // explicit FRACTION, never points.
    var key=String(grade || 'normal').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(grades,key)) throw new Error('Unknown armor resistance grade: '+grade);
    return grades[key] / 100;
  };
  // Daño y Armadura!G122:U175: deliberately retain weights which sum BELOW 1.
  F.resistance = function (classId, pieces, element, bonusPct) {
    var weights=resistanceWeights[F.family(classId)], total=number(bonusPct);
    pieces = pieces || {};
    Object.keys(weights).forEach(function (slot) {
      var piece=pieces[slot];
      var grade=piece && piece.resistances && piece.resistances[element];
      if (grade !== undefined) total += weights[slot] * F.resistanceGradePct(grade);
    });
    return total;
  };
  // Daño y Armadura!F186:F193/G181/G193:G194. Sum first, subtract armour ONCE.
  // critical after mitigation follows translated shared G194 = G193 * 1.33.
  F.mitigate = function (p) {
    p=p || {};
    var components=p.components || {}, resistances=p.resistances || {}, sum=0, raw=0, byElement={};
    Object.keys(components).forEach(function (element) {
      var amount=Math.max(0,number(components[element]));
      // Neutral is NOT pure: neutral skips resistance, but not armor subtraction.
      var resist=(element === 'neutral' || element === 'generic') ? 0 : number(resistances[element]);
      var after=amount*Math.max(0,1-resist);
      raw += amount; sum += after; byElement[element]=after;
    });
    var ignore=clamp(number(p.ignoreDefensePct),0,1);
    var factor=p.armorFactor === undefined ? F.ARMOR_ABSORPTION_FACTOR : Math.max(0,number(p.armorFactor));
    var armorReduction=Math.max(0,number(p.armor))*factor*(1-ignore);
    var beforeCritical=Math.max(0,sum-armorReduction);
    var criticalMultiplier=p.critical ? F.CRITICAL_MULTIPLIER*Math.max(0,1+number(p.criticalBonusPct)) : 1;
    return {raw:raw, afterResistance:sum, byElement:byElement, armorReduction:armorReduction,
      beforeCritical:beforeCritical, damage:beforeCritical*criticalMultiplier, criticalMultiplier:criticalMultiplier};
  };
  // Hoja del pj!D68. Workbook output is percent POINTS; API result is a fraction.
  F.criticalChance = function (concentration, bonusPct) {
    return clamp(Math.max(0,number(concentration)/10-3)*(1+number(bonusPct))/100,0,1);
  };
  // Hoja del pj!D80, level=0 had #DIV/0 in original; guard is a runtime addition.
  F.evasionChance = function (dexterity, level, bonusPct) {
    if (!(level>0)) return 0;
    return clamp(Math.max(0,number(dexterity)*0.066-100/level)*(1+number(bonusPct))/100,0,1);
  };
  F.powerResistanceChance = function (constitution, intelligence, level, buffPoints, bonusPct) {
    var base=0.02*(number(constitution)+number(intelligence))+0.026364*number(level)-1.25+number(buffPoints);
    return clamp(Math.max(0,base)*(1+number(bonusPct))/100,0,1);
  };
  F.health = function (classId, constitution, level, bonusFlat) {
    var warrior=classId==='devastador'||classId==='guardian'||classId==='barbarian'||classId==='knight';
    return Math.max(0,(warrior?47:37)*(number(constitution)/2+number(level))+number(bonusFlat)-(warrior?270:170));
  };
  F.mana = function (classId, intelligence, level, bonusFlat) {
    return Math.max(0,18*(number(intelligence)/2+number(level))+number(bonusFlat)-((classId==='vinculador'||classId==='protector'||classId==='conjurer')?75:80));
  };
  F.attackRate = function (classId, speed, bonusPct) {
    var family=F.family(classId);
    if (classId==='devastador'||classId==='barbarian') family='knight';
    var table={knight:{fast:0.61,medium:0.52,slow:0.45,verySlow:0.39},archer:{fast:0.66,medium:0.6,slow:0.53},mage:{fast:0.65,medium:0.63,slow:0.54}};
    var base=table[family][speed];
    if (base===undefined) throw new Error('Unsupported weapon speed: '+family+'/'+speed);
    return Math.max(0,base*(1+number(bonusPct)));
  };
  F.attackCycle = function (classId,speed,bonusPct) {
    var rate=F.attackRate(classId,speed,bonusPct);
    return rate>0 ? 1/rate : Infinity;
  };
  F.castTime = function (baseSeconds, bonusPct) {
    return Math.max(0,number(baseSeconds))/Math.max(0.01,1+number(bonusPct));
  };
  F.globalCooldown = function (baseSeconds, attackSpeedBonusPct) {
    return Math.max(0,number(baseSeconds)*(1-number(attackSpeedBonusPct)));
  };
  F.moveSpeed = function (bonusPct) { return 4.8*(1+clamp(number(bonusPct),-0.7,0.5)); };
  Arena.Combat = Arena.Combat || {};
  Arena.Combat.RegnumFormulas=F;
  return F;
});
