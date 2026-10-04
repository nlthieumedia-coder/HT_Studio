import { execFile } from 'node:child_process';
import { join } from 'node:path';

export interface PythonRuntime { executable:string; prefixArgs:string[]; source:'HT_PYTHON_BIN'|'.venv'|'py -3'|'python'|'python3' }
export class PythonRuntimeError extends Error { readonly code='PYTHON_RUNTIME_MISSING'; constructor(){super('Không tìm thấy Python 3.10+. Hãy cài Python, bật Add Python to PATH, sau đó tạo môi trường ảo: python -m venv .venv');this.name='PythonRuntimeError'} }
export type PythonProbe=(executable:string,args:string[])=>Promise<boolean>;
const defaultProbe:PythonProbe=(executable,args)=>new Promise(resolve=>{execFile(executable,args,{windowsHide:true,timeout:5000},error=>resolve(!error))});

export async function detectPythonRuntime(env:NodeJS.ProcessEnv=process.env,platform:NodeJS.Platform=process.platform,probe:PythonProbe=defaultProbe,cwd=process.cwd()):Promise<PythonRuntime>{
  const configured=env.HT_PYTHON_BIN?.trim(), candidates:PythonRuntime[]=[];
  if(configured)candidates.push({executable:configured,prefixArgs:[],source:'HT_PYTHON_BIN'});
  candidates.push({executable:join(cwd,'.venv',platform==='win32'?'Scripts/python.exe':'bin/python'),prefixArgs:[],source:'.venv'});
  if(platform==='win32')candidates.push({executable:'py',prefixArgs:['-3'],source:'py -3'});
  candidates.push({executable:'python',prefixArgs:[],source:'python'},{executable:'python3',prefixArgs:[],source:'python3'});
  const versionCheck=['-c','import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'];
  for(const candidate of candidates)if(await probe(candidate.executable,[...candidate.prefixArgs,...versionCheck]))return candidate;
  throw new PythonRuntimeError();
}
