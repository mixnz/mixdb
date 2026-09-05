//! Daemon có ở đó không, và nếu không thì khởi động nó.
//!
//! **Ba trạng thái, không phải hai**, và UI vẽ ba thứ khác nhau: *không chạy* (không dial được
//! nhưng `mixengined` có trên máy), *không trả lời* (dial được, `/health` không xong), *không có
//! MixEngine* (không tìm thấy chương trình). Gộp cả ba thành "lỗi" là bắt người dùng đoán xem họ
//! phải cài, phải khởi động, hay phải chờ.
//!
//! `/health` không cần xác thực — đó chính là lý do nó tồn tại bên MixEngine: để một client quyết
//! định có tự khởi động daemon không.

use std::process::Command;
use std::time::Duration;

use serde::Serialize;

use crate::error::AppError;

use super::{rpc, transport};

/// Chương trình khởi động một daemon. Installer của MixEngine đặt thư mục của nó lên `PATH` của
/// người dùng, nên tên trần là đường thường; bản zip giải nén tay thì không, và đó là
/// [`Presence::NotInstalled`].
const DAEMON: &str = "mixengined";

/// Daemon đang ở trạng thái nào, nhìn từ đây.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Presence {
    Running,
    NotAnswering,
    NotRunning,
    NotInstalled,
}

/// Bao lâu thì coi như daemon không trả lời.
///
/// `/health` là một lần đọc không chạm đĩa ở đầu kia; hai giây là rộng rãi tới mức chỉ một daemon
/// thật sự kẹt mới chạm phải, và đủ ngắn để cổng vào tab không đứng hình.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(2);

/// Daemon đang ở trạng thái nào.
pub async fn presence() -> Presence {
    if transport::connect().await.is_err() {
        return if installed().await {
            Presence::NotRunning
        } else {
            Presence::NotInstalled
        };
    }
    match tokio::time::timeout(HEALTH_TIMEOUT, rpc::request("GET", "/health", None)).await {
        Ok(Ok(_)) => Presence::Running,
        // Dial được nhưng không trả lời được: một daemon đang kẹt, không phải một daemon vắng mặt.
        _ => Presence::NotAnswering,
    }
}

/// `mixengined` có gọi được không. Chỉ hỏi khi đã biết không dial được — nó tốn một tiến trình.
async fn installed() -> bool {
    tauri::async_runtime::spawn_blocking(|| {
        let mut command = Command::new(DAEMON);
        command.arg("--version");
        // Mã thoát không quan trọng: câu hỏi là chương trình có chạy được không, và một phiên bản
        // không hiểu `--version` vẫn là một MixEngine đã cài.
        crate::platform::hide_console(&mut command).output().is_ok()
    })
    .await
    .unwrap_or(false)
}

/// Khởi động daemon và trả về endpoint nó in ra.
///
/// `--detach` **chỉ trả về khi daemon đã trả lời trên endpoint của nó** và in endpoint ra stdout —
/// nên không có vòng lặp backoff ở đây. Việc chờ thuộc về tiến trình biết con nó còn sống hay
/// không, và đó không phải tiến trình này.
pub async fn start_daemon() -> Result<String, AppError> {
    let output = tauri::async_runtime::spawn_blocking(|| {
        let mut command = Command::new(DAEMON);
        command.arg("--detach");
        crate::platform::hide_console(&mut command).output()
    })
    .await
    .map_err(|e| err!("error.mixengineStartFailed", message = e))?
    .map_err(|e| err!("error.mixengineStartFailed", message = e))?;

    if !output.status.success() {
        return Err(err!(
            "error.mixengineStartFailed",
            message = String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Bốn trạng thái đi qua wire dạng camelCase — frontend so chuỗi với chúng, nên đổi cách viết
    /// ở đây là làm hỏng cổng vào tab mà không gì lúc build nói ra.
    #[test]
    fn presence_is_camel_cased_for_the_shell() {
        let json = |value: Presence| serde_json::to_string(&value).unwrap();
        assert_eq!(json(Presence::Running), "\"running\"");
        assert_eq!(json(Presence::NotAnswering), "\"notAnswering\"");
        assert_eq!(json(Presence::NotRunning), "\"notRunning\"");
        assert_eq!(json(Presence::NotInstalled), "\"notInstalled\"");
    }
}
