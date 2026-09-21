import { JobCreateSchema, JobState, type JobCreateInput, type JobUpdateInput } from '@ht-dola/shared';
import type { SqliteDatabase } from '../db/database.js';
import { JobRepository } from '../db/repositories/JobRepository.js';
import type { JobRecord } from '../db/types.js';
import { ConflictError, NotFoundError } from '../api/errors.js';

const transitions:Partial<Record<JobState,readonly JobState[]>>={
  [JobState.DRAFT]:[JobState.QUEUED,JobState.CANCELLED],
  [JobState.QUEUED]:[JobState.DRAFT,JobState.CANCELLED],
  [JobState.FAILED]:[JobState.QUEUED],
};
const deletable=new Set([JobState.DRAFT,JobState.CANCELLED,JobState.FAILED]);

export class JobService {
  readonly repository:JobRepository;
  constructor(private readonly database:SqliteDatabase){this.repository=new JobRepository(database);}
  create(input:JobCreateInput):JobRecord{return this.repository.create(input);}
  update(id:string,input:JobUpdateInput):JobRecord{const job=this.require(id);if(!deletable.has(job.status))throw new ConflictError('Only draft, cancelled, or failed jobs can be edited.');return this.repository.update(id,input)!;}
  duplicate(id:string):JobRecord{const source=this.require(id);return this.repository.create(JobCreateSchema.parse({projectId:source.projectId,sceneNumber:this.repository.nextSceneNumber(source.projectId),provider:source.provider,accountId:source.accountId,prompt:source.prompt,inputMedia:source.inputMedia,durationSeconds:source.durationSeconds,aspectRatio:source.aspectRatio,resolution:source.resolution,status:JobState.DRAFT,priority:source.priority,maxAttempts:source.maxAttempts}));}
  transition(id:string,status:JobState):JobRecord{const job=this.require(id);if(!transitions[job.status]?.includes(status))throw new ConflictError(`Invalid job transition: ${job.status} -> ${status}.`);return this.repository.updateStatus(id,status)!;}
  bulkTransition(ids:string[],status:JobState):JobRecord[]{return this.database.transaction((values:string[])=>values.map((id)=>this.transition(id,status)))(ids);}
  bulkUpdate(ids:string[],changes:JobUpdateInput):JobRecord[]{return this.database.transaction((values:string[])=>values.map((id)=>this.update(id,changes)))(ids);}
  bulkDuplicate(ids:string[]):JobRecord[]{return this.database.transaction((values:string[])=>values.map((id)=>this.duplicate(id)))(ids);}
  delete(id:string):void{const job=this.require(id);if(!deletable.has(job.status))throw new ConflictError('This job state cannot be deleted.');if(this.repository.hasOutputs(id))throw new ConflictError('Jobs with output records cannot be deleted.');this.repository.delete(id);}
  bulkDelete(ids:string[]):void{this.database.transaction((values:string[])=>values.forEach((id)=>this.delete(id)))(ids);}
  reorder(id:string,direction:'up'|'down'):JobRecord{const job=this.require(id);const operator=direction==='up'?'<':'>';const order=direction==='up'?'DESC':'ASC';const adjacent=this.database.prepare(`SELECT id,scene_number AS sceneNumber FROM jobs WHERE project_id=? AND scene_number ${operator} ? ORDER BY scene_number ${order} LIMIT 1`).get(job.projectId,job.sceneNumber) as {id:string;sceneNumber:number}|undefined;if(!adjacent)return job;this.database.transaction(()=>{this.database.prepare('UPDATE jobs SET scene_number=-scene_number WHERE id IN (?,?)').run(id,adjacent.id);this.database.prepare('UPDATE jobs SET scene_number=? WHERE id=?').run(adjacent.sceneNumber,id);this.database.prepare('UPDATE jobs SET scene_number=? WHERE id=?').run(job.sceneNumber,adjacent.id);})();return this.require(id);}
  renumber(projectId:string):JobRecord[]{return this.database.transaction(()=>{const rows=this.database.prepare('SELECT id FROM jobs WHERE project_id=? ORDER BY scene_number,created_at').all(projectId) as {id:string}[];this.database.prepare('UPDATE jobs SET scene_number=-scene_number WHERE project_id=?').run(projectId);const statement=this.database.prepare('UPDATE jobs SET scene_number=?,updated_at=? WHERE id=?');rows.forEach((row,index)=>statement.run(index+1,new Date().toISOString(),row.id));return rows.map((row)=>this.require(row.id));})();}
  private require(id:string):JobRecord{const job=this.repository.getById(id);if(!job)throw new NotFoundError('Job not found.');return job;}
}
