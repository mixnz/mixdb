//! Các lệnh module này lộ ra cho frontend.
//!
//! Không có nghiệp vụ nào ở đây: mỗi lệnh là một call JSON-RPC hoặc một câu hỏi về trạng thái, và
//! nghiệp vụ ở lại phía daemon. Đó là luật `CLAUDE.md` bên MixEngine giữ cho mọi client của nó, và
//! là lý do màn hình bên này vẽ được từ dữ liệu thay vì tự suy ra.

use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::State;

use crate::error::AppError;

use super::state::MixEngineState;
use super::{events, health, rpc};

/// Daemon đang chạy, đang câm, chưa chạy, hay chưa được cài.
#[tauri::command]
pub async fn mixengine_presence() -> health::Presence {
    health::presence().await
}

/// Khởi động daemon. Trả về endpoint nó in ra khi đã sẵn sàng.
#[tauri::command]
pub async fn mixengine_start() -> Result<String, AppError> {
    health::start_daemon().await
}

/// Cả hai lệnh đọc dưới đây trả thẳng `Value`, không giải vào struct của riêng MixDB.
///
/// Rust không đọc field nào trong hai câu trả lời này — nó chuyển tiếp. Một struct ở đây sẽ là bản
/// chép tay thứ hai của một hợp đồng đã có bản sinh tự động ở `src/modules/mixengine/api/types/`,
/// và bản chép tay đầu tiên đã sai ngay: nó thiếu `last_started_at` và `last_exit_code`, nên
/// frontend gõ kiểu `ServiceSummary` sẽ nhận `undefined` cho field hợp đồng nói là có.
#[tauri::command]
pub async fn mixengine_status() -> Result<Value, AppError> {
    rpc::call("daemon.status", json!({})).await
}

#[tauri::command]
pub async fn mixengine_services() -> Result<Value, AppError> {
    rpc::call("service.list", json!({})).await
}

/// `start`, `stop` hoặc `restart` một service.
///
/// Ba method này là ngoại lệ duy nhất của MixEngine nhận `wait` thay vì trả về một job: thời gian
/// chờ bị chặn bởi ready timeout mà recipe của chính service khai, và mọi bước đã ở trên stream sự
/// kiện — nên một call đang chờ không bao giờ là một call mù.
#[tauri::command]
pub async fn mixengine_service_action(id: String, action: String) -> Result<Value, AppError> {
    let method = match action.as_str() {
        "start" => "service.start",
        "stop" => "service.stop",
        "restart" => "service.restart",
        // Không phải lỗi của người dùng: frontend là chỗ duy nhất gọi lệnh này, nên một `action`
        // lạ là một lỗi lập trình và đi ra dưới dạng lỗi giao thức.
        other => {
            return Err(err!(
                "error.mixengineProtocol",
                message = format!("no service action `{other}`")
            ))
        }
    };
    rpc::call(method, json!({ "id": id, "wait": true })).await
}

/// Mở stream sự kiện. Mở lại là đóng cái đang mở.
#[tauri::command]
pub async fn mixengine_watch(
    on_event: Channel<String>,
    state: State<'_, MixEngineState>,
) -> Result<(), AppError> {
    events::stream_events(on_event, &state).await
}

/// Đóng stream. Gọi khi không có gì mở là vô hại — cleanup của một effect chạy hai lần trong
/// StrictMode.
#[tauri::command]
pub fn mixengine_unwatch(state: State<'_, MixEngineState>) {
    state.stop();
}

/// Mọi thao tác đang chờ quyền quản trị, kèm câu mô tả daemon tự viết cho từng cái.
///
/// `daemon.status` chỉ mang một con số (`ElevationSummary.pending`); danh sách thật ở đây. Một tab
/// mở ra khi đã có sẵn thao tác chờ không nhận `elevation_required` nào — sự kiện đó chỉ bắn lúc
/// hàng đợi đổi — nên đây là đường duy nhất thấy chúng.
#[tauri::command]
pub async fn mixengine_elevation_status() -> Result<Value, AppError> {
    rpc::call("elevation.status", json!({})).await
}

/// Cho phép cả lô thao tác đang chờ. Bật đúng một prompt của hệ điều hành.
#[tauri::command]
pub async fn mixengine_elevation_grant() -> Result<Value, AppError> {
    rpc::call("elevation.grant", json!({})).await
}

