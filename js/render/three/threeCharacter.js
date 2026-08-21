/* =============================================================================
 * render/three/threeCharacter.js — el humanoide nativo de Quaternius (UAL),
 * gobernado por la animación que ya existe.
 *
 * ESTE FICHERO NO INVENTA UN SISTEMA DE ANIMACIÓN.
 *
 * Toda la locomoción, el foot locking, las fases de acción y el casteo ya
 * están resueltos en la capa de intención (`render/anim/`, `characterVisual.js`).
 * Aquí sólo se recibe ese estado y se aplica al esqueleto de 65 huesos del GLB.
 *
 * ÚNICA FUENTE DE CUERPO
 *
 * El cuerpo es SIEMPRE el maniquí nativo de Quaternius: no hay modelo custom,
 * no hay retargeting entre esqueletos distintos, no hay ruta procedural de
 * repuesto. Las animaciones vienen autoradas para este esqueleto exacto, así
 * que se aplican tal cual — sin ningún puente de retargeting entre dos rigs
 * diferentes, que fue la fuente de los defectos de versiones anteriores
 * (espejo de lateralidad, poses que no se alcanzan, T-pose intermitente).
 * ========================================================================== */
import * as THREE from 'three';
import { createDirectLibrary } from './threeDirectAnim.js?build=v0340-20260820-warrior-facing';

const RIG_PARENT = {
  Hips:null, Spine:'Hips', Chest:'Spine', Neck:'Chest', Head:'Neck',
  LeftUpperArm:'Chest', LeftLowerArm:'LeftUpperArm', LeftHand:'LeftLowerArm',
  RightUpperArm:'Chest', RightLowerArm:'RightUpperArm', RightHand:'RightLowerArm',
  LeftUpperLeg:'Hips', LeftLowerLeg:'LeftUpperLeg', LeftFoot:'LeftLowerLeg',
  RightUpperLeg:'Hips', RightLowerLeg:'RightUpperLeg', RightFoot:'RightLowerLeg'
};
const RIG_ORDER = Object.keys(RIG_PARENT);

function parallelTraverse(a, b, cb) {
  cb(a, b);
  for (var i=0; i<a.children.length; i++) parallelTraverse(a.children[i], b.children[i], cb);
}

/* Object3D.clone() comparte el Skeleton de un SkinnedMesh. Para un MMO eso
   haría que animar al primer jugador moviese a TODOS. Este clon reasigna cada
   skeleton a los huesos clonados, compartiendo sólo geometría/materiales. */
function cloneSkinnedScene(source) {
  var clone = source.clone(true);
  var srcToClone = Object.create(null);
  parallelTraverse(source, clone, function (src, dst) { srcToClone[src.uuid] = dst; });
  source.traverse(function (src) {
    if (!src.isSkinnedMesh) return;
    var dst = srcToClone[src.uuid];
    var sk = src.skeleton.clone();
    sk.bones = src.skeleton.bones.map(function (bone) { return srcToClone[bone.uuid]; });
    dst.skeleton = sk;
    dst.bindMatrix.copy(src.bindMatrix);
    dst.bindMatrixInverse.copy(src.bindMatrixInverse);
    dst.normalizeSkinWeights();
  });
  return clone;
}

/* Materiales por material lógico. La capa de animación ya clasifica cada pieza
   (piel, tela, cuero, metal, madera, magia): reutilizamos esa clasificación en
   vez de inventar otra que se desincronizaría. */


