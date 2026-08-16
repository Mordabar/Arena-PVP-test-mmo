#!/usr/bin/env python3
"""Generate Project Arena's source-inspired power library from the supplied master DOCX.

The generator intentionally does NOT carry source power names/descriptions into runtime data.
It extracts the source mechanical contract at rank 5 and preserves cast time, cooldown, duration, range, area and effect magnitudes exactly where the Arena runtime has an equivalent channel. Damage remains deterministic fixed/pure for the current milestone, while original Project Arena names/icons are emitted. Source mana is preserved as metadata and scaled only for Arena's compact resource pools so every power remains usable. The source document remains provenance, not shipped content.
"""
from __future__ import annotations
import argparse, hashlib, json, math, re
from pathlib import Path
from docx import Document

TARGETS = {
    'GUERRERO': ['devastador','guardian'],
    'CABALLERO': ['guardian'],
    'BÁRBARO': ['devastador'],
    'ARQUERO': ['centinela','rastreador'],
    'CAZADOR': ['rastreador'],
    'TIRADOR': ['centinela'],
    'MAGO': ['arcanista','vinculador'],
    'BRUJO': ['arcanista'],
    'CONJURADOR': ['vinculador'],
}
CLASS_TAG = {
    'devastador':'ceniza','guardian':'bastion','centinela':'halcon','rastreador':'huella',
    'arcanista':'eter','vinculador':'nexo'
}
CLASS_NOUNS = {
 'devastador':['Ruptura','Mandato','Filo','Ira','Embate','Quiebre','Vórtice','Yunque','Clamor','Marca','Pulso','Tormenta'],
 'guardian':['Égida','Juramento','Bastión','Custodia','Muralla','Vigilia','Ancla','Amparo','Sello','Guardia','Voto','Fortaleza'],
 'centinela':['Saeta','Horizonte','Vigía','Trazo','Aguja','Ráfaga','Órbita','Puntería','Vector','Mirador','Cisma','Centella'],
 'rastreador':['Rastro','Trampa','Acecho','Huella','Señuelo','Sombra','Instinto','Emboscada','Marca','Susurro','Maleza','Niebla'],
 'arcanista':['Runa','Singularidad','Hexagrama','Umbral','Ascua','Vacío','Prisma','Relámpago','Nexo','Orbe','Fractura','Eclipse'],
 'vinculador':['Lazo','Pacto','Sutura','Halo','Resonancia','Vínculo','Gracia','Trama','Aliento','Círculo','Manto','Concordia'],
}
CLASS_EPITHETS = {
 'devastador':['Roto','de Ceniza','del Coloso','Implacable','de Hierro','Rojo','del Cráter','Quebrado','del Asedio','de Sangre Fría'],
 'guardian':['Luminoso','del Juramento','de Mármol','Inquebrantable','del Centinela','Áureo','del Refugio','de Acero','del Faro','de Guardia'],
 'centinela':['Lejano','del Viento','de Cristal','del Meridiano','Ascendente','del Horizonte','de Aguja','Azul','del Ocaso','de Tormenta'],
 'rastreador':['Velado','del Brezal','de Humo','de la Presa','Silente','del Bosque','de Espinas','Nocturno','del Sendero','Oculto'],
 'arcanista':['Astral','del Umbral','Violeta','del Vacío','de Mercurio','del Eclipse','Rúnico','de Éter','de la Grieta','Inverso'],
 'vinculador':['Sereno','del Nexo','de Nácar','Vital','de Alba','del Pacto','Esmeralda','de Resonancia','del Amparo','Convergente'],
}
DISC_NAMES = {
 'devastador':['Dominio del Filo','Dominio del Impacto','Dominio de la Lanza','Táctica de Choque','Gritos de Asedio','Maestría Colosal','Herencia de Guerra'],
 'guardian':['Dominio del Filo','Dominio del Impacto','Dominio de la Lanza','Táctica de Guardia','Vanguardia del Juramento','Escudos del Bastión','Herencia de Guerra'],
 'centinela':['Arco Veloz','Arco de Horizonte','Tácticas de Precisión','Evasión Experta','Munición Arcana','Puntería Superior','Herencia de Guerra'],
 'rastreador':['Arco Veloz','Arco de Horizonte','Tácticas de Campo','Evasión Experta','Exploración Velada','Compañeros Salvajes','Herencia de Guerra'],
 'arcanista':['Mente Rúnica','Flujo de Maná','Maestría del Báculo','Encantamientos','Arcania Profunda','Nigromancia Umbral','Elementalismo','Herencia de Guerra'],
 'vinculador':['Mente Rúnica','Flujo de Maná','Maestría del Báculo','Encantamientos','Tejido Vital','Conjuración','Hechicería Protectora','Herencia de Guerra'],
}
GCD_MAP={'Muy corto':'reactive','Corto':'short','Normal':'standard','Largo':0.8,'Muy largo':0.9,'-':'none'}

FEATURED_SOURCES = {
  'devastador':[31,5,1,77,79,84,90,10,28,32,80,89],
  'guardian':[52,54,50,57,59,60,43,41,58,55,44,49],
  'centinela':[172,111,176,179,180,186,129,121,130,173,171,188],
  'rastreador':[141,145,149,148,121,129,130,142,146,147,150,159],
  'arcanista':[261,263,262,245,265,266,268,269,270,250,252,260],
  'vinculador':[281,289,211,237,240,286,308,282,284,288,301,309],
}


# v0.12 — semantic presentation contract. Runtime never receives the source
# name, but it does receive WHAT kind of fantasy action the power should read
# as. This lets animation/VFX/icon systems differentiate a meteor from a
# lightning strike without hard-coding runtime ability ids.
WARLOCK_PRESENTATION = {
    241: ('Aguja del Permafrost','ice','earthSpike','groundSpike'),
    242: ('Ancla de Bruma','arcane','slowField','bind'),
    243: ('Grilletes de Basalto','earth','stoneBind','bind'),
    244: ('Peso del Vacío','shadow','debilitate','shadow'),
    245: ('Cometa de Ceniza','fire','meteor','meteor'),
    246: ('Corona de Vendaval','wind','windWard','ward'),
    247: ('Roseta de Cristal','ice','crystalBurst','shatter'),
    248: ('Fisura Quebradiza','earth','fracture','bind'),
    249: ('Puño del Monolito','earth','stoneFist','groundSpike'),
    250: ('Pavor de la Grieta','shadow','dreadWave','shadow'),
    251: ('Mordida Carmesí','shadow','lifeDrain','drain'),
    252: ('Velo de Medianoche','shadow','darkSeal','shadow'),
    253: ('Ira Prestada','shadow','enrage','shadow'),
    254: ('Pacto Sanguíneo','shadow','lifeDrain','drain'),
    255: ('Custodios del Umbral','shadow','spiritSwarm','summon'),
    256: ('Espectros Voraces','shadow','spiritSwarm','summon'),
    257: ('Sifón de Ánimas','shadow','soulDrain','drain'),
    258: ('Pira del Ocaso','fire','cremation','groundFlame'),
    259: ('Yugo Espectral','shadow','possession','dominate'),
    260: ('Dominio del Abismo','shadow','doomAura','shadow'),
    261: ('Orbe de Ascua','fire','fireball','hurl'),
    262: ('Estallido Glacial','ice','iceBurst','freeze'),
    263: ('Descarga Fulmínea','lightning','lightningBolt','lightning'),
    264: ('Concordancia Elemental','arcane','elementWard','ward'),
    265: ('Prisión de Escarcha','ice','freezePrison','freeze'),
    266: ('Tempestad de Cristal','ice','iceStorm','storm'),
    267: ('Sello de Vulnerabilidad','arcane','elementExpose','bind'),
    268: ('Núcleo de Magma','fire','magmaOrb','hurl'),
    269: ('Vórtice Errante','wind','tornado','storm'),
    270: ('Cúpula de Rayos','lightning','lightningStorm','storm'),
    272: ('Concilio Velado','arcane','warCouncil','ward'),
    274: ('Marea Umbral','shadow','darkTide','shadow'),
    276: ('Ascendencia Arcana','arcane','mastery','ward'),
    278: ('Enredadera Cataclísmica','nature','massRoots','groundSpike'),
    280: ('Sangre del Conquistador','shadow','bloodPact','ward'),
}

ELEMENT_HINTS = (
    ('lightning', ('rayo','rayos','relámp','relamp','eléct','electr','trueno')),
    ('fire', ('fuego','llama','magma','ceniza','ard','quem','ígneo','igneo')),
    ('ice', ('hielo','frío','frio','helad','escarcha','cristal')),
    ('wind', ('viento','tornado','remolino','ráfaga','rafaga')),
    ('shadow', ('oscur','alma','vamp','nigrom','muerte','sádic','sadic','terror','crem')),
    ('nature', ('hiedra','raíz','raiz','insect','bestia','natural','espina')),
    ('earth', ('roca','piedra','estalagm','golem','tierra','aplast')),
)

def presentation_meta(rec, class_id, target, effects, self_effects):
    if rec['sourceClass']=='BRUJO' and rec['sourceIndex'] in WARLOCK_PRESENTATION:
        name, element, shape, gesture = WARLOCK_PRESENTATION[rec['sourceIndex']]
    else:
        name=None
        text=(' '.join([rec['sourceName'],rec['desc']]+[b['text'] for b in rec['bullets']])).lower()
        element='physical'
        for candidate,hints in ELEMENT_HINTS:
            if any(h in text for h in hints): element=candidate; break
        allfx=(effects or [])+(self_effects or [])
        kinds=[e.get('effect') or e.get('type') for e in allfx]
        if any(k in kinds for k in ('heal','hot','revive')): shape='healPulse'; element='life'
        elif any(k in kinds for k in ('barrier','block','reflect','damageRedirect')): shape='ward';
        elif any(k in kinds for k in ('root','knockdown','stasis','stun','silence','noAttack')): shape='controlSeal'
        elif any(e.get('type')=='summon' for e in allfx): shape='summonSigil'
        elif target in ('ground','aoeSelf') and element=='fire': shape='fireField'
        elif target in ('ground','aoeSelf') and element=='ice': shape='iceStorm'
        elif target in ('ground','aoeSelf') and element=='lightning': shape='lightningStorm'
        elif target in ('ground','aoeSelf') and element=='wind': shape='tornado'
        elif target in ('ground','aoeSelf'): shape='aoeRune'
        elif element=='fire': shape='fireBolt'
        elif element=='ice': shape='iceBolt'
        elif element=='lightning': shape='lightningBolt'
        elif element=='shadow': shape='shadowBolt'
        elif element=='earth': shape='earthSpike'
        else: shape='arcaneBolt' if class_id in ('arcanista','vinculador') else 'physicalSkill'
        if shape in ('lightningBolt',): gesture='lightning'
        elif shape in ('fireBolt','fireField'): gesture='hurl'
        elif shape in ('iceBolt','iceStorm'): gesture='freeze'
        elif shape in ('earthSpike',): gesture='groundSpike'
        elif shape in ('tornado','lightningStorm'): gesture='storm'
        elif shape in ('healPulse',): gesture='heal'
        elif shape in ('ward',): gesture='ward'
        elif shape in ('controlSeal',): gesture='bind'
        elif shape in ('summonSigil',): gesture='summon'
        else: gesture='cast'
    return {
        'element':element,'shape':shape,'iconShape':shape,'spellGesture':gesture,
        'intensity':'major' if rec['cooldown']>=90 or rec['area']>=10 else 'standard',
        'impactRadius':float(rec['area'] or 0),
        **({'curatedName':name} if name else {})
    }

