import type { PoolOutcome } from "./api/types/PoolOutcome";
import type { JobRow } from "./daemonState";

/** `"php@8.3.12"` — cùng một chuỗi làm key React lẫn key tra `installingJob`. */
export type VersionKey = string;

export function versionKey(kind: string, version: string): VersionKey {
  return `${kind}@${version}`;
}

/** Cách vẽ một `ExtensionChange.pool` — ba giá trị, ba banner khác nhau, không giá trị nào là lỗi. */
export type PoolBanner = "none" | "restartRequired" | "appliesNextStart";

export function poolBanner(outcome: PoolOutcome): PoolBanner {
  switch (outcome) {
    case "reloaded":
      return "none";
    case "restart_required":
      return "restartRequired";
    case "pool_not_running":
      return "appliesNextStart";
  }
}

/** Job đang theo dõi cho một hàng, từ `JobRow[]` `daemonState.applyJob` đã tính — không tự giữ map
 *  job thứ hai, chỉ tra lại cái đã có. */
export function jobFor(jobs: JobRow[], jobId: number | undefined): JobRow | undefined {
  return jobId === undefined ? undefined : jobs.find((job) => job.id === jobId);
}