/// Bỏ cả lô đi. Từ chối là một kết cục API mô hình hóa được, không phải một lỗi.
#[tauri::command]
pub async fn mixengine_elevation_drop() -> Result<Value, AppError> {
    rpc::call("elevation.drop", json!({})).await
}

/// `project` lọc theo tên; bỏ trống thấy mọi site trong home.
#[tauri::command]
pub async fn mixengine_sites(project: Option<String>) -> Result<Value, AppError> {
    let params = match project {
        Some(name) => json!({ "project": { "name": name } }),
        None => json!({}),
    };
    rpc::call("site.list", params).await
}

/// Luôn tra theo domain — MixDB không dùng `SiteRef::Path`, chỉ CLI đứng trong thư mục mới cần nó.
#[tauri::command]
pub async fn mixengine_site(domain: String) -> Result<Value, AppError> {
    rpc::call("site.show", json!({ "site": { "domain": domain } })).await
}

/// `params` đã đúng hình `SiteCreate` từ frontend — không giải vào struct Rust riêng, đó sẽ là bản
/// chép tay thứ hai của một hợp đồng đã gõ đúng ở TypeScript (spec Pha 2, mục 5).
#[tauri::command]
pub async fn mixengine_site_create(params: Value) -> Result<Value, AppError> {
    rpc::call("site.create", params).await
}

/// `params` đúng hình `SiteUpdate`.
#[tauri::command]
pub async fn mixengine_site_update(params: Value) -> Result<Value, AppError> {
    rpc::call("site.update", params).await
}

/// `params` đúng hình `SiteShare`.
#[tauri::command]
pub async fn mixengine_site_share(params: Value) -> Result<Value, AppError> {
    rpc::call("site.share", params).await
}

#[tauri::command]
pub async fn mixengine_site_unshare(domain: String) -> Result<Value, AppError> {
    rpc::call("site.unshare", json!({ "site": { "domain": domain } })).await
}

/// Chỉ để dựng dropdown project ở dialog tạo site — không phải một màn hình Projects.
#[tauri::command]
pub async fn mixengine_projects() -> Result<Value, AppError> {
    rpc::call("project.list", json!({})).await
}

/// Tra một project theo tên, kèm pin **hiệu lực** (file thắng row).
#[tauri::command]
pub async fn mixengine_project_show(name: String) -> Result<Value, AppError> {
    rpc::call("project.show", json!({ "project": { "name": name } })).await
}

/// `params` đúng hình `ProjectCreate` từ frontend — không giải vào struct Rust riêng, cùng lý do
/// `mixengine_site_create` đã theo (Pha 2 spec, mục 5).
#[tauri::command]
pub async fn mixengine_project_create(params: Value) -> Result<Value, AppError> {
    rpc::call("project.create", params).await
}

/// `params` đúng hình `ProjectUpdate`. `pins` thay thế toàn bộ — frontend gửi lại mọi pin hiện có
/// cộng thay đổi, không gửi mỗi pin mới.
#[tauri::command]
pub async fn mixengine_project_update(params: Value) -> Result<Value, AppError> {
    rpc::call("project.update", params).await
}

/// Xoá đăng ký — thư mục và `mixengine.toml` được giữ nguyên (`ProjectRemoval.root_kept`/
/// `manifest_kept`), UI phải nói rõ điều đó ở hộp thoại xác nhận.
#[tauri::command]
pub async fn mixengine_project_delete(name: String) -> Result<Value, AppError> {
    rpc::call("project.delete", json!({ "project": { "name": name } })).await
}

/// `domain.dns_status` là cả `domain.list` lẫn chẩn đoán một tên — bỏ trống `domain` thấy mọi tên.
#[tauri::command]
pub async fn mixengine_domains(domain: Option<String>) -> Result<Value, AppError> {
    rpc::call("domain.dns_status", json!({ "domain": domain })).await
}

#[tauri::command]
pub async fn mixengine_domain_add(params: Value) -> Result<Value, AppError> {
    rpc::call("domain.add", params).await
}

#[tauri::command]
pub async fn mixengine_domain_remove(domain: String) -> Result<Value, AppError> {
    rpc::call("domain.remove", json!({ "domain": domain })).await
}

#[tauri::command]
pub async fn mixengine_ca_status() -> Result<Value, AppError> {
    rpc::call("cert.ca_status", json!({})).await
}

