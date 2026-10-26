"""Independent malformed-archive evidence against the actual exact-SHA ZIP."""
import hashlib,importlib.util,json,pathlib,shutil,stat,tempfile,zipfile
r=pathlib.Path.cwd();o=r/'artifacts/scope6e-snapshot-exact-d2a2bdb'
spec=importlib.util.spec_from_file_location('exact_qualification',o/'qualify.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
verify=q.exact('scripts/verify-portable-archive.py','adversarial_exact_verifier')
original=o/'clean.zip';good,_=verify.verify(original,'product',source_root=r,revision=q.sha)
assert good['ok'] and good['sourceCommit']==q.sha
R=stat.S_IFREG|0o644;reserved='hypergraph-motif-cuda-incremental-scope6d-tranche1-untrusted/src/main.cu'
cases=[
 ('arbitrary untracked script','product/scripts/arbitrary-new-diagnostic.mjs',R,'sourceInventory'),
 ('arbitrary untracked allowed-directory file','product/src/arbitrary-new-file.txt',R,'sourceInventory'),
 ('local native install','product/candy-runtime/native/'+reserved,R,'forbiddenMembers'),
 ('root artifacts','product/artifacts/qualification.json',R,'forbiddenMembers'),
 ('trailing dot','product/candy-runtime./native/'+reserved,R,'nonCanonicalMembers'),
 ('trailing space','product/candy-runtime /native/'+reserved,R,'nonCanonicalMembers'),
 ('mixed slash alias','product/candy-runtime/native.\\'+reserved,R,'backslashMembers'),
 ('raw backslash','product\\src\\payload.txt',R,'backslashMembers'),
 ('traversal','product/../payload.txt',R,'traversalMembers'),
 ('POSIX absolute','/payload.txt',R,'absoluteMembers'),
 ('Windows absolute','C:/payload.txt',R,'absoluteMembers'),
 ('UNC','\\\\server\\share\\payload.txt',R,'backslashMembers'),
 ('pairing token','product/pairing-token.json',R,'forbiddenMembers'),
 ('credential','product/credentials.json',R,'forbiddenMembers'),
 ('environment credential','product/.env.local',R,'forbiddenMembers'),
 ('unsafe executable alias','product/native.exe ',R,'nonCanonicalMembers'),
 ('NUL spelling','product/src/ordinary\0hidden',R,'nonCanonicalMembers'),
 ('control spelling','product/src/ordinary\x01hidden',R,'nonCanonicalMembers'),
 ('illegal character','product/src/ordinary:name',R,'nonCanonicalMembers'),
 ('symlink','product/src/link',stat.S_IFLNK|0o777,'symlinkMembers'),
 ('special FIFO','product/src/fifo',stat.S_IFIFO|0o644,'specialMembers'),
 ('writable mode','product/src/writeable',stat.S_IFREG|0o666,'worldOrGroupWritable'),
 ('unexpected executable mode','product/src/ordinary.txt',stat.S_IFREG|0o755,'unexpectedExecutableFiles'),
 ('directory mode','product/unsafe-dir/',stat.S_IFDIR|0o700,'incorrectDirectoryModes'),
]
results=[]
with tempfile.TemporaryDirectory(prefix='candy-d2a2bdb-adversarial-') as temp:
    for i,(label,name,mode,issue) in enumerate(cases):
        archive=pathlib.Path(temp)/(str(i)+'.zip');shutil.copyfile(original,archive)
        with zipfile.ZipFile(archive,'a') as z:
            info=zipfile.ZipInfo(name);info.filename=name;info.create_system=3;info.external_attr=mode<<16;z.writestr(info,b'SYNTHETIC_UNTRUSTED_BYTES')
        report,_=verify.verify(archive,'product',**(dict(source_root=r,revision=q.sha) if issue=='sourceInventory' else {}))
        assert not report['ok'] and report['issues'][issue],(label,report)
        results.append(dict(case=label,rawName=name,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),status='REJECTED',expectedIssue=issue,report=report))
controls=['README.md','scripts/qualify-scope6a-package.py','tests/candy-scope6a-release.test.mjs','candy-runtime/src/artifacts/artifactStore.js','candy-runtime/native/hypergraph-motif-cuda/src/main.cu','candy-runtime/native/hypergraph-motif-cuda-incremental/src/main.cu']
with zipfile.ZipFile(original) as z:assert all('product/'+p in z.namelist() for p in controls)
q.save('adversarial-matrix.json',dict(candidate=q.sha,status='PASS',actualReleaseSha256=good['sha256'],rejected=len(results),acceptedCanonicalControls=len(controls),controls=controls,originalCommitBoundReport=good,cases=results,
 unchangedCommittedInputPolicyFixture='Both fresh full suites separately exercise untracked/dirty/EOL/binary mutation, unsafe committed inputs and no-Git behavior. No test or package-policy byte was modified.'))
print(json.dumps(dict(status='PASS',rejected=len(results),acceptedCanonicalControls=len(controls),candidate=q.sha)),flush=True)