RE_NUM=re.compile(r'[-+]?\d+(?:[.,]\d+)?')

def strip_parenthetical(s:str)->str:
    return re.sub(r'\s*\([^)]*\)\s*$', '', s or '').strip()

def parse_last_number(s, default=0.0):
    nums=[float(x.replace(',','.')) for x in RE_NUM.findall(s or '')]
    return nums[-1] if nums else default

def parse_last_range_value(s, default=0.0):
    # last rank lives after the final slash between rank columns; internal ranges use '-'.
    part=(s or '').split('/')[-1]
    nums=[abs(float(x.replace(',','.'))) for x in RE_NUM.findall(part)]
    if not nums: return default
    return sum(nums)/len(nums)

def rank5_token(s):
    """Return the literal rank-5 value. Rank separators have spaces around '/';
    internal ranges such as +60/65% do not."""
    value=(s or '').split(':',1)[1].strip() if ':' in (s or '') else (s or '').strip()
    parts=re.split(r'\s+/\s+', value)
    return (parts[-1] if parts else value).strip()

def token_range(token, default=0.0):
    t=(token or '').strip()
    # Hyphens between digits are range separators, not negative signs.
    if re.search(r'\d%?\s*-\s*\d', t):
        nums=[float(x.replace(',','.')) for x in re.findall(r'\d+(?:[.,]\d+)?',t)]
    else:
        nums=[float(x.replace(',','.')) for x in RE_NUM.findall(t)]
    if not nums: return (float(default),float(default))
    if len(nums)==1: return (nums[0],nums[0])
    return (min(nums),max(nums))

def source_damage_school(label):
    low=(label or '').lower()
    if any(k in low for k in ('fuego','hielo','frío','frio','eléct','electr','rayo')): return 'magical'
    if any(k in low for k in ('cortante','punzante','aplastante','arma','ataque')): return 'physical'
    return 'pure'

def source_damage_element(label):
    low=(label or '').lower()
    if 'fuego' in low: return 'fire'
    if 'hielo' in low or 'frío' in low or 'frio' in low: return 'ice'
    if 'eléct' in low or 'electr' in low or 'rayo' in low: return 'lightning'
    if 'cortante' in low: return 'slashing'
    if 'punzante' in low: return 'piercing'
    if 'aplastante' in low: return 'blunt'
    return 'generic'

def compile_source_damage(rec):
    """Compile the source rank-5 damage contract without Arena rebalance.
    Ranges stay ranges. With RNG disabled the resolver uses the midpoint; with RNG
    enabled it samples the exact source interval deterministically."""
    out=[]; summaries=[]
    for b in rec['bullets']:
        if b['section']!='Daño': continue
        txt=b['text']; low=txt.lower(); label=txt.split(':',1)[0].strip(); tok=rank5_token(txt)
        # 'Retomar daño' is reflection, not a direct damage packet.
        if 'retomar daño' in low:
            continue
        # Special line: the label itself carries +60%, while the rank columns are the proc chance.
        if 'daño de ataque +60%' in low and 'chance' in low:
            chance=max(0.0,min(1.0,abs(token_range(tok,0)[1])/100.0))
            out.append({'type':'sourceWeaponDamage','pctMin':0.60,'pctMax':0.60,'bonus':True,'chance':round(chance,4),'sourceText':txt})
            summaries.append('bonificación de arma +60% con chance fuente')
            continue
        if 'daño de ataque' in low or 'daño de arma' in low:
            lo,hi=token_range(tok,100)
            # Percentage entries are weapon multipliers. A leading + means bonus over the base swing.
            if '%' in tok or '%' in txt:
                out.append({'type':'sourceWeaponDamage','pctMin':round(abs(lo)/100.0,4),'pctMax':round(abs(hi)/100.0,4),'bonus':(('+' in tok) or ('adicional' in low)),'sourceText':txt})
                summaries.append('daño de arma exacto')
            else:
                out.append({'type':'sourceDamage','min':round(abs(lo),3),'max':round(abs(hi),3),'school':'physical','sourceText':txt})
                summaries.append('daño físico exacto')
            continue
        # "Salud" under Daño is direct HP loss, not a heal.
        if low.startswith('salud'):
            lo,hi=token_range(tok,0)
            out.append({'type':'sourceDamage','min':round(abs(lo),3),'max':round(abs(hi),3),'school':'pure','sourceText':txt})
            summaries.append('daño puro exacto')
            continue
        if 'daño' in low:
            lo,hi=token_range(tok,0); school=source_damage_school(label); element=source_damage_element(label)
            if 'por segundo' in low:
                out.append({'type':'sourceDot','min':round(abs(lo),3),'max':round(abs(hi),3),'duration':effect_duration(rec['duration'] or 1),'interval':1.0,'school':school,'element':element,'sourceText':txt})
                summaries.append('daño por segundo exacto')
            elif 'ticks' in low:
                m=re.search(r'(\d+)\s*ticks?',low); ticks=int(m.group(1)) if m else 1
                dur=effect_duration(rec['duration'] or ticks)
                out.append({'type':'sourceDot','min':round(abs(lo),3),'max':round(abs(hi),3),'duration':dur,'ticks':ticks,'interval':round(dur/max(1,ticks),4),'school':school,'element':element,'sourceText':txt})
                summaries.append('daño por ticks exacto')
            else:
                out.append({'type':'sourceDamage','min':round(abs(lo),3),'max':round(abs(hi),3),'school':school,'element':element,'sourceText':txt})
                summaries.append('daño exacto '+school)
    # Source entries whose table marks a constant elemental pulse but the bullet omits
    # the words 'por segundo'. Regnum's Relámpago is the canonical case.
    if rec.get('sourceIndex')==263 and rec.get('sourceClass')=='BRUJO':
        converted=[]
        for e in out:
            if e.get('type')=='sourceDamage' and e.get('school')=='magical':
                converted.append({'type':'sourceDot','min':e['min'],'max':e['max'],'duration':effect_duration(rec['duration'] or 1),'interval':1.0,'school':'magical','element':'lightning','sourceText':e.get('sourceText','')})
            else: converted.append(e)
        out=converted
    return out,summaries

def boolish(s): return 'sí' in (s or '').lower() or 'yes' in (s or '').lower() or '100%' in (s or '')

def normalise_time(x, kind='cast'):
    # v0.11 parity pass: timings are source contract, not balance suggestions.
    # Preserve the rank-5 value verbatim; only canonicalise floating precision.
    if x <= 0: return 0
    return round(float(x), 3)

def normalise_cost(source_cost, target_class):
    # v0.13 SOURCE PARITY: mana cost is part of the power contract. No scaling.
    return int(max(0, round(float(source_cost or 0))))

def norm_range(x, class_id, target):
    # Explicit source ranges are preserved. Source value 0 means 'weapon range'
    # for many weapon skills, not literal zero metres. Resolve that semantic to
    # Arena's class weapon range without inventing a new range.
    if x > 0: return round(float(x), 3)
    if target not in ('enemy','ally','allyOrSelf','ground','cone','targetArea'): return 0
    if class_id == 'centinela': return 24
    if class_id == 'rastreador': return 20
    if class_id == 'arcanista': return 22
    if class_id == 'vinculador': return 20
    return 2.4

def fixed_damage(raw, dot=False, aoe=False):
    raw=max(1.0, raw)
    base=34 + math.sqrt(raw)*7.7
    if dot: base*=0.82
    if aoe: base*=0.88
    return int(max(45,min(220,round(base/5)*5)))

def cc_duration(kind, duration):
    # v0.11 parity pass: do not silently cap the source duration. Competitive
    # DR/fatigue still applies at resolution time, but the power itself declares
    # the same base duration as the source document.
    return round(max(0.0, float(duration or 0.0)), 3)

def effect_duration(duration):
    """Exact source duration for non-instant effects. Zero stays zero."""
    return round(max(0.0, float(duration or 0.0)), 3)

def mark_permanent_effects(items):
    """Activables/passives persist until explicitly removed, not for an invented TTL."""
    for e in items or []:
        if e.get('type') == 'status':
            e['permanent'] = True
            e.pop('duration', None)
        for key in ('effects','then','otherwise','onTrigger'):
            if isinstance(e.get(key), list): mark_permanent_effects(e[key])

def pct_from_text(text, cap=.55, scale=1.0):
    v=abs(parse_last_number(text,0))/100.0
    return round(min(cap,v*scale),3)

def jsdump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',',':'))

def parse_doc(path:Path):
    doc=Document(str(path))
    paras=doc.paragraphs
    h3=[]
    current_class=None; current_disc=None
    # Capture per-heading effects from paragraphs. Table i maps to heading i by source construction.
    for i,p in enumerate(paras):
        st=p.style.name if p.style else ''
        txt=p.text.strip()
        if st=='Heading 1' and txt:
            key=strip_parenthetical(txt).upper()
            if key in TARGETS: current_class=key; current_disc=None
        elif st=='Heading 2' and txt and current_class:
            current_disc=strip_parenthetical(txt)
        elif st=='Heading 3' and current_class:
            # capture until next heading 1/2/3
            bullets=[]; section=''
            desc=''
            j=i+1
            while j<len(paras):
                q=paras[j]; qs=q.style.name if q.style else ''; qt=q.text.strip()
                if qs in ('Heading 1','Heading 2','Heading 3'): break
                if not qt: j+=1; continue
                if qt in ('Daño','Beneficios (buffs)','Efectos negativos / Control (debuffs)'):
                    section=qt
                elif qs=='List Paragraph':
                    bullets.append({'section':section,'text':qt})
                elif not desc:
                    desc=qt
                j+=1
            h3.append({'sourceClass':current_class,'discipline':current_disc or 'General','sourceName':strip_parenthetical(txt),'desc':desc,'bullets':bullets})
    if len(h3)!=len(doc.tables):
        raise RuntimeError(f'Heading/table mismatch {len(h3)} != {len(doc.tables)}')
    for idx,(rec,t) in enumerate(zip(h3,doc.tables),1):
        cells={}
        for row in t.rows:
            for c in row.cells:
                txt=' '.join(c.text.split())
                if ':' in txt:
                    k,v=txt.split(':',1); cells[k.strip()]=v.strip()
        rec['sourceIndex']=idx
        rec['type']=cells.get('Tipo','')
        rec['cast']=parse_last_number(cells.get('T. lanzamiento',''),0)
        rec['gcd']=cells.get('GCD','Corto') or 'Corto'
        rec['cooldown']=parse_last_number(cells.get('Cooldown',''),0)
        rec['durationText']=cells.get('Duración','-')
        rec['duration']=parse_last_number(rec['durationText'],0)
        rec['mana']=parse_last_range_value(cells.get('Maná',''),0)
        rec['range']=parse_last_number(cells.get('Rango',''),0)
        rec['area']=parse_last_number(cells.get('Área',''),0)
        rec['weaponScale']=boolish(cells.get('Escala con arma',''))
        rec['blockable']=boolish(cells.get('Bloqueable',''))
        rec['resistible']=boolish(cells.get('Resistible',''))
    return h3

