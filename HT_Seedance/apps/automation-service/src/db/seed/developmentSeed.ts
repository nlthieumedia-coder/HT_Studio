import { JobState } from '@ht-dola/shared';
import type { SqliteDatabase } from '../database.js';
import { createRepositories } from '../repositories/index.js';

export const seedDevelopmentData=(database:SqliteDatabase):{seeded:boolean;message:string}=>{
  const repositories=createRepositories(database);
  if(repositories.projects.list({limit:1,offset:0,sortBy:'createdAt',sortDirection:'desc'}).total>0)return{seeded:false,message:'Seed skipped because projects already exist.'};
  database.transaction(()=>{
    const projects=[repositories.projects.create({name:'Autumn Launch',description:'Development seed project.',outputDirectory:null}),repositories.projects.create({name:'Social Shorts',description:'Vertical video development seed.',outputDirectory:null})];
    const accounts=[repositories.accounts.create({displayName:'Studio A',provider:'Dola',enabled:true}),repositories.accounts.create({displayName:'Studio B',provider:'Dola',enabled:true}),repositories.accounts.create({displayName:'Studio C',provider:'Dola',enabled:false})];
    for(let index=0;index<10;index++){const project=projects[index%projects.length]!;repositories.jobs.create({projectId:project.id,sceneNumber:Math.floor(index/2)+1,provider:'dola',accountId:accounts[index%accounts.length]!.id,prompt:`Development prompt ${index+1}`,inputMedia:{},durationSeconds:5,aspectRatio:index%2?'9:16':'16:9',resolution:'1080p',status:index<2?JobState.COMPLETED:JobState.DRAFT,priority:0,maxAttempts:3});}
    repositories.logs.insert({level:'INFO',module:'seed',jobId:null,projectId:null,workerId:null,accountId:null,event:'development_seed',message:'Development seed completed.',metadata:{projects:2,accounts:3,jobs:10}});
  })();
  return{seeded:true,message:'Seeded 2 projects, 3 accounts, 10 jobs, and 1 log.'};
};
