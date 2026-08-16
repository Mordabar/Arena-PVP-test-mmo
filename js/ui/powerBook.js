/* =============================================================================
 * ui/powerBook.js — Libro de poderes de la subclase.
 *
 * Los poderes activos son draggable y se sueltan en cualquiera de los 12 slots.
 * Los pasivos se muestran para que el kit completo sea auditable, pero no se
 * colocan en la barra: el World los aplica automáticamente en el build real.
 * ========================================================================== */
Arena.define('ui/powerBook', ['ui/abilityIcons','data/powerLibrary'], function (Arena) {
  'use strict';
  function el(tag,cls,parent){var n=document.createElement(tag);if(cls)n.className=cls;if(parent)parent.appendChild(n);return n;}
  function meta(ab){
    var a=[]; if(ab.flags&&ab.flags.passive)a.push('PASIVO'); else a.push(ab.castTime>0?('CAST '+ab.castTime.toFixed(2)+'s'):'INSTANT');
    if(ab.cooldown)a.push('CD '+ab.cooldown+'s'); if(ab.cost)a.push('COSTE '+ab.cost); if(ab.range)a.push('R '+ab.range); return a.join(' · ');
  }
  function Book(root){
    this.root=el('section','power-book',root); this.root.id='power-book'; this.root.hidden=true; this.classId=null;
    var shell=el('div','power-book-shell',this.root), head=el('header','power-book-head',shell);
    var title=el('div','power-book-title',head); title.innerHTML='<b>LIBRO DE PODERES</b><span>arrastra un poder activo a la barra</span>';
    this.search=el('input','power-book-search',head); this.search.type='search';this.search.placeholder='Buscar poder o disciplina…';
    this.count=el('div','power-book-count',head); this.close=el('button','power-book-close',head);this.close.type='button';this.close.textContent='×';
    this.body=el('div','power-book-body',shell);
    var self=this;this.close.addEventListener('click',function(){self.hide();});
    this.search.addEventListener('input',function(){self._filter();});
    this.root.addEventListener('mousedown',function(e){if(e.target===self.root)self.hide();});
  }
  Book.prototype.isOpen=function(){return !this.root.hidden;};
  Book.prototype.show=function(){this.root.hidden=false;this.root.classList.add('open');};
  Book.prototype.hide=function(){this.root.hidden=true;this.root.classList.remove('open');};
  Book.prototype.toggle=function(){this.isOpen()?this.hide():this.show();};
  Book.prototype.setClass=function(classId){this.classId=classId;this.render();};
  Book.prototype.render=function(){
    this.body.innerHTML=''; var ids=(Arena.Data.powerLibrary&&Arena.Data.powerLibrary.byClass[this.classId])||[];
    var groups=Object.create(null), order=[];
    for(var i=0;i<ids.length;i++){var ab=Arena.Data.abilities[ids[i]];if(!ab)continue;var d=ab.discipline||'General';if(!groups[d]){groups[d]=[];order.push(d);}groups[d].push(ab);}
    var active=0,passive=0;
    for(var g=0;g<order.length;g++){
      var sec=el('section','power-discipline',this.body); sec.dataset.discipline=order[g].toLowerCase();
      var h=el('h3','',sec);h.textContent=order[g]; var grid=el('div','power-grid',sec);
      var arr=groups[order[g]];
      for(var j=0;j<arr.length;j++){
        var ab=arr[j], isPassive=!!(ab.flags&&ab.flags.passive); if(isPassive)passive++;else active++;
        var card=el('article','power-card'+(isPassive?' passive':''),grid); card.dataset.search=(ab.name+' '+ab.discipline+' '+ab.desc).toLowerCase();card.dataset.abilityId=ab.id;
        if(!isPassive){card.draggable=true;card.title='Arrastra a un slot de la barra';card.addEventListener('dragstart',(function(id){return function(e){e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-arena-ability',id);e.dataTransfer.setData('text/plain',id);};})(ab.id));}
        var icon=el('div','power-card-icon',card);icon.innerHTML=Arena.UI.AbilityIcons.svg(ab);
        var copy=el('div','power-card-copy',card);var name=el('div','power-card-name',copy);name.textContent=ab.name;
        var m=el('div','power-card-meta',copy);m.textContent=meta(ab);var dsc=el('div','power-card-desc',copy);dsc.textContent=ab.desc||'';
      }
    }
    this.count.textContent=active+' activos · '+passive+' pasivos';this._filter();
  };
  Book.prototype._filter=function(){
    var q=(this.search.value||'').trim().toLowerCase(), cards=this.body.querySelectorAll('.power-card'), visible=0;
    for(var i=0;i<cards.length;i++){var show=!q||cards[i].dataset.search.indexOf(q)>=0;cards[i].hidden=!show;if(show)visible++;}
    var secs=this.body.querySelectorAll('.power-discipline');for(var s=0;s<secs.length;s++){secs[s].hidden=!secs[s].querySelector('.power-card:not([hidden])');}
    this.root.dataset.visible=visible;
  };
  Arena.UI=Arena.UI||{};Arena.UI.PowerBook=Book;
});