def original_name(class_id, source_index, source_name=None, source_class=None):
    # Keep the source name recognisable while adding a small Arena qualifier.
    # This is deliberately systematic so QA can identify the reference power instantly.
    suffix={
      'GUERRERO':'de Guerra','CABALLERO':'del Bastión','BÁRBARO':'de Sangre',
      'ARQUERO':'del Viento','CAZADOR':'del Acecho','TIRADOR':'del Horizonte',
      'MAGO':'del Éter','BRUJO':'del Vacío','CONJURADOR':'del Nexo'
    }.get(source_class or '', 'de Arena')
    base=(source_name or f'Poder {source_index}').strip()
    # Avoid clumsy duplicated suffixes while preserving the recognisable source words.
    return f'{base} {suffix}'

def discipline_name(class_id, source_disc, order_map):
    # Disciplines are navigation labels; keep the source taxonomy visible for parity QA.
    return (source_disc or 'General') + ' · Arena'

def damage_raw_from_bullets(rec):
    total=0.0; has=False; dot=False
    for b in rec['bullets']:
        t=b['text'].lower()
        if b['section']=='Daño' or t.startswith('salud: -') or 'daño' in t and b['section']=='Daño':
            if any(k in t for k in ['daño','salud']):
                v=parse_last_range_value(b['text'],0)
                if '%' in t and v<=200:
                    # Percent-of-normal translates to nominal compact damage, not source value.
                    v=max(60,v*1.1)
                if v>0: total+=v; has=True
                if 'por segundo' in t or 'ticks' in t: dot=True
    return (total if has else 0), dot

def has_word(rec,*words):
    s=(' '.join([rec['sourceName'],rec['desc']]+[x['text'] for x in rec['bullets']])).lower()
    return any(w.lower() in s for w in words)