/// Sửa nửa "trình duyệt" của CA. `grant: true` cứng — giả định của plan Pha 2: sửa NSS database
/// không cần quyền quản trị. Nếu đo trên daemon thật thấy sai, đổi sang luồng hai bước như
/// `elevation.*` ở Dashboard.
#[tauri::command]
pub async fn mixengine_ca_repair() -> Result<Value, AppError> {
    rpc::call("daemon.doctor_repair", json!({ "grant": true })).await
}

/// Bỏ trống `domain` để cấp cho mọi site có khai HTTPS — cùng một call vẽ bảng lẫn cấp lại.
#[tauri::command]
pub async fn mixengine_certs(domain: Option<String>) -> Result<Value, AppError> {
    let site = domain.map(|d| json!({ "domain": d }));
    rpc::call("cert.issue", json!({ "site": site })).await
}

/// `filter` đúng hình `RuntimeFilter` — bỏ trống (`{}`) thấy cả bốn kind.
#[tauri::command]
pub async fn mixengine_runtime_list_installed(filter: Value) -> Result<Value, AppError> {
    rpc::call("runtime.list_installed", filter).await
}

/// `filter` đúng hình `RuntimeFilter`. `RuntimeCatalogue.stale` phải được frontend vẽ ra, không bỏ
/// qua — xem D3.
#[tauri::command]
pub async fn mixengine_runtime_list_available(filter: Value) -> Result<Value, AppError> {
    rpc::call("runtime.list_available", filter).await
}

/// `target` đúng hình `RuntimeTarget { kind, version }`. Trả `JobSummary` — id của nó là thứ frontend
/// theo dõi qua stream `/events` đã mở sẵn.
#[tauri::command]
pub async fn mixengine_runtime_install(target: Value) -> Result<Value, AppError> {
    rpc::call("runtime.install", target).await
}

/// `params` đúng hình `RuntimeUninstall { kind, version, force? }`.
#[tauri::command]
pub async fn mixengine_runtime_uninstall(params: Value) -> Result<Value, AppError> {
    rpc::call("runtime.uninstall", params).await
}

/// `target` đúng hình `RuntimeTarget`.
#[tauri::command]
pub async fn mixengine_runtime_set_default(target: Value) -> Result<Value, AppError> {
    rpc::call("runtime.set_default", target).await
}

/// `target` đúng hình `RuntimeTarget` — một bản PHP, trả `RuntimeExtension[]`.
#[tauri::command]
pub async fn mixengine_runtime_list_extensions(target: Value) -> Result<Value, AppError> {
    rpc::call("runtime.list_extensions", target).await
}

/// `choice` đúng hình `ExtensionChoice { kind, version, name, enabled }`. Trả `ExtensionChange
/// { extension, pool }` — `pool` là thứ frontend đọc để quyết định banner nào hiện.
#[tauri::command]
pub async fn mixengine_runtime_set_extension(choice: Value) -> Result<Value, AppError> {
    rpc::call("runtime.set_extension", choice).await
}

/// `filter` đúng hình `PackageFilter { package? }`.
#[tauri::command]
pub async fn mixengine_package_list(filter: Value) -> Result<Value, AppError> {
    rpc::call("package.list", filter).await
}

/// `filter` đúng hình `PackageFilter`. `PackageCatalogue.stale` phải được vẽ, cùng component với
/// `RuntimeCatalogue.stale` — D3.
#[tauri::command]
pub async fn mixengine_package_list_available(filter: Value) -> Result<Value, AppError> {
    rpc::call("package.list_available", filter).await
}

/// `target` đúng hình `PackageTarget { package, version }`. Trả `JobSummary`, cùng cách theo dõi qua
/// stream như `runtime.install`.
#[tauri::command]
pub async fn mixengine_package_install(target: Value) -> Result<Value, AppError> {
    rpc::call("package.install", target).await
}

/// `target` đúng hình `PackageTarget`. **Không có `force`** — refuse vì `services` không rỗng là
/// chốt, không có tham số nào vượt qua nó (D6).
#[tauri::command]
pub async fn mixengine_package_uninstall(target: Value) -> Result<Value, AppError> {
    rpc::call("package.uninstall", target).await
}

/// `service` là `ServiceId` trần (một chuỗi).
#[tauri::command]
pub async fn mixengine_service_limits(service: String) -> Result<Value, AppError> {
    rpc::call("service.limits", json!({ "service": service })).await
}

