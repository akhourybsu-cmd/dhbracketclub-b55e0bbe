export interface FileWriterLease { release: () => void; exclusive: boolean; }
/** Same-device file ownership. No network, user identity or game authority is
 * granted by this lease; cloud writes still assert the authenticated account. */
export function acquireFileWriter(key: string): Promise<FileWriterLease | null> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return Promise.resolve({ release: () => {}, exclusive: false });
  return new Promise(resolve => {
    let settled = false;
    const finish = (lease: FileWriterLease | null) => {
      if (settled) { lease?.release(); return; }
      settled = true; clearTimeout(timer); resolve(lease);
    };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      void navigator.locks.request(`mesomon-writer:${key}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) { finish(null); return; }
        await new Promise<void>(release => { finish({ release, exclusive: true }); });
      }).catch(() => finish(null));
    } catch { finish(null); }
  });
}