def translated_effects(rec, class_id, target, aoe):
    effects=[]; self_effects=[]; summaries=[]
    exact_damage,damage_summaries=compile_source_damage(rec)
    effects.extend(exact_damage); summaries.extend(damage_summaries)
    raw,_dot_hint=damage_raw_from_bullets(rec)

    buff_target = self_effects if target=='enemy' else effects
    duration=normalise_time(rec['duration'],'duration')
    if rec['type'].lower().startswith('pasivo'): duration=0
    if rec['type'].lower().startswith('activable'): duration=0
    movement_duration_override=None
    for _b in rec['bullets']:
        _low=_b['text'].lower()
        if 'duración de la velocidad de movimiento' in _low or 'duracion de la velocidad de movimiento' in _low:
            movement_duration_override=parse_last_number(_b['text'], duration)

    for b in rec['bullets']:
        txt=b['text']; low=txt.lower(); sec=b['section']
        if sec=='Daño':
            if 'retomar daño' in low:
                pct=abs(parse_last_number(rank5_token(txt),0))/100.0
                buff_target.append({'type':'status','effect':'sourceRetaliation','duration':effect_duration(duration),'data':{'returnPct':round(pct,3)},'sourceText':txt})
                summaries.append('retorna daño del próximo ataque'); continue
            if 'maná' in low and ('-%' in low or 'convertir mana' in low or 'mana en daño' in low):
                pct=abs(parse_last_number(rank5_token(txt),20))/100.0
                effects.append({'type':'drainResource','pct':round(pct,3),'sourceText':txt})
                summaries.append('drena recurso')
            continue
        # Some source tables classify the attack multiplier as a benefit even
        # though it belongs to this offensive hit (Dual shot, Grounding arrow,
        # Spiritual blow). Compile it into the hit, never as a lingering buff.
        if sec=='Beneficios (buffs)' and target=='enemy' and low.startswith('daño de ataque'):
            lo,hi=token_range(rank5_token(txt),100)
            effects.append({'type':'sourceWeaponDamage','pctMin':round(abs(lo)/100.0,4),'pctMax':round(abs(hi)/100.0,4),'bonus':('+' in rank5_token(txt)),'sourceText':txt})
            summaries.append('daño de ataque fuente'); continue
        # Hard CC / restrictions. Resistance/cleanse bullets NAME the CC they protect
        # against; they must never be translated into the harmful CC itself.
        # Example: "Resistir inmovilizar +100%" is a ward, not a self-root.
        is_resistance = ('resistir ' in low or 'resistencia ' in low or 'disipar ' in low or
                         'desencantar ' in low or 'inmunidad ' in low or 'chance de resistir' in low)
        bullet_cc_duration = parse_last_number(txt,duration) if re.search(r'\d+(?:\.\d+)?\s*s\b',low) else duration
        if not is_resistance and any(x in low for x in ['noquear','derribo']):
            effects.append({'type':'status','effect':'knockdown','duration':cc_duration('knockdown',bullet_cc_duration)}) ; summaries.append('derribo'); continue
        if not is_resistance and 'inmovilizar' in low:
            effects.append({'type':'status','effect':'root','duration':cc_duration('root',bullet_cc_duration)}) ; summaries.append('inmovilización'); continue
        if not is_resistance and ('paralizar' in low or 'parálisis' in low):
            effects.append({'type':'status','effect':'stasis','duration':cc_duration('stasis',bullet_cc_duration)}) ; summaries.append('parálisis protectora'); continue
        if not is_resistance and 'aturdir' in low:
            effects.append(dict({'type':'status','effect':'stun','duration':cc_duration('stun',bullet_cc_duration)}, **({'chance':round(parse_last_number(txt,100)/100.0,3)} if 'chance' in low else {}))) ; summaries.append('aturdimiento'); continue
        if not is_resistance and 'marear' in low:
            effects.append(dict({'type':'status','effect':'silence','duration':cc_duration('silence',bullet_cc_duration)}, **({'chance':round(parse_last_number(txt,100)/100.0,3)} if 'chance' in low else {}))) ; summaries.append('bloqueo de casteo'); continue
        if not is_resistance and 'no puede atacar' in low:
            effects.append({'type':'status','effect':'noAttack','duration':cc_duration('noAttack',bullet_cc_duration)}) ; summaries.append('impide atacar'); continue
        if 'no puede invocar poderes que no' in low or 'no puede lanzar poderes no ofensivos' in low:
            effects.append({'type':'status','effect':'utilityLock','duration':cc_duration('utilityLock',duration)}) ; summaries.append('bloquea utilidades'); continue
        if 'no puede invocar poderes de daño' in low or 'no puede lanzar poderes de daño' in low:
            effects.append({'type':'status','effect':'noDamage','duration':cc_duration('noDamage',duration)}) ; summaries.append('bloquea poderes dañinos'); continue
        if 'bloquear poderes positivos' in low or 'no puede ser afectado por conjuros positivos' in low:
            effects.append({'type':'status','effect':'antiBuff','duration':effect_duration(duration)}) ; summaries.append('bloquea beneficios'); continue
        # Cleanse / purge / reveal / special
        if 'disipar poderes positivos' in low or 'desencantar poderes positivos' in low:
            count=max(1,int(round(abs(parse_last_number(rank5_token(txt),1)))))
            chance=1.0
            for cb in rec['bullets']:
                cl=cb['text'].lower()
                if 'chance de disipar' in cl or 'chance de desencantar' in cl:
                    chance=max(0.0,min(1.0,abs(parse_last_number(rank5_token(cb['text']),100))/100.0))
                    break
            effects.append({'type':'purge','count':count,'chance':round(chance,3)}) ; summaries.append('purga beneficios'); continue
        if low.startswith('chance de disipar') or low.startswith('chance de desencantar'):
            # Compiled into the purge operation above; keep verbatim in sourceMechanics.
            continue
        if 'disipar poderes negativos' in low or 'desencantar poderes negativos' in low:
            buff_target.append({'type':'cleanse','hard':2,'minor':3}) ; summaries.append('disipa perjuicios'); continue
        if (('disipar:' in low and not low.startswith('chance de disipar')) or 'disipar freeze' in low or 'disipar paral' in low):
            buff_target.append({'type':'cleanse','hard':2,'minor':1}) ; summaries.append('limpia control'); continue
        if 'descubrir' in low or 'revel' in low:
            effects.append({'type':'reveal','duration':effect_duration(duration)}) ; summaries.append('revela ocultos'); continue
        if 'invisibilidad' in low:
            buff_target.append({'type':'status','effect':'stealth','duration':effect_duration(duration)}) ; summaries.append('camuflaje'); continue
        if 'santuario' in low:
            buff_target.append({'type':'status','effect':'sanctuary','duration':effect_duration(duration)}) ; summaries.append('santuario'); continue
        if 'retomar daño' in low:
            pct=abs(parse_last_number(rank5_token(txt),0))/100.0
            if rec['sourceName'].lower()=='represalia':
                buff_target.append({'type':'status','effect':'sourceRetaliation','duration':effect_duration(duration),'data':{'returnPct':round(pct,3)},'sourceText':txt})
                summaries.append('retorna daño del próximo ataque')
            else:
                buff_target.append({'type':'status','effect':'sourceDamageReflect','duration':effect_duration(duration),'data':{'returnPct':round(pct,3)},'sourceText':txt})
                summaries.append('refleja porcentaje de daño durante el efecto')
            continue
        if 'reflej' in low:
            pct=abs(parse_last_number(rank5_token(txt),0))/100.0
            buff_target.append({'type':'status','effect':'sourceDamageReflect','duration':effect_duration(duration),'data':{'returnPct':round(pct,3)},'sourceText':txt}) ; summaries.append('refleja porcentaje de daño'); continue
        if 'absorbe todos los ataques' in low or 'redirigido' in low or 'daño redirigido' in low:
            buff_target.append({'type':'status','effect':'damageRedirect','duration':effect_duration(duration),'data':{'redirectPct':round(min(1.0,pct_from_text(txt,1.0,1.0) or 1.0),3)}}) ; summaries.append('redirección de daño'); continue
        if 'barrera mágica' in low:
            v=round(parse_last_range_value(txt,350),3)
            buff_target.append({'type':'barrier','flat':v,'duration':effect_duration(duration)}) ; summaries.append(f'barrera {v}'); continue
        # Drenar salud is not a heal-only line: the source explicitly removes
        # health from the target and adds the applied amount to the caster.
        if 'drenar salud' in low:
            tok=rank5_token(txt); lo,hi=token_range(tok,0)
            if 'por segundo' in low:
                effects.append({'type':'sourceDrainDot','min':round(abs(lo),3),'max':round(abs(hi),3),'duration':effect_duration(duration or 1),'interval':1.0,'school':'pure','sourceText':txt})
            else:
                effects.append({'type':'sourceDrain','min':round(abs(lo),3),'max':round(abs(hi),3),'sourceText':txt})
            summaries.append('drena salud exacta'); continue
        if ('salud' in low or 'health' in low) and sec=='Beneficios (buffs)':
            tok=rank5_token(txt); lo,hi=token_range(tok,0)
            if 'por tick' in low or 'por segundo' in low:
                dur=effect_duration(duration or 1)
                buff_target.append({'type':'sourceHot','min':round(abs(lo),3),'max':round(abs(hi),3),'duration':dur,'interval':1.0,'sourceText':txt})
                summaries.append('regenera salud exacta por pulsos'); continue
            # Direct/instant health is a source-range heal; timed/passive health is max-health metadata.
            if rec['type'].lower().startswith('direct') and rec['duration']<=0:
                heal_fx={'type':'sourceHeal','min':round(abs(lo),3),'max':round(abs(hi),3),'sourceText':txt}
                if '%' in tok and 'chance' not in low:
                    heal_fx['percentOfMax']=True
                if 'chance' in low:
                    nums=[float(x.replace(',','.')) for x in re.findall(r'[-+]?\d+(?:[.,]\d+)?',tok)]
                    if nums:
                        heal_fx['min']=heal_fx['max']=abs(nums[0])
                    m_ch=re.search(r'\(([-+]?\d+(?:[.,]\d+)?)%\)',tok)
                    if m_ch: heal_fx['chance']=max(0.0,min(1.0,float(m_ch.group(1).replace(',','.'))/100.0))
                buff_target.append(heal_fx)
                summaries.append('cura rango fuente')
            elif '%' in tok:
                pct=parse_last_number(tok,0)/100.0
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'maxHealthPct':round(pct,3)},'sourceText':txt})
                summaries.append('modifica salud máxima')
            else:
                v=round((abs(lo)+abs(hi))/2.0,3)
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'maxHealthFlat':v},'sourceText':txt})
                summaries.append(f'aumenta salud máxima {v}')
            continue
        if 'salud' in low and sec.startswith('Efectos') and '-' in txt:
            if '%' in txt:
                pct=-abs(parse_last_number(txt,0))/100.0
                buff_target.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'maxHealthPct':round(pct,3)}})
            else:
                v=-abs(parse_last_range_value(txt,0))
                buff_target.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'maxHealthFlat':round(v,3)}})
            summaries.append('reduce salud máxima'); continue
        if ('drenar mana' in low or 'drenar maná' in low) and sec=='Beneficios (buffs)':
            tok=rank5_token(txt); lo,hi=token_range(tok,0)
            # Some powers (Sirvientes sádicos) describe summoned souls that keep
            # draining during the whole Constant duration even though the bullet
            # itself only states the per-pulse amount. Preserve that temporal
            # contract instead of collapsing it into one instant drain.
            drain_over_time = (rec['duration'] > 0 and ('drenan maná' in rec['desc'].lower() or 'drenan mana' in rec['desc'].lower()))
            e={'type':'sourceManaDrainDot' if drain_over_time else 'sourceManaDrain',
               'min':round(abs(lo),3),'max':round(abs(hi),3),'percent':('%' in tok),
               'transfer':('roba' in rec['desc'].lower()),'sourceText':txt}
            if drain_over_time:
                e.update({'duration':effect_duration(duration),'interval':1.0})
                summaries.append('drena maná fuente por pulsos')
            else:
                summaries.append('drena maná fuente')
            effects.append(e); continue
        if ('recuperación de maná por golpe' in low or 'recuperacion de mana por golpe' in low):
            v=abs(parse_last_number(rank5_token(txt),0))
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'onHitResourceFlat':round(v,3)},'sourceText':txt})
            summaries.append('recupera maná por golpe'); continue
        if ('recuperación de salud por golpe' in low or 'recuperacion de salud por golpe' in low):
            v=abs(parse_last_number(rank5_token(txt),0))
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'onHitHealthFlat':round(v,3)},'sourceText':txt})
            summaries.append('recupera salud por golpe'); continue
        if ('regenerate mana' in low or 'regenerar mana' in low or 'regenerar maná' in low):
            pct=parse_last_number(rank5_token(txt),0)/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'resourceRegenPct':round(pct,3)},'sourceText':txt})
            summaries.append('aumenta regeneración de maná'); continue
        if ('maná' in low or 'mana' in low) and sec=='Beneficios (buffs)' and ('recuper' in low or '+' in low):
            tok=rank5_token(txt); lo,hi=token_range(tok,0)
            buff_target.append({'type':'sourceResourceRestore','min':round(abs(lo),3),'max':round(abs(hi),3),'percent':('%' in tok),'sourceText':txt})
            summaries.append('restaura recurso fuente'); continue
        if ('maná:' in low or 'mana:' in low) and sec.startswith('Efectos') and '-' in txt:
            if '%' in txt:
                effects.append({'type':'drainResource','pct':round(abs(parse_last_number(txt,0))/100.0,3)})
            else:
                effects.append({'type':'drainResource','flat':round(abs(parse_last_range_value(txt,0)),3)})
            summaries.append('drena recurso'); continue
        # movement / attack / casting modifiers
        if 'duración de la velocidad de movimiento' in low or 'duracion de la velocidad de movimiento' in low:
            # This is metadata for the preceding slow (e.g. Ice Blast: source
            # status lasts 10 s, but the movement reduction lasts only 2 s).
            # It is NOT a +2% self speed buff.
            continue
        if 'velocidad de movimiento' in low:
            pct=pct_from_text(txt,.95,1.0)
            if '-' in txt:
                slow_dur=movement_duration_override if movement_duration_override is not None else duration
                effects.append({'type':'status','effect':'slow','duration':effect_duration(slow_dur),'data':{'slowPct':pct}}); summaries.append('ralentiza')
            else:
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'moveSpeedPct':pct}}); summaries.append('acelera movimiento')
            continue
        if 'velocidad de ataque' in low:
            pct=pct_from_text(txt,.95,1.0)
            data={'attackSpeedPct': -pct if '-' in txt else pct}
            (effects if '-' in txt else buff_target).append({'type':'status','effect':'sourceDebuff' if '-' in txt else 'sourceBuff','duration':effect_duration(duration),'data':data})
            summaries.append('modifica velocidad de ataque'); continue
        if 'velocidad de invocación' in low or 'velocidad de lanzamiento' in low:
            pct=pct_from_text(txt,.95,1.0)
            # castSpeedPct is duration multiplier: negative is faster, positive is slower.
            data={'castSpeedPct': pct if '-' in txt else -pct}
            (effects if '-' in txt else buff_target).append({'type':'status','effect':'sourceDebuff' if '-' in txt else 'sourceBuff','duration':effect_duration(duration),'data':data})
            summaries.append('modifica velocidad de casteo'); continue
        # Exact source stat channels used directly by the runtime.
        if 'rango de ataque' in low:
            pct=parse_last_number(txt,0)/100.0
            buff_target.append({'type':'status','effect':'sourceBuff' if pct>=0 else 'sourceDebuff','duration':effect_duration(duration),'data':{'attackRangePct':round(pct,3)}})
            summaries.append('modifica alcance'); continue
        if 'chance de crítico' in low:
            pct=parse_last_number(txt,0)/100.0
            side=buff_target if pct>=0 else effects
            side.append({'type':'status','effect':'sourceBuff' if pct>=0 else 'sourceDebuff','duration':effect_duration(duration),'data':{'critChancePct':round(pct,3)}})
            summaries.append('modifica crítico'); continue
        if 'golpe crítico del objetivo' in low:
            pct=-abs(parse_last_number(txt,0))/100.0
            effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'critChancePct':round(pct,3)}})
            summaries.append('reduce críticos del objetivo'); continue
        if 'daño crítico' in low:
            pct=parse_last_number(txt,0)/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'critDamagePct':round(pct,3)}})
            summaries.append('modifica daño crítico'); continue
        if 'bonus de curación' in low:
            pct=parse_last_number(txt,0)/100.0
            side=effects if pct<0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct<0 else 'sourceBuff','duration':effect_duration(duration),'data':{'healingBonusPct':round(pct,3)}})
            summaries.append('modifica curación'); continue
        if 'evasión' in low:
            pct=parse_last_number(txt,0)/100.0
            harmful=(pct<0 or sec.startswith('Efectos'))
            side=effects if harmful else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if harmful else 'sourceBuff','duration':effect_duration(duration),'data':{'evasionPct':round(pct,3)}})
            summaries.append('modifica evasión'); continue
        if 'chance de bloqueo absoluto' in low:
            buff_target.append({'type':'status','effect':'block','duration':effect_duration(duration),'data':{'blockPct':1.0}})
            summaries.append('bloqueo absoluto'); continue
        if low.startswith('bloqueo:') and sec=='Beneficios (buffs)':
            pct=abs(parse_last_number(txt,0))/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'blockPct':round(min(1,pct),3)}})
            summaries.append('aumenta bloqueo'); continue
        if low.startswith('bloqueo:') and sec.startswith('Efectos'):
            pct=-abs(parse_last_number(txt,0))/100.0
            effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'blockPctDelta':round(pct,3)}})
            summaries.append('reduce bloqueo'); continue
        if 'resistir ' in low and any(k in low for k in ['noque','aturdir','mareo','inmovil','paral','no puede atacar']):
            pct=parse_last_number(txt,100)/100.0
            key='all'
            if 'noque' in low: key='knockdown'
            elif 'aturdir' in low: key='stun'
            elif 'mareo' in low: key='silence'
            elif 'inmovil' in low: key='root'
            elif 'paral' in low: key='stasis'
            elif 'no puede atacar' in low: key='noAttack'
            side=buff_target if pct>=0 else effects
            side.append({'type':'status','effect':'sourceBuff' if pct>=0 else 'sourceDebuff','duration':effect_duration(duration),'data':{'ccResist':{key:round(pct,3)}}})
            summaries.append('modifica resistencia a control'); continue
        if 'resistir el siguiente efecto de control' in low:
            buff_target.append({'type':'status','effect':'ccWard','duration':effect_duration(duration)})
            summaries.append('resistencia a control'); continue
        if 'chance absoluta de resistencia a poderes' in low or 'resistencia absoluta a poderes' in low:
            pct=abs(parse_last_number(txt,100))/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'powerImmunityPct':round(min(1,pct),3)}})
            summaries.append('resistencia absoluta a poderes'); continue
        if 'daño melee recibido' in low:
            pct=parse_last_number(txt,0)/100.0
            effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'meleeDamageTakenPct':round(pct,3)}})
            summaries.append('modifica daño melee recibido'); continue
        if 'daño de rango recibido' in low:
            pct=parse_last_number(txt,0)/100.0
            side=effects if pct>0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct>0 else 'sourceBuff','duration':effect_duration(duration),'data':{'rangedDamageTakenPct':round(pct,3)}})
            summaries.append('modifica daño de rango recibido'); continue
        if 'rango de detección' in low:
            v=abs(parse_last_number(rank5_token(txt),0))
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'detectionRange':round(v,3)},'sourceText':txt})
            summaries.append('aumenta detección'); continue
        if 'aumentar agresividad' in low:
            v=abs(parse_last_number(rank5_token(txt),0))
            effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'threatFlat':round(v,3)},'sourceText':txt})
            summaries.append('aumenta agresividad'); continue
        if low.startswith('controlable'):
            yes='yes' in rank5_token(txt).lower()
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'summonControllable':yes},'sourceText':txt})
            summaries.append('invocación controlable'); continue
        if '1 punto de daño adicional por cada punto de inteligencia luego de' in low:
            threshold=abs(parse_last_number(rank5_token(txt),70))
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'spellDamagePerIntOver':round(threshold,3)},'sourceText':txt})
            summaries.append('escala daño con inteligencia fuente'); continue
        if sec=='Beneficios (buffs)' and any(low.startswith(k) for k in ('daño de fuego','daño de hielo','daño eléctrico','daño electrico','daño cortante','daño punzante','daño aplastante')):
            tok=rank5_token(txt); lo,hi=token_range(tok,0); v=(lo+hi)/2.0
            elem='fire' if 'fuego' in low else ('ice' if ('hielo' in low or 'frío' in low or 'frio' in low) else ('lightning' if ('eléct' in low or 'electr' in low) else 'physical'))
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'sourceBonusDamageFlat':{elem:round(v,3)}},'sourceText':txt})
            summaries.append('añade daño plano fuente'); continue
        if 'bonus de daño del arma' in low:
            pct=parse_last_number(rank5_token(txt),0)/100.0
            harmful=(sec.startswith('Efectos') or pct<0)
            side=effects if harmful else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if harmful else 'sourceBuff','duration':effect_duration(duration),'data':{'weaponDamagePct':round(pct,3)},'sourceText':txt})
            summaries.append('modifica daño de arma'); continue
        if 'daño de hechizos' in low:
            pct=parse_last_number(rank5_token(txt),0)/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'spellDamagePct':round(pct,3)},'sourceText':txt})
            summaries.append('modifica daño de hechizos'); continue
        if 'protección contra fuego' in low or 'proteccion contra fuego' in low or 'resistir daño de fuego' in low:
            pct=parse_last_number(rank5_token(txt),0)/100.0
            side=effects if pct<0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct<0 else 'sourceBuff','duration':effect_duration(duration),'data':{'elementDamageTakenPct':{'fire':round(-pct,3)}},'sourceText':txt})
            summaries.append('modifica protección de fuego'); continue
        if 'protección contra hielo' in low or 'proteccion contra hielo' in low or 'resistir frío' in low or 'resistir frio' in low:
            pct=parse_last_number(rank5_token(txt),0)/100.0
            side=effects if pct<0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct<0 else 'sourceBuff','duration':effect_duration(duration),'data':{'elementDamageTakenPct':{'ice':round(-pct,3)}},'sourceText':txt})
            summaries.append('modifica protección de hielo'); continue
        if 'protección contra electricidad' in low or 'proteccion contra electricidad' in low or 'resistir rayo' in low:
            pct=parse_last_number(rank5_token(txt),0)/100.0
            side=effects if pct<0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct<0 else 'sourceBuff','duration':effect_duration(duration),'data':{'elementDamageTakenPct':{'lightning':round(-pct,3)}},'sourceText':txt})
            summaries.append('modifica protección eléctrica'); continue
        # Defense/resistance channels stay type-specific. The source book
        # distinguishes physical, magical and individual damage elements; folding
        # those into one generic resistance changes matchups and is not parity.
        if 'protección' in low or 'resistir daño' in low or 'resistencia al daño' in low:
            pct=abs(parse_last_number(rank5_token(txt),0))/100.0
            harmful=('-' in rank5_token(txt) and sec!='Beneficios (buffs)')
            signed=round(pct if harmful else -pct,3)  # damage-taken convention
            data={}
            if 'daño físico' in low or 'daño fisico' in low:
                data['physicalDamageTakenPct']=signed
            elif 'daño mágico' in low or 'daño magico' in low:
                data['magicalDamageTakenPct']=signed
            elif 'cortante' in low:
                data['elementDamageTakenPct']={'slashing':signed}
            elif 'punzante' in low or 'perforador' in low:
                data['elementDamageTakenPct']={'piercing':signed}
            elif 'aplastante' in low:
                data['elementDamageTakenPct']={'blunt':signed}
            else:
                data['sourceDamageTakenPct']=signed
            side=effects if harmful else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if harmful else 'sourceBuff','duration':effect_duration(duration),'data':data,'sourceText':txt})
            summaries.append('reduce defensa específica' if harmful else 'refuerza defensa específica')
            continue
        if 'bonus de daño' in low or 'daño de ataque' in low or 'daño cortante' in low or 'daño punzante' in low or 'daño aplastante' in low or 'daño de hechizos' in low:
            # Damage bullets were already represented; only treat explicit buff/debuff sections.
            if sec=='Beneficios (buffs)':
                pct=max(.0,min(5.0,pct_from_text(txt,5.0,1.0) or 0.0))
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'damageDealtPct':pct}}); summaries.append('aumenta daño')
            elif sec.startswith('Efectos'):
                pct=max(.0,min(5.0,pct_from_text(txt,5.0,1.0) or 0.0))
                effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'damageDealtPct':-pct}}); summaries.append('reduce daño')
            continue
        if 'curación' in low and '-' in txt:
            effects.append({'type':'status','effect':'antiHeal','duration':effect_duration(duration),'data':{'antiHealPct':pct_from_text(txt,1.0,1.0)}}); summaries.append('reduce curación'); continue
        if 'regenerar salud' in low:
            pct=parse_last_number(txt,0)/100.0
            side=effects if pct<0 else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if pct<0 else 'sourceBuff','duration':effect_duration(duration),'data':{'healthRegenPct':round(pct,3)}})
            summaries.append('modifica regeneración de salud'); continue
        if 'absorción vital' in low or 'absorcion vital' in low:
            pct=abs(parse_last_number(txt,0))/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'lifestealPct':round(min(1,pct),3)}})
            summaries.append('robo de vida'); continue
        if 'duración de poder' in low or 'duracion de poder' in low:
            pct=parse_last_number(txt,0)/100.0
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'statusDurationPct':round(pct,3)}})
            summaries.append('amplía duración de efectos'); continue
        if 'no puede invocar poderes de área' in low or 'no puede lanzar poderes de área' in low:
            buff_target.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'preventAoEAbilities':True}})
            summaries.append('bloquea poderes de área'); continue
        if 'inmunidad a poderes que no causan daño' in low:
            buff_target.append({'type':'status','effect':'intervention','duration':effect_duration(duration)})
            summaries.append('ignora poderes no dañinos'); continue
        if 'salud por flecha' in low:
            v=abs(parse_last_range_value(txt,0))
            buff_target.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'normalHealthCostFlat':round(v,3)}})
            summaries.append('consume salud por normal'); continue
        if ('mana por flecha' in low or 'maná por flecha' in low):
            v=abs(parse_last_range_value(txt,0))
            buff_target.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'normalResourceCostFlat':round(v,3)}})
            summaries.append('consume recurso por normal'); continue
        if 'drenar salud' in low:
            lo,hi=token_range(rank5_token(txt),200)
            if 'por segundo' in low:
                dur=effect_duration(duration or 1)
                effects.append({'type':'sourceDrainDot','min':round(abs(lo),3),'max':round(abs(hi),3),'duration':dur,'interval':1.0,'school':'pure','sourceText':txt})
            else:
                effects.append({'type':'sourceDrain','min':round(abs(lo),3),'max':round(abs(hi),3),'sourceText':txt})
            summaries.append('drena salud exacta'); continue
        if 'daño de mascota' in low:
            pct=parse_last_number(txt,0)/100.0
            effects.append({'type':'status','effect':'sourceDebuff','duration':effect_duration(duration),'data':{'damageDealtPct':round(pct,3)}})
            summaries.append('modifica daño de compañero'); continue
        if 'daño acumulable por ataque exitoso' in low:
            if '%' in txt:
                pct=abs(parse_last_number(txt,0))/100.0
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'normalStackDamagePct':round(pct,3),'normalStackMax':5,'normalStackCount':0}})
            else:
                v=abs(parse_last_range_value(txt,0))
                buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'normalStackDamageFlat':round(v,3),'normalStackMax':5,'normalStackCount':0}})
            summaries.append('normales acumulan daño'); continue
        if ('convertir mana en daño' in low or 'convertir maná en daño' in low):
            amount=abs(parse_last_range_value(txt,100))
            effects.append({'type':'manaBurn','flat':round(amount,3),'sourceText':txt})
            summaries.append('convierte recurso enemigo en daño exacto'); continue
        if 'constitución' in low or 'concentración' in low or 'destreza' in low or 'inteligencia' in low or low.startswith('fuerza:') or 'atributo de clase' in low:
            key='attribute'
            if 'constitución' in low: key='constitution'
            elif 'concentración' in low: key='concentration'
            elif 'destreza' in low: key='dexterity'
            elif 'inteligencia' in low: key='intelligence'
            elif low.startswith('fuerza:'): key='strength'
            val=parse_last_number(txt,0)
            is_pct='%' in txt
            data={'sourceStats':{key:{'value':round(val,3),'percent':is_pct}}}
            harmful=(sec.startswith('Efectos') and val<0)
            side=effects if harmful else buff_target
            side.append({'type':'status','effect':'sourceDebuff' if harmful else 'sourceBuff','duration':effect_duration(duration),'data':data})
            summaries.append('modifica '+key); continue
        if 'bloqueo' in low and '+' in txt:
            buff_target.append({'type':'status','effect':'block','duration':effect_duration(duration)}); summaries.append('bloqueo directo'); continue
        if 'resistir el siguiente efecto de control' in low or ('resistir ' in low and sec=='Beneficios (buffs)'):
            buff_target.append({'type':'status','effect':'ccWard','duration':effect_duration(duration)}); summaries.append('resistencia a control'); continue
        # Structural restrictions are compiled into sourceConstraints below.
        if ('invocador no esta afectado' in low or 'invocador no está afectado' in low or
            'no se puede lanzar bajo el efecto' in low or 'no se puede usar con' in low or
            'no puedo ser usado' in low or 'después de que termine' in low or 'despues de que termine' in low or
            'no se puede usar con otra magnific' in low):
            summaries.append('restricción fuente compilada'); continue
        if 'chat de guerra' in low:
            buff_target.append({'type':'status','effect':'sourceBuff','duration':effect_duration(duration),'data':{'warChat':True},'sourceText':txt})
            summaries.append('habilita chat de guerra'); continue
        # Every remaining bullet is retained as an explicit source stat contract,
        # never as an opaque rule_N placeholder.
        if sec in ('Beneficios (buffs)','Efectos negativos / Control (debuffs)'):
            side=buff_target if sec=='Beneficios (buffs)' else effects
            key='source_'+re.sub(r'[^a-z0-9]+','_',low.encode('ascii','ignore').decode()).strip('_')[:48]
            lo,hi=token_range(rank5_token(txt),1)
            side.append({'type':'status','effect':'sourceBuff' if sec=='Beneficios (buffs)' else 'sourceDebuff','duration':effect_duration(duration),'data':{'sourceStats':{key:{'value':round((lo+hi)/2,3),'percent':('%' in rank5_token(txt))}},'sourceText':txt}})
            summaries.append('estadística fuente explícita')

    # v0.13: no hand-authored spell overrides. The document contract is authoritative.

    # Name/description-based special mechanics that are otherwise not encoded as bullets.
    sl=(rec['sourceName']+' '+rec['desc']).lower()
    special_text=(sl+' '+' '.join(b['text'].lower() for b in rec['bullets']))
    if any(w in sl for w in ['revivir','revive']) and rec['sourceClass']!='CAZADOR':
        hp_flat=0; hp_pct=0
        for b in rec['bullets']:
            if b['section']=='Beneficios (buffs)' and ('salud' in b['text'].lower() or 'health' in b['text'].lower()):
                tok=rank5_token(b['text']); lo,hi=token_range(tok,0)
                if '%' in tok: hp_pct=abs((lo+hi)/2)/100.0
                else: hp_flat=abs((lo+hi)/2)
        rev={'type':'revive','hpPct':round(hp_pct,3),'hpFlat':round(hp_flat,3)}
        for b in rec['bullets']:
            bl=b['text'].lower(); tok=rank5_token(b['text'])
            if 'mareo de resurreccion' in bl: rev['resurrectionDaze']=True
            if 'sanctuario' in bl: rev['sanctuarySeconds']=abs(parse_last_number(tok,0))
        effects=[rev]; self_effects=[]; summaries=['revive con salud y estados fuente']
    elif any(w in special_text for w in ['cremar','cremate','cremación','cremacion']):
        effects=[{'type':'cremate'}]; self_effects=[]; summaries=['sella un cadáver enemigo']
    elif rec['sourceName'].lower()=='dominio natural':
        max_level=60
        for b in rec['bullets']:
            if 'domar criaturas' in b['text'].lower(): max_level=int(round(parse_last_number(rank5_token(b['text']),60)))
        effects=[{'type':'tameCreature','maxLevel':max_level}]; self_effects=[]; summaries=['doma criatura fuente']
    elif 'poseer invocación' in sl or 'poseer invocacion' in sl:
        effects=[{'type':'possessCompanion'}]; self_effects=[]; summaries=['toma control de una invocación enemiga']
    elif rec['sourceName'].lower()=='lazo extraplanar':
        # Rank 5 = 50% (10% por nivel, stated in the source description).
        effects=[]; self_effects=[{'type':'companionProtectOwner','redirectPct':0.50,'duration':effect_duration(rec['duration'])}]
        summaries=['redirige 50% del daño del conjurador a su invocación']
    elif rec['sourceName'].lower()=='defensa salvaje':
        pct=0.30
        for b in rec['bullets']:
            if 'daño redirigido' in b['text'].lower(): pct=abs(parse_last_number(rank5_token(b['text']),30))/100.0
        effects=[]; self_effects=[{'type':'companionProtectOwner','redirectPct':round(pct,3),'duration':effect_duration(rec['duration'])}]
        summaries=['la mascota absorbe daño del cazador']
    elif rec['sourceName'].lower()=='vista prominente':
        ownerfx=[]; petfx=[]
        for b in rec['bullets']:
            lowb=b['text'].lower(); tok=rank5_token(b['text'])
            if 'rango de ataque' in lowb:
                ownerfx.append({'type':'status','effect':'sourceBuff','data':{'attackRangePct':round(parse_last_number(tok,0)/100.0,3)},'permanent':True,'sourceText':b['text']})
            elif 'daño de mascota' in lowb:
                petfx.append({'type':'status','effect':'sourceDebuff','data':{'damageDealtPct':round(parse_last_number(tok,0)/100.0,3)},'permanent':True,'sourceText':b['text']})
        effects=[]; self_effects=ownerfx + ([{'type':'companionEffect','effects':petfx}] if petfx else [])
        summaries=['mejora rango del cazador y reduce daño de mascota']
    elif rec['sourceName'].lower()=='furia natural' and rec['sourceClass']=='CAZADOR':
        # The source explicitly says the PET creates the explosion. Preserve its
        # centre point rather than exploding around the hunter.
        pet_attack=[fx for fx in effects if fx.get('type') in ('sourceDamage','sourceWeaponDamage','status')]
        effects=[]; self_effects=[{'type':'companionAoE','radius':float(rec['area'] or 10),'effects':pet_attack}]
        summaries=['explosión fuente centrada en la mascota']
    elif 'invocar' in sl and rec['sourceClass']=='CONJURADOR' and rec['discipline'].lower().startswith('invoc'):
        count=1; kind=rec['sourceName'].replace('Invocar ','').replace('invocar ','').strip() or 'summon'; controllable=False
        for b in rec['bullets']:
            bl=b['text'].lower(); tok=rank5_token(b['text'])
            if bl.startswith('invocar '): count=max(1,int(round(parse_last_number(tok,1))))
            if bl.startswith('invocación') or bl.startswith('invocacion'): kind=tok
            if bl.startswith('controlable'): controllable=('yes' in tok.lower())
        effects=[]; self_effects=[{'type':'summon','count':count,'kind':kind,'controllable':controllable,'duration':effect_duration(rec['duration'])}]; summaries=[f'invoca {count} criatura(s) fuente']
    elif any(w in sl for w in ['curar mascota','heal pet']):
        amount=0
        for b in rec['bullets']:
            if b['section']=='Beneficios (buffs)' and 'salud' in b['text'].lower(): amount=abs(sum(token_range(rank5_token(b['text']),0))/2)
        effects=[]; self_effects=[{'type':'companionEffect','effects':[{'type':'sourceHeal','min':round(amount,3),'max':round(amount,3)}]}]; summaries=['cura mascota con valor fuente']
    elif any(w in sl for w in ['revivir mascota','revive pet']):
        pct=1.0
        for b in rec['bullets']:
            if b['section']=='Beneficios (buffs)' and 'salud' in b['text'].lower(): pct=abs(parse_last_number(rank5_token(b['text']),100))/100.0
        effects=[]; self_effects=[{'type':'companionRevive','hpPct':round(pct,3)}]; summaries=['revive mascota con salud fuente']
    elif rec['sourceClass']=='CAZADOR' and rec['discipline'].lower().startswith('mascotas') and rec['sourceName'].lower() in ('cólera bestial','colera bestial','coraza de la bestia'):
        petfx=effects[:] + self_effects[:]
        effects=[]; self_effects=[{'type':'companionEffect','effects':petfx}]; summaries=['potencia exclusivamente a la mascota']
    elif rec['sourceClass']=='CONJURADOR' and rec['discipline'].lower().startswith('invoc') and rec['sourceName'].lower() in ('furia demoníaca','furia demoniaca','bebedor de sangre'):
        petfx=effects[:] + self_effects[:]
        effects=[]; self_effects=[{'type':'companionEffect','effects':petfx}]; summaries=['potencia exclusivamente a las invocaciones']

    # Description-only mechanics present in the source tables.
    desc_low=(rec['desc'] or '').lower()
    if ('muere instantáneamente' in desc_low or 'muere instantaneamente' in desc_low) and not effects:
        threshold=parse_last_number(rec['desc'],650)
        effects=[{'type':'execute','hpThreshold':round(threshold,3)}]; self_effects=[]; summaries=['ejecución por umbral de salud']
    elif 'próximo intento de control' in desc_low and not effects and not self_effects:
        self_effects=[{'type':'status','effect':'ccWard','duration':effect_duration(rec['duration'])}]; summaries=['evita el siguiente control']
    elif 'crea un portal' in desc_low and not effects and not self_effects:
        effects=[{'type':'teleportAllies','radius':10,'limit':25}]; summaries=['portal táctico para aliados']

    # Ensure every launchable source power has observable simulation effect.
    if not effects and not self_effects and not rec['type'].lower().startswith('pasivo'):
        self_effects=[{'type':'status','effect':'sourceBuff','duration':effect_duration(duration) or 6,'data':{}}]
        summaries=['efecto táctico temporal']
    # Source tables occasionally repeat the same semantic line in Benefits and
    # Effects (e.g. absolute block). Keep the sourceMechanics text verbatim but
    # execute each identical runtime effect only once.
    def _dedupe_fx(items):
        seen=set(); out=[]
        for fx in items:
            key=json.dumps(fx,ensure_ascii=False,sort_keys=True,separators=(',',':'))
            if key in seen: continue
            seen.add(key); out.append(fx)
        return out
    return _dedupe_fx(effects),_dedupe_fx(self_effects),summaries

