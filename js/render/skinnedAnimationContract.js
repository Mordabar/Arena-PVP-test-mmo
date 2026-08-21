/* =============================================================================
 * render/skinnedAnimationContract.js — v0.20 WARRIOR MOTION FOUNDATION
 *
 * Pure animation contract for the imported humanoid. It consumes the already
 * authoritative CharacterVisual handle (loco/action/cast/cc) and outputs local
 * bone offsets + weapon state. It NEVER writes simulation state.
 *
 * The old v0.14 bridge copied world matrices from the procedural mannequin into
 * a completely different bind skeleton. That was mathematically legal but
 * aesthetically wrong: crossed legs, twisted shoulders and equipment floating
 * through the body. v0.15 animates the imported rig in its OWN local basis.
 * ========================================================================== */
Arena.define('render/skinnedAnimationContract', ['data/animationProfiles','render/anim/skeleton'], function (Arena) {
  'use strict';

  var C = {};
  var AP = Arena.Data.AnimationProfiles;
  var SK = Arena.Render.Skeleton;
  C.BONES = [
    'Hips','Spine','Chest','Neck','Head',
    'LeftUpperArm','LeftLowerArm','LeftHand','RightUpperArm','RightLowerArm','RightHand',
    'LeftUpperLeg','LeftLowerLeg','LeftFoot','RightUpperLeg','RightLowerLeg','RightFoot'
  ];

  function clamp(x,a,b){ return x<a?a:(x>b?b:x); }
  function smooth(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
  function pulse(x,a,b,c){
    if (x<=a || x>=c) return 0;
    if (x<b) return smooth((x-a)/Math.max(1e-4,b-a));
    return 1-smooth((x-b)/Math.max(1e-4,c-b));
  }
  function damp(a,b,rate,dt){ return a+(b-a)*(1-Math.exp(-rate*dt)); }

  function makeBone(){ return {x:0,y:0,z:0}; }
  function makePose(){
    var bones=Object.create(null), targets=Object.create(null);
    for(var i=0;i<C.BONES.length;i++){ bones[C.BONES[i]]=makeBone(); targets[C.BONES[i]]=makeBone(); }
    return {
      bones:bones, targets:targets,
      hipsY:0, targetHipsY:0, rootPitch:0, targetRootPitch:0, rootRoll:0, targetRootRoll:0,
      weapon:{kind:'none', pitch:0,yaw:0,roll:0,draw:0,recoil:0,visibility:1},
      targetWeapon:{kind:'none', pitch:0,yaw:0,roll:0,draw:0,recoil:0,visibility:1},
      archetype:'melee', classId:'devastador', combatReady:0, targetCombatReady:0, initialized:false
    };
  }
  C.createState=makePose;

  function zeroTargets(st){
    for(var i=0;i<C.BONES.length;i++){
      var b=st.targets[C.BONES[i]]; b.x=b.y=b.z=0;
    }
    st.targetHipsY=0; st.targetRootPitch=0; st.targetRootRoll=0;
    var w=st.targetWeapon; w.pitch=w.yaw=w.roll=w.draw=w.recoil=0; w.visibility=1;
  }
  function add(t,name,x,y,z){ var b=t[name]; b.x+=x||0; b.y+=y||0; b.z+=z||0; }

  function addVec(t,name,v,k){
    if(!v) return; k=k===undefined?1:k;
    add(t,name,(v.x||0)*k,(v.y||0)*k,(v.z||0)*k);
  }

  /** Normal → combat-ready es una mezcla de presentación, no una regla. */
  function updateReadiness(st,handle,dt){
    var intent=handle&&handle.intent;
    var action=handle&&handle.action;
    var active=!!((intent&&intent.hasTarget) || (handle&&handle.casting) ||
      (action&&action.family) || (handle&&handle.ccBlend>0.02));
    st.targetCombatReady=active?1:0;
    st.combatReady=damp(st.combatReady,st.targetCombatReady,active?8.5:3.2,dt);
  }

  /** BASE → clase. Se aplica incluso encima de un clip externo para que dos
      clases del mismo arquetipo no compartan exactamente la misma personalidad. */
  function classStance(st,handle,classId){
    var p=AP&&AP.profileFor?AP.profileFor(classId):null; if(!p) return;
    var k=(0.20+0.80*st.combatReady)*(p.readiness||1);
    var t=st.targets;
    st.targetHipsY+=(p.hipsY||0)*k;
    addVec(t,'Hips',p.hips,k); addVec(t,'Spine',p.spine,k); addVec(t,'Chest',p.chest,k); addVec(t,'Head',p.head,k);
    addVec(t,'LeftUpperLeg',p.lLeg,k); addVec(t,'RightUpperLeg',p.rLeg,k);
    addVec(t,'LeftUpperArm',p.lArm,k); addVec(t,'RightUpperArm',p.rArm,k);
  }

  function castMod(handle){
    var a=handle&&handle.action;
    var fam=(a&&a.castFamily) || (handle&&handle.intent&&handle.intent.castFamily) || 'projectile';
    return AP&&AP.castFor?AP.castFor(fam):{staffFwd:0.3,freeHand:0.5,chest:0.1,open:0,stanceLow:0,staffDown:0,releaseYaw:0.2};
  }

  function spellGesture(t,gesture,k,release){
    if(!gesture||gesture==='cast') return; k=clamp(k||0,0,1);
    if(gesture==='meteor'){
      add(t,'RightUpperArm',-0.30*k,0,0); add(t,'LeftUpperArm',-0.58*k,-0.12*k,0.05*k); add(t,'Chest',-0.12*k,0,0);
      if(release){ add(t,'RightUpperArm',0.58*k,0,0); add(t,'Chest',0.20*k,0,0); }
    }else if(gesture==='hurl'){
      add(t,'Chest',0,0.18*k,0); add(t,'LeftUpperArm',-0.34*k,-0.16*k,0.04*k);
      if(release) add(t,'Chest',0,-0.40*k,0);
    }else if(gesture==='freeze'||gesture==='shatter'){
      add(t,'LeftUpperArm',-0.55*k,0,0.34*k); add(t,'LeftLowerArm',-0.10*k,0,0.18*k); add(t,'Chest',0,-0.10*k,0);
      if(release) add(t,'LeftUpperArm',-0.18*k,0,0.12*k);
    }else if(gesture==='lightning'){
      add(t,'RightUpperArm',-0.46*k,0,0); add(t,'LeftUpperArm',-0.40*k,-0.34*k,0); add(t,'Chest',-0.09*k,0,0);
      if(release) add(t,'Chest',0,0.30*k,0);
    }else if(gesture==='storm'){
      add(t,'RightUpperArm',-0.28*k,0.18*k,-0.16*k); add(t,'LeftUpperArm',-0.44*k,-0.40*k,0.20*k); add(t,'Chest',-0.08*k,0,0);
    }else if(gesture==='groundSpike'||gesture==='groundFlame'){
      add(t,'RightUpperArm',0.28*k,0,0); add(t,'LeftUpperArm',0.16*k,0,0); add(t,'Chest',0.22*k,0,0); stDummy();
    }else if(gesture==='shadow'||gesture==='drain'||gesture==='dominate'){
      add(t,'Chest',0.10*k,-0.14*k,0); add(t,'LeftUpperArm',-0.30*k,0,0.08*k); add(t,'LeftLowerArm',0.32*k,0,0);
    }else if(gesture==='ward'||gesture==='heal'){
      add(t,'Chest',-0.10*k,0,0); add(t,'LeftUpperArm',-0.48*k,-0.38*k,0.24*k); add(t,'RightUpperArm',-0.12*k,0,0);
    }else if(gesture==='bind'){
      add(t,'LeftUpperArm',-0.46*k,0,-0.28*k); add(t,'LeftLowerArm',0.12*k,0,-0.18*k); add(t,'Chest',0,0.12*k,0);
    }else if(gesture==='summon'){
      add(t,'RightUpperArm',-0.36*k,0.16*k,0); add(t,'LeftUpperArm',-0.36*k,-0.28*k,0.12*k); add(t,'Chest',-0.08*k,0,0);
    }
  }
  /* Intencionalmente vacío: mantiene el branch ground* simétrico sin asignar
     estado global ni depender de VFX. */
  function stDummy(){}

  function deathPose(st,handle){
    if(!handle||!(handle.deadTime>0)) return false;
    var t=st.targets, u=smooth(clamp(handle.deadTime/0.62,0,1));
    /* Muerte original Arena: colapso lateral con protección involuntaria de
       cabeza y arma, distinto del knockdown frontal de Hit_Knockback. */
    st.targetRootPitch=1.18*u;
    st.targetRootRoll=0.34*u;
    st.targetHipsY-=0.12*u;
    add(t,'Hips',0,0.16*u,-0.08*u); add(t,'Spine',0.16*u,-0.10*u,-0.10*u); add(t,'Chest',0.22*u,0.12*u,-0.18*u);
    add(t,'Head',-0.18*u,-0.12*u,0.20*u);
    add(t,'LeftUpperArm',0.42*u,-0.10*u,0.30*u); add(t,'LeftLowerArm',0.38*u,0,-0.12*u);
    add(t,'RightUpperArm',0.58*u,0.16*u,-0.34*u); add(t,'RightLowerArm',0.28*u,0,0.18*u);
    add(t,'LeftUpperLeg',0.34*u,0,0.20*u); add(t,'LeftLowerLeg',0.62*u,0,0);
    add(t,'RightUpperLeg',0.16*u,0,-0.12*u); add(t,'RightLowerLeg',0.34*u,0,0);
    st.targetWeapon.recoil=0.35*(1-u);
    return true;
  }

  function locomotion(st,handle){
    var L=handle.loco; if(!L) return;
    var t=st.targets;
    var speed=clamp(L.moveSpeed||0,0,1.25);
    var gait=clamp(L.gait||0,0,1);
    var moving=speed>0.04;
    var ph=(L.cycle||0)*Math.PI*2;
    var sf=Math.sin(ph), cf=Math.cos(ph);
    var f=L.moveForward||0, r=L.moveRight||0;

    // Root/torso: small and grounded. No exaggerated procedural scaling.
    st.targetHipsY += (L.hipHeight||0)*0.45 + (moving?Math.abs(sf)*0.010*speed:Math.sin(L.breathe||0)*0.004);
    add(t,'Hips', -(L.leanF||0)*0.10, 0, -(L.leanR||0)*0.05);
    add(t,'Spine', -(L.leanF||0)*0.20, -(L.torsoYaw||0)*0.18, -(L.torsoRoll||0)*0.22);
    add(t,'Chest', -(L.leanF||0)*0.16, (L.torsoYaw||0)*0.32, (L.torsoRoll||0)*0.35);
    add(t,'Head', (L.leanF||0)*0.10, -(L.headYaw||0)*0.45, -(L.torsoRoll||0)*0.15);

    if(!moving) {
      // Breathing and turn-in-place keep the model alive without flailing.
      var br=Math.sin(L.breathe||0)*0.018;
      add(t,'Chest',br,0,0); add(t,'Head',-br*0.35,0,0);
      if(Math.abs(L.turnRate||0)>0.12){
        var turn=clamp((L.turnRate||0)*0.18,-0.24,0.24);
        var side=turn<0?-1:1;
        var timer=L.turnStepTimer||0;
        var tp=timer>0?smooth((0.30-timer)/0.30):0;
        var lift=Math.sin(tp*Math.PI)*Math.min(1,Math.abs(turn)*5.0);
        /* Turn-in-place: support leg anchors, stepping leg opens in the turn
           direction, pelvis leads and chest counter-rotates. This is a pivot,
           not two legs twisting like scissors. */
        add(t,'Hips',0,turn*0.55,side*0.025*lift);
        add(t,'Spine',0,-turn*0.28,0); add(t,'Chest',0,-turn*0.42,-side*0.025*lift);
        if(side>0){
          add(t,'RightUpperLeg',-0.12*lift,0,-0.22*lift); add(t,'RightLowerLeg',0.26*lift,0,0); add(t,'RightFoot',0,0.18*turn,0.08*lift);
          add(t,'LeftUpperLeg',0.03*lift,0,0.05*lift);
        } else {
          add(t,'LeftUpperLeg',-0.12*lift,0,0.22*lift); add(t,'LeftLowerLeg',0.26*lift,0,0); add(t,'LeftFoot',0,0.18*turn,-0.08*lift);
          add(t,'RightUpperLeg',0.03*lift,0,-0.05*lift);
        }
      }
      return;
    }

    // The cycle frequency already derives from move speed/stride in locomotion.js.
    // We only translate that phase into anatomically conservative leg arcs.
    var fore=Math.abs(f)>=0.18 ? (f>=0?1:-0.72) : 0;
    /* Carrera Arena: mayor extensión y fase aérea sugerida por el `gait` que
       ya calcula locomotion.js con dutyFactorRun < 0.5. No usa el andar zombi. */
    var amp=(0.48+0.20*gait)*speed;
    var lSwing=sf*amp*fore, rSwing=-sf*amp*fore;
    var side=clamp(r,-1,1)*0.18*speed;
    var pureStrafe=Math.abs(r)>0.55 && Math.abs(f)<0.35;
    if(pureStrafe){
      /* Dedicated side-step: feet alternate outward/closing motion. We do not
         rotate a forward walk ninety degrees, which makes knees cross and the
         character skate. Z rotation abducts the thigh laterally on this rig. */
      var dir=r<0?-1:1, lat=sf*0.26*speed;
      add(t,'LeftUpperLeg',-0.08*cf*speed,0,-dir*lat);
      add(t,'RightUpperLeg',0.08*cf*speed,0,dir*lat);
      add(t,'LeftLowerLeg',Math.max(0,-sf)*0.28*speed,0,0);
      add(t,'RightLowerLeg',Math.max(0,sf)*0.28*speed,0,0);
      add(t,'LeftFoot',0,0,-dir*lat*0.36); add(t,'RightFoot',0,0,dir*lat*0.36);
      add(t,'Hips',0,-sf*0.025*speed,-dir*0.055*cf*speed);
      add(t,'Spine',0,sf*0.04*speed,dir*0.04*cf*speed);
      add(t,'Chest',0,-sf*0.03*speed,-dir*0.055*cf*speed);
    } else {
      add(t,'LeftUpperLeg',-lSwing, side*cf, -side*0.48);
      add(t,'RightUpperLeg',-rSwing, side*cf, side*0.48);
      add(t,'LeftLowerLeg', Math.max(0,lSwing)*(0.62+0.28*gait) + Math.max(0,-lSwing)*(0.12+0.10*gait),0,0);
      add(t,'RightLowerLeg',Math.max(0,rSwing)*(0.62+0.28*gait) + Math.max(0,-rSwing)*(0.12+0.10*gait),0,0);
      add(t,'LeftFoot', lSwing*0.24,0,side*0.20);
      add(t,'RightFoot',rSwing*0.24,0,-side*0.20);
      // Counter-rotation through the torso; subtle enough for MMO camera distance.
      add(t,'Hips',0,-sf*0.055*speed,0);
      add(t,'Spine',0,sf*0.075*speed,0);
      add(t,'Chest',-0.045*gait*speed,-sf*(0.050+0.035*gait)*speed,0);
    }
  }

  /** Foot-lock bridge for the real 17-bone legacy retarget body.
      locomotion.js already owns the contact cycle and freezes each planted
      foot in WORLD space.  v0.19 converts those targets back to character-local
      space and solves the target rig directly; this is presentation only and
      never moves the entity/root.  The legacy retarget body bind has two 0.40 m leg links
      and foot-bone origin at y=0.105 (rigCalibration/rig-report). */
  function footLockIK(st,handle,ctx){
    var L=handle&&handle.loco;
    if(!L||!L.legs||L.airborne||!ctx||!ctx.entityPos||!SK||!SK.solveTwoBoneIK) return false;
    if((L.moveSpeed||0)<0.035 && !(L.turnStepTimer>0)) return false;
    var scale=Math.max(0.01,ctx.scale||1), yaw=ctx.yaw||0;
    var cy=Math.cos(-yaw), sy=Math.sin(-yaw);
    var hipY=0.905 + st.targetHipsY/scale;
    /* The legacy retarget body exporter labels anatomical Left on x<0, but Arena's
       yaw convention has physical-left at +X when yaw=0. locomotion.js leg[0]
       is physical-left (+X), therefore it must drive the rig's Right* chain.
       This is the same measured-side correction preserved by v0.18 retarget. */
    var names=[['RightUpperLeg','RightLowerLeg','RightFoot',0.105],['LeftUpperLeg','LeftLowerLeg','LeftFoot',-0.105]];
    for(var i=0;i<2;i++){
      var leg=L.legs[i]; if(!leg||!leg.footPos) continue;
      var dx=(leg.footPos.x-ctx.entityPos.x)/scale;
      var dz=(leg.footPos.z-ctx.entityPos.z)/scale;
      var lx=dx*cy + dz*sy;
      var lz=-dx*sy + dz*cy;
      // The lock stores the sole on ground. Aim the foot-bone pivot 10.5 cm
      // above that plane, matching the measured target bind.
      var ly=(leg.footPos.y-ctx.entityPos.y)/scale + 0.105;
      var origin={x:names[i][3],y:hipY,z:0};
      var target={x:lx,y:ly,z:lz};
      var ik=SK.solveTwoBoneIK(origin,target,0.40,0.40,{});
      var up=st.targets[names[i][0]], low=st.targets[names[i][1]], foot=st.targets[names[i][2]];
      up.x=ik.pitch; up.y=0; up.z=ik.roll;
      low.x=ik.bend; low.y=0; low.z=0;
      var toe=(1-clamp(leg.plantWeight||0,0,1))*0.30;
      foot.x=-ik.pitch-ik.bend+toe; foot.y=0; foot.z=-ik.roll;
    }
    return true;
  }
  C.solveFootLockPose=footLockIK;

  function casterGuard(st,handle){
    var t=st.targets, L=handle.loco, move=clamp(L?L.moveSpeed:0,0,1);
    // Staff in right hand, free hand poised; upright silhouette like reference.
    add(t,'RightUpperArm',-0.24,0.10,-0.11);
    add(t,'RightLowerArm',0.32,0,0.06);
    add(t,'RightHand',-0.08,0,-0.05);
    add(t,'LeftUpperArm',-0.12,-0.04,0.10);
    add(t,'LeftLowerArm',0.20,0,-0.05);
    if(move>0){
      var s=Math.sin((L.cycle||0)*Math.PI*2)*move;
      add(t,'RightUpperArm',s*0.10,0,0); add(t,'LeftUpperArm',-s*0.07,0,0);
      add(t,'Chest',0,-s*0.035,0);
    }
    st.targetWeapon.kind='staff'; st.targetWeapon.roll=0.04; st.targetWeapon.pitch=-0.03;
  }

  function archerGuard(st,handle){
    var t=st.targets, L=handle.loco, move=clamp(L?L.moveSpeed:0,0,1);
    /* v0.30 · postura de combate del arquero, autorizada como gesto propio de
       Arena mientras BowNotch/BowShoot exactos siguen bloqueados. NO simula un
       disparo: el arco está levantado, el brazo de cuerda está preparado pero
       aún no existe draw. Así Centinela/Rastreador se distinguen del idle antes
       de que llegue la secuencia Source notch → shoot. */
    add(t,'Chest',-0.025,-0.045,0.015);
    add(t,'LeftUpperArm',-0.44,0.03,0.055); add(t,'LeftLowerArm',-0.10,0.02,0.025);
    add(t,'LeftHand',-0.02,0.00,0.015);
    add(t,'RightUpperArm',-0.72,0.11,-0.14); add(t,'RightLowerArm',0.34,0.22,-0.025);
    add(t,'RightHand',-0.035,0.00,0.025);
    if(move>0){
      var s=Math.sin((L.cycle||0)*Math.PI*2)*move;
      /* El torso absorbe el paso; el arco no hace péndulo como un brazo libre. */
      add(t,'Chest',0,-s*0.025,0);
      add(t,'LeftUpperArm',s*0.028,0,0); add(t,'RightUpperArm',-s*0.045,0,0);
      add(t,'RightLowerArm',Math.max(0,s)*0.035,0,0);
    }
    st.targetWeapon.kind='bow'; st.targetWeapon.pitch=0.02; st.targetWeapon.yaw=-0.04; st.targetWeapon.roll=0.02;
    st.targetWeapon.draw=0;
  }

  function meleeGuard(st,handle){
    var t=st.targets, L=handle.loco, move=clamp(L?L.moveSpeed:0,0,1.25);
    var ph=(L&&L.cycle||0)*Math.PI*2, sf=Math.sin(ph), cf=Math.cos(ph);
    var f=L&&L.moveForward||0, r=L&&L.moveRight||0;
    var cls=st.classId||'devastador';

    if(cls==='guardian'){
      /* GUARDIÁN: el escudo manda la silueta. Incluso quieto el hombro
         izquierdo queda adelantado y el codo sostiene la plancha en vez de
         colgarla de la muñeca. La espada permanece compacta y baja. */
      add(t,'Chest',-0.025,-0.045,0.010);
      add(t,'LeftUpperArm',-0.40,-0.20,0.34); add(t,'LeftLowerArm',0.80,0,-0.20); add(t,'LeftHand',-0.06,0,0.04);
      add(t,'RightUpperArm',-0.15,0.05,-0.10); add(t,'RightLowerArm',0.34,0,0.04);
      st.targetWeapon.kind='sword'; st.targetWeapon.pitch=0.02; st.targetWeapon.roll=-0.12;
      if(move>0.04){
        var k=clamp(move,0,1);
        /* Al avanzar el escudo se recoge cerca del torso y amortigua el paso;
           al strafe no hace péndulo como un brazo libre. */
        add(t,'Chest',-0.055*k,-0.030*sf*k,-0.025*r*k);
        add(t,'LeftUpperArm',-0.10*k,0.035*sf*k,0.08*k); add(t,'LeftLowerArm',0.10*k,0,0);
        add(t,'RightUpperArm',sf*0.12*k,0,-0.04*k); add(t,'RightLowerArm',Math.max(0,-sf)*0.10*k,0,0);
        st.targetWeapon.roll=-0.18-0.05*sf*k;
      }
      return;
    }

    /* DEVASTADOR: guardia ofensiva en diagonal. El espadón deja de colgar
       vertical junto al muslo; el brazo de arma queda retrasado y el brazo
       libre compensa el centro de masa. Sigue siendo una mano porque el rig
       actual no posee constraint de agarre secundario: no se finge un grip a
       dos manos que visualmente se desprendería. */
    add(t,'Chest',-0.060,0.055,0.010);
    add(t,'RightUpperArm',-0.32,0.12,-0.18); add(t,'RightLowerArm',0.46,0,0.08); add(t,'RightHand',-0.04,0,-0.04);
    add(t,'LeftUpperArm',-0.18,-0.10,0.18); add(t,'LeftLowerArm',0.32,0,-0.08);
    st.targetWeapon.kind='sword'; st.targetWeapon.pitch=0.05; st.targetWeapon.yaw=-0.03; st.targetWeapon.roll=-0.32;
    if(move>0.04){
      var km=clamp(move,0,1);
      var runBias=clamp((move-0.45)/0.55,0,1);
      /* Carrera: torso más adelantado, espada retrasada y brazo libre con
         contrabalance claro. Backpedal permanece más erguido; strafe inclina
         hacia el vector lateral sin girar mágicamente el cuerpo. */
      var fwd=Math.max(0,f), back=Math.max(0,-f);
      add(t,'Chest',-0.085*runBias*fwd+0.035*back, -sf*0.055*km, -r*0.035*km);
      add(t,'RightUpperArm',-0.10*runBias*fwd + sf*0.14*km, 0, -0.08*runBias*fwd);
      add(t,'RightLowerArm',0.12*runBias*fwd,0,0);
      add(t,'LeftUpperArm',-sf*0.28*km,0,0.08*runBias*fwd); add(t,'LeftLowerArm',Math.max(0,sf)*0.12*km,0,0);
      st.targetWeapon.roll=-0.42-0.10*runBias*fwd+sf*0.06*km;
      st.targetWeapon.pitch=0.08+0.06*runBias*fwd;
    }
  }

  function phaseInfo(handle){
    var a=handle.action;
    if(!a||!a.family) return null;
    var ph=(handle.cfg&&handle.cfg.phases&&(handle.cfg.phases[a.family]||handle.cfg.phases.light)) ||
      {active:0.28,impact:0.55,recovery:0.78,end:1};
    return {a:a,ph:ph,t:clamp(a.t||0,0,1)};
  }

  function casterCast(st,handle){
    var t=st.targets, c=clamp(handle.cast||0,0,1), m=castMod(handle);
    var a=handle&&handle.action, gesture=a&&a.spellGesture;
    if(handle.casting){
      var prep=smooth(c/0.22), gather=smooth((c-0.18)/0.38), channel=smooth((c-0.50)/0.42);
      var tension=Math.max(gather,channel);
      st.targetHipsY-=m.stanceLow*0.035*prep;
      add(t,'Hips',0,-0.10*gather,0);
      add(t,'Spine',-0.04*prep,0,0);
      add(t,'Chest',-(0.08+m.chest*0.18)*gather,(0.06+m.chest*0.32)*gather,m.open*0.035*gather);
      add(t,'RightUpperArm',-0.34*prep-(0.38+m.staffFwd*0.22)*gather,-0.08*gather,-0.16*gather);
      add(t,'RightLowerArm',0.40*prep+0.28*gather,0,-0.06*gather);
      add(t,'RightHand',-0.12*gather,0,-0.08*gather);
      add(t,'LeftUpperArm',-0.34*prep-(0.32+0.34*m.freeHand)*gather,-(0.14+0.20*m.open)*gather,(0.10+0.16*m.open)*gather);
      add(t,'LeftLowerArm',0.44*prep-(0.10+0.16*m.open)*channel,0,-0.16*gather);
      add(t,'LeftHand',-0.16*channel,0,0.10*channel);
      st.targetWeapon.pitch=-0.08-(0.20+m.staffDown*0.20)*gather;
      st.targetWeapon.roll=-0.08*gather+m.open*0.04*gather;
      spellGesture(t,gesture,tension,false);
      return true;
    }
    var p=phaseInfo(handle); if(!p || p.a.family!=='cast') return false;
    m=AP&&AP.castFor?AP.castFor(p.a.castFamily||'projectile'):m;
    gesture=p.a.spellGesture;
    var after=smooth((p.t-p.ph.impact)/Math.max(0.08,p.ph.end-p.ph.impact));
    var hit=1-after;
    /* Release: torso → shoulder → elbow → staff. La familia cambia apertura,
       dirección y base corporal; el color del VFX ya no carga con toda la lectura. */
    add(t,'Chest',-(0.10+m.chest*0.14)*hit,(m.releaseYaw||0.2)*hit,m.open*0.08*hit);
    add(t,'RightUpperArm',-(0.66+m.staffFwd*0.24)*hit,0.10*hit,-0.08*hit);
    add(t,'RightLowerArm',(0.18-m.staffDown*0.10)*hit,0,0.02);
    add(t,'LeftUpperArm',-(0.42+0.34*m.freeHand)*hit,-(0.14+0.20*m.open)*hit,(0.10+0.16*m.open)*hit);
    add(t,'LeftLowerArm',(0.18-0.12*m.freeHand)*hit,0,-0.14*hit);
    st.targetHipsY-=m.stanceLow*0.045*hit;
    st.targetWeapon.pitch=-(0.36+m.staffDown*0.20)*hit;
    st.targetWeapon.yaw=(m.releaseYaw||0.2)*0.18*hit;
    st.targetWeapon.recoil=hit;
    spellGesture(t,gesture,hit,true);
    return true;
  }

  function casterNormal(st,handle){
    var p=phaseInfo(handle); if(!p || p.a.family!=='pulse') return false;
    var t=st.targets, ph=p.ph, x=p.t;
    var prep=smooth(x/Math.max(0.08,ph.active));
    var release=smooth((x-ph.active)/Math.max(0.08,ph.impact-ph.active));
    var recover=smooth((x-ph.impact)/Math.max(0.08,ph.end-ph.impact));
    var live=(1-recover);
    add(t,'Chest',-0.05*prep,0.10*prep-0.14*release,0);
    add(t,'RightUpperArm',-0.30*prep-0.40*release,0.04,-0.08);
    add(t,'RightLowerArm',0.34*prep-0.15*release,0,0.03);
    add(t,'LeftUpperArm',-0.30*prep-0.20*release,-0.12*prep,0.10*prep);
    add(t,'LeftLowerArm',0.40*prep-0.18*release,0,-0.08);
    st.targetWeapon.pitch=-0.30*release*live; st.targetWeapon.recoil=release*live;
    return true;
  }

  function archerShot(st,handle){
    var p=phaseInfo(handle); if(!p || p.a.family!=='ranged') return false;
    var t=st.targets, ph=p.ph, x=p.t;
    var spec=AP&&AP.archerActionFor?AP.archerActionFor(p.a.visualAction,p.a.isPower):{draw:1,torso:1,hold:1,recoil:1,elevation:0};
    var raise=smooth(x/Math.max(0.08,ph.active*0.75));
    var draw=smooth((x-ph.active*0.35)/Math.max(0.08,ph.impact-ph.active*0.35))*spec.draw;
    var released=x>=ph.impact ? smooth((x-ph.impact)/Math.max(0.06,ph.recovery-ph.impact)) : 0;
    var rec=smooth((x-ph.recovery)/Math.max(0.08,ph.end-ph.recovery));
    draw=clamp(draw,0,1.12);

    /* Centinela = tiro limpio; Rastreador = centro de masa algo más bajo por su
       classStance. quick/control/power/volley cambian torso, hold y elevación. */
    add(t,'Chest',-0.06*raise*spec.torso,(-0.12*draw+0.06*released)*spec.torso,spec.elevation*0.18*raise);
    add(t,'LeftUpperArm',(-0.853+spec.elevation*0.20)*raise,0.247*draw,0.264*draw);
    add(t,'LeftLowerArm',-0.643*draw,0.221*draw,0.103*draw);
    add(t,'LeftHand',-0.04*raise,0,0);
    add(t,'RightUpperArm',-1.882*raise,0.831*draw,-1.165*draw);
    add(t,'RightLowerArm',1.786*draw-0.18*released*spec.recoil,1.801*draw,-0.139*draw);
    add(t,'RightHand',-0.08*draw-0.22*released*spec.recoil,0,0.04*draw);
    st.targetWeapon.pitch=spec.elevation*raise;
    st.targetWeapon.draw=clamp(draw*(1-released)*(0.88+0.12*spec.hold),0,1);
    st.targetWeapon.recoil=released*(1-rec)*spec.recoil;
    return true;
  }

  function archerPreCast(st,handle){
    if(!handle.casting) return false;
    var t=st.targets, c=clamp(handle.cast||0,0,1), aa=handle&&handle.action;
    var raise=smooth(c/0.24);
    /* Buff/utility sin visualAction de disparo: arco bajo, mano libre trabaja.
       Así una meditación o postura no parece una flecha fantasma. */
    if(aa && (!aa.visualAction || aa.visualAction==='none')){
      var g=smooth((c-0.12)/0.72);
      add(t,'Chest',-0.03*raise,0.08*g,0); add(t,'LeftUpperArm',0.10*g,0,-0.06*g); add(t,'LeftLowerArm',0.18*g,0,0);
      add(t,'RightUpperArm',-0.34*raise,-0.18*g,0.16*g); add(t,'RightLowerArm',0.52*g,0,-0.10*g); add(t,'RightHand',-0.16*g,0,0);
      st.targetWeapon.pitch=-0.18*g; st.targetWeapon.draw=0; return true;
    }
    var spec=AP&&AP.archerActionFor?AP.archerActionFor(aa&&aa.visualAction,true):{draw:1,torso:1,hold:1,recoil:1,elevation:0};
    var draw=smooth((c-0.18)/0.70)*spec.draw;
    add(t,'Chest',-0.06*raise*spec.torso,-0.16*draw*spec.torso,spec.elevation*0.18*raise);
    add(t,'LeftUpperArm',-0.853*raise,0.247*draw,0.264*draw); add(t,'LeftLowerArm',-0.643*draw,0.221*draw,0.103*draw);
    add(t,'RightUpperArm',-1.882*raise,0.831*draw,-1.165*draw); add(t,'RightLowerArm',1.786*draw,1.801*draw,-0.139*draw);
    add(t,'RightHand',-0.08*draw,0,0.04*draw);
    st.targetWeapon.pitch=spec.elevation*raise; st.targetWeapon.draw=clamp(draw,0,1);
    return true;
  }

  function archerUtility(st,handle){
    var p=phaseInfo(handle); if(!p || p.a.family!=='archerUtility') return false;
    var t=st.targets, ph=p.ph, x=p.t;
    var prep=smooth(x/Math.max(0.08,ph.active));
    var act=smooth((x-ph.active)/Math.max(0.08,ph.impact-ph.active));
    var rec=smooth((x-ph.impact)/Math.max(0.08,ph.end-ph.impact));
    var live=1-rec;
    add(t,'Chest',-0.03*prep,0.12*act*live,0); add(t,'Head',0,-0.06*act*live,0);
    add(t,'LeftUpperArm',0.12*prep,0,-0.08*prep); add(t,'LeftLowerArm',0.22*prep,0,0);
    add(t,'RightUpperArm',-0.30*prep-0.18*act,-0.22*act,0.18*act); add(t,'RightLowerArm',0.56*act,0,-0.12*act);
    add(t,'RightHand',-0.18*act,0,0);
    st.targetWeapon.pitch=-0.20*prep*live; st.targetWeapon.draw=0; st.targetWeapon.recoil=0.10*act*live;
    return true;
  }

  function meleeAction(st,handle){
    var p=phaseInfo(handle); if(!p) return false;
    var fam=p.a.family; if(['light','heavy','thrust','kick','shield','charge'].indexOf(fam)<0) return false;
    var t=st.targets, ph=p.ph, x=p.t;
    var ant=smooth(x/Math.max(0.08,ph.active));
    var hit=smooth((x-ph.active)/Math.max(0.08,ph.impact-ph.active));
    var rec=smooth((x-ph.impact)/Math.max(0.08,ph.end-ph.impact));
    var live=1-rec;
    if(fam==='kick'){
      st.targetHipsY-=0.035*hit; add(t,'Hips',-0.12*ant,0.18*hit,0.05*hit); add(t,'Spine',0,-0.10*hit,0); add(t,'Chest',0,-0.22*ant+0.18*hit,-0.08*hit);
      add(t,'RightUpperLeg',-1.08*hit,0,-0.08*hit); add(t,'RightLowerLeg',0.12*hit,0,0); add(t,'RightFoot',0.10*hit,0,0);
      add(t,'LeftUpperLeg',0.12*hit,0,0.06*hit); add(t,'LeftLowerLeg',0.18*hit,0,0);
      add(t,'LeftUpperArm',-0.26*hit,0,0.22); add(t,'RightUpperArm',0.22*hit,0,-0.20); return true;
    }
    if(fam==='thrust'){
      add(t,'Chest',-0.12*hit,0.16*hit,0); add(t,'RightUpperArm',-0.98*hit,-0.08,0); add(t,'RightLowerArm',0.12*hit,0,0);
      st.targetWeapon.pitch=-0.25*hit; return true;
    }
    if(fam==='charge'){
      add(t,'Hips',-0.18*hit,0,0); add(t,'Chest',-0.34*hit,0,0); add(t,'RightUpperArm',-0.62*hit,0,-0.12); return true;
    }
    var heavy=fam==='heavy'||fam==='shield';
    var side=(p.a.variant&1)?-1:1;
    add(t,'Chest',-0.10*ant,side*(-0.42*ant+0.80*hit)*live,side*0.10*ant);
    add(t,'RightUpperArm',0.18*ant-0.90*hit,side*0.28*ant,side*(-0.52*ant+0.72*hit));
    add(t,'RightLowerArm',0.48*ant-0.18*hit,0,side*0.10);
    add(t,'LeftUpperArm',-0.12*hit,0,-side*0.15*hit);
    st.targetWeapon.roll=side*(0.28*ant-0.72*hit)*(heavy?1.25:1); st.targetWeapon.recoil=hit*live;
    return true;
  }

  /** Lower-body chain that accompanies external UAL2 melee clips.
      Their root-motion feet are intentionally excluded (upper mask) because the
      entity is stationary by simulation; this layer supplies planting/weight. */
  function meleeLowerChain(st,handle){
    var p=phaseInfo(handle); if(!p) return false;
    var fam=p.a.family, t=st.targets, ph=p.ph, x=p.t;
    var ant=smooth(x/Math.max(0.08,ph.active));
    var hit=smooth((x-ph.active)/Math.max(0.08,ph.impact-ph.active));
    var rec=smooth((x-ph.impact)/Math.max(0.08,ph.end-ph.impact));
    var live=1-rec, side=(p.a.variant&1)?-1:1;
    if(fam==='light'){
      st.targetHipsY-=0.020*ant*live;
      add(t,'Hips',-0.04*ant,side*(-0.13*ant+0.22*hit)*live,side*0.025*hit);
      add(t,'LeftUpperLeg',0.07*ant,0,side*0.025*ant); add(t,'RightUpperLeg',0.07*ant,0,-side*0.025*ant);
      add(t,'LeftLowerLeg',0.12*ant,0,0); add(t,'RightLowerLeg',0.12*ant,0,0);
    } else if(fam==='heavy'){
      st.targetHipsY-=0.055*ant*live;
      add(t,'Hips',-0.10*ant,side*(-0.10*ant+0.28*hit)*live,0);
      add(t,'LeftUpperLeg',0.14*ant,0,0.04); add(t,'RightUpperLeg',0.14*ant,0,-0.04);
      add(t,'LeftLowerLeg',0.22*ant,0,0); add(t,'RightLowerLeg',0.22*ant,0,0);
    } else if(fam==='thrust'||fam==='charge'){
      st.targetHipsY-=0.025*ant*live;
      add(t,'Hips',-0.12*hit,0,0); add(t,'LeftUpperLeg',0.10*hit,0,0.025); add(t,'RightUpperLeg',-0.06*hit,0,-0.025);
      add(t,'LeftLowerLeg',0.18*hit,0,0); add(t,'RightLowerLeg',0.08*hit,0,0);
    } else if(fam==='shield'||fam==='block'){
      st.targetHipsY-=0.040*ant*live;
      add(t,'Hips',0,side*0.10*hit,0); add(t,'LeftUpperLeg',0.12*ant,0,0.055); add(t,'RightUpperLeg',0.12*ant,0,-0.055);
      add(t,'LeftLowerLeg',0.18*ant,0,0); add(t,'RightLowerLeg',0.18*ant,0,0);
    }
    return true;
  }

  /** Arena overlay for shield-bearing external melee clips. UAL2's generic
      one-shot contributes torso/right-side energy but the real Guardian tower
      shield must visibly lead the action. This presentation-only layer drives
      LEFT arm + a small chest brace without changing the authoritative action. */
  function externalMeleeOverlay(st,handle){
    var p=phaseInfo(handle); if(!p) return false;
    var fam=p.a.family; if(fam!=='shield'&&fam!=='block') return false;
    var t=st.targets, ph=p.ph, x=p.t;
    var ant=smooth(x/Math.max(0.08,ph.active));
    var drive=smooth((x-ph.active)/Math.max(0.08,ph.impact-ph.active));
    var rec=smooth((x-ph.impact)/Math.max(0.08,ph.end-ph.impact));
    var live=1-rec;
    if(fam==='shield'){
      // Brace → drive the shield plane forward → recoil. The shoulder stays
      // down enough to avoid the common shield-through-head artifact.
      add(t,'Chest',-0.08*ant,-0.16*drive*live,0.05*drive*live);
      add(t,'LeftUpperArm',-0.44*ant-0.38*drive*live,-0.18*drive*live,0.32*ant+0.22*drive*live);
      add(t,'LeftLowerArm',0.72*ant-0.20*drive*live,0.10*drive*live,-0.22*ant);
      add(t,'LeftHand',-0.10*drive*live,0,0.08*drive*live);
    } else {
      // Guard stays compact and square rather than looking like an attack.
      add(t,'Chest',-0.05*ant,0,0.04*ant);
      add(t,'LeftUpperArm',-0.32*ant,-0.10*ant,0.42*ant);
      add(t,'LeftLowerArm',0.88*ant,0,-0.20*ant);
      add(t,'LeftHand',-0.08*ant,0,0.05*ant);
    }
    return true;
  }

  function crowdControl(st,handle){
    var cc=handle.cc, w=handle.ccBlend||0; if(!cc||w<0.001) return;
    if(cc.rootPitch>0.8){ st.targetRootPitch=cc.rootPitch*w; st.targetHipsY-=0.08*w; }
    else {
      add(st.targets,'Chest',(cc.rootPitch||0)*w,0,(cc.sway?Math.sin((handle.ccTime||0)*4.3)*0.08:0)*w);
      add(st.targets,'Head',(cc.headTilt||0)*w,0,(cc.headTilt||0)*0.4*w);
      if(cc.armDrop){ add(st.targets,'LeftUpperArm',0.45*cc.armDrop*w,0,0); add(st.targets,'RightUpperArm',0.45*cc.armDrop*w,0,0); }
    }
  }

  C.update=function(st,handle,archetype,classId,dt,opts){
    opts=opts||{}; dt=clamp(dt||0,0,0.05); zeroTargets(st); st.archetype=archetype||'melee'; st.classId=classId||'devastador';
    updateReadiness(st,handle,dt);
    var dead=!!(handle&&handle.deadTime>0);
    if(!dead && !opts.skipLocomotion) locomotion(st,handle);
    // Weapon identity is independent from whether an external full-body clip is active.
    st.targetWeapon.kind=st.archetype==='caster'?'staff':(st.archetype==='archer'?'bow':'sword');
    if(dead){
      /* Cuando un clip externo full-body representa DEATH, no sumamos encima
         la antigua caída procedural: dos muertes simultáneas deformaban el rig. */
      if(!opts.skipDeath) deathPose(st,handle);
    } else {
      if(st.archetype==='caster'){
        if(!opts.skipGuard) casterGuard(st,handle);
      } else if(st.archetype==='archer'){
        if(!opts.skipGuard) archerGuard(st,handle);
      } else if(!opts.skipGuard) meleeGuard(st,handle);
      /* Identidad de clase se mezcla sobre guardia y locomoción, incluso cuando
         un clip externo lleva el lower body. */
      if(!opts.skipClassStance) classStance(st,handle,st.classId);
      if(st.archetype==='caster'){
        if(!opts.skipCasterAction && !casterCast(st,handle)) casterNormal(st,handle);
      } else if(st.archetype==='archer'){
        if(!opts.skipArcherAction && !archerPreCast(st,handle)) { if(!archerShot(st,handle)) archerUtility(st,handle); }
      } else if(!opts.skipMeleeAction) meleeAction(st,handle);
      if(opts.externalMeleeAction) { meleeLowerChain(st,handle); externalMeleeOverlay(st,handle); }
      if(opts.externalMeleeFullBody) externalMeleeOverlay(st,handle);
      if(!opts.skipLocomotion && !(handle&&handle.casting) && !(handle&&handle.action&&handle.action.family) && !(handle&&handle.ccBlend>0.02)) footLockIK(st,handle,opts.footIKContext);
      crowdControl(st,handle);
    }

    var rate=st.initialized?16:1000;
    var feetTracking=!!(handle&&handle.loco&&!handle.loco.airborne&&(handle.loco.moveSpeed||0)>0.035&&opts.footIKContext);
    for(var i=0;i<C.BONES.length;i++){
      var n=C.BONES[i], b=st.bones[n], q=st.targets[n];
      /* A planted foot is a world-space constraint. Smoothing its leg at the
         same leisurely rate as breathing makes the ROOT move underneath it and
         creates visible skating. Track leg IK aggressively; torso/arms retain
         softer damping. */
      var br=feetTracking&&(/UpperLeg|LowerLeg|Foot/.test(n))?58:rate;
      b.x=damp(b.x,q.x,br,dt); b.y=damp(b.y,q.y,br,dt); b.z=damp(b.z,q.z,br,dt);
    }
    st.hipsY=damp(st.hipsY,st.targetHipsY,rate,dt);
    st.rootPitch=damp(st.rootPitch,st.targetRootPitch,rate,dt);
    st.rootRoll=damp(st.rootRoll,st.targetRootRoll,rate,dt);
    var w=st.weapon,qw=st.targetWeapon; w.kind=qw.kind;
    w.pitch=damp(w.pitch,qw.pitch,18,dt); w.yaw=damp(w.yaw,qw.yaw,18,dt); w.roll=damp(w.roll,qw.roll,18,dt);
    w.draw=damp(w.draw,qw.draw,24,dt); w.recoil=damp(w.recoil,qw.recoil,22,dt); w.visibility=qw.visibility;
    st.initialized=true; return st;
  };

  Arena.Render.SkinnedAnimationContract=C;
});
