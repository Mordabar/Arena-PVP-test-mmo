/* =============================================================================
 * ui/actionBarState.js — 4 páginas × 12 slots, persistentes por subclase.
 *
 * Es estado de PRESENTACIÓN/INPUT: guarda qué id se solicita al pulsar una
 * tecla. Nunca aplica daño, recurso, GCD ni cooldown.
 * ========================================================================== */
Arena.define('ui/actionBarState', ['data/powerLibrary'], function (Arena) {
  'use strict';

  var BAR_COUNT = 4, SLOT_COUNT = 12;
  var memory = Object.create(null);

  function safeStorage() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }
  function keyFor(classId) { return 'arena.actionbars.v4.sourceParity.' + classId; }
  function blank() {
    var bars=[]; for(var b=0;b<BAR_COUNT;b++){bars[b]=[];for(var i=0;i<SLOT_COUNT;i++)bars[b][i]=null;} return bars;
  }
  function allowed(classId, id) {
    var a=Arena.Data.abilities[id];
    return !!(a && !(a.flags&&a.flags.passive) && (!a.allowedClasses || a.allowedClasses.indexOf(classId)>=0));
  }
  function defaults(classId) {
    var bars=blank(), ids=[], c=Arena.Data.classes[classId];
    /* v0.12: la primera barra debe enseñar la IDENTIDAD de la clase, no los
       primeros registros del documento por accidente. Featured vive en datos
       y después se completa con el kit pequeño y el resto del libro. */
    if(Arena.Data.powerLibrary&&Arena.Data.powerLibrary.featuredFor) ids=ids.concat(Arena.Data.powerLibrary.featuredFor(classId));
    if(Arena.Data.powerLibrary) ids=ids.concat(Arena.Data.powerLibrary.activeFor(classId));
    var seen=Object.create(null), clean=[];
    for(var i=0;i<ids.length;i++) if(!seen[ids[i]]&&allowed(classId,ids[i])){seen[ids[i]]=1;clean.push(ids[i]);}
    for(var n=0;n<Math.min(clean.length,BAR_COUNT*SLOT_COUNT);n++) bars[Math.floor(n/SLOT_COUNT)][n%SLOT_COUNT]=clean[n];
    return bars;
  }

  function State(classId, storage) {
    this.storage=storage===undefined?safeStorage():storage;
    this.classId=classId||'devastador'; this.activeBar=0; this.bars=blank();
    this.setClass(this.classId);
  }
  State.prototype._load=function(classId){
    var raw=null;
    try { raw=this.storage?this.storage.getItem(keyFor(classId)):memory[keyFor(classId)]; } catch(e){ raw=null; }
    if(!raw) return defaults(classId);
    try {
      var parsed=JSON.parse(raw), out=blank();
      for(var b=0;b<BAR_COUNT;b++)for(var i=0;i<SLOT_COUNT;i++){
        var id=parsed[b]&&parsed[b][i]; out[b][i]=allowed(classId,id)?id:null;
      }
      return out;
    } catch(e2){ return defaults(classId); }
  };
  State.prototype._save=function(){
    var raw=JSON.stringify(this.bars), k=keyFor(this.classId);
    try { if(this.storage)this.storage.setItem(k,raw); else memory[k]=raw; } catch(e){ memory[k]=raw; }
  };
  State.prototype.setClass=function(classId){
    this.classId=classId; this.activeBar=0; this.bars=this._load(classId); return this;
  };
  State.prototype.selectBar=function(index){ this.activeBar=Math.max(0,Math.min(BAR_COUNT-1,index|0)); return this.activeBar; };
  State.prototype.abilityAt=function(slot){ return this.bars[this.activeBar][slot|0]||null; };
  State.prototype.assign=function(slot,id){
    slot=slot|0; if(slot<0||slot>=SLOT_COUNT||!allowed(this.classId,id)) return false;
    this.bars[this.activeBar][slot]=id; this._save(); return true;
  };
  State.prototype.clear=function(slot){ slot=slot|0;if(slot<0||slot>=SLOT_COUNT)return false;this.bars[this.activeBar][slot]=null;this._save();return true; };
  State.prototype.reset=function(){ this.bars=defaults(this.classId);this._save();return this; };
  State.prototype.snapshot=function(){ return {classId:this.classId,activeBar:this.activeBar,bars:JSON.parse(JSON.stringify(this.bars))}; };

  Arena.UI=Arena.UI||{};
  Arena.UI.ActionBarState={State:State,BAR_COUNT:BAR_COUNT,SLOT_COUNT:SLOT_COUNT,allowed:allowed,defaults:defaults};
});
