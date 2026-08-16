Arena.define('tests/skinnedAnimationV015Tests', ['tests/testRunner','render/skinnedAnimationContract'], function (Arena) {
  'use strict';
  var T=Arena.Tests, C=Arena.Render.SkinnedAnimationContract;
  function baseHandle(){
    return { loco:{moveSpeed:0,cycle:0,moveForward:0,moveRight:0,hipHeight:0,leanF:0,leanR:0,torsoYaw:0,torsoRoll:0,headYaw:0,breathe:0,turnRate:0},
      action:{family:null,t:0,variant:0}, cast:0,casting:false,cc:null,ccBlend:0,ccTime:0,
      cfg:{phases:{pulse:{active:.28,impact:.55,recovery:.78,end:1},ranged:{active:.28,impact:.55,recovery:.78,end:1},light:{active:.28,impact:.55,recovery:.78,end:1},heavy:{active:.30,impact:.58,recovery:.80,end:1},cast:{active:.18,impact:.42,recovery:.72,end:1}}}
    };
  }
  function pose(arche,h,steps){ var s=C.createState(); for(var i=0;i<(steps||20);i++) C.update(s,h,arche,'x',1/60); return s; }
  T.suite('Skinned Animation v0.15 · cuerpo importado', function(){
    T.test('caster usa sólo báculo como arma base', function(){ T.assertEqual(pose('caster',baseHandle()).weapon.kind,'staff'); });
    T.test('archer usa sólo arco como arma base', function(){ T.assertEqual(pose('archer',baseHandle()).weapon.kind,'bow'); });
    T.test('melee usa espada como arma base', function(){ T.assertEqual(pose('melee',baseHandle()).weapon.kind,'sword'); });
    T.test('locomoción no cruza las piernas: swings opuestos', function(){ var h=baseHandle();h.loco.moveSpeed=1;h.loco.moveForward=1;h.loco.cycle=.25;var p=pose('caster',h); T.assert(p.bones.LeftUpperLeg.x*p.bones.RightUpperLeg.x<=0,'piernas deben oscilar en oposición'); });
    T.test('caster casteando eleva ambos brazos y mantiene cuerpo plantado', function(){ var h=baseHandle();h.casting=true;h.cast=.72;var p=pose('caster',h); T.assert(p.bones.LeftUpperArm.x<-.25&&p.bones.RightUpperArm.x<-.25,'brazos no entran en gather/channel'); T.assert(Math.abs(p.bones.LeftUpperLeg.x)<.05,'cast parado no inventa paso'); });
    T.test('pulso normal de báculo es menor que release de hechizo', function(){ var h=baseHandle();h.action={family:'pulse',t:.55,variant:0};var a=pose('caster',h); var normal=Math.abs(a.bones.LeftUpperArm.x)+Math.abs(a.bones.RightUpperArm.x); h=baseHandle();h.action={family:'cast',t:.43,variant:0};var b=pose('caster',h);var spell=Math.abs(b.bones.LeftUpperArm.x)+Math.abs(b.bones.RightUpperArm.x);T.assert(spell>normal*1.05,'normal y spell no se diferencian'); });
    T.test('arquero aumenta tensión del arco antes del release', function(){ var h=baseHandle();h.action={family:'ranged',t:.18,variant:0};var p1=pose('archer',h);h=baseHandle();h.action={family:'ranged',t:.50,variant:0};var p2=pose('archer',h);T.assert(p2.weapon.draw>p1.weapon.draw+.18,'draw no crece'); });
    T.test('arquero libera la cuerda después del marker de impacto', function(){ var h=baseHandle();h.action={family:'ranged',t:.50,variant:0};var pre=pose('archer',h);h=baseHandle();h.action={family:'ranged',t:.72,variant:0};var post=pose('archer',h);T.assert(post.weapon.draw<pre.weapon.draw,'cuerda no libera'); });

    T.test('full draw coloca mano de arco adelante y mano de cuerda cerca del rostro', function(){
      function mm(a,b){var o=[];for(var r=0;r<3;r++)for(var c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;}
      function mv(m,v){return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];}
      function rot(e){var x=e.x,y=e.y,z=e.z,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);var rx=[1,0,0,0,cx,-sx,0,sx,cx],ry=[cy,0,sy,0,1,0,-sy,0,cy],rz=[cz,-sz,0,sz,cz,0,0,0,1];return mm(mm(rx,ry),rz);}
      var h=baseHandle();h.action={family:'ranged',t:.54,variant:0};var p=pose('archer',h,1), I=[1,0,0,0,1,0,0,0,1];
      var bind={Chest:[0,1.305,0],LeftUpperArm:[-.255,.12,.005],LeftLowerArm:[-.085,-.26,.02],LeftHand:[-.058,-.25,.03],RightUpperArm:[.255,.12,.005],RightLowerArm:[.085,-.26,.02],RightHand:[.058,-.25,.03]};
      function hand(side){var pos=bind.Chest.slice(),R=rot(p.bones.Chest),names=[side+'UpperArm',side+'LowerArm',side+'Hand'];for(var i=0;i<names.length;i++){var n=names[i],v=mv(R,bind[n]);pos[0]+=v[0];pos[1]+=v[1];pos[2]+=v[2];R=mm(R,rot(p.bones[n]));}return pos;}
      var l=hand('Left'),r=hand('Right');
      T.assert(l[2]>.30,'mano de arco no está proyectada hacia el objetivo');
      T.assert(r[2]<l[2]-.12,'mano de cuerda no queda detrás del arco');
      T.assert(Math.abs(r[0])<.42,'mano de cuerda queda demasiado abierta del rostro');
      T.assertBetween(r[1],1.12,1.68,'mano de cuerda fuera de altura humana');
    });
    T.test('melee normal alterna dirección por variant', function(){ var h=baseHandle();h.action={family:'light',t:.52,variant:0};var a=pose('melee',h);h=baseHandle();h.action={family:'light',t:.52,variant:1};var b=pose('melee',h);T.assert(a.bones.Chest.y*b.bones.Chest.y<0,'variants no alternan torsión'); });
    T.test('knockdown inclina cuerpo completo sin contaminar arma', function(){ var h=baseHandle();h.cc={rootPitch:1.42,rootLift:.22,armDrop:.85};h.ccBlend=1;var p=pose('caster',h);T.assert(p.rootPitch>1.0,'derribo no inclina raíz');T.assertEqual(p.weapon.kind,'staff'); });
    T.test('todas las rotaciones son finitas tras movimiento+acción', function(){ var h=baseHandle();h.loco.moveSpeed=1.1;h.loco.moveForward=.7;h.loco.moveRight=.7;h.loco.cycle=.63;h.action={family:'ranged',t:.47,variant:0};var p=pose('archer',h,60);C.BONES.forEach(function(n){['x','y','z'].forEach(function(k){T.assert(isFinite(p.bones[n][k]),n+'/'+k+' no finito');});}); });
  });
});
