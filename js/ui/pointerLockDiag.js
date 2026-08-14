/* =============================================================================
 * ui/pointerLockDiag.js — El único gate que un navegador headless no concede.
 *
 * POR QUÉ EXISTE
 *
 * Pointer Lock exige un gesto humano de verdad. Chromium headless rechaza el
 * `requestPointerLock()` que nace de un evento sintético, y ninguna cantidad de
 * ingenio en el arnés lo cambia: es una decisión de seguridad del navegador, no
 * un fallo del juego. Todo lo demás del ratón —arrastre izquierdo 1:1, mirada
 * libre con el derecho, deadzone de selección— SÍ está automatizado y en verde.
 *
 * Así que en vez de seguir peleando con el arnés, esta pantalla convierte la
 * comprobación en algo que una persona hace en treinta segundos sobre el juego
 * ya desplegado, y que da un veredicto que se puede copiar y pegar.
 *
 *   index.html?diag=pointerlock      o  F9 en cualquier momento
 *
 * NO TOCA NADA. Lee `Game.input`, la cámara y el yaw del jugador. No escribe
 * una sola propiedad de simulación ni de presentación: si esta pantalla
 * desapareciera, el juego se comportaría exactamente igual.
 * ========================================================================== */
Arena.define('ui/pointerLockDiag', [], function (Arena) {
  'use strict';

  var D = {};

  /* Las seis comprobaciones del brief, en el orden en que se hacen. */
  var CHECKS = [
    { id: 'hold',    label: 'Mantener el botón IZQUIERDO sobre el juego' },
    { id: 'lock',    label: 'Pointer Lock activo mientras se arrastra' },
    { id: 'cursor',  label: 'El cursor desaparece' },
    { id: 'oneToOne', label: 'El ratón horizontal gira cámara y cuerpo 1:1' },
    { id: 'release', label: 'Al soltar vuelve el cursor y se libera el lock' },
    { id: 'freeLook', label: 'Botón DERECHO: gira la cámara y NO el cuerpo' }
  ];

  /** Tolerancia del 1:1. Por debajo de esto la diferencia no se nota jugando. */
  var RATIO_TOL = 0.06;
  /** Giro mínimo, en radianes, para que una medición cuente. */
  var MIN_TURN = 0.25;

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  D.create = function (game) {
    if (D._panel) return D._panel;

    var state = {};
    for (var i = 0; i < CHECKS.length; i++) state[CHECKS[i].id] = { ok: null, note: '' };

    var root = el('div',
      'position:fixed;left:16px;bottom:16px;z-index:9999;width:430px;' +
      'background:rgba(10,14,20,.94);border:1px solid #2b3a4d;border-radius:10px;' +
      'padding:14px 16px;color:#d7dde5;font:12px/1.55 ui-monospace,Menlo,Consolas,monospace;' +
      'box-shadow:0 10px 34px rgba(0,0,0,.55);pointer-events:none;user-select:none');

    var title = el('div',
      'font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8fb6e8;margin-bottom:2px',
      'Diagnóstico · Pointer Lock');
    var sub = el('div', 'color:#63758c;margin-bottom:10px;font-size:11px',
      'Arrastra con el botón izquierdo, suéltalo, y luego arrastra con el derecho.');
    root.appendChild(title);
    root.appendChild(sub);

    var rows = {};
    for (var k = 0; k < CHECKS.length; k++) {
      var row = el('div', 'display:flex;gap:9px;align-items:baseline;padding:2px 0');
      var mark = el('span', 'width:14px;flex:0 0 14px;color:#5d6b7d', '·');
      var lbl = el('span', 'flex:1', CHECKS[k].label);
      var note = el('span', 'color:#7f8fa3;font-size:11px;text-align:right;min-width:118px', '');
      row.appendChild(mark); row.appendChild(lbl); row.appendChild(note);
      root.appendChild(row);
      rows[CHECKS[k].id] = { mark: mark, label: lbl, note: note };
    }

    var verdict = el('div',
      'margin-top:11px;padding-top:10px;border-top:1px solid #24303f;font-weight:700', '');
    root.appendChild(verdict);
    var hint = el('div', 'margin-top:6px;color:#63758c;font-size:11px',
      'F9 cierra este panel. Requiere HTTPS o localhost.');
    root.appendChild(hint);

    document.body.appendChild(root);

    /* --- Medición ------------------------------------------------------- */
    var canvas = document.getElementById('gl');
    var track = null;   // arrastre en curso

    function playerYaw() {
      var w = game.world;
      var p = w && w.getPlayer ? w.getPlayer() : null;
      return p ? p.yaw : 0;
    }
    function camYaw() {
      return game.renderer && game.renderer.camera ? game.renderer.camera.yaw : 0;
    }
    // Diferencia angular con envoltura: sin esto, cruzar ±π da un salto de 2π
    // y el 1:1 sale «roto» justo al mirar hacia atrás.
    function delta(a, b) {
      var d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    function set(id, ok, note) {
      state[id].ok = ok;
      state[id].note = note || '';
    }

    function onDown(e) {
      track = {
        button: e.button,
        cam0: camYaw(), body0: playerYaw(),
        sawLock: false, sawHidden: false
      };
      if (e.button === 0) set('hold', true, 'botón 0');
      if (e.button === 2) set('freeLook', null, 'midiendo…');
    }

    function onUp() {
      if (!track) return;
      var dCam = delta(track.cam0, camYaw());
      var dBody = delta(track.body0, playerYaw());

      if (track.button === 0) {
        if (Math.abs(dCam) >= MIN_TURN) {
          var ratio = dCam !== 0 ? dBody / dCam : 0;
          var ok = Math.abs(ratio - 1) <= RATIO_TOL;
          set('oneToOne', ok, 'cuerpo/cámara ' + ratio.toFixed(3));
        }
        // Soltar tiene que devolver el cursor.
        var libre = !document.pointerLockElement;
        set('release', libre, libre ? 'cursor devuelto' : 'sigue capturado');
      } else if (track.button === 2) {
        if (Math.abs(dCam) >= MIN_TURN) {
          var quieto = Math.abs(dBody) < 0.02;
          set('freeLook', quieto,
            'cámara ' + dCam.toFixed(2) + ' · cuerpo ' + dBody.toFixed(3));
        } else {
          set('freeLook', null, 'gira más');
        }
      }
      track = null;
    }

    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mouseup', onUp, true);

    function tick() {
      if (!D._panel) return;
      var locked = document.pointerLockElement === canvas;
      if (locked) {
        set('lock', true, 'canvas capturado');
        // Con Pointer Lock el cursor lo esconde el navegador: comprobarlo es
        // exactamente comprobar que el lock está activo sobre el canvas.
        set('cursor', true, 'oculto por el lock');
        if (track) { track.sawLock = true; track.sawHidden = true; }
      } else if (state.lock.ok === null && track && track.button === 0) {
        set('lock', false, 'no concedido');
      }

      var pend = 0, bad = 0;
      for (var i = 0; i < CHECKS.length; i++) {
        var c = CHECKS[i], s = state[c.id], r = rows[c.id];
        if (s.ok === true) { r.mark.textContent = '✓'; r.mark.style.color = '#4fbf87'; }
        else if (s.ok === false) { r.mark.textContent = '✗'; r.mark.style.color = '#ff5a4d'; bad++; }
        else { r.mark.textContent = '·'; r.mark.style.color = '#5d6b7d'; pend++; }
        r.note.textContent = s.note;
      }
      if (bad) {
        verdict.textContent = 'FALLA · ' + bad + ' comprobación(es) en rojo';
        verdict.style.color = '#ff8a7a';
      } else if (pend) {
        verdict.textContent = 'PENDIENTE · faltan ' + pend + ' por comprobar';
        verdict.style.color = '#e7c678';
      } else {
        verdict.textContent = 'PASA · Pointer Lock verificado a mano';
        verdict.style.color = '#6fe0aa';
      }
      D._raf = requestAnimationFrame(tick);
    }

    D._panel = {
      root: root,
      state: state,
      destroy: function () {
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('mouseup', onUp, true);
        if (D._raf) cancelAnimationFrame(D._raf);
        if (root.parentNode) root.parentNode.removeChild(root);
        D._panel = null;
      },
      /** Veredicto en texto plano, para pegar en un informe. */
      report: function () {
        var out = ['POINTER LOCK · diagnóstico manual', new Date().toISOString(),
                   'user-agent: ' + navigator.userAgent,
                   'origen: ' + location.origin + ' (seguro: ' + (window.isSecureContext ? 'sí' : 'NO') + ')', ''];
        for (var i = 0; i < CHECKS.length; i++) {
          var s = state[CHECKS[i].id];
          out.push((s.ok === true ? '[OK]  ' : s.ok === false ? '[FALLA] ' : '[----] ') +
            CHECKS[i].label + (s.note ? '  — ' + s.note : ''));
        }
        return out.join('\n');
      }
    };
    tick();
    return D._panel;
  };

  D.toggle = function (game) {
    if (D._panel) { D._panel.destroy(); return false; }
    D.create(game);
    return true;
  };

  /** ¿Lo pide la URL? `index.html?diag=pointerlock` */
  D.requestedByUrl = function () {
    try {
      return /(^|[?&])diag=pointerlock(&|$)/.test(location.search);
    } catch (e) { return false; }
  };

  Arena.UI.PointerLockDiag = D;
});
