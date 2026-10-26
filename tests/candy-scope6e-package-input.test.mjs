import { execFileSync } from "node:child_process";

// Every Git object/ref below belongs to a disposable synthetic repository.
// Never stage, commit or change refs in the product or populated witness.
const program = String.raw`
import importlib.util, pathlib, os, shutil, stat, subprocess, sys, tempfile, zipfile
source = pathlib.Path.cwd()
def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
pack = load(source / 'scripts/package-portable-source.py', 'input_pack')
verify = load(source / 'scripts/verify-portable-archive.py', 'input_verify')
with tempfile.TemporaryDirectory(prefix='c6e-input-') as temporary:
    work = pathlib.Path(temporary); root = work / 'repo'; root.mkdir()
    env = {k:v for k,v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_AUTHOR_NAME='Synthetic', GIT_AUTHOR_EMAIL='fixture@example.invalid',
               GIT_COMMITTER_NAME='Synthetic', GIT_COMMITTER_EMAIL='fixture@example.invalid')
    def git(*args, data=None):
        return subprocess.run(['git','-C',str(root),*args],input=data,env=env,
                              capture_output=True,check=True).stdout
    git('init','--quiet')
    files = {rel:(source / rel).read_bytes() for rel in pack.REQUIRED_FILES}
    required = ['candy-runtime/src/artifacts/artifactStore.js'] + [
        'candy-runtime/native/'+d+'/'+n for d in ['hypergraph-motif-cuda','hypergraph-motif-cuda-incremental']
        for n in ['Makefile','src/main.cu']]
    for rel in required: files[rel] = (source / rel).read_bytes()
    binary = bytes(range(256)) + b'\r\n\x00\xffBINARY'
    files.update({'scripts/legitimate.mjs':b'export const value = 1;\n', 'README.md':b'fixture\n',
                  'public/exact.png':binary, 'src/fixtures/artifacts/intentional.js':b'fixture\n',
                  'artifacts/private.json':b'PRIVATE', 'candy-runtime/.local/qualification.json':b'PRIVATE',
                  'candy-runtime/native/hypergraph-motif-cuda-incremental-scope6d-tranche1-any/src/main.cu':b'PRIVATE'})
    def tree(entries):
        nested = {}
        for rel, (mode, kind, oid) in entries.items():
            node = nested; components = rel.split('/')
            for part in components[:-1]: node = node.setdefault(part, {})
            node[components[-1]] = (mode, kind, oid)
        def emit(node):
            rows = []
            for name, item in sorted(node.items()):
                if isinstance(item, dict): mode, kind, oid = '040000','tree',emit(item)
                else: mode, kind, oid = item
                rows.append((mode+' '+kind+' '+oid+'\t'+name+'\0').encode())
            return git('mktree','-z',data=b''.join(rows)).decode().strip()
        return emit(nested)
    entries = {}
    for rel, data in files.items():
        path = root / rel; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
        oid = git('hash-object','-w','--stdin',data=data).decode().strip()
        entries[rel] = ('100644','blob',oid)
    commit = git('commit-tree',tree(entries),data=b'synthetic inventory\n').decode().strip()
    git('update-ref','refs/heads/fixture',commit); git('symbolic-ref','HEAD','refs/heads/fixture')
    first = work / 'clean.zip'; pack.create_zip(root, first, project_name='product')
    report,_ = verify.verify(first,'product',source_root=root,revision=commit)
    assert report['ok'] and report['verificationLevel']=='commit-bound' and report['sourceCommit']==commit, report
    with zipfile.ZipFile(first) as z:
        assert z.read('product/public/exact.png')==binary
        assert z.read('product/scripts/legitimate.mjs')==files['scripts/legitimate.mjs']
        assert all('product/'+p in z.namelist() for p in required)
        assert 'product/src/fixtures/artifacts/intentional.js' in z.namelist()
        assert all('product/'+p not in z.namelist() for p in files if pack.is_excluded(root/p,root))
    # Same immutable commit, arbitrary untracked inputs in unrelated directories,
    # and changed text/binary checkout bytes: none may change release output.
    for rel in ['scripts/arbitrary-future-diagnostic.mjs','src/arbitrary-untracked.txt']:
        path=root/rel; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(b'UNTRACKED')
    (root/'scripts/legitimate.mjs').write_bytes(b'export const value = 1;\r\n')
    (root/'README.md').write_bytes(b'fixture\r\n')
    (root/'public/exact.png').write_bytes(b'DIRTY_BINARY')
    second = work / 'populated.zip'; pack.create_zip(root,second,revision=commit,project_name='product')
    assert first.read_bytes()==second.read_bytes()
    assert verify.verify(second,'product',source_root=root,revision=commit)[0]['ok']
    # Environment-selected other metadata must not redirect Git input reads.
    previous=os.environ.get('GIT_DIR'); os.environ['GIT_DIR']=str(work/'wrong-metadata')
    try:
        third=work/'environment.zip'; pack.create_zip(root,third,project_name='product')
        assert third.read_bytes()==first.read_bytes()
        assert verify.verify(third,'product',source_root=root)[0]['ok']
    finally:
        if previous is None: os.environ.pop('GIT_DIR',None)
        else: os.environ['GIT_DIR']=previous
    # Independent verification uses external trusted Git, not a producer manifest.
    for index,(name,data) in enumerate([
        ('product/scripts/arbitrary-future-diagnostic.mjs',b'INJECTED'),
        ('product/src/arbitrary-untracked.txt',b'INJECTED'),
        ('product/unexpected-empty/',b''),
    ]):
        archive=work/('injected-%d.zip'%index);shutil.copyfile(first,archive)
        with zipfile.ZipFile(archive,'a') as z:
            info=zipfile.ZipInfo(name);info.create_system=3
            info.external_attr=((stat.S_IFDIR|0o755) if name.endswith('/') else (stat.S_IFREG|0o644))<<16
            z.writestr(info,data)
        bad,_=verify.verify(archive,'product',source_root=root,revision=commit)
        assert not bad['ok'] and name in bad['issues']['sourceInventory'],bad
    for mutation in ['missing','changed']:
        archive=work/(mutation+'.zip')
        with zipfile.ZipFile(first) as src,zipfile.ZipFile(archive,'w') as dst:
            for info in src.infolist():
                if info.filename=='product/public/exact.png':
                    if mutation=='missing':continue
                    data=b'ALTERED'
                else:data=src.read(info)
                dst.writestr(info,data)
        assert not verify.verify(archive,'product',source_root=root,revision=commit)[0]['ok']
    # A commit can contain links/submodules; a regular-looking checkout cannot
    # turn them into legitimate portable source. Do not resolve their targets.
    for mode,kind,oid in [('120000','blob',entries['README.md'][2]),('160000','commit',commit)]:
        unsafe=dict(entries);unsafe['src/unsafe']= (mode,kind,oid)
        revision=git('commit-tree',tree(unsafe),data=b'unsafe fixture\n').decode().strip()
        try:pack.create_zip(root,work/'unsafe.zip',revision=revision)
        except RuntimeError:pass
        else:raise AssertionError('Non-regular Git source accepted')
        try:verify.verify(first,'product',source_root=root,revision=revision)
        except RuntimeError:pass
        else:raise AssertionError('Non-regular Git inventory accepted')
    for unsafe_names in [['src/bad./tool.js'],['src/bad /tool.js'],['src/raw\\alias.js'],
                         ['src/case.js','src/CASE.js']]:
        unsafe=dict(entries)
        for name in unsafe_names:unsafe[name]=entries['README.md']
        revision=git('commit-tree',tree(unsafe),data=b'unsafe path fixture\n').decode().strip()
        for operation in [lambda:pack.create_zip(root,work/'unsafe-name.zip',revision=revision),
                          lambda:verify.verify(first,'product',source_root=root,revision=revision)]:
            try:operation()
            except RuntimeError:pass
            else:raise AssertionError('Unsafe committed path accepted: '+str(unsafe_names))
    nested=root/'not-the-worktree-root';nested.mkdir()
    try:pack.create_zip(nested,work/'ancestor.zip')
    except RuntimeError:pass
    else:raise AssertionError('Ancestor repository silently selected')
    # Missing Git never silently becomes a filesystem release. Deliberately
    # reviewed no-Git trees/fixtures retain explicit snapshot operation.
    os.rename(root/'.git',root/'.git-unavailable')
    output=work/'keep.zip';output.write_bytes(b'PRESERVE')
    try:pack.create_zip(root,output)
    except RuntimeError:pass
    else:raise AssertionError('Silent no-Git fallback')
    assert output.read_bytes()==b'PRESERVE'
    try:verify.verify(first,'product',source_root=root)
    except RuntimeError:pass
    else:raise AssertionError('No-Git commit verification accepted')
    # Remove the temporary metadata from the reviewed snapshot inventory by
    # moving it outside root, not by relying on a new exclusion pattern.
    os.rename(root/'.git-unavailable',work/'fixture-metadata')
    pack.create_zip(root,work/'snapshot.zip',source_mode='snapshot',project_name='product')
    structural,_=verify.verify(work/'snapshot.zip','product')
    assert structural['ok'] and structural['verificationLevel']=='structural-only'
    with zipfile.ZipFile(work/'snapshot.zip') as z:
        assert 'product/scripts/arbitrary-future-diagnostic.mjs' in z.namelist()
    print('Committed inventory, untracked injection, LF/CRLF, binary identity, independent verifier, unsafe modes and explicit no-Git snapshot policy passed.')
`;

execFileSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"),
  ["-B", "-c", program], { cwd: process.cwd(), windowsHide: true, timeout: 120000, stdio: "inherit",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
