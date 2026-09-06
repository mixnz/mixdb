import { Channel, invoke } from "@tauri-apps/api/core";

import type { DaemonStatus } from "./api/types/DaemonStatus";
import type { ElevationStatus } from "./api/types/ElevationStatus";
import type { ServiceList } from "./api/types/ServiceList";
import type { SiteCreate } from "./api/types/SiteCreate";
import type { SiteCreation } from "./api/types/SiteCreation";
import type { SiteDetail } from "./api/types/SiteDetail";
import type { SiteList } from "./api/types/SiteList";
import type { SiteShare } from "./api/types/SiteShare";
import type { SiteSharing } from "./api/types/SiteSharing";
import type { SiteUpdate } from "./api/types/SiteUpdate";
import type { ProjectList } from "./api/types/ProjectList";
import type { ProjectDetail } from "./api/types/ProjectDetail";
import type { ProjectCreate } from "./api/types/ProjectCreate";
import type { ProjectUpdate } from "./api/types/ProjectUpdate";
import type { ProjectRemoval } from "./api/types/ProjectRemoval";
import type { ProjectSummary } from "./api/types/ProjectSummary";
import type { DomainStatusReport } from "./api/types/DomainStatusReport";
import type { CaStatus } from "./api/types/CaStatus";
import type { CertIssueReport } from "./api/types/CertIssueReport";

/**
 * Chỗ duy nhất module này gọi `invoke()`.
 *
 * Frontend không chạm mạng và không chạm đĩa: nó gọi qua đây và vẽ thứ quay về. Kiểu của những
 * thứ quay về là hợp đồng của MixEngine, vendor nguyên xi ở `api/types/` — đừng viết lại chúng ở
 * đây, đó là `npm run bindings`.
 */

/** Daemon đang ở trạng thái nào, nhìn từ máy này. */
export type Presence = "running" | "notAnswering" | "notRunning" | "notInstalled";

export function presence(): Promise<Presence> {
  return invoke<Presence>("mixengine_presence");
}

/** Khởi động daemon; trả về endpoint nó in ra khi đã sẵn sàng. */
export function startDaemon(): Promise<string> {
  return invoke<string>("mixengine_start");
}

export function status(): Promise<DaemonStatus> {
  return invoke<DaemonStatus>("mixengine_status");
}

/** `service.list` trả `{ services: [...] }`, không phải một mảng trần — đo được trên daemon thật,
 *  và `ServiceList` trong hợp đồng nói đúng như vậy. */
export function services(): Promise<ServiceList> {
  return invoke<ServiceList>("mixengine_services");
}

export type ServiceAction = "start" | "stop" | "restart";

export function serviceAction(id: string, action: ServiceAction): Promise<unknown> {
  return invoke("mixengine_service_action", { id, action });
}

/**
 * Mở stream sự kiện.
 *
 * Mỗi message là JSON **thô**: người gọi tự parse, vì một `type` chưa biết phải bỏ qua được chứ
 * không phải làm vỡ gì. Sự kiện của MixEngine internally tagged, và một biến thể sinh ra ở phiên
 * bản sau phải tới được một MixDB cũ như một object nó nhận ra và lờ đi.
 */
export function watch(onMessage: (raw: string) => void): Promise<void> {
  const channel = new Channel<string>();
  channel.onmessage = onMessage;
  return invoke("mixengine_watch", { onEvent: channel });
}

export function unwatch(): Promise<void> {
  return invoke("mixengine_unwatch");
}

/**
 * Mọi thao tác đang chờ quyền quản trị, kèm câu daemon tự viết cho từng cái.
 *
 * `daemon.status` chỉ mang một con số. Một tab mở ra khi đã có sẵn thao tác chờ không nhận
 * `elevation_required` nào — sự kiện đó chỉ bắn lúc hàng đợi đổi — nên đây là đường duy nhất thấy
 * chúng.
 */