/// `params` đúng hình `ServiceLimitsSet { service, limits }` — `limits` phải là toàn bộ
/// `ResourceLimits`, không phải một phần: gửi thiếu field nào là xoá field đó, đúng như
/// `ServiceLimitsSet`'s doc đã ghi. Frontend chịu trách nhiệm gửi đủ.
#[tauri::command]
pub async fn mixengine_service_set_limits(params: Value) -> Result<Value, AppError> {
    rpc::call("service.set_limits", params).await
}

/// Đọc chính sách idle hiện tại. **Chưa có type TypeScript đã vendor cho câu trả lời này** — xác
/// nhận hình dạng thật khi chạy với daemon thật (Task 8).
#[tauri::command]
pub async fn mixengine_service_idle(service: String) -> Result<Value, AppError> {
    rpc::call("service.idle", json!({ "service": service })).await
}

/// `params` đúng hình `ServiceIdleSet { service, minutes? }` — ba trạng thái: vắng mặt (theo
/// recipe), `0` (tắt hẳn), `n` (n phút).
#[tauri::command]
pub async fn mixengine_service_set_idle(params: Value) -> Result<Value, AppError> {
    rpc::call("service.set_idle", params).await
}

/// `params` đúng hình `DatabaseCreate { service, database, user? }`.
#[tauri::command]
pub async fn mixengine_database_create(params: Value) -> Result<Value, AppError> {
    rpc::call("database.create", params).await
}

/// `service` là `ServiceId` trần. Đọc-only, không khởi động gì — dùng để vẽ affordance "Open" trước
/// khi biết có bấm được không.
#[tauri::command]
pub async fn mixengine_database_client(service: String) -> Result<Value, AppError> {
    rpc::call("database.client", json!({ "service": service })).await
}

/// Mở stream log của một service. Mở lại (một service khác, hay cùng service với `tail` khác) đóng
/// cái đang mở — đúng luật `LogsState::keep` đã theo cho `MixEngineState`.
#[tauri::command]
pub async fn mixengine_logs_watch(
    service: String,
    tail: u32,
    follow: bool,
    on_line: Channel<String>,
    state: State<'_, super::state::LogsState>,
) -> Result<(), AppError> {
    super::logs::stream_logs(service, tail, follow, on_line, &state).await
}

/// Đóng stream log đang mở. Gọi khi không có gì mở là vô hại.
#[tauri::command]
pub fn mixengine_logs_unwatch(state: State<'_, super::state::LogsState>) {
    state.stop();
}

/// `blueprint.list` — mọi blueprint home này giữ, theo thứ tự slug.
#[tauri::command]
pub async fn mixengine_blueprints() -> Result<Value, AppError> {
    rpc::call("blueprint.list", json!({})).await
}

/// `params` đúng hình `BlueprintCapture { project: ProjectRef, name, description?, overwrite }`.
#[tauri::command]
pub async fn mixengine_blueprint_capture(params: Value) -> Result<Value, AppError> {
    rpc::call("blueprint.capture", params).await
}

/// `params` đúng hình `BlueprintImport { path, signature?, name?, overwrite }`. Không bao giờ trả
/// lỗi vì chữ ký sai — một chữ ký thiếu hoặc sai chỉ đổi `BlueprintSummary.trusted`/`signature` của
/// kết quả, không chặn việc nhập.
#[tauri::command]
pub async fn mixengine_blueprint_import(params: Value) -> Result<Value, AppError> {
    rpc::call("blueprint.import", params).await
}

/// `params` đúng hình `BlueprintApply { blueprint, project, root, dry_run, answers?, scaffold? }` —
/// một method, gọi hai lượt: `dry_run: true` trả `{ outcome: "planned", plan }`, `dry_run: false` trả
/// `{ outcome: "started", job }`.
#[tauri::command]
pub async fn mixengine_blueprint_apply(params: Value) -> Result<Value, AppError> {
    rpc::call("blueprint.apply", params).await
}

/// `job.status` — chưa có command nào gọi tới namespace `job.*` trong file này trước đây. Cần đúng
/// một lần: đọc `BlueprintApplied` sau khi job đã biến khỏi danh sách job đang chạy trên stream
/// (`job_finished` xoá hàng, không giữ payload — xem `daemonState.applyJob`).
#[tauri::command]
pub async fn mixengine_job_status(job: i64) -> Result<Value, AppError> {
    rpc::call("job.status", json!({ "job": job })).await
}
