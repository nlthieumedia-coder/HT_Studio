import type { Page } from 'playwright';
import { ControlResolver } from '../reliability/ControlResolver.js';
import { navigationControls, generationControls, resultControls } from './selectors/index.js';
export type DolaPageState='HOME'|'LOGIN_REQUIRED'|'VIDEO_GENERATION'|'GENERATION_RUNNING'|'RESULT_READY'|'ERROR_PAGE'|'UNKNOWN';
export type PageConfidence='HIGH'|'MEDIUM'|'LOW'|'UNKNOWN';
export interface PageRecognition { state:DolaPageState; confidence:PageConfidence; url:string; title:string; evidence:string[] }
const found=async(r:ControlResolver,d:Parameters<ControlResolver['resolve']>[0])=>(await r.resolve(d)).state==='FOUND';
export const recognizeDolaPage=async(page:Page):Promise<PageRecognition>=>{
 const resolver=new ControlResolver(page), url=page.url(), title=await page.title().catch(()=>''), evidence:string[]=[];
 const login=await found(resolver,navigationControls.login); if(login){evidence.push('login-control');return{state:'LOGIN_REQUIRED',confidence:'HIGH',url,title,evidence};}
 const result=await found(resolver,resultControls.result), complete=await found(resolver,generationControls.completed); if(result&&complete){evidence.push('result','completed');return{state:'RESULT_READY',confidence:'HIGH',url,title,evidence};}
 if(await found(resolver,generationControls.generating)){evidence.push('progress');return{state:'GENERATION_RUNNING',confidence:'HIGH',url,title,evidence};}
 const landmark=await found(resolver,navigationControls.generationLandmark), prompt=await found(resolver,generationControls.prompt), generate=await resolver.resolve(generationControls.generate);
 if(landmark&&prompt&&generate.state==='FOUND'){evidence.push('landmark','prompt','generate');return{state:'VIDEO_GENERATION',confidence:'HIGH',url,title,evidence};}
 if(prompt&&(generate.state==='FOUND'||generate.state==='NOT_FOUND')){evidence.push('prompt');return{state:'VIDEO_GENERATION',confidence:'MEDIUM',url,title,evidence};}
 if(await found(resolver,generationControls.failed)){evidence.push('provider-error');return{state:'ERROR_PAGE',confidence:'HIGH',url,title,evidence};}
 if(await found(resolver,navigationControls.authenticated)){evidence.push('authenticated-marker');return{state:'HOME',confidence:'MEDIUM',url,title,evidence};}
 return{state:'UNKNOWN',confidence:'UNKNOWN',url,title,evidence};
};
