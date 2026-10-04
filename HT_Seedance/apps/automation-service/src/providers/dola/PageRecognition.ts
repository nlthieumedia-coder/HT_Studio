import type { Page } from 'playwright';
import { ControlResolver } from '../reliability/ControlResolver.js';
import { navigationControls, generationControls, resultControls } from './selectors/index.js';
export type DolaPageState='HOME'|'LOGIN_REQUIRED'|'VIDEO_GENERATION'|'GENERATION_RUNNING'|'RESULT_READY'|'ERROR_PAGE'|'UNKNOWN';
export type PageConfidence='HIGH'|'MEDIUM'|'LOW'|'UNKNOWN';
export interface PageRecognition { state:DolaPageState; confidence:PageConfidence; url:string; title:string; evidence:string[] }
const found=async(r:ControlResolver,d:Parameters<ControlResolver['resolve']>[0])=>(await r.resolve(d)).state==='FOUND';
export const recognizeDolaPage=async(page:Page):Promise<PageRecognition>=>{
 const url=page.url(), title=await page.title().catch(()=>''), evidence:string[]=[];

 const hasLoginButton = await page
   .locator('button, a, [role="button"]')
   .filter({ hasText: /^log\s*in$/i })
   .or(page.locator('button, a, [role="button"]').filter({ hasText: /^sign\s*in$/i }))
   .or(page.locator('text="Đăng nhập"'))
   .count()
   .catch(() => 0);

 const hasLoginModal = await page
   .locator('text="Đăng nhập để mở khóa thêm tính năng"')
   .or(page.locator('text="Sign in to unlock"'))
   .or(page.getByText(/log\s*in to unlock more features/i))
   .or(page.locator('text="Tiếp tục bằng Google"'))
   .or(page.getByText(/continue with google/i))
   .count()
   .catch(() => 0);

 if (hasLoginButton > 0 || hasLoginModal > 0 || url.includes('/signin') || url.includes('/login')) {
   evidence.push('login-button-or-modal-visible');
   return { state: 'LOGIN_REQUIRED', confidence: 'HIGH', url, title, evidence };
 }

 const hasCreationWorkspace = await page
   .getByText('AI Creation', { exact: true })
   .count()
   .catch(() => 0);
 const hasCreationTabs = await page
   .getByText(/^(image|video)$/i)
   .count()
   .catch(() => 0);
 const hasVideoPrompt = await page
   .locator('p[data-placeholder*="video" i]')
   .count()
   .catch(() => 0);
 const hasEditablePrompt = await page
   .locator('[contenteditable="true"][role="textbox"]')
   .count()
   .catch(() => 0);
 const videoTab = page.getByRole('tab', { name: 'Video', exact: true });
 const videoTabCount = await videoTab.count().catch(() => 0);
 const videoTabSelected = videoTabCount > 0
   ? await videoTab.first().evaluate((element) => element.getAttribute('aria-selected') === 'true' || element.getAttribute('data-state') === 'active').catch(() => false)
   : false;
 if ((hasVideoPrompt > 0 || hasEditablePrompt === 1) && videoTabSelected) {
   evidence.push('video-tab-active', 'video-prompt-visible');
   return { state: 'VIDEO_GENERATION', confidence: 'HIGH', url, title, evidence };
 }
 if (
   url.includes('/chat/create-') &&
   /AI Creation/i.test(title) &&
   hasCreationWorkspace > 0 &&
   hasCreationTabs > 0 &&
   !videoTabSelected
 ) {
   evidence.push('authenticated-ai-creation-workspace');
   return { state: 'HOME', confidence: 'HIGH', url, title, evidence };
 }

 const resolver=new ControlResolver(page);
 const login=await found(resolver,navigationControls.login); if(login){evidence.push('login-control');return{state:'LOGIN_REQUIRED',confidence:'HIGH',url,title,evidence};}
 const result=await found(resolver,resultControls.result), complete=await found(resolver,generationControls.completed); if(result&&complete){evidence.push('result','completed');return{state:'RESULT_READY',confidence:'HIGH',url,title,evidence};}
 if(await found(resolver,generationControls.generating)){evidence.push('progress');return{state:'GENERATION_RUNNING',confidence:'HIGH',url,title,evidence};}
 const landmark=await found(resolver,navigationControls.generationLandmark), prompt=await found(resolver,generationControls.prompt), generate=await resolver.resolve(generationControls.generate);
 if(landmark&&prompt){evidence.push('landmark','prompt',`generate:${generate.state}`);return{state:'VIDEO_GENERATION',confidence:'HIGH',url,title,evidence};}
 if(prompt&&(generate.state==='FOUND'||generate.state==='NOT_FOUND')){evidence.push('prompt');return{state:'VIDEO_GENERATION',confidence:'MEDIUM',url,title,evidence};}
 if(await found(resolver,generationControls.failed)){evidence.push('provider-error');return{state:'ERROR_PAGE',confidence:'HIGH',url,title,evidence};}
 const hasUserProfile = await page
   .locator('[data-testid="user-menu"], button[aria-label*="account" i], button[aria-label*="profile" i], [role="button"][aria-label*="avatar" i]')
   .count()
   .catch(() => 0);
 if (hasUserProfile > 0) {evidence.push('user-profile-authenticated');return{state:'HOME',confidence:'HIGH',url,title,evidence};}
 if(await found(resolver,navigationControls.authenticated)){evidence.push('authenticated-marker');return{state:'HOME',confidence:'MEDIUM',url,title,evidence};}
 return{state:'UNKNOWN',confidence:'UNKNOWN',url,title,evidence};
};