export function createCharacterFactory(Arena, scene, opts) {
  opts = opts || {};
  var Backend = Arena.Render.CharacterBackend;
  var baseCharacterGltf = opts.baseCharacterGltf || null;
  var meleeBaseCharacterGltf = opts.meleeBaseCharacterGltf || null;
  var animationLibraryGltf = opts.animationLibraryGltf || null;
  var dynamicCharacterLights = opts.dynamicCharacterLights === true;
  var directLibrary = null;
  function libreriaDirecta(sampleRoot) {
    if (directLibrary) return directLibrary;
    if (!animationLibraryGltf || !sampleRoot) return null;
    directLibrary = createDirectLibrary(Arena, animationLibraryGltf, sampleRoot);
    if (directLibrary) Arena.Render.directUalReport = { mode:directLibrary.mode, authored:directLibrary.authoredNames.slice(), derived:(directLibrary.derivedNames||[]).slice(), sourceBones:65 };
    return directLibrary;
  }

  /* Acentos mágicos Three-only. No representan gameplay: son presentación
     derivada de `handle.cast`/acción. Geometrías compartidas, cero allocations
     por fotograma. */
  var casterRuneGeo = new THREE.RingGeometry(0.62, 0.70, 48);
  casterRuneGeo.rotateX(-Math.PI / 2);
  var casterMoteGeo = new THREE.IcosahedronGeometry(0.055, 0);

  /* --- Armas limpias para el cuerpo skinned --------------------------------
   * Se enganchan a huesos reales; no reutilizamos matrices de equipo del
   * maniquí procedural. Cuerpo + arma es la dirección de esta iteración. */
  var weaponMat = new THREE.MeshStandardMaterial({ color:0x3a3029, roughness:0.62, metalness:0.12 });
  var metalWeaponMat = new THREE.MeshStandardMaterial({ color:0xaeb8c4, roughness:0.28, metalness:0.82 });
  var magicWeaponMat = new THREE.MeshStandardMaterial({ color:0x7fb7ff, emissive:0x244d88, emissiveIntensity:1.1, roughness:0.24, metalness:0.16 });

  function makeStaff() {
    var g=new THREE.Group(); g.name='weapon:staff';
    var shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.031,1.70,10),weaponMat); shaft.position.y=-0.34; g.add(shaft);
    var collar=new THREE.Mesh(new THREE.TorusGeometry(0.105,0.020,8,18),metalWeaponMat); collar.position.y=0.50; collar.rotation.x=Math.PI/2; g.add(collar);
    var orb=new THREE.Mesh(new THREE.IcosahedronGeometry(0.095,1),magicWeaponMat); orb.position.y=0.60; g.add(orb);
    g.position.set(0.025,-0.03,0.02); g.rotation.set(0.06,0,-0.05); return g;
  }
  function makeSword() {
    var g=new THREE.Group(); g.name='weapon:sword';
    var blade=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.72,0.020),metalWeaponMat); blade.position.y=0.40; g.add(blade);
    var tip=new THREE.Mesh(new THREE.ConeGeometry(0.041,0.12,4),metalWeaponMat); tip.position.y=0.82; g.add(tip);
    var guard=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.042,0.052),metalWeaponMat); guard.position.y=0.02; g.add(guard);
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.034,0.20,8),weaponMat); grip.position.y=-0.10; g.add(grip);
    /* UAL hand local +Y points from palm toward the middle finger.  The blade
       therefore extends +Y from the hand; the previous -Y layout ran through
       the forearm and made the sword disappear in several source poses. */
    g.position.set(0.00,0.00,0.00); return g;
  }
  function makeGreatsword() {
    /* v0.30 · distinct 2H silhouette. It is still socketed to RightHand until
       a validated secondary-hand grip constraint exists; that limitation is
       explicit in AnimationSourcePlan and no 1H swing is played on it. */
    var g=new THREE.Group(); g.name='weapon:greatsword';
    var blade=new THREE.Mesh(new THREE.BoxGeometry(0.075,1.02,0.028),metalWeaponMat); blade.position.y=0.56; g.add(blade);
    var tip=new THREE.Mesh(new THREE.ConeGeometry(0.057,0.16,4),metalWeaponMat); tip.position.y=1.15; g.add(tip);
    var guard=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.052,0.068),metalWeaponMat); guard.position.y=0.02; g.add(guard);
    var grip=new THREE.Mesh(new THREE.CylinderGeometry(0.039,0.039,0.34,8),weaponMat); grip.position.y=-0.17; g.add(grip);
    var pommel=new THREE.Mesh(new THREE.SphereGeometry(0.055,8,6),metalWeaponMat); pommel.position.y=-0.36; g.add(pommel);
    g.position.set(0,0,0); return g;
  }

  function makeBow() {
    var g=new THREE.Group(); g.name='weapon:bow';
    var c1=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0.64,0),new THREE.Vector3(0.25,0.32,0),new THREE.Vector3(0,0,0));
    var c2=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,0),new THREE.Vector3(0.25,-0.32,0),new THREE.Vector3(0,-0.64,0));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c1,14,0.023,7,false),weaponMat));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c2,14,0.023,7,false),weaponMat));
    var sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute([0,0.64,0, 0,0,0, 0,-0.64,0],3));
    var line=new THREE.Line(sg,new THREE.LineBasicMaterial({color:0xd9d9cf})); line.name='bowString'; g.add(line); g.userData.string=line; g.userData.lastDraw=NaN;
    g.position.set(-0.01,-0.01,0.03); return g;
  }

  function makeShield() {
    /* Escudo limpio de transición. No es armadura ni accesorio de clase: es el
       arma defensiva del Guardián y vive en el antebrazo izquierdo real del rig
       UAL. Su geometría local usa +Z como normal frontal, de modo que el socket
       puede orientar la placa sin la antigua cadena de offsets del legacy retarget body. */
    var g = new THREE.Group(); g.name='weapon:shield';
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.72,0.045), metalWeaponMat);
    plate.position.set(0,-0.10,0); g.add(plate);
    var rim = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.78,0.022), weaponMat);
    rim.position.set(0,-0.10,-0.025); g.add(rim);
    var face = new THREE.Mesh(new THREE.BoxGeometry(0.41,0.66,0.052), metalWeaponMat.clone());
    face.material.color.set(0x53677e); face.position.set(0,-0.10,0.015); g.add(face);
    g.position.set(0.00,-0.10,0.075);
    g.rotation.set(0.02,0,0.02,'YXZ');
    return g;
  }

  /* v0.30 · El antiguo sistema de armaduras procedurales fue retirado del
     runtime nativo. No quedan sockets de petos/capas/cascos ni conversiones
     legacy-retarget → UAL en esta ruta: sólo cuerpo UAL + armas funcionales. */

  function Character(entity) {
    this.entityId = entity.id;
    this.handle = Backend.current.createCharacter(entity);
    this.root = new THREE.Group();
    this.root.name = 'char:' + entity.id;
    scene.add(this.root);
    var arche0 = Arena.Data.archetypeOf(entity.classId);
    /* v0.30 baseline: las seis subclases usan el MISMO Humanoid nativo de
       Quaternius. Se elimina la bifurcación legacy retarget body/UAL y con ella el retarget
       de personaje en runtime. Esta decisión es sólo presentación. */
    this.directUalRig = !!meleeBaseCharacterGltf;
    this.characterGltf = meleeBaseCharacterGltf || baseCharacterGltf;
    this.usedGlb = !!this.characterGltf;
    this.fxTime = 0;
    this.skinnedRoot = null;
    this.rigBones = null;
    this.rigBindPos = null;
    this.rigBindQuat = null;
    this.rigBindWorldQuat = null;
    this.directBindAll = null;
    this.baseModelHeight = 1.89738;
    this.animLib = null;
    this.player = null;
    this.skinnedAnim = Arena.Render.SkinnedAnimationContract ? Arena.Render.SkinnedAnimationContract.createState() : null;
    this.weapons = null;
    this.guardianShield = null;
    this._shadowCasting = true;
    this.lastDt = 1/60;
    this._lastTargetMode = null;
    this._modeTransition = null;
    this._archerReadyLower = null;

    if (this.characterGltf) {
      this.skinnedRoot = cloneSkinnedScene(this.characterGltf.scene);
      this.skinnedRoot.name = 'ual-native-base:' + entity.id;
      this.root.add(this.skinnedRoot);

      /* Conservar materiales neutrales del mannequin UAL. Sin piel púrpura,
         sin armadura procedural y sin accesorios de la etapa legacy retarget body. */
      this.rigBones = Object.create(null);
      this.rigBindPos = Object.create(null);
      this.rigBindQuat = Object.create(null);
      this.rigBindWorldQuat = Object.create(null);
      this.skinnedRoot.updateMatrixWorld(true);

      var lib = this.directUalRig ? libreriaDirecta(this.skinnedRoot) : null;
      var map = this.directUalRig && lib ? lib.canonicalMap : null;
      for (var rb=0; rb<RIG_ORDER.length; rb++) {
        var bn = RIG_ORDER[rb];
        var actualName = map ? map[bn] : bn;
        var bone = this.skinnedRoot.getObjectByName(actualName);
        if (!bone || !bone.isBone) throw new Error('Rig GLB incompleto: falta hueso ' + actualName + ' (' + bn + ')');
        this.rigBones[bn] = bone;
        this.rigBindPos[bn] = bone.position.clone();
        this.rigBindQuat[bn] = bone.quaternion.clone();
        this.rigBindWorldQuat[bn] = bone.getWorldQuaternion(new THREE.Quaternion());
      }

      /* Exact source clips animate 65 bones, not only the 17 canonical joints.
         Preserve every source bind so procedural states can cleanly take over
         without leaving a finger/clavicle/toe frozen in the previous action. */
      if (this.directUalRig) {
        this.directBindAll = [];
        this.skinnedRoot.traverse((o) => {
          if (!o.isBone) return;
          this.directBindAll.push({ bone:o, p:o.position.clone(), q:o.quaternion.clone(), s:o.scale.clone() });
        });
        var box = new THREE.Box3().setFromObject(this.skinnedRoot);
        var h = box.max.y - box.min.y;
        if (Number.isFinite(h) && h > 0.5) this.baseModelHeight = h;
      }

      this.animLib = lib;
      this.player = lib ? lib.createPlayer(this.skinnedRoot) : null;
      this.weapons = { staff:makeStaff(), bow:makeBow(), sword:makeSword(), greatsword:makeGreatsword(), shield:makeShield() };
      this.rigBones.RightHand.add(this.weapons.staff);
      this.rigBones.LeftHand.add(this.weapons.bow);
      this.rigBones.RightHand.add(this.weapons.sword);
      this.rigBones.RightHand.add(this.weapons.greatsword);
      /* El escudo sigue el antebrazo; no la mano. Así el clip puede pronar la
         muñeca sin convertir la placa en una hélice. */
      this.rigBones.LeftLowerArm.add(this.weapons.shield);
      this.weapons.staff.visible=this.weapons.bow.visible=this.weapons.sword.visible=this.weapons.greatsword.visible=this.weapons.shield.visible=false;
      this.guardianShield = { node:this.weapons.shield };
      this.gear = null;
      this.gearClass = null;
      this.skinnedRoot.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = this._shadowCasting; o.receiveShadow = true;
        if (o.isSkinnedMesh) {
          /* v0.24 visual-arbiter finding: Three's geometry-space frustum test is
             unsafe for this imported skeleton.  It culled the player in idle
             even while the skinned pose was visibly inside the camera.  Keep
             the SkinnedMesh visible and optimize the environment/assets instead;
             a future character-level coarse culler must use the authoritative
             entity position, not the bind-pose geometry bounds. */
          o.frustumCulled = false;
        }
      });
    }

    // Luz tenue exclusiva del caster: sólo refuerza la gema/báculo; no sirve
    // para iluminar el mapa ni para gameplay.
    this.magicLight = null;
    this.castFx = null;
    if (Arena.Data.archetypeOf(entity.classId) === 'caster') {
      if (dynamicCharacterLights) {
        this.magicLight = new THREE.PointLight(0x75bfff, 0.75, 3.2, 2.0);
        scene.add(this.magicLight);
      }

      var fx = new THREE.Group();
      fx.name = 'caster-fx:' + entity.id;
      var runeMat = new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      var rune = new THREE.Mesh(casterRuneGeo, runeMat);
      rune.position.y = 0.025; fx.add(rune);
      var motes = [];
      for (var mi=0; mi<5; mi++) {
        var mm = new THREE.MeshBasicMaterial({ color: 0xaee9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        var mote = new THREE.Mesh(casterMoteGeo, mm); fx.add(mote); motes.push(mote);
      }
      scene.add(fx);
      this.castFx = { root: fx, rune: rune, motes: motes, time: 0 };
    }
  }

  Character.prototype.update = function (entity, dt, world) {
    Backend.current.updateCharacter(this.handle, entity, dt, world);
    this.lastDt = Math.max(1/240, Math.min(0.05, dt || 1/60));
    this.fxTime += Math.max(0, Math.min(0.05, dt || 0));
  };

  var _rigWorld = new THREE.Matrix4(), _rigParentWorld = new THREE.Matrix4();
  var _rigLocal = new THREE.Matrix4(), _rigInv = new THREE.Matrix4();
  var _rigPos = new THREE.Vector3(), _rigQuat = new THREE.Quaternion(), _rigScale = new THREE.Vector3();
  var _rigParentPos = new THREE.Vector3(), _rigParentQuat = new THREE.Quaternion(), _rigParentScale = new THREE.Vector3();
  var _one = new THREE.Vector3(1,1,1);

  var _qOffset = new THREE.Quaternion(), _eOffset = new THREE.Euler();
  var _shieldParentQ = new THREE.Quaternion(), _shieldRootQ = new THREE.Quaternion();
  var _shieldDesiredQ = new THREE.Quaternion(), _shieldLocalQ = new THREE.Quaternion();
  var _shieldCharQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.075, 0.020, 'YXZ'));
  var _weaponParentQ = new THREE.Quaternion(), _weaponRootQ = new THREE.Quaternion();
  var _weaponDesiredQ = new THREE.Quaternion(), _weaponLocalQ = new THREE.Quaternion();
  /* Weapon meshes are authored with their long axis on local +Y.  These
     character-space quaternions keep staff/bow readable while their POSITION
     continues to come directly from the animated hand. */
  var _staffCharQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.02, -0.05, 'YXZ'));
  var _bowCharQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, -0.12, 0.02, 'YXZ'));


  /* v0.34 · bow-specific two-bone presentation IK.
   * The video review showed that the v0.32 fallback had the right semantic
   * phases but twisted the torso because an upper-only pose was layered over a
   * square Idle lower body.  The full-body stance now comes from the same-rig
   * Pistol_Aim scaffold; this constraint only finishes the bow biomechanics by
   * placing the bow hand and string hand where the reference video expects.
   * It never changes entity position/yaw or combat timing. */
  var _ikS=new THREE.Vector3(), _ikE=new THREE.Vector3(), _ikH=new THREE.Vector3();
  var _ikTarget=new THREE.Vector3(), _ikPole=new THREE.Vector3(), _ikAdjTarget=new THREE.Vector3(), _ikElbowTarget=new THREE.Vector3();
  var _ikD=new THREE.Vector3(), _ikN=new THREE.Vector3(), _ikTmp=new THREE.Vector3(), _ikTmp2=new THREE.Vector3();
  var _ikCurDir=new THREE.Vector3(), _ikWantDir=new THREE.Vector3();
  var _ikRot=new THREE.Quaternion(), _ikWorldQ2=new THREE.Quaternion(), _ikParentQ2=new THREE.Quaternion(), _ikLocalQ2=new THREE.Quaternion();
  var _archLeftLocal=new THREE.Vector3(), _archLeftPoleLocal=new THREE.Vector3(), _archRightLocal=new THREE.Vector3(), _archRightPoleLocal=new THREE.Vector3();
  var _archRightStart=new THREE.Vector3(), _archRightDraw=new THREE.Vector3(), _archRightSnap=new THREE.Vector3();
  var _archLeftWorld=new THREE.Vector3(), _archLeftPoleWorld=new THREE.Vector3(), _archRightWorld=new THREE.Vector3(), _archRightPoleWorld=new THREE.Vector3();
  var _archRootWorld=new THREE.Vector3(), _archForwardWorld=new THREE.Vector3(), _archLateralWorld=new THREE.Vector3(), _archAimVec=new THREE.Vector3();
  function solveTwoBoneIK(upper, lower, hand, targetWorld, poleWorld, weight) {
    if(!upper||!lower||!hand||!upper.parent||!lower.parent||weight<=0)return;
    upper.updateWorldMatrix(true,true);
    upper.getWorldPosition(_ikS); lower.getWorldPosition(_ikE); hand.getWorldPosition(_ikH);
    var l1=_ikS.distanceTo(_ikE), l2=_ikE.distanceTo(_ikH);
    if(l1<1e-4||l2<1e-4)return;
    _ikD.copy(targetWorld).sub(_ikS);
    var rawD=_ikD.length(); if(rawD<1e-5)return;
    _ikD.multiplyScalar(1/rawD);
    var dist=Math.max(Math.abs(l1-l2)+1e-4,Math.min(l1+l2-1e-4,rawD));
    _ikAdjTarget.copy(_ikS).addScaledVector(_ikD,dist);
    _ikN.copy(poleWorld).sub(_ikS);
    _ikN.addScaledVector(_ikD,-_ikN.dot(_ikD));
    if(_ikN.lengthSq()<1e-8){
      _ikN.copy(_ikE).sub(_ikS); _ikN.addScaledVector(_ikD,-_ikN.dot(_ikD));
    }
    if(_ikN.lengthSq()<1e-8)_ikN.set(0,1,0);
    _ikN.normalize();
    var x=(l1*l1-l2*l2+dist*dist)/(2*dist);
    var hh=Math.sqrt(Math.max(0,l1*l1-x*x));
    _ikElbowTarget.copy(_ikS).addScaledVector(_ikD,x).addScaledVector(_ikN,hh);

    _ikCurDir.copy(_ikE).sub(_ikS).normalize();
    _ikWantDir.copy(_ikElbowTarget).sub(_ikS).normalize();
    _ikRot.setFromUnitVectors(_ikCurDir,_ikWantDir);
    upper.getWorldQuaternion(_ikWorldQ2); _ikWorldQ2.premultiply(_ikRot).normalize();
    upper.parent.getWorldQuaternion(_ikParentQ2);
    _ikLocalQ2.copy(_ikParentQ2).invert().multiply(_ikWorldQ2).normalize();
    upper.quaternion.slerp(_ikLocalQ2,Math.max(0,Math.min(1,weight))).normalize();
    upper.updateWorldMatrix(true,true);

    lower.getWorldPosition(_ikE); hand.getWorldPosition(_ikH);
    _ikCurDir.copy(_ikH).sub(_ikE); if(_ikCurDir.lengthSq()<1e-8)return; _ikCurDir.normalize();
    _ikWantDir.copy(_ikAdjTarget).sub(_ikE); if(_ikWantDir.lengthSq()<1e-8)return; _ikWantDir.normalize();
    _ikRot.setFromUnitVectors(_ikCurDir,_ikWantDir);
    lower.getWorldQuaternion(_ikWorldQ2); _ikWorldQ2.premultiply(_ikRot).normalize();
    lower.parent.getWorldQuaternion(_ikParentQ2);
    _ikLocalQ2.copy(_ikParentQ2).invert().multiply(_ikWorldQ2).normalize();
    lower.quaternion.slerp(_ikLocalQ2,Math.max(0,Math.min(1,weight))).normalize();
    lower.updateWorldMatrix(true,true);
  }

  Character.prototype.applyArcherBowConstraint = function(entity, sel) {
    if(!this.directUalRig || !sel || Arena.Data.archetypeOf(entity.classId)!=='archer')return;
    var combat=!!(this.handle&&this.handle.intent&&this.handle.intent.combatMode);
    if(!combat)return;
    var st=sel.state||'';
    var locomotion=/^(WALK|RUN|SPRINT|BACKPEDAL|STRAFE|DIAGONAL|TURN)$/.test(st);
    var ready=/^(COMBAT_IDLE|ARCHER_COMBAT_IDLE)$/.test(st)||locomotion;
    var charge=st==='CAST_CHARGE';
    var action=st==='ACTION';
    if(!ready&&!charge&&!action)return;

    /* Lock the planted combat base across notch/release. v0.32 allowed the
       stationary release composite to collapse the feet toward each other,
       which is visible in the user's rear-view recording as a torso twist.
       Capture the audited COMBAT_IDLE lower pose once, then reuse it only for
       stationary bow charge/release. Locomotion always keeps its own legs. */
    var lowerNames=['Hips','LeftUpperLeg','LeftLowerLeg','LeftFoot','LeftToe','RightUpperLeg','RightLowerLeg','RightFoot','RightToe'];
    if(ready&&!locomotion){
      this._archerReadyLower=Object.create(null);
      for(var li=0;li<lowerNames.length;li++){var ln=lowerNames[li],lb=this.rigBones[ln];if(lb)this._archerReadyLower[ln]={p:lb.position.clone(),q:lb.quaternion.clone()};}
    } else if((charge||action)&&this._archerReadyLower){
      for(var lj=0;lj<lowerNames.length;lj++){var lnn=lowerNames[lj],bb=this.rigBones[lnn],src=this._archerReadyLower[lnn];if(!bb||!src)continue;bb.position.copy(src.p);bb.quaternion.copy(src.q);}
      this.skinnedRoot.updateMatrixWorld(true);
    }

    var phase=Number.isFinite(sel.syncProgress)?Math.max(0,Math.min(1,sel.syncProgress)):0;
    var draw=ready?0.62:(charge?Math.max(.12,phase):1.0);
    var snap=0;
    if(action){
      /* Around authoritative RELEASE the string hand snaps slightly rearward;
         afterwards it returns to the combat-ready anchor instead of dropping
         to Idle. The exact release still belongs to simulation. */
      var d=Math.abs(phase-.56);
      snap=d<.16?(1-d/.16):0;
      if(phase>.72)draw=Math.max(.62,1-(phase-.72)/.28*.38);
    }

    /* v0.34 · WORLD-FORWARD BOW BASIS.
       The hardware screenshot showed the authored fallback aiming into the
       opposite hemisphere. A blind 180° pelvis correction is unsafe because
       the UAL Pistol_Aim scaffold itself already reaches +Z; rotating a parent
       bone can twist the shoulder chain. Instead, derive the bow-hand targets
       directly from the simulation-owned visual yaw. This makes the final
       right-hand→left-hand aim vector agree with the character's forward
       hemisphere regardless of how the source pose was exported. */
    _archLeftLocal.set(0.14,1.40,0.49);
    _archLeftPoleLocal.set(0.48,1.20,0.20);
    _archRightStart.set(-0.08,1.40,0.24);
    _archRightDraw.set(-0.16,1.50,0.02);
    _archRightSnap.set(-0.30,1.48,-0.02);
    _archRightLocal.copy(_archRightStart).lerp(_archRightDraw,draw).lerp(_archRightSnap,snap*0.72);
    _archRightPoleLocal.set(-0.58,1.46,-0.02);

    var fyaw=this.root.rotation.y, sc=Math.max(0.001,this.skinnedRoot.scale.x||1);
    _archForwardWorld.set(Math.sin(fyaw),0,Math.cos(fyaw)).normalize();
    _archLateralWorld.set(Math.cos(fyaw),0,-Math.sin(fyaw)).normalize();
    this.root.getWorldPosition(_archRootWorld);
    function bowWorld(out,local){
      out.copy(_archRootWorld)
        .addScaledVector(_archLateralWorld,local.x*sc)
        .addScaledVector(_archForwardWorld,local.z*sc);
      out.y += local.y*sc;
      return out;
    }
    bowWorld(_archLeftWorld,_archLeftLocal);
    bowWorld(_archLeftPoleWorld,_archLeftPoleLocal);
    bowWorld(_archRightWorld,_archRightLocal);
    bowWorld(_archRightPoleWorld,_archRightPoleLocal);
    var w=locomotion?0.78:(ready?0.90:0.96);
    solveTwoBoneIK(this.rigBones.LeftUpperArm,this.rigBones.LeftLowerArm,this.rigBones.LeftHand,_archLeftWorld,_archLeftPoleWorld,w);
    solveTwoBoneIK(this.rigBones.RightUpperArm,this.rigBones.RightLowerArm,this.rigBones.RightHand,_archRightWorld,_archRightPoleWorld,w);
    this.skinnedRoot.updateMatrixWorld(true);

    /* Adversarial runtime metric: positive means the drawn bow points into the
       same forward hemisphere as the simulation-facing body. This is debug/
       presentation telemetry only; it never changes combat legality or yaw. */
    this.rigBones.LeftHand.getWorldPosition(_archLeftWorld);
    this.rigBones.RightHand.getWorldPosition(_archRightWorld);
    _archAimVec.copy(_archLeftWorld).sub(_archRightWorld);_archAimVec.y=0;
    this._archerAimForwardDot=_archAimVec.lengthSq()>1e-8?_archAimVec.normalize().dot(_archForwardWorld):0;
  };

  /**
   * Tower-shield presentation constraint for the exact UAL warrior rig.
   *
   * UAL's shield idle contains realistic forearm pronation for a small/medium
   * shield. Arena's Guardian carries a much taller tower shield: inheriting the
   * full wrist/forearm twist makes its broad face periodically turn edge-on.
   * The shield POSITION still follows the animated forearm, while this visual
   * constraint keeps the broad plane in a readable defensive orientation in
   * CHARACTER space. Combat truth is untouched. During explicit shield/block
   * actions the constraint relaxes so the source action can visibly lead.
   */
  Character.prototype.applyGuardianShieldConstraint = function (entity, sel) {
    var gs = this.guardianShield;
    if (!gs || !gs.node || !gs.node.parent || entity.classId !== 'guardian') return;
    var explicit = !!(sel && sel.state === 'ACTION' && (sel.family === 'shield' || sel.family === 'block'));
    var hold = explicit ? 0.70 : 0.90;

    // Desired broad face: vertical, character-forward, with a subtle inward
    // cant. Since the shield mesh is authored in local XY, local +Z is its
    // broad-face normal. Root yaw therefore gives the desired world facing.
    this.root.getWorldQuaternion(_shieldRootQ);
    _shieldDesiredQ.copy(_shieldRootQ).multiply(_shieldCharQ);
    gs.node.parent.getWorldQuaternion(_shieldParentQ);
    _shieldLocalQ.copy(_shieldParentQ).invert().multiply(_shieldDesiredQ).normalize();
    gs.node.quaternion.slerp(_shieldLocalQ, hold).normalize();
  };

  Character.prototype.applyNativeWeaponConstraint = function (entity, sel, kind) {
    if (!this.directUalRig || !this.weapons || !kind) return;
    var w=this.weapons[kind];
    if (!w || !w.visible || !w.parent) return;
    var arche=Arena.Data.archetypeOf(entity.classId);
    var desired=null, hold=0;
    if (kind==='staff' && arche==='caster') {
      desired=_staffCharQ;
      /* The staff is a long readable silhouette: its position follows RightHand,
         while world orientation stays predominantly vertical. The former low
         cast hold inherited Spell_Simple wrist twist and laid the staff almost
         horizontal across the legs in video-led QA. */
      hold=(sel && (sel.state==='ACTION' || sel.state==='CASTER_ENTER' || sel.state==='CASTER_EXIT')) ? 0.92 : 0.96;
    } else if (kind==='bow' && arche==='archer') {
      desired=_bowCharQ;
      /* BowNotch/BowShoot are SOURCE blockers today. The bow itself must remain
         vertically readable while the source-derived arms move around it; a low
         hold inherited pistol-wrist pronation and turned the bow horizontal in
         the user's/video-led QA. Position still follows LeftHand exactly. */
      hold=(sel && sel.state==='ACTION') ? 0.98 : 0.94;
    } else return;
    this.root.getWorldQuaternion(_weaponRootQ);
    _weaponDesiredQ.copy(_weaponRootQ).multiply(desired);
    w.parent.getWorldQuaternion(_weaponParentQ);
    _weaponLocalQ.copy(_weaponParentQ).invert().multiply(_weaponDesiredQ).normalize();
    w.quaternion.slerp(_weaponLocalQ,hold).normalize();
  };
  Character.prototype.applySkinnedPose = function (entity, pos, yaw) {
    if (!this.usedGlb || !this.rigBones || !this.skinnedAnim || !Arena.Render.SkinnedAnimationContract) return;
    var arche = Arena.Data.archetypeOf(entity.classId);
    var SM = Arena.Render.AnimationStateMachine;

    /* 0) Qué estado toca. La simulación ya decidió TODO lo que importa; aquí
       sólo se elige el clip que lo representa. */
    var sel = (this.player && SM)
      ? SM.select(this.handle, arche, null) : null;

    /* v0.32 · transición NORMAL/COMBAT. Caster usa literalmente Spell_Simple
       Enter/Exit. Melee cambia por crossfade entre Idle_Loop y Sword_Idle /
       Idle_Shield_Loop; no se inventa Sword_Enter/Exit. */
    var combatModeVisual = !!(this.handle && this.handle.intent && this.handle.intent.combatMode);
    if (this._lastTargetMode === null) this._lastTargetMode = combatModeVisual;
    var busyForMode = !!(this.handle && ((this.handle.action && this.handle.action.family) || this.handle.casting));
    var movingForMode = !!(this.handle && this.handle.loco && (this.handle.loco.moveSpeed || 0) > 0.06);
    if (combatModeVisual !== this._lastTargetMode && !busyForMode && !movingForMode) {
      if (arche === 'caster') {
        this._modeTransition = {
          kind:'caster', clip:combatModeVisual?'Spell_Simple_Enter':'Spell_Simple_Exit',
          elapsed:0, duration:combatModeVisual?0.34:0.30,
          /* El clip es nativo; se usa la ventana corporal legible ya aprobada
             para evitar el extremo excesivamente abierto del Enter completo. */
          start:combatModeVisual?0.06:0.18, end:combatModeVisual?0.58:0.74
        };
      } else if (arche === 'melee') {
        this._modeTransition = null;
      } else {
        this._modeTransition = null;
      }
      this._lastTargetMode = combatModeVisual;
    } else if (!movingForMode && !busyForMode) {
      this._lastTargetMode = combatModeVisual;
    }

    if (this._modeTransition && !busyForMode) {
      var mt=this._modeTransition;
      mt.elapsed=Math.min(mt.duration,mt.elapsed+this.lastDt);
      var mtAlpha=mt.duration>0?Math.max(0,Math.min(1,mt.elapsed/mt.duration)):1;
      if (mt.kind==='caster') {
        sel = {
          state:combatModeVisual?'CASTER_ENTER':'CASTER_EXIT',
          clip:'Idle_Loop', mask:'lower', loop:false, fade:0.07,
          directUpperBase:mt.clip, rate:1, procedural:false,
          source:'HYBRID_CC0_NATIVE', qualityStatus:'FINAL', requestedClip:mt.clip,
          syncAuthoritative:true, syncProgress:mt.start+(mt.end-mt.start)*mtAlpha
        };
      }
      if (mt.elapsed >= mt.duration) this._modeTransition = null;
    }

    /* A source blocker must never fall through into the old legacy-retarget-axis
       procedural action/gait and look "finished". Keep an explicit native
       ready hold instead. Simulation still moves/releases normally, while QA
       can see from qualityStatus/requestedClip exactly which authored clip is
       missing. This is intentionally less flashy than a semantically wrong
       animation. */
    var preResolved = (this.animLib && this.animLib.resolveSelection) ? this.animLib.resolveSelection(sel) : null;
    var blockedNativeVisual = !!(this.directUalRig && sel && (!preResolved || sel.intentionalBlank) && (sel.intentionalBlank || sel.qualityStatus === 'MISSING_EXACT_CLIP' || sel.qualityStatus === 'EMPTY_INTENTIONAL'));
    if (blockedNativeVisual) {
      sel = Object.assign({}, sel, {
        clip: entity.classId === 'guardian' ? 'Idle_Shield_Loop' : 'Idle_Loop',
        mask: (arche === 'archer' || arche === 'caster') ? 'lower' : 'full', loop:true, fade:0.08,
        procedural:false, visualBlockerHold:true, intentionalBlank:true
      });
      if (arche === 'archer') {
        sel.directUpperBase='Arena_Archer_VideoReady'; sel.directUpperBaseProgress=0.50;
      } else if (arche === 'caster') {
        sel.directUpperBase='Spell_Simple_Idle_Loop'; sel.directUpperBaseProgress=0.50;
      }
    }

    /* v0.30 · Composición mínima sobre el rig nativo.
       - Exact clips (incluidos futuros Source) conservan cuerpo completo.
       - Guardián sólo compone Idle_Shield sobre Jog cuando Sprint_Shield falta
         y el resolver ha caído explícitamente al fallback Jog_Fwd_Loop.
       - Arquero/mago conservan una guardia superior mientras caminan/corren.
       No existe ya una ruta que manufacture backpedal/strafe/turn desde Jog. */
    var directComposite = false;
    if (this.directUalRig && sel && sel.clip) {
      sel = Object.assign({}, sel);
      if (entity.classId === 'guardian' && /^(IDLE_SHIELD|COMBAT_IDLE)$/.test(sel.state || '')) {
        sel.clip = 'Idle_Shield_Loop'; sel.fallbackClip = null;
      }
      var exactAvailable = !!(this.animLib && this.animLib.has && this.animLib.has(sel.clip));
      var guardianSprintFallback = entity.classId==='guardian' && sel.state==='RUN' && sel.clip==='Sprint_Shield' && !exactAvailable && sel.fallbackClip==='Jog_Fwd_Loop';
      var meleeCombatLocomotion = combatModeVisual && entity.classId==='guardian' && /^(WALK|RUN|BACKPEDAL|STRAFE|DIAGONAL|TURN)$/.test(sel.state || '');
      var rangedCombatLocomotion = combatModeVisual && (arche === 'archer' || arche === 'caster') && /^(WALK|RUN|BACKPEDAL|STRAFE|DIAGONAL|TURN)$/.test(sel.state || '');
      if (guardianSprintFallback) {
        sel.mask='lower'; sel.directUpperBase='Idle_Shield_Loop'; sel.directUpperBaseProgress=0.50; directComposite=true;
      } else if (meleeCombatLocomotion) {
        /* En modo ataque la locomoción mueve piernas/centro de masa y la mitad
           superior conserva una guardia de arma. Si Sprint_Shield existe en un
           futuro Source, el branch anterior deja de ser fallback y el clip
           exacto puede gobernar el cuerpo completo. */
        sel.mask='lower';
        sel.directUpperBase = entity.classId==='guardian' ? 'Idle_Shield_Loop' : 'Sword_Idle';
        sel.directUpperBaseProgress = 0.50;
        directComposite=true;
      } else if (rangedCombatLocomotion) {
        sel.mask='lower';
        sel.directUpperBase = arche === 'archer' ? 'Arena_Archer_VideoReady' : 'Spell_Simple_Idle_Loop';
        sel.directUpperBaseProgress = 0.50;
        directComposite=true;
      } else if (sel.directUpperBase) {
        /* Combat-ready / intentional blank may already provide a source-derived
           upper hold. Preserve its lower+upper composition instead of forcing
           the lower Idle clip back to full-body. */
        sel.mask='lower'; directComposite=true;
      } else if (sel.directLowerBase) {
        /* v0.30 upper mocap action (bow/caster) + planted lower idle. */
        sel.mask='upper'; directComposite=true;
      } else if (/^(IDLE|IDLE_SHIELD|COMBAT_IDLE|WALK|RUN|BACKPEDAL|STRAFE|DIAGONAL|TURN|JUMP_START|AIRBORNE|LAND|MELEE_ENTER|MELEE_EXIT)$/.test(sel.state || '')) {
        sel.mask='full';
      }
    }
    var directResolved = (sel && this.animLib && this.animLib.resolveSelection) ? this.animLib.resolveSelection(sel) : null;
    var conClip = !!directResolved;

    /* La gramática propia del proyecto sigue viva y es la que cubre lo que UAL2
       no trae: retroceso, strafe, giro, casteo y arco. Se apaga sólo lo que el
       clip horneado ya está haciendo, para que no haya doble animación. */
    var mandaPiernas = conClip && (sel.mask === 'lower' || sel.mask === 'full' || !!sel.directLowerBase);
    var mandaTodo = conClip && sel.mask === 'full';
    /* v0.20: los clips UAL2 de espada se reproducen full-body porque el audit
       visual demostró que su cadena pie→cadera→torso es muy superior al recorte
       upper-body. El bake sigue descartando root X/Z, por lo que la entidad no
       se desplaza. Para los clips full-body NO sumamos la vieja cadena inferior
       procedural; sólo conservamos overlays de identidad (p.ej. escudo). */
    var meleeClip = conClip && sel.state === 'ACTION' && arche === 'melee';
    var meleeClipFull = meleeClip && sel.mask === 'full';
    var meleeClipUpper = meleeClip && sel.mask === 'upper';
    var classOverlayState = this.directUalRig && sel && /^(COMBAT_IDLE|ARCHER_COMBAT_IDLE|CASTER_COMBAT_IDLE|WALK|RUN|BACKPEDAL|STRAFE|DIAGONAL|TURN)$/.test(sel.state || '');
    var guardOverlayState = this.directUalRig && sel && /^(COMBAT_IDLE|ARCHER_COMBAT_IDLE|CASTER_COMBAT_IDLE|WALK|RUN|BACKPEDAL|STRAFE|DIAGONAL|TURN)$/.test(sel.state || '');
    var baseH = this.directUalRig ? this.baseModelHeight : 1.89738;
    var modelScale = Math.max(0.78, Math.min(1.18, entity.height / Math.max(0.5, baseH)));
    var a = Arena.Render.SkinnedAnimationContract.update(this.skinnedAnim, this.handle, arche, entity.classId, this.lastDt, {
      skipLocomotion: mandaPiernas,
      /* The generic 17-bone Arena stance/guard offsets were authored in the
         legacy-retarget local axes.  Applying those Euler offsets on the native UAL
         65-joint bind abducted both arms into a T-like pose in runtime.  When
         a native/direct clip is present, let that clip (plus the explicit
         lower+weapon-idle composite) own the body.  Class identity still comes
         from the selected sword-vs-shield upper base and equipment; source-rig
         specific additives can be introduced later only after visual audit. */
      skipGuard: this.directUalRig && conClip ? true : ((mandaTodo || meleeClip) && !guardOverlayState),
      skipMeleeAction: mandaTodo || meleeClip || !!(sel && sel.intentionalBlank),
      externalMeleeAction: meleeClipUpper,
      externalMeleeFullBody: meleeClipFull,
      footIKContext: {entityPos:pos,yaw:yaw,scale:modelScale},
      skipCasterAction: (this.directUalRig && conClip) || mandaTodo || !!(sel && sel.intentionalBlank),
      skipArcherAction: (this.directUalRig && conClip) || mandaTodo || !!(sel && sel.intentionalBlank),
      skipDeath: mandaTodo && sel && sel.state === 'DEATH',
      skipClassStance: this.directUalRig && conClip ? true : (this.directUalRig && mandaTodo && !classOverlayState)
    });

    /* World transform remains simulation-authoritative. External clips are
       sampled only as bone pose; root translation/yaw from UAL2 is discarded. */
    this.root.position.set(pos.x, pos.y, pos.z);
    this.root.rotation.order='YXZ';
    /* Native UAL clips already contain their full body lean. Residual spring
       offsets from the procedural contract must not double-tilt a direct clip. */
    var directOwnsRootPose = this.directUalRig && conClip;
    var directOwnsFullPose = directOwnsRootPose && sel && (sel.mask === 'full' || !!sel.directUpperBase || !!sel.directLowerBase);
    this.root.rotation.set(directOwnsRootPose ? 0 : a.rootPitch, yaw, directOwnsRootPose ? 0 : a.rootRoll);
    this.skinnedRoot.scale.setScalar(modelScale);

    /* 1) Decide el action primero. En el rig nativo NO podemos restaurar el
       bind pose en cada frame mientras el mismo clip sigue activo. Three.js
       PropertyMixer cachea su último resultado y puede omitir una escritura si
       el valor animado no cambió; eso es correcto normalmente, pero no si Arena
       acaba de pisar manualmente el hueso con el bind. Una pose superior
       muestreada/constante (p.ej. ready del arquero) terminaba por ello en una
       T-pose aunque el action tuviera weight=1.

       Restauramos los 65 joints sólo al CAMBIAR de action (o al salir de la
       ruta nativa hacia un estado procedural). Así limpiamos dedos/clavículas
       heredados sin pelear contra el cache del mixer en cada frame. */
    var previousDirectAction = this.player ? this.player.actual : null;
    if (this.player) this.player.play(sel, this.lastDt);
    var directActionChanged = this.player ? previousDirectAction !== this.player.actual : false;
    var mustRestoreBind = !this.directUalRig || !conClip || directActionChanged;

    if (mustRestoreBind) {
      if (this.directUalRig && this.directBindAll) {
        for (var db=0; db<this.directBindAll.length; db++) {
          var dbr=this.directBindAll[db];
          dbr.bone.position.copy(dbr.p); dbr.bone.quaternion.copy(dbr.q); dbr.bone.scale.copy(dbr.s);
        }
      } else {
        for (var r0=0;r0<RIG_ORDER.length;r0++) {
          var bn0=RIG_ORDER[r0], bb0=this.rigBones[bn0];
          bb0.position.copy(this.rigBindPos[bn0]);
          bb0.quaternion.copy(this.rigBindQuat[bn0]);
          bb0.scale.set(1,1,1);
        }
      }
    }

    /* 2) El mixer escribe cuaterniones ABSOLUTOS de su máscara. Al continuar el
       mismo action parte de la pose del frame anterior; al cambiar, parte del
       bind recién restaurado. Ambas rutas son deterministas y evitan tanto
       joints congelados como el falso T-pose de los holds constantes. */
    if (this.player) {
      this.player.update(this.lastDt);
      /* La pista de cadera viene en metros de mundo pero el modelo va escalado,
         así que se reexpresa en unidades del modelo. */
      if (!this.directUalRig && conClip && sel.mask !== 'upper' && modelScale !== 1) {
        var bind = this.rigBindPos.Hips;
        this.rigBones.Hips.position.y = bind.y + (this.rigBones.Hips.position.y - bind.y) / modelScale;
      }
    }


    if (this.directUalRig && conClip && arche === 'archer') {
      this.applyArcherBowConstraint(entity, sel);
    }

    // 3) Arena-specific additive language: bow draw, staff cast, CC, guards.
    //    It layers on top of the external base without owning combat timing.
    //    On the native 65-joint warrior, however, the direct/composite clip is
    //    already the intended final pose. Applying the contract's spring-smoothed
    //    leftovers again caused the hardware-video A/T-arm artifact after state
    //    changes. Direct clips therefore own their pose completely.
    if (!directOwnsFullPose) {
      this.rigBones.Hips.position.y += a.hipsY / modelScale;
      for (var i=0;i<RIG_ORDER.length;i++) {
        var n=RIG_ORDER[i], b=this.rigBones[n], p=a.bones[n];
        _eOffset.set(p.x,p.y,p.z,'XYZ'); _qOffset.setFromEuler(_eOffset); b.quaternion.multiply(_qOffset).normalize();
      }
    }

    var kind=a.weapon.kind;
    /* Weapon identity is class policy, not an accidental side-effect of the
       procedural contract. This keeps the 2H weapon visible even when its body
       action is intentionally blank. */
    var isDevastador=entity.classId==='devastador', isGuardian=entity.classId==='guardian';
    var effectiveKind=(isDevastador && (kind==='sword'||kind==='none'))?'greatsword':kind;
    this.weapons.staff.visible=entity.classId==='arcanista'||entity.classId==='vinculador';
    this.weapons.bow.visible=entity.classId==='centinela'||entity.classId==='rastreador';
    this.weapons.sword.visible=isGuardian;
    this.weapons.greatsword.visible=isDevastador;
    if (this.weapons.shield) this.weapons.shield.visible = isGuardian;
    var w=this.weapons[effectiveKind];
    if(w){
      if (this.directUalRig && conClip && (effectiveKind==='sword'||effectiveKind==='greatsword')) w.rotation.set(0,0,0,'XYZ');
      else w.rotation.set(a.weapon.pitch,a.weapon.yaw,a.weapon.roll,'XYZ');
      if(effectiveKind==='staff') w.rotation.z += -0.05;
      if((effectiveKind==='sword'||effectiveKind==='greatsword') && !(this.directUalRig && conClip)) w.rotation.z += -0.08;
      if(effectiveKind==='bow' && w.userData.string){
        /* Upload the tiny bow-string buffer only when draw actually changes.
           Combat-ready archer stance keeps draw=0, so idle/run no longer force
           a GPU buffer update every frame on low-end laptops. */
        var nextDraw=(sel && Number.isFinite(sel.bowDraw)) ? sel.bowDraw : (a.weapon.draw||0);
        if (!Number.isFinite(w.userData.lastDraw) || Math.abs(nextDraw-w.userData.lastDraw)>0.0001) {
          var pa=w.userData.string.geometry.attributes.position.array;
          pa[3]=0; pa[4]=0; pa[5]=-0.30*nextDraw;
          w.userData.string.geometry.attributes.position.needsUpdate=true;
          w.userData.lastDraw=nextDraw;
        }
      }
    }
    this.skinnedRoot.updateMatrixWorld(true);
    if (this.directUalRig && (effectiveKind==='staff' || effectiveKind==='bow')) {
      this.applyNativeWeaponConstraint(entity, sel, effectiveKind);
      this.skinnedRoot.updateMatrixWorld(true);
    }
    if (this.directUalRig && entity.classId === 'guardian' && this.guardianShield) {
      this.applyGuardianShieldConstraint(entity, sel);
      this.skinnedRoot.updateMatrixWorld(true);
    }
  };
  /**
   * Aplica la pose del fotograma.
   *
   * Las mallas se reciclan: si esta vez hacen falta menos piezas que la
   * anterior, las sobrantes se ocultan en vez de destruirse. Crear y destruir
   * objetos de Three por fotograma produce microtirones de recolección de
   * basura, y ocurrirían justo en el burst, que es cuando más piezas cambian.
   */
  /**
   * Cuelga el equipo de la clase de los huesos del modelo real.
   *
   * Se llama una vez por personaje (y otra si cambia de clase en el lobby). A
   * partir de ahí el equipo no cuesta nada por fotograma: son hijos de huesos,
   * así que el skinning los arrastra solo.
   */
  Character.prototype.buildGear = function (entity, palette) {
    /* v0.30: no existe gear procedural. Esta función conserva el punto de
       integración del renderer pero sólo configura una vez el arma defensiva.
       Evita además la antigua asignación `[]` por frame. */
    if (!this.usedGlb || !this.rigBones || !this.weapons) return;
    if (this.gearClass === entity.classId) return;
    this.gearClass = entity.classId;
    this.gear = null;
    var isGuardian = entity.classId === 'guardian';
    if (this.weapons.shield) {
      this.weapons.shield.visible = isGuardian;
      this.guardianShield = isGuardian ? { node:this.weapons.shield } : null;
    }
  };

  Character.prototype.disposeGear = function () {
    this.gear = null;
    this.gearClass = null;
    this.guardianShield = null;
  };

  Character.prototype.applyPose = function (entity, pos, yaw, palette, fade, hurtTint) {
    this.applySkinnedPose(entity, pos, yaw);
    this.buildGear(entity, palette);
    if (this.magicLight) {
      var castGlow = (this.handle && this.handle.cast) ? this.handle.cast : 0;
      var actionGlow = (this.handle && this.handle.action && this.handle.action.weight) ? this.handle.action.weight : 0;
      var glow = Math.max(castGlow, actionGlow * 0.72);
      var fxPos = { x: pos.x, y: pos.y + 1.35, z: pos.z };
      this.magicLight.position.set(fxPos.x, fxPos.y, fxPos.z);
      this.magicLight.intensity = 0.22 + glow * 1.9;
      this.magicLight.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);
      if (this.castFx) {
        this.castFx.time = this.fxTime;
        var fx = this.castFx, vis = Math.max(0, Math.min(1, glow));
        fx.root.visible = vis > 0.015;
        fx.root.position.set(pos.x, pos.y, pos.z);
        fx.rune.material.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);
        fx.rune.material.opacity = vis * 0.32;
        fx.rune.rotation.z = this.fxTime * (0.55 + vis * 0.45);
        for (var fm = 0; fm < fx.motes.length; fm++) {
          var mote = fx.motes[fm], aa = this.fxTime * (1.8 + fm * 0.12) + fm * 1.23;
          mote.position.set(Math.cos(aa) * 0.20, 1.20 + Math.sin(aa * 1.4) * 0.10, Math.sin(aa) * 0.20);
          mote.material.color.setRGB(palette.accent[0], palette.accent[1], palette.accent[2]);
          mote.material.opacity = vis * (0.32 + fm * 0.04);
        }
      }
    }
  };


  /**
   * Presentation-only shadow LOD. Traversal happens only when the desired state
   * changes, never every frame. It cannot alter simulation or visibility.
   */
  Character.prototype.setShadowCasting = function (enabled) {
    enabled = !!enabled;
    if (this._shadowCasting === enabled) return;
    this._shadowCasting = enabled;
    this.root.traverse(function(o){ if(o && o.isMesh) o.castShadow = enabled; });
  };

  Character.prototype.dispose = function () {
    Backend.current.destroyCharacter(this.handle);
    scene.remove(this.root);
    if (this.magicLight) scene.remove(this.magicLight);
    if (this.castFx) scene.remove(this.castFx.root);
    if (this.player) this.player.dispose();
    this.disposeGear();
    this.skinnedRoot = null; this.rigBones = null; this.rigBindPos = null; this.rigBindQuat=null; this.rigBindWorldQuat=null; this.player=null; this.animLib=null; this.weapons=null; this.skinnedAnim=null;
  };

  return {
    create: function (entity) { return new Character(entity); },
    baseCharacterGltf: baseCharacterGltf,
    animationLibraryGltf: animationLibraryGltf
  };
}
