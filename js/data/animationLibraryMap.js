/* =============================================================================
 * data/animationLibraryMap.js — v0.16 clip contract for UAL2 Standard (CC0)
 *
 * Pure data/selection only. It does NOT animate Three.js and never mutates
 * simulation. The renderer consumes this contract to decide which external
 * reference clip can represent an already-authoritative AnimationIntent.
 * ========================================================================== */
Arena.define('data/animationLibraryMap', [], function (Arena) {
  'use strict';
  var M = {};
  M.asset = 'assets/animations/ual2-standard.glb';
  M.license = 'CC0-1.0';
  M.clips = {
    idle: 'Idle_FoldArms_Loop',
    locomotion: 'Walk_Carry_Loop',
    hit: 'Hit_Knockback',
    jumpStart: 'NinjaJump_Start',
    jumpAir: 'NinjaJump_Idle_Loop',
    jumpLand: 'NinjaJump_Land',
    meleeA: 'Sword_Regular_A',
    meleeB: 'Sword_Regular_B',
    meleeC: 'Sword_Regular_C',
    meleeHeavy: 'Sword_Heavy_Combo',
    meleeBlock: 'Sword_Block',
    meleeDash: 'Sword_Dash',
    shield: 'Shield_OneShot',
    shieldDash: 'Shield_Dash'
  };
  M.masks = {
    upperBody: ['Spine','Chest','Neck','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand'],
    lower: ['Hips','Spine','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'],
    lowerSpine: ['Hips','Spine','Chest','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'],
    full: ['Hips','Spine','Chest','Neck','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot']
  };
  function clamp(x,a,b){return x<a?a:(x>b?b:x);}
  function smooth(x){x=clamp(x,0,1);return x*x*(3-2*x);}
  function actionSpec(clip,t,extra){
    t=clamp(t,0,1); var enter=smooth(t/0.13), exit=smooth((1-t)/0.18);
    var o={clip:clip,phase:0.08+t*0.84,mask:'full',blend:Math.min(enter,exit),fullAction:true};
    if(extra) for(var k in extra)o[k]=extra[k]; return o;
  }
  M.select = function (handle, archetype) {
    var L = handle && handle.loco || {};
    var A = handle && handle.action || {};
    var speed = clamp(L.moveSpeed || 0, 0, 1.2);

    /* Jump clips are presentation-only and never move the authoritative root. */
    if (L.airborne) {
      var jp = clamp(L.jumpPhase || 0, 0, 1);
      if (jp < 0.20) return { clip:M.clips.jumpStart, phase:jp/0.20, mask:'lowerSpine', blend:1, locomotion:true, jump:true };
      if (jp > 0.82) return { clip:M.clips.jumpLand, phase:(jp-0.82)/0.18, mask:'lowerSpine', blend:1, locomotion:true, jump:true };
      return { clip:M.clips.jumpAir, phase:(jp-0.20)/0.62, mask:'lowerSpine', blend:1, locomotion:true, jump:true };
    }
    if ((L.landingAmount || 0) > 0.08) {
      return { clip:M.clips.jumpLand, phase:1-clamp(L.landingAmount,0,1), mask:'lowerSpine', blend:clamp(L.landingAmount*1.3,0,1), locomotion:true };
    }

    /* A received hit may briefly borrow UAL2's natural upper-body recoil.
       It never owns root translation and never suppresses the lower-body
       locomotion controller, so a running player does not freeze on impact. */
    var hitAmount=clamp(L.hitAmount||0,0,1);
    if(hitAmount>0.08 && !(handle&&handle.casting) && !A.family){
      var hitT=clamp(1-hitAmount,0,1);
      return {clip:M.clips.hit,phase:0.06+hitT*0.86,mask:'upperBody',blend:Math.min(0.78,smooth(hitAmount*1.7)),hitReaction:true};
    }

    /* UAL2 contains high quality sword families. We use them only for melee,
       so caster/archer weapon language remains the purpose-built Arena pose. */
    if (archetype === 'melee' && A.family) {
      var t = clamp(A.t || 0, 0, 0.9999), v = A.variant || 0;
      if (A.family === 'light') return actionSpec((v%3===0?M.clips.meleeA:(v%3===1?M.clips.meleeB:M.clips.meleeC)),t);
      if (A.family === 'heavy') return actionSpec(M.clips.meleeHeavy,t);
      if (A.family === 'shield') return actionSpec(M.clips.shield,t);
      if (A.family === 'charge') return actionSpec(M.clips.meleeDash,t);
      if (A.family === 'thrust') return actionSpec(M.clips.meleeC,t,{blend:Math.min(0.92,Math.min(smooth(t/0.13),smooth((1-t)/0.18)))});
    }

    /* The supplied pack does not include true strafe/backpedal clips. We do
       not fake them by rotating a forward walk: those directions stay on the
       dedicated procedural directional grammar. Forward locomotion uses the
       mocap-authored gait, while backward samples it in reverse as a temporary
       naturalistic base until a dedicated backward clip is supplied. */
    var f = L.moveForward || 0, r = L.moveRight || 0;
    var mostlyForward = Math.abs(f) >= 0.45 && Math.abs(r) < 0.58;
    if (speed > 0.06 && mostlyForward) {
      var phase = (L.cycle || 0) % 1; if (phase < 0) phase += 1;
      if (f < 0) phase = (1-phase) % 1;
      return { clip:M.clips.locomotion, phase:phase, mask:'lowerSpine', blend:clamp((speed-0.04)/0.22,0,1), locomotion:true, reverse:f<0 };
    }

    /* At true idle borrow only pelvis/spine/legs from the loop. Arms remain
       under Arena's weapon guards so staff/bow/sword silhouettes stay ours. */
    if(speed<=0.06 && !(handle&&handle.casting) && !A.family && !(handle&&handle.cc)){
      var idlePhase=((L.breathe||0)/(Math.PI*2))%1; if(idlePhase<0)idlePhase+=1;
      return {clip:M.clips.idle,phase:idlePhase,mask:'lowerSpine',blend:clamp((L.idleAmount===undefined?1:L.idleAmount)*0.62,0,0.62),locomotion:true,idle:true};
    }
    return null;
  };
  Arena.Data.AnimationLibraryMap = M;
  return M;
});
