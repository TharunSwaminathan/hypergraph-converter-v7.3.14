import hashlib,json,os,pathlib,shutil,subprocess,zipfile
r=pathlib.Path.cwd();old=r.parent/'hypergraph-converter-v7.3.14';o=r/'artifacts/candy-scope6e-v3-work';sha='e84f06cdaa750803a06007ade63124b6bce693c8'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):
    with p.open('x',encoding='utf8') as f:json.dump(v,f,indent=2);f.write('\n')
deployment=r/'artifacts/v3run'
assert not deployment.exists();deployment.mkdir()
with zipfile.ZipFile(o/'clean.zip') as z:
    skipped=['product/candy-runtime/native/hypergraph-motif-cuda/src/main.cu','product/candy-runtime/native/hypergraph-motif-cuda/Makefile']
    for name in skipped:
        rel=name.removeprefix('product/');a=(old/rel).read_bytes();b=z.read(name)
        assert a.replace(b'\r\n',b'\n')==b.replace(b'\r\n',b'\n')
        assert subprocess.check_output(['git','hash-object','--path='+rel,str(old/rel)],cwd=r).strip()==subprocess.check_output(['git','rev-parse',sha+':'+rel],cwd=r).strip()
    for info in z.infolist():
        if info.filename not in skipped:z.extract(info,deployment)
root=deployment/'product';copies=[]
for backend,folder,recordname,exe in [
 ('CUDA_STATIC','hypergraph-motif-cuda','cuda_static-qualified-build.json','candy-hypergraph-motif-cuda'),
 ('CUDA_INCREMENTAL','hypergraph-motif-cuda-incremental-scope6d-tranche1-f3fa7dc3','cuda_incremental-scope6d-tranche1-f3fa7dc3-qualified-build.json','candy-hypergraph-motif-cuda-incremental')]:
    recordpath=old/'candy-runtime/.local'/recordname;record=json.loads(recordpath.read_text(encoding='utf8'))
    for rel,key in [('src/main.cu','sourceSha256'),('Makefile','makefileSha256'),('build/'+exe,'binarySha256')]:
        source=old/'candy-runtime/native'/folder/rel;target=root/'candy-runtime/native'/folder/rel
        assert h(source)==record[key],str(source)
        if target.exists():assert h(target)==record[key],str(target)
        else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        copies.append(dict(kind='qualified native '+backend,source=str(source),target=str(target),sha256=h(target)))
    target=root/'candy-runtime/.local'/recordname;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(recordpath,target)
    copies.append(dict(kind='exact qualification record',source=str(recordpath),target=str(target),sha256=h(target)))
    for rel,digest in record['evidence'].items():
        source=old/rel;target=root/rel;assert h(source)==digest;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        copies.append(dict(kind='qualification evidence',source=str(source),target=str(target),sha256=h(target)))
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip()==sha
save(o/'live-deployment-qualified.json',dict(candidate=sha,root=str(root),archiveSha256=h(o/'clean.zip'),
 method='Fresh deployment assembled from authoritative archive plus exact existing qualified native installation bytes. Static source/Makefile CRLF representation is the same candidate Git blob and is copied unchanged to preserve its independent byte qualification. No existing source or witness is modified; ordinary production verifier, no injected discovery or runner.',
 nativeQualificationTagSource='Enclosing V3 worktree exact preserved tags; no refs created or changed.',copies=copies))
print(json.dumps(dict(deployment=str(root),qualifiedCopies=len(copies))),flush=True)
