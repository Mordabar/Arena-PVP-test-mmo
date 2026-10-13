#!/usr/bin/env node
/** Original native vector art for CoRT data. Run: node tools/generate-trainer-presentation.mjs path/to/trainerdata.json
 * The 30 undefined WM slots are deliberately NOT fictional powers. SVGs need no paid service.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.argv[2]||path.join(root,'js/data/trainerdata.json');
const trainer=JSON.parse(fs.readFileSync(source,'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const names={
'Short Bows':['Disparo gemelo','Cadencia vertiginosa','Flecha del cepo','Paso de pluma','Meditación del vigía','Instinto versátil','Herida abierta','Maestro del duelo','Lastre del cazador','Salva de repetición'],
'Long Bows':['Saeta rompeescudos','Arco parabólico','Maniobra del viento','Ojo del águila real','Disparo certero','Vigía omnipresente','Impacto desgarrador','Especialista del arco','Velo de confusión','Lluvia de saetas'],
'Tricks':['Emboscada del acechador','Golpe de sorpresa','Puño del aturdimiento','Eco de represalia','Contacto viscoso','Combate tramposo','Fineza del tirador','Centinela nocturno','Flecha de distracción','Saeta de abrojos'],
'Evasion':['Esquiva fugaz','Paso veloz','Arte de la evasión','Reflejo de pantera','Acrobacia del viento','Fuga de hechizos','Escapista de sombras','Ingenio alerta','Silueta discreta','Heredero del vendaval'],
'Scouting':['Flecha de zarzas','Sentencia del acechador','Vigilia enemiga','Espíritu indómito','Manto de camuflaje','Ligereza ancestral','Instinto de sangre fría','Revelación del rastreador','Desconcierto','Territorio del acechador'],
'Pets':['Pacto de la naturaleza','Caricia revitalizante','Guardia de la bestia','Mirada del depredador','Disciplina del vínculo','Retorno del compañero','Ira del colmillo','Coraza de corteza','Furia del bosque','Piel del depredador'],
'Arrow Mastery':['Saetas sobrecargadas','Oleada de invierno','Ráfaga del vendaval','Colmillo de serpiente','Quemadura de Ignus','Saeta del éter','Estallido de agujas','Proyectil astral','Diluvio de brasas','Flecha de la tempestad'],
'Aiming Mastery':['Mirada mortífera','Foco del tirador','Saeta perforante','Visión anticipada','Maleficio del cíclope','Impacto letal','Bastión estratégico','Ojo experto','Disparo rastreador','Mirada del halcón real'],
'Mental':['Misil de la mente','Enjambre voraz','Llamarada psíquica','Repulsión mental','Hiedra del tormento','Dominio psíquico','Sello del silencio','Muralla de espinas','Señor del instante','Masa de la vorágine'],
'Mana Control':['Barrera del éter','Combustión de maná','Lazo sinérgico','Sangre dracónica','Préstamo del éter','Sacrificio del ambicioso','Devoción astral','Reserva de maná','Comunión del éter','Obelisco de maná'],
'Staff Mastery':['Bastón de las brasas','Aceleración astral','Proyección del éter','Arte del bastón','Campo de estática','Bastón de escarcha','Cúpula del guardián','Control del pulso','Bastón de la tormenta','Furia del firmamento'],
'Enchantments':['Maleficio de ruina','Agilidad de pantera','Velo de ceguera','Bendición del alba','Vigor del oso','Arma consagrada','Disipación astral','Ingenio del zorro','Lastre de torpeza','Purga de encantamientos'],
'Life':['Alivio del compañero','Aliento vital','Retorno del alma','Renuevo fraterno','Renuevo interior','Mano de la providencia','Custodio de la vida','Flujo de renovación','Oleada de sanación','Retorno de los caídos'],
'Summon':['Círculo de diablillos','Vínculo del otro plano','Heraldo demoníaco','Vínculo de materia','Legión de los marchitos','Rabia del abismo','Guardián de piedra','Coraza del invocado','Sed del invocado','Señor del sepulcro'],
'Sorcery':['Coraza del éter','Figura cambiante','Escudo fraterno','Mente vacía','Espejo del destino','Barrera de sortilegios','Muralla corpórea','Refugio sagrado','Visión interior','Dermis de acero'],
'Arcania':['Aguja de piedra','Lastre temporal','Manos de granito','Sopor arcano','Meteorito del caos','Muralla del vendaval','Fragmentación cristalina','Marca de fragilidad','Puño del titán','Terror del vacío'],
'Necromancy':['Mordisco vampírico','Manto de oscuridad','Ira impuesta','Sifón de vitalidad','Centinelas del tormento','Siervos del dolor','Custodia de almas','Pira de cenizas','Dominio del invocado','Señor de la perdición'],
'Elements':['Orbe de la hoguera','Estallido glacial','Rayo de tormenta','Convergencia elemental','Prisión de escarcha','Ventisca despiadada','Marca de los elementos','Erupción de magma','Torbellino errante','Descarga celestial'],
'Slashing Weapons':['Carga del filo','Esgrima certera','Corte incapacitante','Vigor atlético','Cruz del horizonte','Choque de acero','Filo devastador','Dermis de hierro','Corte fatal','Tifón de filos'],
'Blunt Weapons':['Golpe del martillo','Impactos de demolición','Quebrantacostillas','Anatomía del verdugo','Martillo triturador','Sentencia del mazo','Quiebra de la mente','Temple de forja','Quebrantaquijadas','Trueno del martillo'],
'Piercing Weapons':['Desgarro penetrante','Maniobra ligera','Paso de balestra','Arsenal versátil','Contrapunta','Lanza de empalamiento','Perforación cerebral','Cuerpo flexible','Ráfaga de estocadas','Estocada relampagueante'],
'Tactics':['Patada del derribo','Guardia cautelosa','Corte de garganta','Disciplina defensiva','Preparación del veterano','Golpe de revés','Embestida implacable','Presencia intimidante','Manos inutilizadas','Reflejo del combatiente'],
'Warcries':['Fuerza de coloso','Frenesí de batalla','Grito del verdugo','Hambre de sangre','Rugido del desafío','Bramido del estruendo','Rabia berserker','Vigor abrumador','Carrera del asalto','Furia incontenible'],
'Two Handed Mastery':['Amenaza del gigante','Golpe del espíritu','Desgarro brutal','Zarpazo bestial','Alarido de guerra','Onda del coloso','Golpe desequilibrante','Ataque fulminante','Puños de acero','Furia de la falla'],
'Vanguard':['Desafío del bastión','Provocación del guardián','Finta del duelista','Temple del protector','Postura del asalto','Apoyo del bastión','Coraza del troll','Ímpetu del caballero','Presencia del héroe','Bastión solitario'],
'Shields':['Guardia del escudo','Impacto del bastión','Amparo del aliado','Parada perfecta','Postura de baluarte','Manto espectral','Muralla de escudos','Ancla del defensor','Escudo del firmamento','Barrera de reflexión']
};
const wmNames={
'Hunter WM':{1:'Consejo del acechador',3:'Cuerno del vendaval',5:'Maestría del rastreador',7:'Líder de la manada',9:'Sangre del explorador'},
'Marksman WM':{1:'Consejo del tirador',3:'Saeta de la hoguera',5:'Maestría del centinela',7:'Instinto del ejecutor',9:'Sangre del tirador'},
'Conjurer WM':{1:'Consejo de la vida',3:'Umbral del refugio',5:'Maestría del vinculador',7:'Amparo de la providencia',9:'Sangre del sanador'},
'Warlock WM':{1:'Consejo de la ruina',3:'Umbral del asalto',5:'Maestría del arcanista',7:'Jardín de espinas',9:'Sangre del hechicero'},
'Barbarian WM':{1:'Consejo del asalto',3:'Estandarte de batalla',5:'Maestría del devastador',7:'Clamor del héroe',9:'Sangre del berserker'},
'Knight WM':{1:'Consejo del bastión',3:'Auxilio del paladín',5:'Maestría del guardián',7:'Favor del alba',9:'Sangre del defensor'}
};
const glyph={
arrow:'<path d="M16 49L48 17M34 17h14v14M16 49v-11M16 49h11"/>',
dual:'<path d="M12 44L39 17M28 17h11v11M23 51L50 24M39 24h11v11M12 44h9M23 51h9"/>',
rain:'<path d="M13 34L28 19M19 19h9v9M27 43L43 27M34 27h9v9M39 52L53 38M45 38h8v8M11 47l6-6"/>',
bow:'<path d="M23 13Q54 32 23 51L30 32Z M13 32h38M43 25l8 7-8 7"/>',
shield:'<path d="M32 11l19 7v15Q49 45 32 54Q15 45 13 33V18Z M23 31l7 7 12-15"/>',
sword:'<path d="M19 45L44 12l8 8L27 51M18 35l17 13M17 48l-5 6M22 19l-7-5"/>',
blades:'<path d="M13 13L47 49M13 13l9 2-7 8M51 13L17 49M51 13l-9 2 7 8M10 42l12 11M42 53l12-11"/>',
hammer:'<path d="M30 35L17 51M22 14l16-5 16 14-9 14Z M36 19l8 8"/>',
spear:'<path d="M16 53L44 18M44 18l-1-9 12 2-2 13Z M24 42l8 5"/>',
kick:'<path d="M21 12l13 4-6 22 22 5 3 10H19l-4-8 7-17Z M39 20l11-7M43 29h12"/>',
fist:'<path d="M20 30V18q0-6 6-4v12-13q6-5 6 2v12-13q6-4 6 2v13-10q6-3 6 3v16l-8 14H23l-9-13V29q0-7 6 1Z"/>',
meteor:'<path d="M17 31L37 9M26 35L50 12M33 41L56 21M19 26L27 19M40 43L48 33"/><path d="M16 32l14-4 12 11-5 14-15 3-12-13Z" fill="currentColor" fill-opacity=".25"/><path d="M20 40l6-4 7 7-6 6"/>',
fire:'<path d="M33 10c12 15-2 17 8 27 5-5 7-9 6-13 14 17 5 29-13 30-21 0-28-16-16-29 0 8 5 12 9 14 4-9-4-13 6-29Z"/>',
fireball:'<circle cx="29" cy="36" r="16"/><path d="M17 24L29 11M29 23L47 10M43 36l11-11M23 33q12-9 15 3"/>',
ice:'<path d="M32 10v44M13 21l38 22M13 43l38-22M26 15l6 6 6-6M26 49l6-6 6 6M15 29l9-3-2-9M42 47l-2-9 9-3M49 29l-9-3 2-9M22 47l2-9-9-3"/>',
crystal:'<path d="M21 18L32 9l12 9 7 24-19 13-18-13Z M21 18l11 37 12-37M14 42h37M21 18h23"/>',
lightning:'<path d="M34 10L17 35h13L26 55l23-29H35Z" fill="currentColor" fill-opacity=".22"/>',
wind:'<path d="M12 24h32q13 0 8-10-5-6-10 0M10 33h32q13 0 8 12-5 6-10 0M17 43h11"/>',
tornado:'<path d="M13 16q18-10 38 0-19 13-38 0ZM16 26q19 10 34-1M21 35q14 8 23-1M27 44q8 4 11-1M32 53h4"/>',
earth:'<path d="M10 49l11-29 12 19 9-24 13 34Z M13 54h40M24 33l9 6M39 30l9 9"/>',
roots:'<path d="M32 12v27l-9 14M32 34l12 19M32 22L17 14M32 28l17-11M32 37l-19 8M32 42l20 4M22 53l-2-9M44 53l1-10"/>',
leaf:'<path d="M13 45Q13 11 51 11q1 39-33 38Z M16 48L43 20M25 39l1-13M33 31l11-1"/>',
paw:'<path d="M20 39q12-16 24 0c16 19-7 14-12 11-9 6-25 2-12-11Z"/><ellipse cx="15" cy="26" rx="5" ry="8"/><ellipse cx="27" cy="18" rx="5" ry="8"/><ellipse cx="40" cy="18" rx="5" ry="8"/><ellipse cx="51" cy="28" rx="5" ry="8"/>',
eye:'<path d="M10 32q22-27 44 0-22 27-44 0Z"/><circle cx="32" cy="32" r="8"/><path d="M32 13v-4M32 51v4"/>',
foot:'<path d="M29 13l12 4-6 24 12 5v9H20V43l8-24Z M11 20h10M9 29h11M10 39h8"/>',
hood:'<path d="M12 51Q14 10 32 10q18 0 20 41ZM23 30q9-12 18 0l-4 12H27Z M26 35h1M37 35h1"/>',
heart:'<path d="M32 20C16-2-5 27 32 53 69 27 48-2 32 20Z M16 32h9l5-9 6 17 5-8h8"/>',
heal:'<path d="M26 13h12v13h13v12H38v13H26V38H13V26h13Z"/><path d="M8 13l5 5M51 48l5 5"/>',
revive:'<path d="M14 29q2-17 19-17 17 1 19 18M14 17v12h12M50 37q-3 17-20 16-15-1-17-14M50 49V37H38M32 22v19M25 29h14"/>',
mana:'<path d="M32 10Q9 37 18 49q14 15 28 0 9-12-14-39Z M25 39q4 8 12 3"/>',
link:'<path d="M28 19l7-7q15-7 17 9l-12 14q-9 7-14-2M36 45l-7 7q-15 7-17-9l12-14q9-7 14 2M24 40l16-16"/>',
staff:'<path d="M21 53L37 22M30 13l9-6 9 7-7 13-11-3Z M31 34l7 4M27 42l7 4"/>',
dome:'<path d="M10 48Q10 9 32 12q22-3 22 36ZM17 48q0-27 15-33 15 6 15 33M11 36h42M32 15v33"/>',
brain:'<path d="M32 17q-13-15-19 0-10 3-5 15-7 11 7 13 2 12 17 3 15 9 17-3 14-2 7-13 5-12-5-15-6-15-19 0ZM32 17v31M17 22l7 7-6 6M47 22l-7 7 6 6"/>',
silence:'<path d="M17 25q15-15 30 0M17 38q15 15 30 0M23 28v8M31 25v14M39 28v8M12 12l40 40"/>',
skull:'<path d="M18 42Q6 14 32 11q26 3 14 31l-5 3v9H23v-9Z"/><circle cx="23" cy="29" r="5"/><circle cx="41" cy="29" r="5"/><path d="M30 39l2-5 3 5M29 47v7M35 47v7"/>',
fanged:'<path d="M12 24q20-13 40 0l-6 24-9-15-5 10-6-10-8 15Z M14 24l12 8M50 24l-13 8"/>',
ghost:'<path d="M14 51V29q0-19 18-19 18 0 18 19v22l-10-6-8 9-8-9Z M24 26v8M40 26v8M27 41h10"/>',
demon:'<path d="M20 21L12 9l14 6 12-1 14-5-8 15q13 23-12 30-25-7-12-33Z M22 30l6 3M42 30l-6 3M25 43l7 5 7-5"/>',
golem:'<path d="M24 10h16v14H24ZM18 28h28l4 18-9 9H23l-9-9ZM8 30h9v18H6ZM47 30h9l2 18H47M28 29v17h8V29"/>',
portal:'<ellipse cx="32" cy="32" rx="19" ry="24"/><ellipse cx="32" cy="32" rx="11" ry="16"/><path d="M8 32h13M43 32h13M49 26l7 6-7 6"/>',
flag:'<path d="M17 54V10h30l-6 11 7 12H17M11 54h16"/>',
horn:'<path d="M12 18q22 10 34-6l8 22q-22-7-32 12ZM17 21l8 21M37 28q-4 12-12 13"/>',
crown:'<path d="M13 43l-4-23 13 9 10-17 10 17 13-9-4 23ZM13 51h38M24 40h16"/>',
mirror:'<path d="M21 11h24l9 13-9 26H21L11 24ZM24 17h18l5 9-7 17H25l-7-17ZM32 50v5M22 55h20M25 36l14-14"/>',
star:'<path d="M32 10l7 14 16 2-12 12 3 17-14-8-14 8 3-17L9 26l16-2Z"/>',
insect:'<ellipse cx="32" cy="34" rx="9" ry="17"/><path d="M28 17l-7-7M36 17l7-7M23 26l-9-5M41 26l9-5M23 34H10M41 34h13M23 43l-9 7M41 43l9 7M32 19v29"/>',
clock:'<circle cx="32" cy="33" r="20"/><path d="M32 18v16l10 7M25 8h14M32 8v5M16 15l-4-5"/>',
roar:'<path d="M11 27l12-9 15 5v28l-14-3-13-11ZM23 18v30M43 23q14 11 0 22M47 15q23 19 0 39"/>',
stance:'<circle cx="32" cy="14" r="5"/><path d="M32 21v16M17 28l15-7 15 8M32 37L18 53M32 37l14 16M11 42h10M45 42h8"/>',
locked:'<path d="M18 28V20q0-16 14-16 14 0 14 16v8M12 28h40v28H12ZM32 37v10M18 14l29 36"/>',
};
const palette={fire:'#ff9354',ice:'#91e5ff',lightning:'#ffe773',wind:'#95eadc',earth:'#e1bd8c',shadow:'#c596ff',nature:'#a9ec87',life:'#83efba',arcane:'#b6aeff',physical:'#ebd7b6',neutral:'#9bacbf'};
// Explicit silhouette chosen from each power's meaning, not its numeric seed.
const motifs={
'Short Bows':'dual bow roots foot brain eye fanged bow wind rain',
'Long Bows':'arrow bow foot eye arrow eye blades bow hood rain',
'Tricks':'hood sword fist mirror roots fist eye eye arrow roots',
'Evasion':'foot foot shield paw stance shield foot brain hood wind',
'Scouting':'roots skull eye paw hood foot fanged eye brain hood',
'Pets':'paw heal shield eye paw revive paw shield leaf paw',
'Arrow Mastery':'arrow ice wind fanged fire arrow rain star rain lightning',
'Aiming Mastery':'eye eye arrow eye skull arrow stance eye arrow eye',
'Mental':'star insect fire brain roots brain silence spear clock ghost',
'Mana Control':'shield mana link fanged mana heart star mana mana staff',
'Staff Mastery':'staff staff staff staff lightning staff dome heart staff lightning',
'Enchantments':'skull paw eye star paw sword star paw stance star',
'Life':'heal heal revive heart heart heal shield heart heal revive',
'Summon':'demon link demon link skull demon golem shield fanged skull',
'Sorcery':'shield ghost shield brain mirror shield dome dome eye shield',
'Arcania':'earth clock fist clock meteor wind crystal sword fist skull',
'Necromancy':'fanged hood roar heart skull ghost ghost fire demon skull',
'Elements':'fireball ice lightning star ice ice star fireball tornado lightning',
'Slashing Weapons':'sword blades sword stance blades shield sword shield sword blades',
'Blunt Weapons':'hammer hammer hammer skull hammer skull hammer shield hammer lightning',
'Piercing Weapons':'spear spear foot stance spear spear spear stance spear lightning',
'Tactics':'kick shield sword shield stance sword foot roar fist stance',
'Warcries':'fist fire skull fanged roar roar fist fist foot fire',
'Two Handed Mastery':'sword sword blades paw roar wind hammer lightning fist earth',
'Vanguard':'roar roar sword shield sword shield shield foot crown shield',
'Shields':'shield shield shield shield shield ghost dome stance star shield',
'Hunter WM':'locked crown locked horn locked crown locked paw locked heart',
'Marksman WM':'locked crown locked fire locked crown locked skull locked heart',
'Conjurer WM':'locked crown locked portal locked crown locked shield locked heart',
'Warlock WM':'locked crown locked portal locked crown locked roots locked heart',
'Barbarian WM':'locked crown locked flag locked crown locked roar locked heart',
'Knight WM':'locked crown locked heal locked crown locked star locked heart'
};
function properties(d,s,m){
 const n=s.name.en.toLowerCase(); const desc=(s.description?.en||'').toLowerCase();
 const all=JSON.stringify(s).toLowerCase();
 let element='physical';
 if(d==='Necromancy'||/vampir|darkness|doom|lich|demon|zombi|sadistic|soul|cremation/.test(n))element='shadow';
 else if(/fire|blaze|magma|ignus|meteor|burn|cremation/.test(n))element='fire';
 else if(/ice|winter|frozen|freeze|crystal/.test(n))element='ice';
 else if(/lightning|thunder|static/.test(n))element='lightning';
 else if(/wind|tornado|twister|typhoon/.test(n))element='wind';
 else if(/golem|stalagmite|petrify|earth/.test(n))element='earth';
 else if(d==='Life'||/heal|regenerat|resurrect|divine|bless|sanctuary|paladin/.test(n))element='life';
 else if(d==='Pets'||/ivy|nature|natural|serpent|ensnar|beast|caltrop/.test(n))element='nature';
 else if(['Mental','Mana Control','Staff Mastery','Enchantments','Sorcery','Summon','Arcania'].includes(d)||/ethereal|arcane|energy|magic|portal/.test(n))element='arcane';
 let shape='mastery';
 if(m==='meteor')shape='meteor';
 else if(/fire ball/.test(n))shape='fireball';
 else if(/magma/.test(n))shape='magmaOrb';
 else if(/ice blast/.test(n))shape='iceBurst';
 else if(/crystal blast/.test(n))shape='crystalBurst';
 else if(n==='freeze'||n==='winter stroke')shape='freezePrison';
 else if(/frozen storm/.test(n))shape='iceStorm';
 else if(/summon lightning/.test(n))shape='lightningStorm';
 else if(n==='lightning'||/lightning arrow/.test(n))shape='lightningBolt';
 else if(/twister|typhoon/.test(n))shape='tornado';
 else if(/fire rain|ignus scorch|blaze/.test(n))shape='fireField';
 else if(/golem fist/.test(n))shape='stoneFist';
 else if(/stalagmite/.test(n))shape='earthSpike';
 else if(/vampirism|vitality absorption/.test(n))shape='lifeDrain';
 else if(n==='soulkeeper'||n==='energy borrow')shape='soulDrain';
 else if(n==='cremation')shape='cremation';
 else if(n==='sultar\'s terror')shape='dreadWave';
 else if(n==='master of doom')shape='doomAura';
 else if(n==='darkness')shape='darkTide';
 else if(/possess/.test(n))shape='possession';
 else if(/^summon|portal|beacon/.test(n))shape='summonSigil';
 else if(/mass pricking/.test(n))shape='massRoots';
 else if(/pricking ivy|ensnaring|grounding|sticky touch|caltrop|petrify/.test(n))shape='stoneBind';
 else if(/swarm|devouring|servants|guards/.test(n))shape='spiritSwarm';
 else if(/heal|regenerat|resurrect|revive|paladin/.test(n))shape='healPulse';
 else if(/war council/.test(n))shape='warCouncil';
 else if(/blood|sacrifice|material bond|extraplanar/.test(n))shape='bloodPact';
 else if(/wind wall|son of the wind|horn of/.test(n))shape='windWard';
 else if(/wall|barrier|armor|skin|shield|block|defens|protection|sanctuary|caution|steadiness/.test(n))shape='ward';
 else if(/elemental conjunction/.test(n))shape='elementWard';
 else if(/element exposure/.test(n))shape='elementExpose';
 else if(/fragility|break|disable limb|rend|crash/.test(n))shape='fracture';
 else if(/slow|hinder|laziness|obfuscat/.test(n))shape='slowField';
 else if(/curse|confuse|blindness|silence|ambush|stunning|kick|feint|jaw breaker|throat|brain piercing|terror|destabil/.test(n))shape=element==='shadow'?'darkSeal':'controlSeal';
 else if(/clumsiness|infuriate|intimidate|challenge|taunt|hinder|death sentence/.test(n))shape='debilitate';
 else if(/wrath|fury|rage|berserk|colossus|frenzy|strength|heads|roar|howl/.test(n))shape='enrage';
 else if(['arrow','dual','rain','bow','sword','blades','hammer','spear','kick','fist'].includes(m))shape=element==='fire'?'fireBolt':element==='shadow'?'shadowBolt':element==='ice'?'iceBurst':element==='lightning'?'lightningBolt':'arcaneBolt';
 else if(/missile/.test(n))shape='arcaneBolt';
 // Compact secondary marker conveys effects even when two skills share a weapon silhouette.
 let badge='none';
 if(s.type==='Passive')badge='passive';
 else if(/knock down/.test(all))badge='knockdown';
 else if(/immobilize/.test(all))badge='root';
 else if(/dizzy|cannot attack/.test(all))badge='silence';
 else if(/stun/.test(all))badge='stun';
 else if(/health damage/.test(all)&&s.duration)badge='dot';
 else if(/heal|regenerat|resurrect/.test(n))badge='heal';
 else if(/attack speed/.test(all))badge='speed';
 else if(/protection|damage resistance|armor/.test(all))badge='defense';
 else if(/area|arc/.test(desc)||s.area)badge='area';
 else if(s.duration)badge='duration';
 else if(s.cast)badge='cast';
 return {element,shape,iconShape:shape,motif:m,badge,spellGesture:/heal/.test(n)?'heal':/summon/.test(n)?'summon':/barrier|shield/.test(n)?'ward':/controlSeal|stoneBind|darkSeal/.test(shape)?'bind':'cast'};
}
function badgeArt(b){
 const common='stroke="#f7f2dd" fill="none" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';
 const arts={passive:'<path d="M-5 0l5-5 5 5-5 5Z"/>',knockdown:'<path d="M0-5v10M-4 1l4 4 4-4M-5 7h10"/>',root:'<path d="M0-5v6l-5 5M0 1l5 5M-5-2l5 3 5-3"/>',silence:'<path d="M-5-5l10 10M-4 1q4 4 8 0M-4-2q4-4 8 0"/>',stun:'<path d="M0-6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1Z"/>',dot:'<circle cy="-4" r="1"/><circle r="1"/><circle cy="4" r="1"/>',heal:'<path d="M0-5v10M-5 0h10"/>',speed:'<path d="M-5-5l5 5-5 5M0-5l5 5-5 5"/>',defense:'<path d="M-5-4l5-2 5 2v5L0 6l-5-5Z"/>',area:'<circle r="4"/><path d="M0-7v2M0 5v2M-7 0h2M5 0h2"/>',duration:'<circle r="5"/><path d="M0-3v3h3"/>',cast:'<path d="M0-6v12M-5-3l10 6M-5 3l10-6"/>'};
 if(!arts[b])return '';
 return '<g transform="translate(51 49)"><circle r="9" fill="#111522" stroke="#c8b590" stroke-width=".8"/><g '+common+'>'+arts[b]+'</g></g>';
}
const result={};let index=0;
fs.mkdirSync(path.join(root,'assets/icons'),{recursive:true});
for(const [d,discipline] of Object.entries(trainer.disciplines)){
 const ms=motifs[d]?.split(' ');if(!ms||ms.length!==10)throw Error('Missing motifs '+d);
 for(const [slot,s] of discipline.spells.entries()){
 const unavailable=/^undefined\d*$/.test(s.name.en), key=d+'|'+s.name.en;
 const id='trainer_'+String(++index).padStart(3,'0');
 const name=unavailable?'Espacio sin poder — '+discipline.display_name.es+' '+(slot+1):(names[d]?.[slot]||wmNames[d]?.[slot]);
 if(!name)throw Error('Missing name '+key);
 const pr=properties(d,s,ms[slot]);
 if(unavailable)Object.assign(pr,{element:'neutral',shape:'mastery',iconShape:'mastery',motif:'locked',badge:'none'});
 const digest=crypto.createHash('sha256').update(key).digest('hex');
 const entry={name,sourceName:s.name.es,sourceEnglishName:s.name.en,discipline:d,slot:slot+1,available:!unavailable,icon:'assets/icons/'+id+'.svg',...pr,seed:parseInt(digest.slice(0,8),16),accent:parseInt(digest.slice(8,10),16)%8,signature:digest.slice(0,16),visualVariant:slot%4,particleCount:8+(slot%5)*2,orbitDirection:slot%2?-1:1,trailLength:0.16+(slot%5)*0.025,pulseRate:1.2+(slot%6)*0.12};
 result[key]=entry;
 const color=palette[pr.element], art=glyph[pr.motif];if(!art)throw Error('Missing glyph '+pr.motif);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${esc(name)}"><title>${esc(name)}</title><desc>${esc(s.description?.es||'Espacio no definido por el trainer.')} — ${esc(d)} #${slot+1}</desc><defs><radialGradient id="bg" cx="35%" cy="24%" r="85%"><stop stop-color="${color}" stop-opacity=".5"/><stop offset=".5" stop-color="#20202e"/><stop offset="1" stop-color="#090d15"/></radialGradient><linearGradient id="ink" x2=".7" y2="1"><stop stop-color="#fff7df"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect x="1" y="1" width="62" height="62" rx="8" fill="url(#bg)" stroke="${color}" stroke-opacity=".55"/><g fill="none" color="${color}" stroke="url(#ink)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${art}</g>${badgeArt(pr.badge)}<rect x="3" y="56" width="${5+(slot+1)*3.1}" height="2" rx="1" fill="${color}" opacity=".8"/><text x="7" y="53" fill="${color}" font-family="sans-serif" font-size="7" font-weight="bold">${slot+1}</text></svg>`;
 fs.writeFileSync(path.join(root,entry.icon),svg);
 }
}
fs.writeFileSync(path.join(root,'js/data/trainerPresentation.json'),JSON.stringify(result,null,2)+'\n');
const entries=Object.entries(result);const hashes=new Set(entries.map(([,e])=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,e.icon))).digest('hex')));
if(entries.length!==320||hashes.size!==320)throw Error('Expected 320 unique icons');
const activeNames=entries.filter(([,e])=>e.available).map(([,e])=>e.name);
if(new Set(activeNames).size!==activeNames.length)throw Error('Variant names must be unique');
// A complete QA sheet renders actual SVG files; it is also usable offline.
let sheet='<!doctype html><meta charset="utf-8"><title>320 poderes — atlas visual</title><style>body{background:#10131c;color:#eef1f6;font:14px system-ui;margin:28px}h2{margin:36px 0 16px}section{display:grid;grid-template-columns:repeat(10,minmax(90px,1fr));gap:12px}.tile{text-align:center;background:#191e2a;padding:10px 4px;border-radius:8px}.tile svg{width:64px;height:64px}.tile small{display:block;color:#a8b3c7;margin-top:4px}.tile.unavailable{opacity:.45}h1{font-size:23px}p{color:#a8b3c7}</style><h1>Atlas de poderes 1.35.19</h1><p>290 poderes originales · 30 espacios vacíos de la fuente · formas vectoriales originales · marcador secundario de efecto</p>';
for(const [d,discipline] of Object.entries(trainer.disciplines)){
 sheet+='<h2>'+esc(discipline.display_name.es)+'</h2><section>';
 for(const s of discipline.spells){const e=result[d+'|'+s.name.en];const svg=fs.readFileSync(path.join(root,e.icon),'utf8');sheet+='<div class="tile '+(e.available?'':'unavailable')+'">'+svg+'<div>'+esc(e.name)+'</div><small>'+esc(e.sourceEnglishName)+'</small></div>';}
 sheet+='</section>';
}
const qa=path.join(root,'docs/QA_ICONOS_TRAINER.html');fs.writeFileSync(qa,sheet);
console.log(JSON.stringify({slots:entries.length,available:activeNames.length,uniqueIcons:hashes.size,glyphFamilies:Object.keys(glyph).length,source:trainer.version,mapping:'js/data/trainerPresentation.json',qa:'docs/QA_ICONOS_TRAINER.html'}));
