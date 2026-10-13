import {pathToFileURL} from 'node:url';import path from 'node:path';
export async function resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('../../vendor/three-0.160.0/three.module.js',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}