export function elevationStatus(): Promise<ElevationStatus> {
  return invoke<ElevationStatus>("mixengine_elevation_status");
}

/** Cho phép cả lô thao tác đang chờ — đúng một prompt của hệ điều hành. */
export function elevationGrant(): Promise<unknown> {
  return invoke("mixengine_elevation_grant");
}

/** Bỏ cả lô đi. Từ chối là một kết cục bình thường, không phải một lỗi. */
export function elevationDrop(): Promise<unknown> {
  return invoke("mixengine_elevation_drop");
}

/** `project` lọc theo tên; bỏ trống thấy mọi site trong home. */
export function sites(project?: string): Promise<SiteList> {
  return invoke<SiteList>("mixengine_sites", { project });
}

/** Mọi thứ chỉ một lookup mới trả lời được: `doc_root_full`, `pool`, `services`. */
export function site(domain: string): Promise<SiteDetail> {
  return invoke<SiteDetail>("mixengine_site", { domain });
}

export function siteCreate(input: SiteCreate): Promise<SiteCreation> {
  return invoke<SiteCreation>("mixengine_site_create", { params: input });
}

/** `domains`/`services` thay thế toàn bộ danh sách site đang có, không merge. */
export function siteUpdate(input: SiteUpdate): Promise<{ site: SiteDetail }> {
  return invoke("mixengine_site_update", { params: input });
}

export function siteShare(input: SiteShare): Promise<SiteSharing> {
  return invoke<SiteSharing>("mixengine_site_share", { params: input });
}

export function siteUnshare(domain: string): Promise<unknown> {
  return invoke("mixengine_site_unshare", { domain });
}

export function projects(): Promise<ProjectList> {
  return invoke<ProjectList>("mixengine_projects");
}

/** Pin **hiệu lực** (file thắng row) kèm project — dùng cho cả trang chi tiết và form sửa. */
export function projectShow(name: string): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("mixengine_project_show", { name });
}

export function projectCreate(input: ProjectCreate): Promise<ProjectSummary> {
  return invoke<ProjectSummary>("mixengine_project_create", { params: input });
}

/** `pins` thay thế toàn bộ — gửi lại mọi pin hiện có cộng thay đổi. */
export function projectUpdate(input: ProjectUpdate): Promise<ProjectSummary> {
  return invoke<ProjectSummary>("mixengine_project_update", { params: input });
}

/** Thư mục và `mixengine.toml` được giữ nguyên — chỉ gỡ đăng ký. */
export function projectDelete(name: string): Promise<ProjectRemoval> {
  return invoke<ProjectRemoval>("mixengine_project_delete", { name });
}

/** `domain.dns_status` là cả liệt kê lẫn chẩn đoán một tên — bỏ trống `domain` thấy mọi tên. */
export function domains(domain?: string): Promise<DomainStatusReport> {
  return invoke<DomainStatusReport>("mixengine_domains", { domain });
}

export function domainAdd(site: string, domain: string, acceptRiskyTld: boolean): Promise<unknown> {
  return invoke("mixengine_domain_add", {
    params: { site: { domain: site }, domain, accept_risky_tld: acceptRiskyTld },
  });
}

export function domainRemove(domain: string): Promise<unknown> {
  return invoke("mixengine_domain_remove", { domain });
}

/** Hai câu trả lời tin cậy, không phải một: `trust` là kho hệ thống, `browsers` là NSS database. */
export function caStatus(): Promise<CaStatus> {
  return invoke<CaStatus>("mixengine_ca_status");
}

export function caRepair(): Promise<unknown> {
  return invoke("mixengine_ca_repair");
}

/** Bỏ trống `domain` để cấp cho mọi site có khai HTTPS — cùng một call vẽ bảng lẫn cấp lại. */
export function certs(domain?: string): Promise<CertIssueReport> {
  return invoke<CertIssueReport>("mixengine_certs", { domain });
}
