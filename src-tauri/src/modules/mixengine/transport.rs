//! Dial endpoint của MixEngine và trả một IO tokio cho `hyper`.
//!
//! **Trên Windows, client có cổng gác của riêng nó.** Namespace pipe của Windows phẳng và toàn
//! máy, tên suy ra được từ một SID công khai cộng một fingerprint mã nguồn bên kia viết rõ, và
//! `CreateNamedPipeW` không cần đặc quyền gì — nên một tài khoản khác giữ được cái tên đó trước
//! khi daemon lên và thu mọi request, kể cả `elevation.*`. Cờ `FILE_FLAG_FIRST_PIPE_INSTANCE` của
//! daemon chỉ chặn nó *nhập* vào pipe đó. Nên ở đây đọc **owner của đối tượng pipe** và cúp máy
//! trước byte đầu tiên nếu không phải tài khoản này. Owner chứ không phải pid: pid tái sử dụng
//! được giữa lúc lấy và lúc tra, còn owner được đóng dấu lúc tạo và không đặt thành một tài khoản
//! mà người tạo không có.
//!
//! Unix không cần: socket là file trong `run/` của chính tài khoản này, và không tài khoản khác
//! đặt một cái vào đó để bị tìm thấy nhầm được.

use crate::error::AppError;

use super::endpoint;

/// Một kết nối đang mở tới daemon. Không rời module này: `rpc` và `events` bọc nó vào `hyper`.
pub enum Io {
    #[cfg(windows)]
    Pipe(tokio::net::windows::named_pipe::NamedPipeClient),
    #[cfg(not(windows))]
    Socket(tokio::net::UnixStream),
}

/// Địa chỉ endpoint của home trên máy này.
pub fn current_address() -> Result<String, AppError> {
    let home = endpoint::home().ok_or_else(|| err!("error.mixengineNoHome"))?;
    let run = endpoint::run_dir(&home);
    Ok(endpoint::address(&run, &current_sid()?))
}

/// Mở một kết nối tới daemon của home trên máy này.
pub async fn connect() -> Result<Io, AppError> {
    let address = current_address()?;
    dial(&address).await
}

/// SID của tài khoản đang chạy tiến trình này, dạng `S-1-5-…`.
#[cfg(windows)]
pub fn current_sid() -> Result<String, AppError> {
    use std::ffi::c_void;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let mut token: HANDLE = std::ptr::null_mut();
    // SAFETY: `token` là chỗ nhận một handle; nó được đóng ở mọi đường ra bên dưới.
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(err!(
            "error.mixengineNoSid",
            message = std::io::Error::last_os_error()
        ));
    }

    // Hỏi độ dài trước: `TOKEN_USER` là một struct có đuôi biến thiên (chính cái SID), nên kích
    // thước của nó không phải `size_of`.
    let mut needed: u32 = 0;
    // SAFETY: buffer rỗng với độ dài 0 là cách API này được hỏi độ dài; nó luôn thất bại và điền
    // `needed`.
    unsafe {
        GetTokenInformation(token, TokenUser, std::ptr::null_mut(), 0, &mut needed);
    }
    let mut buffer = vec![0u8; needed.max(1) as usize];
    // SAFETY: `buffer` dài đúng `needed` byte, là thứ lời gọi trên vừa yêu cầu.
    let read = unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            buffer.as_mut_ptr() as *mut c_void,
            needed,
            &mut needed,
        )
    };
    // SAFETY: `token` là handle hợp lệ vừa mở ở trên và không dùng lại sau dòng này.
    unsafe { CloseHandle(token) };
    if read == 0 {
        return Err(err!(
            "error.mixengineNoSid",
            message = std::io::Error::last_os_error()
        ));
    }

    // SAFETY: `buffer` giữ một `TOKEN_USER` API vừa ghi vào, và `User.Sid` trỏ vào chính buffer đó,
    // thứ còn sống tới hết hàm.
    let sid = unsafe { (*(buffer.as_ptr() as *const TOKEN_USER)).User.Sid };
    sid_to_string(sid).ok_or_else(|| err!("error.mixengineNoSid", message = "unreadable SID"))
}

/// Trên unix không có SID, và `endpoint::address` không đọc tới nó.
#[cfg(not(windows))]
pub fn current_sid() -> Result<String, AppError> {
    Ok(String::new())
}

/// Một SID thành `S-1-…`. `None` khi Windows từ chối chuyển.
#[cfg(windows)]
fn sid_to_string(sid: windows_sys::Win32::Security::PSID) -> Option<String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::ConvertSidToStringSidW;

    let mut text: *mut u16 = std::ptr::null_mut();
    // SAFETY: `sid` là con trỏ hợp lệ do người gọi giữ; `text` là chỗ nhận một chuỗi Windows cấp
    // phát, được `LocalFree` đúng một lần bên dưới.
    if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 || text.is_null() {
        return None;
    }
    // SAFETY: `text` là chuỗi wide kết thúc NUL do Windows cấp phát.
    let len = unsafe {
        let mut len = 0usize;
        while *text.add(len) != 0 {
            len += 1;
        }
        len
    };
    // SAFETY: `len` là số ô trước NUL, nên slice nằm gọn trong vùng đã cấp phát.
    let owner = String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(text, len) });
    // SAFETY: `text` do `ConvertSidToStringSidW` cấp phát bằng `LocalAlloc` và không dùng lại sau
    // dòng này.
    unsafe { LocalFree(text as *mut std::ffi::c_void) };
    Some(owner)
}

