import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve,relative,isAbsolute } from 'node:path';
export async function sha256File(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path)) hash.update(chunk as Buffer);return hash.digest('hex')}
export function normalizeUrl(raw:string){const url=new URL(raw.trim());url.hash='';url.hostname=url.hostname.toLowerCase();for(const key of [...url.searchParams.keys()]) if(key.startsWith('utm_')||['fbclid','gclid'].includes(key)) url.searchParams.delete(key);url.searchParams.sort();return url.toString()}
export function assertInside(root:string,target:string){const rel=relative(resolve(root),resolve(target));if(rel.startsWith('..')||isAbsolute(rel)) throw new Error('Đã chặn đường dẫn không an toàn');return resolve(target)}
export function cosineSimilarity(a:number[],b:number[]){if(a.length!==b.length||!a.length)return 0;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/(Math.sqrt(aa)*Math.sqrt(bb)):0}
export function hammingSimilarity(a:string,b:string){if(!a||a.length!==b.length)return 0;let same=0;for(let i=0;i<a.length;i++)if(a[i]===b[i])same++;return same/a.length}