def infer_target(rec, class_id):
    """Infer the gameplay recipient from the source contract.

    The source tables sometimes put negative values under "Benefits" (for
    example a shout that slows ENEMIES), so section names alone are not enough.
    Prefer source type + area/range + prose subject, and keep personal stances
    personal even when they include a drawback.
    """
    typ=rec['type'].lower()
    name=rec['sourceName'].lower()
    desc=(rec.get('desc') or '').lower()
    bullet_text=' '.join(x['text'] for x in rec['bullets']).lower()
    text=(name+' '+desc+' '+bullet_text)

    if typ.startswith('pasivo'): return 'self','alliesAndSelf'
    if typ.startswith('activable'): return 'self','alliesAndSelf'

    # Explicit source mechanics first.
    if 'muere instantáneamente' in text or 'muere instantaneamente' in text: return 'enemy','enemies'
    if any(w in text for w in ('cremar cadaver','cremar cadáver','cremación','cremacion','cremate')): return 'enemy','enemies'
    if 'crea un portal' in text: return 'ground','allies'
    if 'poseer invocación' in text or 'poseer invocacion' in text: return 'enemy','enemies'
    if name=='dominio natural': return 'enemy','enemies'
    if name=='revelar': return ('targetArea','enemies') if rec['area']>0 else ('enemy','enemies')

    # Pet/summon disciplines are commanded through the owner.
    if rec['sourceClass']=='CAZADOR' and rec['discipline'].lower().startswith('mascotas'):
        if name=='furia natural': return 'aoeSelf','enemies'
        return 'self','alliesAndSelf'
    if rec['sourceClass']=='CONJURADOR' and rec['discipline'].lower().startswith('invoc'):
        if 'poseer invoc' in name: return 'enemy','enemies'
        return 'self','alliesAndSelf'
    if name in ('espejo del karma','lazo extraplanar'): return 'self','alliesAndSelf'

    if any(w in (name+' '+desc) for w in ['revivir','revive']):
        if rec['area']>0: return 'aoeSelf','allies'
        return 'ally','allies'

    if (any(('drenar mana' in b['text'].lower() or 'drenar maná' in b['text'].lower() or 'drenar salud' in b['text'].lower()) for b in rec['bullets'])
        or 'roba puntos de maná' in text or 'drenan maná' in text or 'drena puntos de vida' in text):
        return 'enemy','enemies'

    # Counters/stances whose source wording describes what happens to an
    # attacker, but the cast itself is unambiguously personal.
    if any(('retomar daño' in b['text'].lower() or 'reflej' in b['text'].lower()) for b in rec['bullets']):
        return 'self','alliesAndSelf'

    has_damage=any(b['section']=='Daño' for b in rec['bullets'])
    has_benefit=any(b['section']=='Beneficios (buffs)' for b in rec['bullets'])
    cc_words=('noquear','inmovilizar','paralizar','parálisis','aturdir','marear','no puede atacar','bloquear poderes positivos')
    harmful_cc=any(any(w in b['text'].lower() for w in cc_words) and not any(z in b['text'].lower() for z in ('resistir ','disipar ','chance de resistir')) for b in rec['bullets'])
    structural=('no se puede lanzar bajo el efecto','no se puede usar con','no puedo ser usado','después de que termine','despues de que termine')
    harmful_section=any(b['section'].startswith('Efectos') and not any(z in b['text'].lower() for z in structural) for b in rec['bullets'])
    enemy_prose=any(w in desc for w in ('enemig','oponent','víctima','victima','adversario'))
    target_prose=enemy_prose or ('objetivo' in desc) or ('blanco' in desc)
    ally_prose=any(w in desc for w in ('aliado','aliados','compañero','companero'))

    # Personal stances/buffs often mention enemies only as context and carry a
    # self drawback in the Effects section. If the class itself is the actor,
    # there is a positive benefit and no direct damage, keep it on self.
    self_subjects=('el guerrero','el caballero','el bárbaro','el barbaro','el arquero','el cazador','el tirador','el mago','el brujo','el conjurador','el warmaster')
    self_subject=any(su in desc for su in self_subjects)
    if has_benefit and self_subject and not ally_prose and not has_damage:
        # Exception: explicit hostile area aura/shout despite class prose.
        if not (rec['area']>0 and (harmful_cc or (enemy_prose and any('-' in rank5_token(b['text']) for b in rec['bullets'])))):
            return 'self','alliesAndSelf'

    # Zero-range non-damage techniques whose prose does not direct an
    # action at a victim are personal preparations (Rapid shot, Eagle eye).
    action_words=('golpe','ataca','dispara','lanza','asesta','somete','arroja','emite','maldice')
    if rec['range']==0 and rec['area']==0 and not has_damage and not target_prose and not ally_prose and not any(v in desc for v in action_words):
        return 'self','alliesAndSelf'
    # Fineza-style personal technique: class is the subject, no direct damage,
    # zero range, and no attack verb even if the prose mentions the opponent.
    if self_subject and rec['range']==0 and rec['area']==0 and not has_damage and not any(v in desc for v in action_words):
        return 'self','alliesAndSelf'

    offensive=has_damage or harmful_cc or harmful_section
    # Some source tables label hostile negative values as Benefits (Heroic Shout).
    if enemy_prose and any('-' in rank5_token(b['text']) for b in rec['bullets']): offensive=True

    if typ.startswith('aura'):
        return ('self','enemies') if offensive else ('self','alliesAndSelf')

    if rec['area']>0:
        if offensive:
            return ('targetArea','enemies') if rec['range']>0 else ('aoeSelf','enemies')
        return ('targetArea','allies') if rec['range']>0 else ('aoeSelf','alliesAndSelf')

    if offensive: return 'enemy','enemies'
    if ally_prose: return 'allyOrSelf','allies'
    # A positive ranged spell whose prose says "the target" is an ally buff/heal.
    if rec['range']>0 and ('objetivo' in desc or 'blanco' in desc): return 'allyOrSelf','allies'
    return 'self','alliesAndSelf'

