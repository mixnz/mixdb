//! Các lệnh module này lộ ra cho frontend.
//!
//! Không có nghiệp vụ nào ở đây: mỗi lệnh là một call JSON-RPC hoặc một câu hỏi về trạng thái, và
//! nghiệp vụ ở lại phía daemon. Đó là luật `CLAUDE.md` bên MixEngine giữ cho mọi client của nó, và
//! là lý do màn hình bên này vẽ được từ dữ liệu thay vì tự suy ra.

use serde_json::{json, Value};
use tauri::ipc::Channel;
use tauri::State;

use crate::error::AppError;

use super::models::{DaemonStatus, ServiceSummary};
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

#[tauri::command]
pub async fn mixengine_status() -> Result<DaemonStatus, AppError> {
    rpc::call("daemon.status", json!({})).await
}

#[tauri::command]
pub async fn mixengine_services() -> Result<Vec<ServiceSummary>, AppError> {
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
