// Preserve the approved domain in an existing generated Pages output.
// This does not build, deploy, alter DNS, or modify repository settings.
import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const canonical=join(dirname(fileURLToPath(import.meta.url)),'..','CNAME');
const target=resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)),'..'));
const domain=await readFile(canonical,'utf8');
if(domain!=='web.appherday.com\n' && domain!=='web.appherday.com')throw new Error('Canonical CNAME does not match the approved domain.');
await access(join(target,'index.html'));
await writeFile(join(target,'CNAME'),'web.appherday.com\n');
if((await readFile(join(target,'CNAME'),'utf8'))!=='web.appherday.com\n')throw new Error('Published-output CNAME verification failed.');
console.log('Verified output CNAME: web.appherday.com');