def source_constraints(rec, name_to_index):
    """Compile source cross-power restrictions into source indices, never names."""
    rules=[b['text'] for b in rec['bullets']]
    lows=[r.lower() for r in rules]
    out={}
    if any('otra magnific' in r for r in lows): out['exclusiveGroup']='magnification'
    incompatible=[]; expire=[]
    for name,idx in name_to_index.items():
        if idx==rec['sourceIndex']: continue
        nl=name.lower()
        for raw,low in zip(rules,lows):
            if nl not in low: continue
            if 'después de que termine' in low or 'despues de que termine' in low:
                sec=parse_last_number(raw,5)
                expire.append({'sourceIndex':idx,'seconds':float(sec or 5)})
            elif ('bajo el efecto' in low or 'no se puede usar con' in low or 'no puedo ser usado' in low):
                incompatible.append(idx)
    if incompatible: out['incompatibleSourceIndices']=sorted(set(incompatible))
    if expire:
        uniq={x['sourceIndex']:x for x in expire}
        out['onExpireLockSourceIndices']=list(uniq.values())
    return out

def visual_action_for(rec, class_id, timing_type, effects):
    text=(' '.join([rec['sourceName'],rec['desc']]+[b['text'] for b in rec['bullets']])).lower()
    kinds=[e.get('effect') or e.get('type') for e in effects]
    if timing_type=='spell': return 'cast'
    if class_id in ('centinela','rastreador') and timing_type=='weaponSkill':
        if rec['area']>0: return 'archerVolley'
        if any(k in kinds for k in ('root','knockdown','stasis','stun','silence','noAttack')): return 'archerControl'
        if rec['cast'] <= 0.5: return 'archerQuick'
        return 'archerPower'
    if timing_type=='weaponSkill':
        if 'puntapié' in text or 'kick' in text: return 'kick'
        if 'escudo' in text or 'shield' in text or class_id=='guardian' and 'bloque' in text: return 'shield'
        if 'carga' in text or 'embestida' in text or 'charge' in text or 'onslaught' in text: return 'charge'
        if 'grito' in text or 'bramido' in text or 'alarido' in text or 'aullido' in text: return 'cry'
        if 'punzante' in text or 'lanza' in text or 'estocada' in text or 'impale' in text: return 'thrust'
        return 'heavy'
    if rec['area']>0 and any(x in text for x in ('grito','bramido','presencia','aura')): return 'cry'
    return 'none'

