//! Thứ module này giữ giữa hai lệnh: đúng một stream sự kiện đang mở.
//!
//! Một tab một stream là sai. Bus sự kiện bên MixEngine là bus chung, sức chứa 1024 message, và
//! hai tab MixEngine mở cùng lúc sẽ là hai kết nối `/events` cùng đọc nó. Một stream, mọi tab
//! nghe cùng một `Channel`, là đủ cho pha này — log có stream riêng theo service ([ADR 0009 bên
//! MixEngine]: log không bao giờ là sự kiện), giữ trong `LogsState` ngay dưới đây, tách hẳn khỏi
//! `MixEngineState`.

use std::sync::Mutex;

use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct MixEngineState {
    open: Mutex<Option<CancellationToken>>,
}

impl MixEngineState {
    /// Hủy stream đang mở, nếu có, rồi giữ cái mới.
    pub fn keep(&self, token: CancellationToken) {
        let mut slot = self.open.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(previous) = slot.replace(token) {
            previous.cancel();
        }
    }

    /// Đóng stream đang mở. Gọi hai lần là vô hại.
    pub fn stop(&self) {
        let mut slot = self.open.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(token) = slot.take() {
            token.cancel();
        }
    }
}

/// Đúng một stream log đang mở — riêng với `MixEngineState`, vì `/events` và `/logs/service/{id}`
/// là hai kết nối cùng lúc, không phải một cái thay cái kia. Cùng hình dạng `keep`/`stop`, tách struct
/// vì Tauri khoá state theo kiểu: gộp chung sẽ là hai stream chia nhau một khoá, và mở Logs sẽ đóng
/// `/events` đang mở cho Dashboard.
#[derive(Default)]
pub struct LogsState {
    open: Mutex<Option<CancellationToken>>,
}

impl LogsState {
    pub fn keep(&self, token: CancellationToken) {
        let mut slot = self.open.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(previous) = slot.replace(token) {
            previous.cancel();
        }
    }

    pub fn stop(&self) {
        let mut slot = self.open.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(token) = slot.take() {
            token.cancel();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mở cái thứ hai là đóng cái thứ nhất — nếu không, một tab mở lại sẽ để lại một kết nối
    /// `/events` không ai đọc, chạy tới lúc app thoát.
    #[test]
    fn a_second_stream_cancels_the_first() {
        let state = MixEngineState::default();
        let first = CancellationToken::new();
        state.keep(first.clone());
        assert!(!first.is_cancelled());

        let second = CancellationToken::new();
        state.keep(second.clone());
        assert!(first.is_cancelled());
        assert!(!second.is_cancelled());

        state.stop();
        assert!(second.is_cancelled());
    }

    /// Đóng khi không có gì mở, và đóng hai lần, đều không được panic: `mixengine_unwatch` chạy từ
    /// cleanup của một effect và effect chạy hai lần trong StrictMode.
    #[test]
    fn stopping_nothing_is_harmless() {
        let state = MixEngineState::default();
        state.stop();
        state.stop();
    }
}
