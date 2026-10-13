/* =============================================================================
 * ui/powerBook.js — Libro de poderes de la subclase.
 *
 * Los poderes activos son draggable y se sueltan en cualquiera de los 12 slots.
 * Los pasivos se muestran para que el kit completo sea auditable, pero no se
 * colocan en la barra: sólo los seleccionados se aplican al build.
 * ========================================================================== */
Arena.define('ui/powerBook', ['ui/abilityIcons','data/powerLibrary'], function (Arena) {
  'use strict';
  function el(tag,cls,parent){var n=document.createElement(tag);if(cls)n.className=cls;if(parent)parent.appendChild(n);return n;}
  function meta(ab){
    var a=[]; if(ab.flags&&ab.flags.passive)a.push('PASIVO'); else a.push(ab.castTime>0?('PREPARACIÓN '+ab.castTime.toFixed(2)+' s'):'INSTANTÁNEO');
    if(ab.cooldown)a.push('RECUPERACIÓN '+ab.cooldown+' s'); if(ab.cost)a.push('COSTE '+ab.cost); if(ab.range)a.push('ALCANCE '+ab.range); return a.join(' · ');
  }
  function Book(root){
    this.root=el('section','power-book',root); this.root.id='power-book'; this.root.hidden=true; this.classId=null;
    var shell=el('div','power-book-shell',this.root), head=el('header','power-book-head',shell);
    var title=el('div','power-book-title',head); title.innerHTML='<b>LIBRO DE PODERES</b><span>Build libre · elige nivel y pasivos · arrastra activos</span>';
    this.search=el('input','power-book-search',head); this.search.type='search';this.search.placeholder='Buscar poder o disciplina…';
    this.count=el('div','power-book-count',head); this.close=el('button','power-book-close',head);this.close.type='button';this.close.textContent='×';
    this.body=el('div','power-book-body',shell);
    var self=this;this.close.addEventListener('click',function(){self.hide();});
    this.search.addEventListener('input',function(){self._filter();});
    this.root.addEventListener('mousedown',function(e){if(e.target===self.root)self.hide();});
  }
  Book.prototype.isOpen=function(){return !this.root.hidden;};
  Book.prototype.show=function(){this.render();this.root.hidden=false;this.root.classList.add('open');};
  Book.prototype.hide=function(){this.root.hidden=true;this.root.classList.remove('open');};
  Book.prototype.toggle=function(){this.isOpen()?this.hide():this.show();};
  Book.prototype.setClass=function(classId){this.classId=classId;this.render();};
  Book.prototype.render=function(){
    this.body.innerHTML=''; var ids=((Arena.Data.classes[this.classId]||{}).abilities||[]).concat((Arena.Data.powerLibrary&&Arena.Data.powerLibrary.byClass[this.classId])||[]);
    ids=ids.filter(function(id,i){return ids.indexOf(id)===i;});
    var groups=Object.create(null), order=[];
    for(var i=0;i<ids.length;i++){var ab=Arena.Data.abilities[ids[i]];if(!ab)continue;var d=ab.discipline||'General';if(!groups[d]){groups[d]=[];order.push(d);}groups[d].push(ab);}
    var active=0,passive=0;
    for(var g=0;g<order.length;g++){
      var sec=el('section','power-discipline',this.body); sec.dataset.discipline=order[g].toLowerCase();
      var h=el('h3','',sec);h.textContent=order[g]; var grid=el('div','power-grid',sec);
      var arr=groups[order[g]];
      for(var j=0;j<arr.length;j++){
        var ab=arr[j], isPassive=!!(ab.flags&&ab.flags.passive); if(isPassive)passive++;else active++;
        var card=el('article','power-card'+(isPassive?' passive':''),grid); card.dataset.search=(ab.name+' '+(ab.originalName||'')+' '+ab.discipline+' '+ab.desc).toLowerCase();card.dataset.abilityId=ab.id;
        if(!isPassive){card.draggable=true;card.title='Arrastra a un slot de la barra';card.addEventListener('dragstart',(function(id){return function(e){e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('application/x-arena-ability',id);e.dataTransfer.setData('text/plain',id);};})(ab.id));}
        var icon=el('div','power-card-icon',card);icon.innerHTML=Arena.UI.AbilityIcons.image(ab);
        var copy=el('div','power-card-copy',card);var name=el('div','power-card-name',copy);name.textContent=ab.name;
        var original=el('small','power-original',copy);original.textContent='Referencia: '+(ab.originalName||ab.name);
        var m=el('div','power-card-meta',copy);m.textContent=meta(ab);var dsc=el('div','power-card-desc',copy);dsc.textContent=ab.desc||'';
        if(ab.contextRequired)el('small','power-original',copy).textContent=ab.contextRequired;
        if(ab.rank){
          var controls=el('div','power-rank-controls',copy),label=el('label','',controls);label.textContent='Nivel ';
          var select=el('select','power-rank-select',label);select.setAttribute('aria-label','Nivel de '+ab.name);
          for(var r=1;r<=5;r++){var opt=el('option','',select);opt.value=r;opt.textContent=r+'/5';opt.selected=r===ab.rank;}
          select.disabled=Arena.Data.trainerBuild.isLocked();
          select.addEventListener('change',(function(id,book){return function(ev){Arena.Data.trainerBuild.setRank(id,Number(ev.target.value));book.render();};})(ab.id,this));
          if(isPassive){var toggle=el('button','power-passive-toggle',controls);toggle.type='button';toggle.textContent=Arena.Data.trainerBuild.isSelected(ab.id)?'✓ Equipado':'Equipar pasivo';toggle.setAttribute('aria-pressed',String(Arena.Data.trainerBuild.isSelected(ab.id)));toggle.disabled=Arena.Data.trainerBuild.isLocked();
            toggle.addEventListener('click',(function(id,book){return function(){Arena.Data.trainerBuild.togglePassive(id);book.render();};})(ab.id,this));}
          var rows=ab.sourceMechanics.rows||[],detail=el('details','power-level-details',copy),summary=el('summary','',detail);summary.textContent='Efectos · nivel '+ab.rank+' / comparar 1–5';
          var table=el('table','power-level-table',detail),tr=el('tr','',el('thead','',table));['Efecto','1','2','3','4','5'].forEach(function(s){el('th','',tr).textContent=s;});
          var tbody=el('tbody','',table),variants=Arena.Data.trainerCatalogue.ranks[ab.id].ranks;
          rows.forEach(function(row,ri){var line=el('tr','',tbody);el('td','',line).textContent=row.label;variants.forEach(function(v){var cell=el('td',v.rank===ab.rank?'selected-rank':'',line),value=v.sourceMechanics.rows[ri].value;cell.textContent=value===true?'Sí':value===false?'No':String(value);});});
          [['Maná','cost'],['Cast (s)','castTime'],['Recarga (s)','cooldown']].forEach(function(row){var line=el('tr','',tbody);el('td','',line).textContent=row[0];variants.forEach(function(v){el('td',v.rank===ab.rank?'selected-rank':'',line).textContent=v[row[1]];});});
        }
      }
    }
    this.count.textContent=active+' activos · '+passive+' pasivos'+(Arena.Data.trainerBuild&&Arena.Data.trainerBuild.isLocked()?' · Build bloqueado durante duelo':'');this._filter();
  };
  Book.prototype._filter=function(){
    var q=(this.search.value||'').trim().toLowerCase(), cards=this.body.querySelectorAll('.power-card'), visible=0;
    for(var i=0;i<cards.length;i++){var show=!q||cards[i].dataset.search.indexOf(q)>=0;cards[i].hidden=!show;if(show)visible++;}
    var secs=this.body.querySelectorAll('.power-discipline');for(var s=0;s<secs.length;s++){secs[s].hidden=!secs[s].querySelector('.power-card:not([hidden])');}
    this.root.dataset.visible=visible;
  };
  Arena.UI=Arena.UI||{};Arena.UI.PowerBook=Book;
});