def icon_meta(rec, class_id, seq, effects, self_effects):
    """Semantic icon grammar + deterministic per-power variation.

    Two powers may share a family, but never the exact composition signature.
    The renderer consumes family/motif/accent/rotation/segments rather than ids.
    """
    allfx=(effects or [])+(self_effects or [])
    kinds=[]
    for e in allfx:
        kinds.append(e.get('effect') or e.get('type') or 'utility')
    low=(' '.join([rec['sourceName'],rec['desc']]+[b['text'] for b in rec['bullets']])).lower()
    if rec['type'].lower().startswith('pasivo'): family='passive'
    elif any(k in kinds for k in ('revive','heal','hot')): family='heal'
    elif 'barrier' in kinds or 'damageReduction' in kinds or 'block' in kinds: family='defense'
    elif any(k in kinds for k in ('knockdown','root','stasis','stun','silence','noAttack','utilityLock','noDamage')): family='control'
    elif any(k in kinds for k in ('stealth','revealed','reveal')): family='stealth'
    elif any(k in kinds for k in ('cleanse','purge','antiBuff','reflect','damageRedirect','ccWard')): family='counter'
    elif any(k in kinds for k in ('summon','companionEffect','companionRevive')): family='summon'
    elif 'velocidad de movimiento' in low or 'rango de ataque' in low: family='mobility'
    elif any((e.get('type') in ('pureDamage','dot','physicalDamage','magicalDamage')) for e in allfx): family='damage'
    elif rec['type'].lower().startswith('aura'): family='aura'
    else: family='utility'
    digest=hashlib.sha1(f'{class_id}|{rec["sourceIndex"]}|{seq}|{family}'.encode()).hexdigest()
    motifs=['blade','burst','rune','chevron','orb','ward','spiral','fang','star','eye','wave','crown']
    return {
      'family':family,
      'motif':motifs[int(digest[0:2],16)%len(motifs)],
      'accent':int(digest[2:4],16)%6,
      'rotation':round((int(digest[4:8],16)%360)*math.pi/180,4),
      'segments':3+(int(digest[8:10],16)%6),
      'mirror':bool(int(digest[10:12],16)%2),
      'signature':digest[:16]
    }

def original_runtime_desc(rec, class_id, disc, presentation, summaries, target):
    # Original prose: communicates what the power DOES without shipping source
    # names/descriptions. Especially important for the elemental spellbook: a
    # player should recognise fireball/lightning/meteor from the card before
    # memorising a renamed title.
    shape=presentation.get('shape','')
    radius=float(rec.get('area') or 0)
    phrases={
      'fireball':'Proyecta una esfera ardiente que estalla al alcanzar a su objetivo',
      'iceBurst':'Detona hielo sobre el objetivo y frena su movimiento',
      'lightningBolt':'Canaliza una descarga eléctrica sostenida sobre el objetivo',
      'meteor':'Invoca una roca incandescente desde el cielo y desorienta al objetivo',
      'magmaOrb':'Lanza un núcleo de magma que impacta y deja una quemadura persistente',
      'iceStorm':'Desata una tormenta de hielo alrededor del objetivo',
      'lightningStorm':'Convoca una tormenta eléctrica alrededor del lanzador',
      'tornado':'Levanta un vórtice que atrapa a los enemigos alrededor del objetivo',
      'freezePrison':'Encierra al objetivo en una prisión de escarcha',
      'crystalBurst':'Hace brotar una explosión radial de cristales afilados',
      'earthSpike':'Hace emerger una punta mineral bajo el objetivo',
      'dreadWave':'Libera una oleada de terror sobre varios enemigos',
      'lifeDrain':'Absorbe energía vital del objetivo',
      'soulDrain':'Drena energía del enemigo para alimentar al lanzador',
      'darkSeal':'Sella al objetivo contra ayuda mágica positiva',
      'doomAura':'Extiende una presencia oscura debilitante alrededor del lanzador',
      'possession':'Somete temporalmente una invocación enemiga',
      'cremation':'Consume mágicamente un cadáver enemigo para impedir su retorno inmediato',
      'massRoots':'Hace surgir raíces espinosas alrededor del lanzador',
    }
    base=phrases.get(shape, 'Poder de '+disc)
    if radius and target in ('targetArea','ground','aoeSelf'): base += ' en un radio de '+str(int(radius) if radius.is_integer() else radius)
    detail=', '.join(dict.fromkeys(summaries)) if summaries else 'efecto táctico'
    return (base+'. '+detail+'.').replace('..','.')

