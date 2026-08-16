/* =============================================================================
 * render/skinnedAnimationContract.js — v0.15 NEW SKINNED MOTION LANGUAGE
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
Arena.define('render/skinnedAnimationContract', [], function (Arena) {
  'use strict';

  var C = {};
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
      archetype:'melee', classId:'devastador', initialized:false
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

  function locomotion(st,handle){
    var L=handle.loco; if(!L) return;
    var t=st.targets;
    var speed=clamp(L.moveSpeed||0,0,1.25);
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
    var amp=0.48*speed;
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
      add(t,'LeftLowerLeg', Math.max(0,lSwing)*0.62 + Math.max(0,-lSwing)*0.12,0,0);
      add(t,'RightLowerLeg',Math.max(0,rSwing)*0.62 + Math.max(0,-rSwing)*0.12,0,0);
      add(t,'LeftFoot', lSwing*0.24,0,side*0.20);
      add(t,'RightFoot',rSwing*0.24,0,-side*0.20);
      // Counter-rotation through the torso; subtle enough for MMO camera distance.
      add(t,'Hips',0,-sf*0.055*speed,0);
      add(t,'Spine',0,sf*0.075*speed,0);
      add(t,'Chest',0,-sf*0.050*speed,0);
    }
  }

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
    // Bow carried low but ready, not horizontally across the chest.
    add(t,'LeftUpperArm',-0.30,-0.05,-0.05); add(t,'LeftLowerArm',0.20,0,0.03);
    add(t,'RightUpperArm',-0.10,0.04,0.08); add(t,'RightLowerArm',0.28,0,-0.03);
    if(move>0){
      var s=Math.sin((L.cycle||0)*Math.PI*2)*move;
      add(t,'LeftUpperArm',s*0.055,0,0); add(t,'RightUpperArm',-s*0.10,0,0);
    }
    st.targetWeapon.kind='bow'; st.targetWeapon.pitch=0; st.targetWeapon.roll=0;
  }

  function meleeGuard(st,handle){
    var t=st.targets, L=handle.loco, move=clamp(L?L.moveSpeed:0,0,1);
    add(t,'RightUpperArm',-0.10,0.05,-0.07); add(t,'RightLowerArm',0.22,0,0.03);
    add(t,'LeftUpperArm',-0.05,-0.03,0.04); add(t,'LeftLowerArm',0.18,0,0);
    if(move>0){
      var s=Math.sin((L.cycle||0)*Math.PI*2)*move;
      add(t,'RightUpperArm',s*0.18,0,0); add(t,'LeftUpperArm',-s*0.18,0,0);
    }
    st.targetWeapon.kind='sword'; st.targetWeapon.roll=-0.08;
  }

  function phaseInfo(handle){
    var a=handle.action;
    if(!a||!a.family) return null;
    var ph=(handle.cfg&&handle.cfg.phases&&(handle.cfg.phases[a.family]||handle.cfg.phases.light)) ||
      {active:0.28,impact:0.55,recovery:0.78,end:1};
    return {a:a,ph:ph,t:clamp(a.t||0,0,1)};
  }

  function casterCast(st,handle){
    var t=st.targets, c=clamp(handle.cast||0,0,1);
    if(handle.casting){
      var prep=smooth(c/0.22), gather=smooth((c-0.18)/0.38), channel=smooth((c-0.50)/0.42);
      // Planted feet and tall spine. Staff rises beside shoulder; free hand gathers forward.
      add(t,'Hips',0,-0.10*gather,0); add(t,'Spine',-0.04*prep,0,0); add(t,'Chest',-0.10*gather,0.10*gather,0);
      add(t,'RightUpperArm',-0.34*prep-0.42*gather,-0.08*gather,-0.16*gather);
      add(t,'RightLowerArm',0.40*prep+0.30*gather,0,-0.06*gather);
      add(t,'RightHand',-0.14*gather,0,-0.10*gather);
      add(t,'LeftUpperArm',-0.38*prep-0.38*gather,-0.25*gather,0.18*gather);
      add(t,'LeftLowerArm',0.46*prep-0.18*channel,0,-0.18*gather);
      add(t,'LeftHand',-0.18*channel,0,0.12*channel);
      st.targetWeapon.pitch=-0.10-0.24*gather; st.targetWeapon.roll=-0.10*gather;
      return true;
    }
    var p=phaseInfo(handle); if(!p || p.a.family!=='cast') return false;
    var after=smooth((p.t-p.ph.impact)/Math.max(0.08,p.ph.end-p.ph.impact));
    var hit=1-after;
    // Release: kinetic chain torso -> shoulder -> elbow -> staff, then recover.
    add(t,'Chest',-0.14*hit,0.28*hit,0);
    add(t,'RightUpperArm',-0.78*hit,0.10*hit,-0.08*hit);
    add(t,'RightLowerArm',0.18*hit,0,0.02);
    add(t,'LeftUpperArm',-0.72*hit,-0.26*hit,0.16*hit);
    add(t,'LeftLowerArm',0.12*hit,0,-0.16*hit);
    st.targetWeapon.pitch=-0.44*hit; st.targetWeapon.recoil=hit;
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
    var raise=smooth(x/Math.max(0.08,ph.active*0.75));
    var draw=smooth((x-ph.active*0.35)/Math.max(0.08,ph.impact-ph.active*0.35));
    var released=x>=ph.impact ? smooth((x-ph.impact)/Math.max(0.06,ph.recovery-ph.impact)) : 0;
    var rec=smooth((x-ph.recovery)/Math.max(0.08,ph.end-ph.recovery));
    var hold=1-rec;

    // Left arm stable toward target; right elbow travels backward during draw.
    add(t,'Chest',-0.06*raise,-0.12*draw+0.06*released,0);
    /* Full-draw targets were solved against the actual 17-bone GLB bind pose,
       not copied from the old mannequin. At draw=1 the bow hand lands about
       48 cm forward and the draw hand beside the face/string line. */
    add(t,'LeftUpperArm',-0.853*raise,0.247*draw,0.264*draw);
    add(t,'LeftLowerArm',-0.643*draw,0.221*draw,0.103*draw);
    add(t,'LeftHand',-0.04*raise,0,0);
    add(t,'RightUpperArm',-1.882*raise,0.831*draw,-1.165*draw);
    add(t,'RightLowerArm',1.786*draw-0.18*released,1.801*draw,-0.139*draw);
    add(t,'RightHand',-0.08*draw-0.22*released,0,0.04*draw);
    st.targetWeapon.draw=clamp(draw*(1-released),0,1);
    st.targetWeapon.recoil=released*(1-rec);
    return true;
  }

  function archerPreCast(st,handle){
    if(!handle.casting) return false;
    var t=st.targets, c=clamp(handle.cast||0,0,1);
    var raise=smooth(c/0.24), draw=smooth((c-0.18)/0.70);
    add(t,'Chest',-0.06*raise,-0.16*draw,0);
    add(t,'LeftUpperArm',-0.853*raise,0.247*draw,0.264*draw); add(t,'LeftLowerArm',-0.643*draw,0.221*draw,0.103*draw);
    add(t,'RightUpperArm',-1.882*raise,0.831*draw,-1.165*draw); add(t,'RightLowerArm',1.786*draw,1.801*draw,-0.139*draw);
    add(t,'RightHand',-0.08*draw,0,0.04*draw);
    st.targetWeapon.draw=draw;
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
      add(t,'Chest',0,-0.12*ant,0); add(t,'RightUpperLeg',-0.95*hit,0,0); add(t,'RightLowerLeg',0.18*hit,0,0);
      add(t,'LeftUpperArm',-0.20*hit,0,0.15); add(t,'RightUpperArm',0.18*hit,0,-0.15); return true;
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
    if(!opts.skipLocomotion) locomotion(st,handle);
    // Weapon identity is independent from whether an external full-body clip is active.
    st.targetWeapon.kind=st.archetype==='caster'?'staff':(st.archetype==='archer'?'bow':'sword');
    if(st.archetype==='caster'){
      if(!opts.skipGuard) casterGuard(st,handle);
      if(!opts.skipCasterAction && !casterCast(st,handle)) casterNormal(st,handle);
    } else if(st.archetype==='archer'){
      if(!opts.skipGuard) archerGuard(st,handle);
      if(!opts.skipArcherAction && !archerPreCast(st,handle)) archerShot(st,handle);
    } else {
      if(!opts.skipGuard) meleeGuard(st,handle);
      if(!opts.skipMeleeAction) meleeAction(st,handle);
    }
    crowdControl(st,handle);

    var rate=st.initialized?16:1000;
    for(var i=0;i<C.BONES.length;i++){
      var n=C.BONES[i], b=st.bones[n], q=st.targets[n];
      b.x=damp(b.x,q.x,rate,dt); b.y=damp(b.y,q.y,rate,dt); b.z=damp(b.z,q.z,rate,dt);
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
