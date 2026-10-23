import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { motifRecordPath, verifyQualifiedMotifBackend } from '../candy-runtime/src/capabilities/motifQualification.js';

test('incremental production binding rejects substituted records and never falls back to historical installation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'candy-scope6d-binding-test-'));
  try {
    const selected = motifRecordPath(root, 'CUDA_INCREMENTAL');
    await mkdir(dirname(selected), { recursive: true });
    const historical = join(root, '.local', 'cuda_incremental-qualified-build.json');
    await writeFile(historical, JSON.stringify({ backend: 'CUDA_INCREMENTAL', qualifiedCommit: 'feb9e9d79722795fcc7c46c7b278889e4c739de4' }));
    const unavailable = { available: false, reason: 'motif_qualification_unavailable_or_stale' };
    assert.deepEqual(await verifyQualifiedMotifBackend({ runtimeRoot: root }, 'CUDA_INCREMENTAL'), unavailable);
    // Even a syntactically valid replacement must fail before any environment
    // probe: record identity is approved as exact bytes, not self-asserted fields.
    for (const bytes of ['{}', '{"backend":"CUDA_INCREMENTAL"}', 'null', '\ufeff{}', '{}\r\n']) {
      await writeFile(selected, bytes);
      let probes = 0;
      assert.deepEqual(await verifyQualifiedMotifBackend({ runtimeRoot: root }, 'CUDA_INCREMENTAL', {
        environment: () => { probes++; throw new Error('must not probe substituted record'); },
      }), unavailable);
      assert.equal(probes, 0);
    }
    assert.equal(motifRecordPath(root, 'CUDA_STATIC'), join(root, '.local', 'cuda_static-qualified-build.json'));
  } finally {
    assert.ok(basename(root).startsWith('candy-scope6d-binding-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
