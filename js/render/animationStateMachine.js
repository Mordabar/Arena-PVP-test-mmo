/* =============================================================================
 * render/animationStateMachine.js — v0.34 · literal warrior clips + natural REC timing + archer facing fix.
 *
 * PRESENTATION ONLY. The latest user mapping is authoritative for clip choice.
 * Simulation owns position, yaw, RELEASE, damage, CC, GCD and cooldowns.
 * ========================================================================== */
Arena.define('render/animationStateMachine', ['data/animationProfiles','data/animationSourcePlan'], function (Arena) {
  'use strict';
  var S = {}, AP = Arena.Data.AnimationProfiles, SP = Arena.Data.AnimationSourcePlan;
  var PP = SP.playbackPolicy || {};
  var AFP = SP.archerFacingPolicy || {};

  S.STATES = {
    IDLE:{clip:'Idle_Loop',mask:'full',loop:true,fade:0.22,phaseGroup:'idle'},
    COMBAT_IDLE:{clip:'Idle_Loop',mask:'full',loop:true,fade:0.18,phaseGroup:'idle'},
    WALK:{clip:'Walk_Loop',mask:'full',loop:true,fade:0.18,phaseGroup:'locomotion'},
    RUN:{clip:'Jog_Fwd_Loop',mask:'full',loop:true,fade:0.14,phaseGroup:'locomotion'},
    SPRINT:{clip:'Sprint_Loop',mask:'full',loop:true,fade:0.12,phaseGroup:'locomotion'},
    BACKPEDAL:{clip:null,mask:'full',loop:true,fade:0.10,phaseGroup:'locomotion'},
    STRAFE:{clip:null,mask:'full',loop:true,fade:0.10,phaseGroup:'locomotion'},
    DIAGONAL:{clip:null,mask:'full',loop:true,fade:0.10,phaseGroup:'locomotion'},
    TURN:{clip:null,mask:'full',loop:false,fade:0.08},
    JUMP_START:{clip:'Jump_Start',mask:'full',loop:false,fade:0.08},
    AIRBORNE:{clip:'Jump_Loop',mask:'full',loop:true,fade:0.08},
    LAND:{clip:'Jump_Land',mask:'full',loop:false,fade:0.10},
    HIT:{clip:'Hit_Chest',mask:'upper',loop:false,fade:0.075},
    KNOCKDOWN_START:{clip:'Slide_Start',mask:'full',loop:false,fade:0.06},
    KNOCKDOWN_LOOP:{clip:'Slide_Loop',mask:'full',loop:true,fade:0.04},
    KNOCKDOWN_EXIT:{clip:'Slide_Exit',mask:'full',loop:false,fade:0.07},
    DEATH:{clip:'Death01',mask:'full',loop:false,fade:0.08},
    ACTION:{clip:null,mask:'full',loop:false,fade:0.075},
    CAST_CHARGE:{clip:null,mask:'full',loop:true,fade:0.12}
  };

  S.MASKS = {
    full:['Hips','Spine','Chest','Neck','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'],
    lower:['Hips','Spine','Chest','LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'],
    upper:['Spine','Chest','Neck','Head','LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand']
  };

  function clamp(x,a,b){return x<a?a:(x>b?b:x);}
  function copy(a,b){if(b)for(var k in b)a[k]=b[k];return a;}
  function classIdOf(h){return (h&&h.intent&&h.intent.classId)||'devastador';}
  function policyOf(h,archetype){return SP.classPolicy[classIdOf(h)]||{archetype:archetype,grip:archetype};}
  function slotSel(slot, extra){
    var o={clip:slot&&slot.clip||null,requestedClip:slot&&slot.clip||null,source:'EXTERNAL_CC0',qualityStatus:slot&&slot.status||SP.STATUS.MISSING};
    if(slot&&slot.fallback)o.fallbackClip=slot.fallback;
    if(!slot||slot.status===SP.STATUS.MISSING||!slot.clip){o.intentionalBlank=true;o.source='INTENTIONAL_BLANK';}
    if(slot&&slot.status===SP.STATUS.SOURCE_DERIVED)o.source='SOURCE_DERIVED_CC0';
    if(slot&&slot.status===SP.STATUS.PLACEHOLDER)o.source='ARENA_DEFAULT_PLACEHOLDER';
    return copy(o,extra);
  }
  function state(name,extra){
    var st=S.STATES[name];
    return copy({state:name,clip:st.clip,mask:st.mask,loop:st.loop,fade:st.fade,rate:1,window:st.window||null,phaseGroup:st.phaseGroup||null,procedural:false,source:st.clip?'EXTERNAL_CC0':'INTENTIONAL_BLANK',qualityStatus:'FINAL'},extra);
  }

  S.actionClipProgress=function(handle,family,clip){
    var A=(handle&&handle.action)||{},ph=(handle&&handle.cfg&&handle.cfg.phases&&(handle.cfg.phases[family]||handle.cfg.phases.light))||{impact:0.5};
    var impact=clamp(ph.impact===undefined?0.5:ph.impact,0.02,0.98),meta=AP.actionClipFor(clip),t=clamp(A.t||0,0,1),u;
    if(t<=impact)u=meta.start+(t/impact)*(meta.contact-meta.start);else u=meta.contact+((t-impact)/(1-impact))*(meta.end-meta.contact);
    return clamp(u,0,1);
  };

  function actionFromSlot(handle, family, slot, key, extra){
    if(!slot||!slot.clip) return state('ACTION',{clip:'Idle_Loop',loop:true,intentionalBlank:true,blankSlot:key,qualityStatus:SP.STATUS.MISSING,source:'INTENTIONAL_BLANK'});
    return state('ACTION',copy(slotSel(slot,{mask:'full',loop:false,family:family,syncAuthoritative:true,syncProgress:S.actionClipProgress(handle,family,slot.clip),semanticSlot:key}),extra));
  }

  /* Sword_Regular_A/B each ship with a dedicated *_Rec clip. The attack clip
     owns anticipation/contact; the REC clip owns the return to the combat idle.
     This avoids a crossfade directly from the strike endpoint to Sword_Idle. */
  function normalWithRecovery(handle, variant){
    var A=(handle&&handle.action)||{},ph=(handle&&handle.cfg&&handle.cfg.phases&&handle.cfg.phases.light)||{impact:.42,recovery:.55};
    var isB=(variant&1)===1;
    var attack=isB?SP.slots.meleeNormalB:SP.slots.meleeNormalA;
    var rec=isB?SP.slots.meleeNormalBRec:SP.slots.meleeNormalARec;
    var key=isB?'meleeNormalB':'meleeNormalA';
    var t=clamp(A.t||0,0,1), cut=clamp(ph.recovery===undefined?.55:ph.recovery,ph.impact||.42,.90);
    if(t<cut){
      var p=clamp(t/Math.max(.05,cut),0,1);
      var meta=AP.actionClipFor(attack.clip);
      var contactT=clamp((ph.impact||.42)/Math.max(.05,cut),.05,.95);
      var sourceProgress=p<=contactT
        ? meta.start+(p/contactT)*(meta.contact-meta.start)
        : meta.contact+((p-contactT)/(1-contactT))*(meta.end-meta.contact);
      return state('ACTION',slotSel(attack,{mask:'full',loop:false,family:'light',syncAuthoritative:true,syncProgress:clamp(sourceProgress,0,1),semanticSlot:key,normalStage:'ATTACK'}));
    }
    return state('ACTION',slotSel(rec,{
      mask:'full',loop:false,family:'light',
      /* REC is presentation recovery, not the authoritative hit marker.
         Let the real *_Rec clip breathe at natural speed instead of forcing
         0→100% into the tiny tail of the simulation action. */
      syncAuthoritative:false,
      rate:Number.isFinite(PP.meleeRecoveryRate)?PP.meleeRecoveryRate:0.72,
      fade:Number.isFinite(PP.meleeRecoveryFade)?PP.meleeRecoveryFade:0.085,
      semanticSlot:key+'Rec',normalStage:'RECOVERY'}));
  }

  function combatUpper(handle,archetype,sel){
    var pol=policyOf(handle,archetype), combatMode=!!(handle&&handle.intent&&handle.intent.combatMode);
    if(!combatMode) return sel;
    if(pol.grip==='oneHandShield'){ sel.mask='lower';sel.directUpperBase='Idle_Shield_Loop';sel.directUpperBaseProgress=0.50; }
    else if(pol.grip==='twoHand'){ sel.mask='lower';sel.directUpperBase='Sword_Idle';sel.directUpperBaseProgress=0.50; }
    else if(pol.grip==='bow'){ sel.mask='lower';sel.directUpperBase='Arena_Archer_VideoReady';sel.directUpperBaseProgress=0.50; }
    else if(pol.grip==='staff'){ sel.mask='lower';sel.directUpperBase='Spell_Simple_Idle_Loop';sel.directUpperBaseProgress=0.50; }
    return sel;
  }
  function locomotionFromSlot(handle,archetype,stateName,slot,key,extra){
    if(!slot||!slot.clip) return state(stateName,{clip:'Idle_Loop',intentionalBlank:true,blankSlot:key,qualityStatus:SP.STATUS.MISSING,source:'INTENTIONAL_BLANK'});
    var sel=state(stateName,copy(slotSel(slot,{loop:stateName!=='TURN',phaseGroup:stateName!=='TURN'?'locomotion':null,semanticSlot:key}),extra));
    return combatUpper(handle,archetype,sel);
  }

  function lowerBaseForHit(handle,archetype){
    var L=(handle&&handle.loco)||{},speed=clamp(L.moveSpeed||0,0,1.6),f=L.moveForward||0,r=L.moveRight||0,mps=L.metersPerSecond;
    if(mps===undefined)mps=speed*4.15;
    if(speed<=0.06)return 'Idle_Loop';
    if(f<-0.20)return (Math.abs(r)>.28?(r<0?SP.locomotion.walkBackLeft.clip:SP.locomotion.walkBackRight.clip):SP.locomotion.walkBackward.clip)||'Idle_Loop';
    if(Math.abs(f)<.45&&Math.abs(r)>.40)return (r<0?SP.locomotion.strafeLeft.clip:SP.locomotion.strafeRight.clip)||'Idle_Loop';
    if(f>.20&&Math.abs(r)>.28)return (r<0?SP.locomotion.diagonalForwardLeft.clip:SP.locomotion.diagonalForwardRight.clip)||'Idle_Loop';
    if(f>.20){
      if(handle&&handle.intent&&handle.intent.speedBoosted&&Math.abs(mps)>.95)return 'Sprint_Loop';
      return Math.abs(mps)>.95?'Jog_Fwd_Loop':'Walk_Loop';
    }
    return 'Idle_Loop';
  }

  S.select=function(handle,archetype){
    var L=(handle&&handle.loco)||{},A=(handle&&handle.action)||{},pol=policyOf(handle,archetype),cid=classIdOf(handle),intent=handle&&handle.intent||{};
    var speed=clamp(L.moveSpeed||0,0,1.6),hasTarget=!!intent.hasTarget,combatMode=!!intent.combatMode;

    if(handle&&handle.deadTime>0)return state('DEATH',slotSel(SP.slots.death));

    /* Knockdown uses the exact Slide triplet selected by the user. ccBlend is a
       presentation blend only: while knockdown exists we enter/hold Slide; once
       simulation removes knockdown, the fading ccBlend drives Slide_Exit. */
    if(intent.crowdControl==='KNOCKDOWN'){
      if((handle.ccBlend||0)<0.62)return state('KNOCKDOWN_START',slotSel(SP.slots.knockdownStart,{syncAuthoritative:true,syncProgress:clamp((handle.ccBlend||0)/.62,0,1)}));
      return state('KNOCKDOWN_LOOP',slotSel(SP.slots.knockdownLoop,{loop:true}));
    }
    if((handle&&handle.ccBlend||0)>0.02&&handle&&handle.cc&&handle.cc.rootPitch>0.8){
      return state('KNOCKDOWN_EXIT',slotSel(SP.slots.knockdownExit,{syncAuthoritative:true,syncProgress:clamp(1-(handle.ccBlend||0),0,1)}));
    }

    if(L.airborne){var jp=clamp(L.jumpPhase||0,0,1);if(jp<0.20)return state('JUMP_START',{rate:PP.jumpStartRate||0.88});if(jp>0.82)return state('LAND',{rate:PP.jumpLandRate||0.82});return state('AIRBORNE',{rate:PP.jumpAirRate||0.94});}
    if((L.landingAmount||0)>0.08)return state('LAND',{rate:PP.jumpLandRate||0.82});

    /* Damage reaction clips are selected from the actual damage packet. Auto
       attack = Hit_Chest. A damaging ability without hard control = Hit_Head. */
    if((handle&&handle.hurt||0)>0.06){
      var hs=(handle.hurtReaction==='head')?SP.slots.hitHead:SP.slots.hitChest;
      return state('HIT',slotSel(hs,{mask:'upper',loop:false,rate:handle.hurtReaction==='head'?(PP.hitHeadRate||0.80):(PP.hitChestRate||0.82),directLowerBase:lowerBaseForHit(handle,archetype),semanticSlot:handle.hurtReaction==='head'?'hitHead':'hitChest'}));
    }

    /* Caster family: all Spell_* clips are now in their literal roles. */
    if(handle&&handle.casting&&archetype==='caster'){
      return state('CAST_CHARGE',slotSel(SP.slots.casterCharge,{mask:'full',loop:true,semanticSlot:'casterCharge'}));
    }

    /* Archer v0.32: charge is simulation-driven and references the exact
       Bow_Notch name from the user's video. If Source is unavailable, the
       authored video-derived fallback plays on upper body over planted legs. */
    if(handle&&handle.casting&&archetype==='archer'){
      var va=(intent.visualAction)||(A&&A.visualAction)||null;
      var attackLike=!!(va&&String(va).indexOf('archer')===0);
      var as=attackLike?SP.slots.archerAttackCharge:SP.slots.archerBuffCharge;
      var cprog=clamp(Number(intent.castProgress)||Number(handle.cast)||0,0,1);
      return state('CAST_CHARGE',slotSel(as,{mask:'upper',directLowerBase:'Arena_Archer_VideoReady',directLowerBaseProgress:0.50,loop:false,syncAuthoritative:true,syncProgress:cprog,fallbackSyncProgress:cprog,bowDraw:attackLike?cprog:0,semanticSlot:attackLike?'archerAttackCharge':'archerBuffCharge'}));
    }

    if(A.family){
      if(archetype==='archer'){
        var arslot=A.family==='ranged'?(A.isPower?SP.slots.archerPowerRelease:SP.slots.archerNormalAttack):SP.slots.archerBuffCharge;
        var aph=(handle&&handle.cfg&&handle.cfg.phases&&(handle.cfg.phases.ranged||handle.cfg.phases.light))||{impact:.56,recovery:.72};
        var at=clamp(A.t||0,0,1), impact=clamp(aph.impact||.56,.1,.9);
        var draw=at<impact?clamp(at/impact,0,1):0;
        return state('ACTION',slotSel(arslot,{mask:'upper',directLowerBase:'Arena_Archer_VideoReady',directLowerBaseProgress:0.50,loop:false,syncAuthoritative:true,syncProgress:at,fallbackSyncProgress:at,bowDraw:draw,semanticSlot:A.isPower?'archerPowerRelease':'archerNormalAttack'}));
      }
      if(archetype==='caster'){
        var cslot=A.family==='pulse'?SP.slots.casterNormalAttack:SP.slots.casterPowerRelease;
        return actionFromSlot(handle,A.family,cslot,A.family==='pulse'?'casterNormalAttack':'casterPowerRelease',{mask:'upper',directLowerBase:'Idle_Loop',directLowerBaseProgress:0.50});
      }
      if(archetype==='melee'){
        if(A.family==='kick')return actionFromSlot(handle,A.family,SP.slots.kick,'kick',{mask:'lower',directUpperBase:cid==='guardian'?'Idle_Shield_Loop':'Sword_Idle',directUpperBaseProgress:0.50});
        if(A.family==='shield')return actionFromSlot(handle,A.family,SP.slots.shieldBash,'shieldBash');
        if(A.family==='charge')return actionFromSlot(handle,A.family,SP.slots.warriorCharge,'warriorCharge');
        if(A.family==='cry'){
          if(A.visualAction==='guardBuff')return state('ACTION',slotSel(SP.slots.shieldGuard,{mask:'full',loop:false,family:'cry',rate:PP.shieldBuffRate||0.82,syncAuthoritative:false,semanticSlot:'shieldGuard'}));
          return actionFromSlot(handle,A.family,SP.slots.warriorBuff,'warriorBuff');
        }
        if(A.family==='light')return normalWithRecovery(handle,A.variant||0);
        if(A.family==='heavy'||A.family==='thrust')return actionFromSlot(handle,A.family,SP.slots.meleeWeaponPower,'meleeWeaponPower');
      }
      return state('ACTION',{clip:'Idle_Loop',loop:true,intentionalBlank:true,blankSlot:'unmappedAction:'+A.family,qualityStatus:SP.STATUS.MISSING,source:'INTENTIONAL_BLANK'});
    }

    var f=L.moveForward||0,r=L.moveRight||0,mps=L.metersPerSecond;
    if(mps===undefined)mps=speed*4.15;
    function rate(n){return clamp(Math.abs(mps)/Math.max(0.1,n),0.72,1.28);}
    if(speed>0.06){
      if(f<-0.20){
        var bs=Math.abs(r)>0.28?(r<0?SP.locomotion.walkBackLeft:SP.locomotion.walkBackRight):SP.locomotion.walkBackward;
        return locomotionFromSlot(handle,archetype,'BACKPEDAL',bs,r<-.28?'locomotion.walkBackLeft':(r>.28?'locomotion.walkBackRight':'locomotion.walkBackward'),{rate:rate(1.05),direction:r<-.28?'BACK_LEFT':(r>.28?'BACK_RIGHT':'BACK')});
      }
      if(Math.abs(f)<0.45&&Math.abs(r)>0.40){
        var ss=r<0?SP.locomotion.strafeLeft:SP.locomotion.strafeRight;
        return locomotionFromSlot(handle,archetype,'STRAFE',ss,r<0?'locomotion.strafeLeft':'locomotion.strafeRight',{rate:rate(1.25),direction:r<0?'LEFT':'RIGHT'});
      }
      if(f>0.20&&Math.abs(r)>0.28){
        var ds=r<0?SP.locomotion.diagonalForwardLeft:SP.locomotion.diagonalForwardRight;
        return locomotionFromSlot(handle,archetype,'DIAGONAL',ds,r<0?'locomotion.diagonalForwardLeft':'locomotion.diagonalForwardRight',{rate:rate(1.15),direction:r<0?'FORWARD_LEFT':'FORWARD_RIGHT'});
      }
      if(f>0.20){
        var useRun=Math.abs(mps)>0.95;
        var boosted=!!intent.speedBoosted;
        var stateName=useRun?(boosted?'SPRINT':'RUN'):'WALK';
        var clip=useRun?(boosted?'Sprint_Loop':'Jog_Fwd_Loop'):'Walk_Loop';
        var baseRate=useRun?(boosted?5.2:4.15):0.975;
        return combatUpper(handle,archetype,state(stateName,{clip:clip,rate:rate(baseRate),qualityStatus:SP.STATUS.FINAL,source:'EXTERNAL_CC0'}));
      }
    }
    if(Math.abs(L.turnRate||0)>0.12){
      var ts=L.turnRate<0?SP.locomotion.turnLeft:SP.locomotion.turnRight;
      return locomotionFromSlot(handle,archetype,'TURN',ts,L.turnRate<0?'locomotion.turnLeft':'locomotion.turnRight',{direction:L.turnRate<0?'LEFT':'RIGHT',loop:true,phaseGroup:'turn'});
    }

    if(combatMode){
      if(pol.grip==='oneHandShield')return state('COMBAT_IDLE',slotSel(SP.slots.combatIdleOneHand,{clip:'Idle_Shield_Loop',mask:'full',rate:PP.combatIdleRate||0.94}));
      if(pol.grip==='twoHand')return state('COMBAT_IDLE',slotSel(SP.slots.combatIdleTwoHand,{clip:'Sword_Idle',mask:'full',rate:PP.combatIdleRate||0.94}));
      if(pol.grip==='bow')return state('COMBAT_IDLE',slotSel(SP.slots.combatIdleArcher,{mask:'full',loop:true,rate:PP.combatIdleRate||0.94,bowDraw:0,semanticSlot:'combatIdleArcher'}));
      if(pol.grip==='staff')return state('COMBAT_IDLE',slotSel(SP.slots.combatIdleCaster,{clip:'Spell_Simple_Idle_Loop',mask:'full'}));
    }
    return state('IDLE',slotSel(SP.slots.normalIdle,{clip:'Idle_Loop',mask:'full'}));
  };

  S.clipsUsados=function(){
    var set=Object.create(null);function add(x){if(x)set[x]=true;}
    Object.keys(SP.slots).forEach(function(k){add(SP.slots[k].clip);});
    Object.keys(SP.locomotion).forEach(function(k){add(SP.locomotion[k].clip);add(SP.locomotion[k].fallback);});
    SP.jump.active.forEach(add);
    ['Arena_Archer_VideoReady','Arena_Archer_VideoNotch','Arena_Archer_VideoShoot','Arena_Archer_VideoBuff'].forEach(add);
    return Object.keys(set);
  };

  Arena.Render.AnimationStateMachine=S;return S;
});
