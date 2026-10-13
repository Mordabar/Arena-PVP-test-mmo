/* Free arena build editor. No claim of a complete campaign levelling system. */
Arena.define('data/trainerBuild',['data/trainerCatalogue'],function(Arena){
  'use strict';
  var T=Arena.Data.trainerCatalogue,L=Arena.Data.powerLibrary,A=Arena.Data.abilities;
  var key='arena.trainer-build.v039',saved={ranks:{},passives:{}};
  try{var v=JSON.parse(localStorage.getItem(key)||'null');if(v&&v.ranks&&v.passives)saved=v;}catch(e){}
  Object.keys(saved.ranks).forEach(function(id){T.setRank(id,saved.ranks[id]);});
  function persist(){try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){}}
  function locked(){var g=Arena.Game,f=g&&g.flow;return !!(f&&f.mode!=='training'&&(f.phase==='ACTIVE'||f.phase==='COUNTDOWN'));}
  function selected(cid){return (saved.passives[cid]||[]).filter(function(id){var a=A[id];return a&&a.classId===cid&&a.flags.passive;});}
  function inFlight(id){var g=Arena.Game,w=g&&g.world;return !!(w&&(w.entities.some(function(e){return e.pendingCast&&e.pendingCast.abilityId===id;})||w.projectiles.some(function(p){return p.abilityId===id;})));}
  function refresh(){var g=Arena.Game,w=g&&g.world;if(!w)return;
    w.entities.slice().forEach(function(e){
      e.statuses.slice().forEach(function(st){var a=A[st.abilityId];if(a&&a.flags.passive)Arena.Combat.StatusSystem.removeInstance(w,e,st,'buildChanged');});
      selected(e.classId).forEach(function(id){var a=A[id],caster=e.isCompanion?w.getEntity(e.ownerId):e;if(!caster)return;Arena.Combat.Resolver._applyEffectList(w,caster,e,a,e.isCompanion?(a.companionEffects||[]):(a.selfEffects||[]),{isSelf:true});});
      e.hp=Math.min(e.hp,e.effectiveHpMax());e.resource=Math.min(e.resource,e.effectiveResourceMax());e.invalidateMods();
    });
  }
  Arena.Data.trainerBuild={isLocked:locked,selectedFor:selected,
    setRank:function(id,rank){if(locked()||inFlight(id))return false;if(!T.setRank(id,rank))return false;saved.ranks[id]=A[id].rank;persist();refresh();return true;},
    isSelected:function(id){var a=A[id];return !!(a&&selected(a.classId).indexOf(id)>=0);},
    togglePassive:function(id){var a=A[id];if(locked()||!a||!a.flags.passive)return false;
      var ids=selected(a.classId),i=ids.indexOf(id);if(i>=0)ids.splice(i,1);else ids.push(id);
      saved.passives[a.classId]=ids;persist();refresh();return true;},
    refresh:refresh
  };
});
