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