/// Mở kết nối tới một địa chỉ đã biết.
#[cfg(windows)]
pub async fn dial(address: &str) -> Result<Io, AppError> {
    use tokio::net::windows::named_pipe::ClientOptions;

    // Owner được đọc **trước khi** mở: nếu một tài khoản khác đang giữ cái tên này thì không có
    // byte nào của ta được gửi đi cả.
    let owner = pipe_owner(address)?;
    let ours = current_sid()?;
    if owner != ours {
        return Err(err!(
            "error.mixenginePipeOwner",
            endpoint = address,
            owner = owner
        ));
    }

    let client = ClientOptions::new().open(address).map_err(|e| {
        err!(
            "error.mixengineUnreachable",
            endpoint = address,
            message = e
        )
    })?;
    Ok(Io::Pipe(client))
}

/// Trên unix, socket là file trong `run/` của chính tài khoản này — không có cổng gác nào phải
/// dựng thêm.
#[cfg(not(windows))]
pub async fn dial(address: &str) -> Result<Io, AppError> {
    let stream = tokio::net::UnixStream::connect(address).await.map_err(|e| {
        err!(
            "error.mixengineUnreachable",
            endpoint = address,
            message = e
        )
    })?;
    Ok(Io::Socket(stream))
}

/// SID của chủ sở hữu đối tượng pipe.
///
/// Một pipe không tồn tại là `error.mixengineUnreachable`, không phải một vấn đề chủ sở hữu: cả
/// hai đi qua đây, nhưng chúng là hai câu khác nhau với người đọc.
#[cfg(windows)]
fn pipe_owner(address: &str) -> Result<String, AppError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{LocalFree, ERROR_FILE_NOT_FOUND};
    use windows_sys::Win32::Security::Authorization::{GetNamedSecurityInfoW, SE_FILE_OBJECT};
    use windows_sys::Win32::Security::{OWNER_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR, PSID};

    let wide: Vec<u16> = std::ffi::OsStr::new(address)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut sid: PSID = std::ptr::null_mut();
    let mut descriptor: PSECURITY_DESCRIPTOR = std::ptr::null_mut();

    // SAFETY: `wide` kết thúc bằng NUL và sống hết lời gọi; hai con trỏ ra là chỗ để nhận, và
    // `descriptor` được `LocalFree` đúng một lần bên dưới.
    let status = unsafe {
        GetNamedSecurityInfoW(
            wide.as_ptr(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION,
            &mut sid,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut descriptor,
        )
    };
    if status != 0 {
        // Không có gì ở địa chỉ đó là "daemon chưa chạy", không phải "pipe của người khác".
        let code = if status == ERROR_FILE_NOT_FOUND {
            "error.mixengineUnreachable"
        } else {
            "error.mixenginePipeOwner"
        };
        return Err(crate::error::AppError::new(code)
            .with("endpoint", address)
            .with("owner", format!("Windows error {status}"))
            .with("message", format!("Windows error {status}")));
    }

    let owner = sid_to_string(sid);
    // SAFETY: `descriptor` do `GetNamedSecurityInfoW` cấp phát và không dùng lại sau dòng này.
    unsafe { LocalFree(descriptor) };
    owner.ok_or_else(|| {
        err!(
            "error.mixenginePipeOwner",
            endpoint = address,
            owner = "unreadable"
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Không có MixEngine trên máy CI, nên cái test được là *câu trả lời khi không có gì ở đó*:
    /// một `AppError` đọc được, không phải một panic và không phải một treo.
    ///
    /// Dial thẳng một địa chỉ bịa thay vì đi qua `MIXENGINE_HOME`: biến môi trường là toàn cục và
    /// cargo chạy test song song, nên một test đặt nó là một test làm hỏng test khác.
    #[tokio::test]
    async fn an_absent_daemon_is_an_error_and_not_a_panic() {
        let address = if cfg!(windows) {
            r"\\.\pipe\mixengine.S-1-5-21-0-0-0-0.0123456789abcdef"
        } else {
            "/nowhere/a-home-that-is-not-there/run/mixengined.sock"
        };
        let error = dial(address)
            .await
            .err()
            .expect("an absent daemon must not connect");
        assert_eq!(error.code, "error.mixengineUnreachable", "{error:?}");
    }

    /// Câu lỗi phải mang theo địa chỉ đã thử, vì triệu chứng của một fingerprint lệch là
    /// "không tìm thấy daemon" và cách duy nhất so bằng mắt là nhìn thấy cái tên.
    #[tokio::test]
    async fn the_error_names_the_address_it_tried() {
        let address = if cfg!(windows) {
            r"\\.\pipe\mixengine.S-1-5-21-0-0-0-0.fedcba9876543210"
        } else {
            "/nowhere/else/run/mixengined.sock"
        };
        let error = dial(address).await.err().unwrap();
        assert_eq!(error.params.get("endpoint"), Some(&address.to_string()));
    }

    /// Địa chỉ của máy này dựng được, và có hình dạng đúng nền tảng. Không cần daemon nào chạy.
    #[test]
    fn this_machine_has_an_address() {
        let Ok(address) = current_address() else {
            // Một máy không có `HOME` lẫn `LOCALAPPDATA` là hợp lệ để bỏ qua, không phải để đỏ.
            return;
        };
        if cfg!(windows) {
            assert!(address.starts_with(endpoint::PIPE_PREFIX), "{address}");
        } else {
            assert!(address.ends_with("mixengined.sock"), "{address}");
        }
    }
}
