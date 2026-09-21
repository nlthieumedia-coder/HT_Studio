import { randomUUID } from 'node:crypto';
import { ACTIVE_JOB_STATES, type ProjectCreateInput, type ProjectListQuery, type ProjectUpdateInput } from '@ht-dola/shared';
import type { SqliteDatabase } from '../database.js';
import type { PaginatedResult, ProjectRecord } from '../types.js';
import { nowIso } from './helpers.js';

const runningStates = ACTIVE_JOB_STATES.filter((state) => state !== 'QUEUED');
const selectProject = `SELECT p.id,p.name,p.description,p.status,p.output_directory AS outputDirectory,
 p.default_provider AS defaultProvider,p.default_duration_seconds AS defaultDurationSeconds,
 p.default_aspect_ratio AS defaultAspectRatio,p.default_resolution AS defaultResolution,
 p.created_at AS createdAt,p.updated_at AS updatedAt,p.archived_at AS archivedAt,
 COUNT(j.id) AS totalJobs,
 COALESCE(SUM(CASE WHEN j.status='DRAFT' THEN 1 ELSE 0 END),0) AS draftJobs,
 COALESCE(SUM(CASE WHEN j.status='QUEUED' THEN 1 ELSE 0 END),0) AS queuedJobs,
 COALESCE(SUM(CASE WHEN j.status IN (${runningStates.map(() => '?').join(',')}) THEN 1 ELSE 0 END),0) AS runningJobs,
 COALESCE(SUM(CASE WHEN j.status='COMPLETED' THEN 1 ELSE 0 END),0) AS completedJobs,
 COALESCE(SUM(CASE WHEN j.status='FAILED' THEN 1 ELSE 0 END),0) AS failedJobs
 FROM projects p LEFT JOIN jobs j ON j.project_id=p.id`;

export class ProjectRepository {
  constructor(private readonly database: SqliteDatabase) {}
  create(input: ProjectCreateInput): ProjectRecord {
    const id=randomUUID(), now=nowIso();
    this.database.prepare(`INSERT INTO projects (id,name,description,status,output_directory,default_provider,default_duration_seconds,default_aspect_ratio,default_resolution,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.name,input.description??'','ACTIVE',input.outputDirectory??null,input.defaultProvider??'dola',input.defaultDurationSeconds??30,input.defaultAspectRatio??'9:16',input.defaultResolution??'720p',now,now);
    return this.getById(id)!;
  }
  getById(id:string):ProjectRecord|undefined { return this.database.prepare(`${selectProject} WHERE p.id=? GROUP BY p.id`).get(...runningStates,id) as ProjectRecord|undefined; }
  list(query:ProjectListQuery):PaginatedResult<ProjectRecord> {
    const conditions:string[]=[], params:unknown[]=[];
    if(query.status){conditions.push('p.status=?');params.push(query.status);}
    if(query.search){conditions.push('(p.name LIKE ? OR p.description LIKE ?)');params.push(`%${query.search}%`,`%${query.search}%`);}
    const where=conditions.length?` WHERE ${conditions.join(' AND ')}`:'';
    const total=(this.database.prepare(`SELECT COUNT(*) count FROM projects p${where}`).get(...params) as {count:number}).count;
    const columns={createdAt:'p.created_at',updatedAt:'p.updated_at',name:'p.name'} as const;
    const sortBy=query.sortBy??'createdAt',sortDirection=query.sortDirection??'desc';
    const items=this.database.prepare(`${selectProject}${where} GROUP BY p.id ORDER BY ${columns[sortBy]} ${sortDirection.toUpperCase()} LIMIT ? OFFSET ?`).all(...runningStates,...params,query.limit,query.offset) as ProjectRecord[];
    return {items,total,limit:query.limit,offset:query.offset};
  }
  update(id:string,input:ProjectUpdateInput):ProjectRecord|undefined {
    const map:Record<string,string>={name:'name',description:'description',outputDirectory:'output_directory',defaultProvider:'default_provider',defaultDurationSeconds:'default_duration_seconds',defaultAspectRatio:'default_aspect_ratio',defaultResolution:'default_resolution'};
    const fields:string[]=[],values:unknown[]=[];
    for(const [key,column] of Object.entries(map)){const value=input[key as keyof ProjectUpdateInput];if(value!==undefined){fields.push(`${column}=?`);values.push(value);}}
    if(!fields.length)return this.getById(id); fields.push('updated_at=?');values.push(nowIso(),id);
    return this.database.prepare(`UPDATE projects SET ${fields.join(',')} WHERE id=?`).run(...values).changes?this.getById(id):undefined;
  }
  archive(id:string):ProjectRecord|undefined {const now=nowIso();return this.database.prepare("UPDATE projects SET status='ARCHIVED',archived_at=?,updated_at=? WHERE id=?").run(now,now,id).changes?this.getById(id):undefined;}
  restore(id:string):ProjectRecord|undefined {const now=nowIso();return this.database.prepare("UPDATE projects SET status='ACTIVE',archived_at=NULL,updated_at=? WHERE id=?").run(now,id).changes?this.getById(id):undefined;}
  delete(id:string):boolean{return this.database.prepare('DELETE FROM projects WHERE id=?').run(id).changes>0;}
}