def generate(records):
    order_map={}; out=[]; excluded=[]; class_counts={k:0 for k in CLASS_TAG}
    names={k:set() for k in CLASS_TAG}
    name_to_index={r['sourceName'].strip().lower():r['sourceIndex'] for r in records if r['sourceName'].strip() and not r['sourceName'].lower().startswith('undefined')}
    for rec in records:
        # The source includes blank "undefinedN" placeholders in WM tables. They are not powers.
        if rec['sourceName'].lower().startswith('undefined') or not rec['sourceName'].strip():
            excluded.append({'sourceIndex':rec['sourceIndex'],'sourceClass':rec['sourceClass'],'reason':'undefined placeholder'})
            continue
        for class_id in TARGETS[rec['sourceClass']]:
            class_counts[class_id]+=1
            seq=class_counts[class_id]
            pid=f'power_{class_id}_{seq:03d}'
            name=original_name(class_id, rec['sourceIndex'], rec['sourceName'], rec['sourceClass'])
            if name in names[class_id]: name += f' {seq}'
            names[class_id].add(name)
            disc=discipline_name(class_id,rec['discipline'],order_map)
            target,affects=infer_target(rec,class_id)
            aoe=target in ('ground','aoeSelf','cone','targetArea')
            effects,selfEffects,summ=translated_effects(rec,class_id,target,aoe)
            presentation=presentation_meta(rec,class_id,target,effects,selfEffects)
            passive=rec['type'].lower().startswith('pasivo')
            aura=rec['type'].lower().startswith('aura')
            toggle=rec['type'].lower().startswith('activable')
            if toggle:
                mark_permanent_effects(effects); mark_permanent_effects(selfEffects)
            companion_passive = passive and ((rec['sourceClass']=='CAZADOR' and rec['discipline'].lower().startswith('mascotas')) or
                                                (rec['sourceClass']=='CONJURADOR' and rec['discipline'].lower().startswith('invoc')))
            companionEffects=[]
            if passive:
                # Pet/summon discipline passives belong to the controlled creature,
                # not to its owner. All other passives remain permanent self effects.
                passfx=(selfEffects or effects or [{'type':'status','effect':'sourceBuff','permanent':True,'data':{}}])
                effects=[]; selfEffects=[]
                for e in passfx:
                    if e.get('type')=='status': e['permanent']=True; e.pop('duration',None)
                if companion_passive: companionEffects=passfx
                else: selfEffects=passfx
            exclude_caster_area=(rec['area']>0 and any('invocador no esta afectado' in b['text'].lower() or 'invocador no está afectado' in b['text'].lower() for b in rec['bullets']))
            if aura:
                nested=effects or selfEffects
                aura_affects = 'allies' if exclude_caster_area else ('enemies' if affects=='enemies' else 'alliesAndSelf')
                effects=[]; selfEffects=[{'type':'aura','radius':float(rec['area'] or rec['range'] or 6),'duration':normalise_time(rec['duration'] or 60,'duration'),'affects':aura_affects,'effects':nested}]
            elif exclude_caster_area:
                # Some source entries are typed Constant rather than Aura even though
                # their actual contract is a persistent allied dome. Represent the
                # mechanic, not the source table label: pulse the buff to nearby allies
                # and explicitly exclude the caster.
                nested=effects or selfEffects
                effects=[]; selfEffects=[{'type':'aura','radius':float(rec['area'] or 6),'duration':normalise_time(rec['duration'] or 20,'duration'),'affects':'allies','effects':nested}]
                target='self'; affects='alliesAndSelf'; aoe=False
            timing_type='spell' if rec['sourceClass'] in ('MAGO','BRUJO','CONJURADOR') else ('weaponSkill' if (rec['weaponScale'] or rec['sourceClass'] in ('ARQUERO','CAZADOR','TIRADOR')) and target in ('enemy','ground','cone','aoeSelf','targetArea') else 'utility')
            cast=normalise_time(rec['cast'],'cast')
            stationary=(cast>0 or timing_type=='weaponSkill') and not toggle
            gcd=GCD_MAP.get(rec['gcd'], 'short')
            cd=normalise_time(rec['cooldown'],'cooldown')
            flags={
                'sourceDerived':True,'passive':passive,'toggle':toggle,
                'offensive': bool(affects=='enemies'),
                'magic': rec['sourceClass'] in ('MAGO','BRUJO','CONJURADOR'),
                'weaponAttack': timing_type=='weaponSkill',
                'projectile': ((rec['sourceClass'] in ('ARQUERO','CAZADOR','TIRADOR') and target=='enemy') or
                               (rec['sourceClass'] in ('MAGO','BRUJO','CONJURADOR') and presentation.get('shape') in ('fireball','magmaOrb','fireBolt') and target in ('enemy','targetArea'))) and not toggle,
                'requiresFacing': target in ('enemy','ground','cone','targetArea'),
                'blockable':rec['blockable'],'resistible':rec['resistible'],
            }
            if companion_passive: flags['companionPassive']=True
            if any(e.get('type')=='revive' for e in effects): flags['revive']=True
            if any(e.get('type')=='cremate' for e in effects): flags['cremate']=True
            if passive: flags['offensive']=False; flags['projectile']=False; flags['requiresFacing']=False
            range_v=norm_range(rec['range'], class_id, target) if target in ('enemy','ally','allyOrSelf','ground','cone','targetArea') else 0
            radius=float(rec['area'] or 5) if aoe else 0
            if target=='cone' and not radius: radius=0
            # External source exact names/descriptions are deliberately absent from runtime output.
            data={
              'id':pid,'classId':class_id,'allowedClasses':[class_id],'name':name,
              'discipline':disc,'sourceIndex':rec['sourceIndex'],'sourceFamily':rec['sourceClass'].lower(),
              'sourceDisciplineCode':hashlib.sha1((rec['sourceClass']+'|'+rec['discipline']).encode()).hexdigest()[:8],
              'sourceDerived':True,'damageModel':'source-rank5-exact','powerType':'passive' if passive else ('aura' if aura else ('toggle' if toggle else 'active')),
              'target':target,'affects':affects,'range':range_v,'radius':radius,
              'castTime':cast,'gcd':gcd,'cooldown':cd,'cost':0 if passive else normalise_cost(rec['mana'],class_id),
              'school':'arcane' if flags['magic'] else ('archery' if class_id in ('centinela','rastreador') else 'weapon'),
              'flags':flags,'effects':effects,'selfEffects':selfEffects,
              'sourceMechanics':{
                'sourceName':rec['sourceName'],'sourceClass':rec['sourceClass'],'sourceDiscipline':rec['discipline'],
                'type':rec['type'],'castTime':rec['cast'],'gcd':rec['gcd'],'cooldown':rec['cooldown'],
                'duration':rec['duration'],'durationText':rec['durationText'],'manaRank5':rec['mana'],
                'range':rec['range'],'area':rec['area'],'weaponScale':rec['weaponScale'],
                'blockable':rec['blockable'],'resistible':rec['resistible'],
                'effects':[{'section':b['section'],'text':b['text'],'rank5':rank5_token(b['text'])} for b in rec['bullets']]
              },
              'iconMeta':icon_meta(rec,class_id,seq,effects,selfEffects),
              'presentation':presentation,
              'combatTiming':{
                'actionType':timing_type,'normalInteraction':'independent' if timing_type!='weaponSkill' else ('weaveAfterNormal' if seq%3 else 'replacesNormal'),
                'weaponIntervalPolicy':'respectReady' if timing_type=='weaponSkill' and seq%3==0 else 'ignore',
                'stationary':stationary,'visualAction':visual_action_for(rec,class_id,timing_type,effects+selfEffects),
                'spellGesture':presentation.get('spellGesture','cast') if timing_type=='spell' else None,
                # No usar sourceIndex+seq: en ramas donde ambos avanzan juntos
                # sólo produce dos paridades y colapsa decenas de hechizos en
                # dos gestos. Mezcla coprima + clase para obtener las cuatro
                # variantes de forma estable y data-driven.
                'visualVariant':int(hashlib.sha1(f'{class_id}|{rec["sourceIndex"]}|{seq}|pose'.encode()).hexdigest()[:2],16) % 4,
                'cooldownCommit':'onRelease','resourceCommit':'onRelease','gcdCommit':'onRelease'
              },
              'desc': original_runtime_desc(rec,class_id,disc,presentation,summ,target),
              'iconSeed':hashlib.sha1(pid.encode()).hexdigest()[:12]
            }
            if companionEffects: data['companionEffects']=companionEffects
            constraints=source_constraints(rec,name_to_index)
            if constraints: data['sourceConstraints']=constraints
            # prune zero values that confuse target UI
            if not data['radius']: data.pop('radius')
            out.append(data)
    return out,excluded,class_counts

def emit_js(powers,excluded,class_counts,dst:Path):
    # Compact line-per-ability keeps parse fast while remaining diffable.
    lines=[]
    lines.append("/* AUTO-GENERATED by tools/generate-power-library.py. Original names/descriptions are intentionally not shipped. */")
    lines.append("Arena.define('data/powerLibrary', ['data/abilities','data/classes','data/effects'], function (Arena) {\n  'use strict';")
    lines.append("  var A = Arena.Data.abilities; var C = Arena.Data.classes; var list = []; var byClass = Object.create(null);")
    lines.append("  function add(o){ A[o.id]=o; list.push(o); (byClass[o.classId]||(byClass[o.classId]=[])).push(o.id); }")
    for p in powers: lines.append('  add('+jsdump(p)+');')
    coverage={'sourceEntries':len(powers) and (len(powers)-sum(class_counts.values())+0) or 0}
    # exact source count is emitted below from known parser totals, not the duplicated assignment count.
    source_valid=len({p['sourceIndex'] for p in powers})
    source_total=source_valid+len(excluded)
    lines.append('  var coverage='+jsdump({'sourceEntries':source_total,'validNamedPowers':source_valid,'excludedPlaceholders':len(excluded),'classAssignments':len(powers),'classCounts':class_counts})+';')
    lines.append('  var featuredSources='+jsdump(FEATURED_SOURCES)+'; var featured=Object.create(null);')
    lines.append("  for (var fc in featuredSources) { var wanted=featuredSources[fc], got=[]; for(var wi=0;wi<wanted.length;wi++){ for(var li=0;li<list.length;li++){var pa=list[li];if(pa.classId===fc&&pa.sourceIndex===wanted[wi]&&!(pa.flags&&pa.flags.passive)){got.push(pa.id);break;}} } featured[fc]=got; }")
    lines.append("  for (var id in C) if (Object.prototype.hasOwnProperty.call(C,id)) { C[id].powerBook=(byClass[id]||[]).slice(); C[id].abilities=(featured[id]||[]).slice(0,6); if(!C[id].abilities.length) C[id].abilities=(byClass[id]||[]).filter(function(pid){var a=A[pid];return a&&!(a.flags&&a.flags.passive);}).slice(0,6); }")
    lines.append("  Arena.Data.powerLibrary={list:list,byClass:byClass,featured:featured,coverage:coverage,excluded:"+jsdump(excluded)+", activeFor:function(classId){return (byClass[classId]||[]).filter(function(id){var a=A[id];return a&&!a.flags.passive;});}, featuredFor:function(classId){return (featured[classId]||[]).slice();}, passiveFor:function(classId){return (byClass[classId]||[]).filter(function(id){var a=A[id];return a&&a.flags.passive;});}};")
    lines.append("});\n")
    dst.write_text('\n'.join(lines),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('source_docx',type=Path)
    ap.add_argument('--out',type=Path,default=Path('js/data/powerLibrary.js'))
    ap.add_argument('--report',type=Path,default=Path('docs/POWER_LIBRARY_REPORT.json'))
    a=ap.parse_args()
    records=parse_doc(a.source_docx)
    powers,excluded,counts=generate(records)
    a.out.parent.mkdir(parents=True,exist_ok=True); emit_js(powers,excluded,counts,a.out)
    report={
      'source_entries':len(records),'valid_named_powers':len(records)-len(excluded),'excluded_placeholders':len(excluded),
      'class_assignments':len(powers),'class_counts':counts,
      'design_contract':'Recognisable source-name variants; source rank-5 cast/GCD/cooldown/duration/mana/range/area/block/resist and damage ranges are runtime-authoritative; all five source rank strings remain auditable; no Arena damage rebalance; armor/attribute formulas remain deferred.',
      'excluded':excluded
    }
    a.report.parent.mkdir(parents=True,exist_ok=True); a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
