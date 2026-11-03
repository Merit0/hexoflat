const ZERO_SHA = /^0+$/;

export interface PushRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

export interface GitProbe {
  hasCommit(sha: string): boolean;
  mergeBase(sha: string): string | null;
}

export interface DiffPlan {
  ranges: string[];
  fullSuiteBecause: string | null;
}

export function parsePushRefs(stdin: string): PushRef[] {
  return stdin
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({
      localRef: localRef as string,
      localSha: localSha as string,
      remoteRef: remoteRef as string,
      remoteSha: remoteSha as string,
    }));
}

export function diffRanges(refs: readonly PushRef[], git: GitProbe): DiffPlan {
  const ranges: string[] = [];
  for (const ref of refs) {
    if (ZERO_SHA.test(ref.localSha)) continue;
    if (ZERO_SHA.test(ref.remoteSha)) {
      const base = git.mergeBase(ref.localSha);
      if (base === null) {
        return {
          ranges: [],
          fullSuiteBecause: `new branch ${ref.localRef}: no origin/main to compare with`,
        };
      }
      ranges.push(`${base}..${ref.localSha}`);
      continue;
    }
    if (!git.hasCommit(ref.remoteSha)) {
      return {
        ranges: [],
        fullSuiteBecause: `${ref.remoteRef}: remote commit ${ref.remoteSha.slice(0, 7)} is not known locally`,
      };
    }
    ranges.push(`${ref.remoteSha}..${ref.localSha}`);
  }
  return { ranges, fullSuiteBecause: null };
}
