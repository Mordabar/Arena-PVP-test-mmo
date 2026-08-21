/* Project Arena v0.16 — pure keyboard movement contract. */
Arena.define('core/controlMap', [], function (Arena) {
  'use strict';
  var C={};
  /* Tactical walk modifier. Run remains the untouched default. */
  C.WALK_SPEED_SCALE=0.22;
  C.movement=function(k){k=k||{};return {
    forward:(k['w']?1:0)-(k['s']?1:0),
    strafe:(k['d']?1:0)-(k['a']?1:0),
    walk:!!k['shift']
  };};
  C.turn=function(k){k=k||{};return (k['e']?1:0)-(k['q']?1:0);};
  Arena.Core.ControlMap=C; return C;
});
