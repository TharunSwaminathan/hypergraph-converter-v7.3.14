import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const exec=promisify(execFile);
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const npmCli="\\\\wsl.localhost\\Ubuntu\\home\\tharu\\.nvm\\versions\\node\\v22.23.1\\lib\\node_modules\\npm\\bin\\npm-cli.js";
const python="C:\\Users\\tharu\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python";
const report={schemaVersion:"candy.scope4c-application-gates/1",status:"RUNNING",gates:[],dependencyUpdates:false};
const commands=[
  ["npm run test",process.execPath,["scripts/run-node-tests.mjs"]],
  ["npm run lint",process.execPath,["node_modules/eslint/bin/eslint.js","."]],
  ["npm run build",process.execPath,["node_modules/vite/bin/vite.js","build"]],
  ["npm run build:github",process.execPath,["node_modules/vite/bin/vite.js","build","--base=/hypergraph-converter/"]],
  ["npm audit --omit=dev",process.execPath,[npmCli,"audit","--omit=dev","--json"]],
  ["git diff --check","git",["diff","--check"]],
];
try {
  for(const [gate,command,args] of commands){
    const started=Date.now();
    const {stdout,stderr}=await exec(command,args,{cwd:root,shell:false,windowsHide:true,timeout:600000,maxBuffer:4*1024*1024,env:{...process.env,PATH:`${python};${process.env.PATH}`}});
    const output={gate,command,args,exitCode:0,status:"PASS",durationMs:Date.now()-started,stdout,stderr};
    if(gate==="npm run test"){const counts=/Node test suite passed: (\d+)\/(\d+) files/.exec(stdout);if(!counts)throw Error("Missing full-suite test count");output.passedTestFiles=Number(counts[1]);output.totalTestFiles=Number(counts[2]);}
    if(gate==="npm audit --omit=dev")output.audit=JSON.parse(stdout).metadata;
    report.gates.push(output);console.log(`${gate}: PASS${output.passedTestFiles?` (${output.passedTestFiles}/${output.totalTestFiles} test files)`:""}`);
  }
  report.status="APPLICATION_GATES_PASS";
}catch(error){report.status="APPLICATION_GATES_FAIL";report.failure={message:error.message,exitCode:error.code,stdout:error.stdout,stderr:error.stderr};process.exitCode=1;console.error(error.message);}
finally{await writeFile(join(root,"artifacts","candy-scope4c-application-gates.json"),JSON.stringify(report,null,2)+"\n");console.log(report.status);}
