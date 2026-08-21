/* =============================================================================
 * data/powerAnimationGrammar.js — Presentation-only semantic animation grammar.
 *
 * The generated power library preserves source mechanics and is deliberately
 * regenerated from the master document.  This thin layer derives VISUAL action
 * metadata from stable source semantics without editing generated powers or
 * branching on individual ability ids inside render code.
 *
 * It may mutate presentation/combatTiming.visualAction only.  It MUST NOT touch
 * damage, costs, cooldowns, GCD, range, statuses or any simulation outcome.
 * ========================================================================== */
Arena.define('data/powerAnimationGrammar', ['data/powerLibrary','data/abilities'], function (Arena) {
  'use strict';
  var abilities=Arena.Data.abilities;
  var applied=[];

  function sourceName(a){ return a&&a.sourceMechanics&&a.sourceMechanics.sourceName || ''; }
  function isMeleeClass(a){ return a && (a.classId==='devastador'||a.classId==='guardian'); }
  function hasPositiveBuff(a){
    var all=(a.effects||[]).concat(a.selfEffects||[]);
    return all.some(function(e){ return e && (e.effect==='sourceBuff'||e.effect==='barrier'||e.type==='sourceBuff'||e.type==='status'&&e.effect&&/buff|barrier|block|reflect|protect/i.test(e.effect)); });
  }

  function assignVisual(a, visualAction, rule){
    if(!a||!a.combatTiming) return false;
    if(a.combatTiming.visualAction===visualAction) return false;
    // Presentation-only: clone the small metadata object so the generated source
    // object remains structurally obvious in diagnostics while runtime gets the
    // derived semantic action.
    var next={}; for(var k in a.combatTiming) if(Object.prototype.hasOwnProperty.call(a.combatTiming,k)) next[k]=a.combatTiming[k];
    next.visualAction=visualAction;
    a.combatTiming=next;
    applied.push({id:a.id,sourceName:sourceName(a),visualAction:visualAction,rule:rule});
    return true;
  }

  Object.keys(abilities).forEach(function(id){
    var a=abilities[id]; if(!a||!a.sourceDerived) return;
    var n=sourceName(a);
    // The source semantic is stable across both warrior subclasses and does not
    // depend on generated runtime ids.  This makes the real knockdown power use
    // Arena's authored leg-chain kick instead of the old Melee_Hook placeholder.
    if(isMeleeClass(a) && n==='Puntapié') assignVisual(a,'kick','sourceName:Puntapié');
    if(isMeleeClass(a) && a.powerType==='active' && a.flags && (!a.combatTiming.visualAction||a.combatTiming.visualAction==='none')) {
      if(a.flags.offensive) {
        /* Weaponless control/taunt powers need a body read too.  A shout uses
           the war-cry family; a Guardian weapon interaction uses the shield,
           and a Devastador weapon interaction uses the heavy family. */
        if(!a.flags.weaponAttack || a.target==='aoeSelf') assignVisual(a,'cry','melee:offensiveControl');
        else if(a.classId==='guardian') assignVisual(a,'shield','guardian:offensiveWeaponUtility');
        else assignVisual(a,'heavy','devastador:offensiveWeaponUtility');
      } else {
        /* Every active melee utility gets an intentional stance gesture.  This
           covers wards/heals/stances as well as sourceBuff, avoiding powers
           that resolve mechanically while the character remains motionless. */
        assignVisual(a,a.classId==='guardian'?'guardBuff':'cry',a.classId+':activeUtility');
      }
    }
  });

  Arena.Data.powerAnimationGrammar={
    applied:applied,
    rules:['sourceName:Puntapié','melee:offensiveControl','guardian:offensiveWeaponUtility','devastador:offensiveWeaponUtility','guardian:activeUtility','devastador:activeUtility'],
    visualFor:function(id){ var a=abilities[id]; return a&&a.combatTiming?a.combatTiming.visualAction:null; }
  };
});
