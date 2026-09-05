//! Những gì Rust thật sự đọc ra khỏi câu trả lời của daemon.
//!
//! **Hẹp một cách có chủ ý.** Hợp đồng đầy đủ là `bindings/` bên MixEngine, và frontend đọc nó;
//! ở đây chỉ khai những field phía Rust chạm tới. Một member thêm vào response là optional trên
//! wire và không làm bump protocol version (ADR 0019 bên đó), nên một struct hẹp không vỡ khi
//! daemon mọc thêm field — và `serde` bỏ qua field lạ theo mặc định.
//!
//! `protocol` và `uptime` giữ nguyên là `Value`: MixDB không tính toán gì trên chúng, chỉ chuyển
//! tiếp cho UI, và khai lại hình dạng của chúng ở đây là chép hợp đồng lần thứ hai.

use serde::{Deserialize, Serialize};

/// `daemon.status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonStatus {
    pub version: String,
    pub protocol: serde_json::Value,
    pub pid: u32,
    pub home: String,
    pub endpoint: String,
    pub uptime: serde_json::Value,
    /// `elevated`, `can_prompt`, `pending` — có mặt khi daemon có gì để nói về quyền quản trị.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub elevation: Option<serde_json::Value>,
}

/// Một dòng của `service.list`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSummary {
    pub id: String,
    /// `None` cho một service khai báo nhưng chưa bao giờ được dựng.
    #[serde(default)]
    pub state: Option<String>,
    pub supervised: bool,
    #[serde(default)]
    pub pid: Option<u32>,
    #[serde(default)]
    pub port: Option<u16>,
    #[serde(default)]
    pub depends_on: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Một answer mang field MixDB chưa biết vẫn phải đọc được — đó là hình dạng của một daemon
    /// mới hơn, không phải một lỗi.
    #[test]
    fn an_unknown_member_does_not_break_a_read() {
        let json = serde_json::json!({
            "id": "mariadb@main",
            "state": "running",
            "supervised": true,
            "pid": 42,
            "port": 3306,
            "depends_on": [],
            "something_from_a_later_version": { "x": 1 }
        });
        let summary: ServiceSummary = serde_json::from_value(json).unwrap();
        assert_eq!(summary.id, "mariadb@main");
        assert_eq!(summary.port, Some(3306));
    }

    /// Và một answer thiếu những field optional cũng vậy: chúng là `default`, không phải lỗi.
    #[test]
    fn the_optional_members_may_all_be_absent() {
        let json = serde_json::json!({ "id": "redis@main", "supervised": false });
        let summary: ServiceSummary = serde_json::from_value(json).unwrap();
        assert_eq!(summary.state, None);
        assert_eq!(summary.pid, None);
        assert_eq!(summary.port, None);
        assert!(summary.depends_on.is_empty());
    }
}
