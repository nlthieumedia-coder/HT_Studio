import { ProviderError } from './ProviderErrors.js';
export type ProviderWorkflowState = 'INITIAL'|'NAVIGATING'|'PAGE_RECOGNIZED'|'SESSION_VALID'|'FORM_READY'|'JOB_PREPARED'|'PRE_SUBMIT_VALIDATED'|'SUBMITTING'|'GENERATING'|'RESULT_READY'|'DOWNLOADING'|'DONE'|'ERROR';
const legal: Record<ProviderWorkflowState, readonly ProviderWorkflowState[]> = {
 INITIAL:['NAVIGATING','ERROR'], NAVIGATING:['PAGE_RECOGNIZED','ERROR'], PAGE_RECOGNIZED:['SESSION_VALID','ERROR'], SESSION_VALID:['FORM_READY','ERROR'], FORM_READY:['JOB_PREPARED','ERROR'], JOB_PREPARED:['PRE_SUBMIT_VALIDATED','ERROR'], PRE_SUBMIT_VALIDATED:['SUBMITTING','ERROR'], SUBMITTING:['GENERATING','ERROR'], GENERATING:['RESULT_READY','ERROR'], RESULT_READY:['DOWNLOADING','ERROR'], DOWNLOADING:['DONE','ERROR'], DONE:[], ERROR:[],
};
export class ProviderStateMachine {
 private current: ProviderWorkflowState='INITIAL';
 get state(){return this.current;}
 transition(next:ProviderWorkflowState){if(!legal[this.current].includes(next))throw new ProviderError('INVALID_PROVIDER_STATE',`Illegal provider transition ${this.current} -> ${next}.`,{from:this.current,to:next});this.current=next;return this.current;}
}
