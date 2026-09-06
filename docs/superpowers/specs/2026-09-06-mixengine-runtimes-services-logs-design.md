# Projects, Runtimes & Packages, Services chi tiết và Logs: bốn màn hình mới của module `mixengine`

Ngày 2026-09-06. Pha 3 của [roadmap/mixengine-module.md](../../../roadmap/mixengine-module.md) — mở
rộng hơn ba màn hình roadmap gốc liệt kê, xem mục "Projects" và "Packages" dưới đây vì sao.

**Roadmap ghi "Pha 2–4 chưa bắt đầu", nhưng Pha 2 đã land** — `e7e1189`,
`feat(mixengine): sites, domains and TLS (#40)` — cùng Pha 1 (`898f936`). Đúng bài học Pha 0 đã tự ghi:
*"Code là câu trả lời, note không phải."* Header của roadmap nên sửa lại một dòng khi spec này được
chấp nhận; không phải việc của spec này.

## Mục tiêu

- **Projects**: màn hình mới, ngoài 9 màn hình gốc của `client-surface.md` — xem "Vì sao có Projects"
  dưới đây. Danh sách, tạo, sửa (tên/root/pin phiên bản/`keep_warm`), xoá.
- **Runtimes**: phiên bản PHP/Node/Python/Ruby đã cài (mặc định được đánh dấu), phiên bản có thể cài;
  cài/gỡ là job có tiến độ thật — lần đầu module này vẽ một progress bar thật thay vì `wait: true`.
  Bật/tắt PHP extension theo từng phiên bản — có method ghi thật, xem mục 2.
- **Packages** (MariaDB, Caddy, Redis…, khác `runtime.*`): cùng màn hình với Runtimes, hai tab con,
  cùng luồng cài/gỡ có tiến độ — theo đúng ý bạn: "package cần một luồng cài đặt y hệt Runtimes".
- **Services chi tiết**: mở từ một hàng ở Dashboard, xem giới hạn CPU/RAM (và watchdog bộ nhớ nơi máy
  không tự ép được), đổi ngưỡng tự dừng khi rảnh (idle), và với một service database: tạo
  database/account, và "Open" mở thẳng một tab `db` trong MixDB — không vòng qua OS.
- **Logs**: tail sống theo từng service, lọc theo stream, lộ đường file để mở thư mục chứa.

## Vì sao có Projects trong Pha này

Pha 2 chủ động không dựng Projects — quyết định (a) trong
[2026-09-06-mixengine-sites-domains-design.md](2026-09-06-mixengine-sites-domains-design.md), Câu hỏi
1: dropdown gọi thẳng `project.list`, máy chưa có project nào thì tự đăng ký bằng
`mix project add <thư mục>`. Bàn lại trong buổi viết spec này, quyết định đảo ngược: MixDB dựng hẳn
một màn hình quản lý — không chỉ vì Sites cần nó, mà vì `project.*` đã có đủ method
(`list, create, show, update, delete, export` — tên thật xác nhận qua `rpc.rs`, xem Hiện trạng) để một
màn hình đầy đủ không phải chắp vá. Đây **là**
một mục ngoài 9 màn hình `client-surface.md` liệt kê — xem **Quyết định D4** cho việc sidebar xử lý
thế nào.

## Phi mục tiêu

- Blueprints, Extensions (nghĩa "extension sản phẩm" — Mailpit, phpMyAdmin, chính MixDB — namespace
  `extension.*`), Settings, Metrics — Pha 4.
- **Tạo/xoá một service instance mới** (`service.create`/`service.delete` — cả hai đều tồn tại thật,
  xác nhận qua `rpc.rs`). Cài một package (mục 2) chỉ là "phiên bản này đã có trên đĩa" — dùng nó để
  dựng một service instance mới (`mariadb@secondary` cạnh `mariadb@main`) là một bước khác, vẫn ở
  ngoài Pha này: không nằm trong "Xong khi" của roadmap, và là một quyết định mở rộng phạm vi giống hệt
  Projects — nếu muốn thêm, nên hỏi trước như Projects đã được hỏi, không lặng lẽ gộp vào vì tiện.
  `mix service create` vẫn là đường duy nhất cho việc này ở Pha 3.
- Sửa `port`, `bind_addr`, `data_dir`, `autostart` của một service **đã tồn tại**. Roadmap T3.2 và
  "Xong khi" (*"sửa được port của MariaDB"*) giả định việc này làm được — **xác nhận là không**, và
  không phải vì chưa code tới: không có `service.config_get`/`config_set` nào cả, theo đúng chủ đích
  kiến trúc của MixEngine ("config sinh ra là đồ dùng một lần, không phải thứ có API đọc-ghi chung
  chung"). Roadmap nên bỏ câu "sửa được port của MariaDB" khỏi "Xong khi" của Pha 3 — đây không phải
  việc dời sang sau, mà là việc không tồn tại để làm. Xem **Quyết định D1**.

## Hiện trạng

### Ba nguồn, ba câu trả lời khác nhau — không nguồn nào một mình đủ tin

Viết spec này bắt đầu bằng đọc ba thứ: `bindings/` đã vendor trong repo này
(`src/modules/mixengine/api/types/`), `daemon-and-ipc.md` và `client-surface.md` đọc trực tiếp từ
`mixnz/mixengine@master`. Cả ba **không khớp nhau**, theo cả hai chiều:

| Method | Trong `bindings/` đã vendor | Trong `daemon-and-ipc.md` hôm nay | Trong `rpc.rs` thật |
| --- | --- | --- | --- |
| `service.config_get` / `config_set` | Không có type nào | Có, trong dòng `service.*` | **Không tồn tại** — xác nhận |
| `service.reload` | — | Có, trong dòng `service.*` | **Không tồn tại** — xác nhận |
| `service.create` / `delete` / `limits` / `set_limits` / `idle` / `set_idle` | Có type cho create/delete/limits/set_limits/set_idle | Không có trong dòng `service.*` | **Có cả sáu** — xác nhận |
| `package.*` (mariadb/caddy/redis, khác `runtime.*`) | `PackageCatalogue/Filter/Target/Release/Summary/Removal` | Không có namespace `package.*` nào | (chưa tra, giả định có theo bindings) |
| `runtime.list_extensions` / `set_extension` | `ExtensionChoice`, `ExtensionChange`, `PoolOutcome` | Không nêu tên hai verb này trong dòng `runtime.*` (chỉ 6 verb) | **Có** — xác nhận |
| `project.set_runtime` | — | Có, trong dòng `project.*` | **Không tồn tại** — tên thật là `project.update` |
| `project.get` | — | Có, trong dòng `project.*` | Tên thật là `project.show` |
| `project.import` | — | Có, trong dòng `project.*` | **Không tồn tại riêng** — `project.create` tự đảm nhận cả hai |
| `project.export` | — | Không có trong dòng `project.*` | **Có** |

**Kết luận: `daemon-and-ipc.md` lệch code thật (`rpc.rs`) ở ít nhất ba namespace** (`runtime.*`,
`service.*`, `project.*`), không phải một lần lẻ. Namespace nào Pha này còn phải tra thêm mà chưa đối
chiếu trực tiếp — `site.*`, `domain.*`, `cert.*` nếu cần mở rộng — nên coi bảng "Method namespaces"
của tài liệu là gợi ý, không phải nguồn cuối; đối chiếu bằng bindings đã vendor mới nhất hoặc gọi thử
lên daemon thật, đừng lặp lại việc phải xác nhận từng namespace một bằng tay.

Không có source nào "mới hơn" một cách đáng tin: `bindings/` là bản MixDB này chép lúc Pha 1, còn hai
file `.md` là snapshot lấy về hôm nay nhưng viết bởi người, sửa chậm hơn code — đúng cùng một bệnh
roadmap này vừa tự mắc ở header của nó. Kết luận rút ra không phải "tin cái nào" mà là: **đừng viết
code dựa một mình vào tài liệu — chạy `npm run bindings` lấy bản mới nhất trước khi bắt đầu Pha này,
và với bất cứ method nào bảng trên không khớp, hỏi `mixengined` thật** (`daemon.status` không liệt kê
method, nhưng một `POST /rpc` gọi thử với `method` sai trả về `error.data.code = "not_found"`
hay tương đương — cách rẻ nhất để biết một method có tồn tại không cần đọc mã nguồn Rust bên kia).
Xem **Quyết định D1**.

### Hai câu hỏi ban đầu đã được trả lời — và một bài học rút ra từ chính lỗi của spec này

Bản nháp đầu của spec này liệt kê ba câu hỏi mở. Hai câu đã được xác nhận:

- **PHP extension toggle có thật.** `runtime.list_extensions`/`runtime.set_extension` tồn tại;
  `ExtensionChoice { kind, version, name, enabled }` là tham số ghi, `ExtensionChange { extension,
  pool: PoolOutcome }` là câu trả lời — cả ba type **đã có sẵn trong `bindings/` đã vendor của chính
  repo này**, tự đọc lại xác nhận được, không phải tin theo lời kể. Lỗi ở bản nháp đầu: lọc danh sách
  file theo tên bắt đầu bằng `Extension` rồi kết luận cả cụm đó thuộc namespace `extension.*` (hệ
  blueprint/plugin Pha 4) — trong khi `ExtensionChoice`/`ExtensionChange` là một họ khác, thuộc
  `runtime.*`, chỉ trùng tiền tố tên. Bài học: **lọc theo tên file không thay được việc đọc doc comment
  của từng type** — bindings có gần 300 file, chỗ nhầm này có thể còn chỗ khác chưa lộ ra. Xem mục 2
  cho luồng UI, và **Rủi ro**.
- **`LogExcerpt` không liên quan tới trang Logs — đúng như nghi ngờ ban đầu.** Nó là field
  `daemon_log` bên trong `Manifest` (`daemon.bundle`, Pha 4), trả lời "trích đoạn `daemon.log` nào
  được đưa vào gói chẩn đoán" — không liên quan gì tới việc xem log service theo thời gian thực. Mục 4
  không dùng type này.

Câu thứ ba (`package.*` có vào Pha này không) được trả lời **có**, với yêu cầu cụ thể: luồng cài/gỡ
giống hệt Runtimes. Xem mục 2.

### Ba thứ Pha 1–2 để lại và Pha 3 dựng lên trên

- **Stream sự kiện đã mang `job_progress`/`job_finished` từ Pha 1**, chưa ai vẽ. `elevation.grant` và
  `daemon.doctor_repair` đã đẻ job từ Pha 1–2 nhưng luôn gọi kiểu chờ xong; Pha 3 là nơi đầu tiên một
  job thật sự chạy lâu (tải một bản PHP hay một package) và tiến độ phải lên màn hình khi nó đang chạy.
- **`ServiceSummary` (Dashboard, Pha 1) đã đủ để dẫn vào Services chi tiết** — `id`, `state`, `pid`,
  `port`, `depends_on`. Không cần gọi gì thêm để vẽ hàng có thể bấm vào; `service.limits`/
  `service.logs` chỉ gọi khi đã vào trang chi tiết.
- **`readSecrets`/`resolveKeyringRef` của module `db`** (Pha 0,
  [savedConnections.ts:47,80](../../../src/modules/db/savedConnections.ts)) đã biết đọc một mật khẩu
  từ namespace `mixengine` bằng đúng cặp `service`/`key` một `SecretAddress` mang. Mục 3 dùng lại
  nguyên hàm này, không viết đường đọc keyring thứ hai.

## 1. Projects

`project.list` → `ProjectList { projects: ProjectSummary[] }` — mỗi hàng: `name`, `root`,
`created_at`, `manifest?` (có `mixengine.toml` hay không — cái này quyết định pin trong file có hiệu
lực hay chưa), `keep_warm`.

- **Chi tiết.** `project.show` (`ProjectQuery { project: ProjectRef::Name }`) →
  `ProjectDetail { project, pins: ProjectPin[] }`. **`pins` là pin hiệu lực, không phải pin đã lưu** —
  mỗi `ProjectPin { kind, constraint, source: PinSource, resolved?, hint? }` nói pin này tới từ
  `mixengine.toml` hay từ row, và version nào nó thật sự trỏ tới trên máy này (`resolved`) — hoặc câu
  lệnh sửa (`hint`) khi không có bản nào khớp. Vẽ đúng bốn field này, không chỉ vẽ `constraint`: một
  panel chỉ hiện "PHP: 8.3" mà không nói pin đó có thật sự resolve được không là một panel nói dối
  đúng lúc người dùng cần nó nhất.
- **Tạo.** `project.create` (`ProjectCreate { root, name?, pins? }`) → `ProjectSummary`. `root` bắt
  buộc là thư mục **tuyệt đối và đã tồn tại** — dùng lại dialog chọn thư mục
  (`@tauri-apps/plugin-dialog`) `SiteForm.tsx` đã dùng cho doc root, không viết validate path tay.
  `name` bỏ trống thì daemon tự lấy từ `mixengine.toml` rồi từ tên thư mục — form không cần đoán
  trước, chỉ gửi những gì người dùng gõ. `pins` để trong một phần "Nâng cao" gấp lại mặc định — hầu
  hết project không cần pin lúc tạo, `mixengine.toml` hoặc mặc định của máy đã đủ.
- **Sửa.** Method thật là `project.update` — xác nhận qua `rpc.rs`, không phải `project.set_runtime`
  như `daemon-and-ipc.md` ghi (verb đó không tồn tại). Một method duy nhất sửa cả bốn thứ
  (`ProjectUpdate { project, name?, root?, pins?, keep_warm? }`), không phải bốn method riêng.
  **`pins` thay thế toàn bộ, không merge** — gửi lại mọi pin hiện có cộng thay đổi, `{}` xoá hết pin,
  field vắng mặt giữ nguyên. `root` chỉ dùng khi thư mục đã chuyển chỗ thật — không phải nơi sửa lại
  tên hiển thị.
- **Xoá.** `project.delete` (`ProjectQuery`) → `ProjectRemoval { removed, root_kept, manifest_kept? }`.
  Hộp thoại xác nhận nói rõ **thư mục và `mixengine.toml` được giữ nguyên, chỉ gỡ đăng ký** — cùng
  triết lý `ServiceRemoval`/`SiteRemoval` đã có trong bindings (xoá registration, không đụng dữ liệu
  trên đĩa). **Chưa biết** xoá một project mà Sites đang trỏ tới (`SiteOwner::Project`) có bị refuse
  không hay để lại site mồ côi — không có field nào trên `ProjectRemoval`/`ProjectSummary` nói trước
  điều này như `PackageSummary.services` làm cho package. Chỉ đo được với daemon thật, xem **Kiểm
  thử**.

Tích hợp với Sites (Pha 2, đã xong): `SiteForm.tsx` không đổi cách gọi (vẫn `api.projects()` →
`project.list`), chỉ đổi nội dung gợi ý khi rỗng — trỏ sang tab Projects thay vì bảo gõ lệnh CLI. Xem
[i18n/vi.ts:69](../../../src/modules/mixengine/i18n/vi.ts).

## 2. Runtimes & Packages

Một sidebar item, hai tab con — không phải hai mục sidebar riêng. Lý do ở **Quyết định D5**: cùng hình
dạng RPC, cùng hình dạng job, tách thành hai màn hình là vẽ hai lần một thứ giống hệt nhau.

### Ngôn ngữ (`runtime.*`)

`runtime.list_installed` (lọc được theo `kind` qua `RuntimeFilter`, bỏ trống thấy cả bốn) →
`RuntimeSummary { kind, version, channel, path, installed_at, bytes, default }`, một hàng một bản đã
cài, bản mặc định được đánh dấu. `runtime.list_available` → `RuntimeCatalogue { runtimes, stale }` —
**`stale: true` phải vẽ ra** (Quyết định D3): một danh sách từ cache không refresh được vẫn là danh
sách dùng được, nhưng im lặng về nó là nói dối đã hỏi được mạng.

- **Cài.** `runtime.install` nhận `RuntimeTarget { kind, version }`, trả `JobSummary`. Vẽ thanh tiến
  độ ngay hàng của bản đó trong bảng "có thể cài" — không phủ spinner lên cả màn hình, đúng luật T1.9
  Pha 1 đã đặt cho service. Tiến độ đến từ `job_progress` trên stream **đã mở sẵn** của Dashboard/tab —
  không mở stream thứ hai; xem mục 3.
- **Gỡ.** `runtime.uninstall` nhận `RuntimeUninstall { kind, version, force? }`. Refuse mặc định khi
  một project pin đúng bản này; message nêu project nào — **Projects (mục 1) là chỗ người dùng đọc
  tiếp để sửa pin đó**, không phải một câu lỗi cụt. `force: true` **chỉ vượt qua cái refusal đó** —
  không vượt qua một service đang chạy trên bản này, vì không service nào phụ thuộc trực tiếp một
  *runtime* (chỉ phụ thuộc lẫn nhau qua `depends_on`) nên không có xung đột thứ hai để `force` phải lo.
  UI hỏi xác nhận một lần trước khi gửi `force: true`.
- **Mặc định.** `runtime.set_default` nhận `RuntimeTarget`, trả `RuntimeSummary` — nút "Đặt mặc định"
  trên một hàng đã cài chưa phải mặc định.
- **PHP extension — có thật, xác nhận qua `bindings/` đã vendor của chính repo này** (xem Hiện trạng).
  `runtime.list_extensions` → `RuntimeExtension[] { name, linkage, enabled, source }` mỗi bản PHP.
  Toggle: `runtime.set_extension` nhận `ExtensionChoice { kind, version, name, enabled }`, trả
  `ExtensionChange { extension, pool: PoolOutcome }`. UI đọc `pool` sau mỗi lần bấm:
  - `"reloaded"` — im lặng, pool đã tự nhận cấu hình mới, không cần báo thêm.
  - `"restart_required"` — banner "Cần khởi động lại pool để có hiệu lực" kèm nút Restart, gọi
    `service.restart` (đã có từ Pha 1) cho đúng service của pool đó.
  - `"pool_not_running"` — câu "Đã lưu, sẽ áp dụng lần pool tiếp theo khởi động", không phải lỗi.
  `linkage: "static"` (một phần của binary, không tắt được) ẩn hẳn công tắc, không vẽ rồi disable nó —
  một control luôn từ chối là một control không nên có mặt.

### Dịch vụ (`package.*`)

`package.list` → `PackageList { packages: PackageSummary[] }`; mỗi `PackageSummary` mang
`services: ServiceId[]` — **service nào đang là instance của đúng version này**, hiện ngay trên hàng
để người dùng biết trước khi định gỡ. `package.list_available` (lọc theo `package` qua `PackageFilter`)
→ `PackageCatalogue { packages, stale }` — cùng component `stale`-badge với Ngôn ngữ ở trên (D3).

- **Cài.** `package.install` (`PackageTarget { package, version }`) → `JobSummary` — **dùng lại y hệt**
  component tiến độ job của Ngôn ngữ, chỉ khác namespace gọi. Đây chính là điều bạn yêu cầu: "package
  cần một luồng cài đặt y hệt Runtimes".
- **Gỡ.** `package.uninstall` (`PackageTarget`) → `PackageRemoval { removed }`. **Khác `runtime.uninstall`
  một điểm quan trọng: không có `force`.** `services` không rỗng thì refuse là chốt hẳn — không có
  cách vượt qua từ UI. Vẽ đúng danh sách service đang phụ thuộc, không vẽ nút "vẫn gỡ" vì không có gì
  để nút đó gọi. Xoá/chuyển service khỏi package trước là việc của `mix service delete`, ngoài Pha này
  (xem Phi mục tiêu).
- **Không có "đặt mặc định" cho package** — khái niệm đó chỉ có ở runtime (`RuntimeSummary.default`);
  một service instance chọn version của nó lúc `service.create`, không có "version mặc định của
  MariaDB" theo nghĩa toàn máy.

## 3. Job — hạ tầng đã có từ Pha 1, lần đầu chạy thật

Không stream mới. `JobProgress { job, percent, message, at }` và `JobFinish { job, at, ending: …
}` đã tới trên `GET /events` mà `mixengine_watch` đã mở. Việc của Pha này là một hàm thuần
`jobState.ts` — cùng khuôn `daemonState.ts` đã có (`rowsFrom`, `applyEvent`, thuần, test không cần
daemon) — giữ một map `JobId -> JobProgress | JobFinish` từ các message đã thấy, và một component vẽ
thanh tiến độ từ đó theo `job.id` nó đang theo dõi. Component này **dùng chung cho cả Runtimes và
Packages** — cả hai chỉ khác `JobKind` (`"runtime.install"` so với `"package.install"`), không khác gì
ở cách vẽ.

- **Không cần `job.list` hay `job.status` để vẽ một job vừa tự mình tạo ra** — id đã có ngay trong câu
  trả lời của `runtime.install`/`package.install`, và mọi bước tiếp theo tới qua stream đang mở sẵn.
- **Cần `job.status` (hoặc `job.list` lọc `state: running`) đúng một lần: lúc mở tab.** Một job đang
  chạy từ trước khi tab này mở (cài một bản PHP từ CLI, rồi mở MixDB) không có `job_progress` nào cho
  UI thấy nó bắt đầu — bảng service đã theo luật này từ Pha 1 (`service.list` lúc mount, sự kiện chỉ
  cập nhật từ đó), job cũng vậy.
- **Job đã xong khi tab đóng rồi mở lại không cần vẽ lại** — `JobFinish` không tới hai lần cho một
  job đã kết thúc trước khi client này mở stream, và bảng "có thể cài" tự đọc lại `installed: true`
  qua `*.list_available`/`list_installed` lần sau, không qua job.
- `job.cancel` — không dùng ở Pha này. Không method nào của Pha 3 sinh ra một job nên huỷ nửa chừng là
  an toàn (một bản tải dở không để lại service nào đang chạy dở); để lại cho Blueprints (Pha 4), nơi
  `RunScaffold` thật sự có thể cần huỷ.

## 4. Services chi tiết

Một trang mở từ một hàng `ServiceSummary` ở Dashboard — không phải sidebar riêng, `servicesDetail`
trong `Sidebar.tsx` là chỗ chứa, nhưng vào bằng cách bấm một service cụ thể chứ không phải một danh
sách riêng (danh sách đã có ở Dashboard từ Pha 1, lặp lại nó là hai bảng phải đồng bộ).

### Giới hạn (T3.3 — chắc chắn buildable, cả hai nguồn tài liệu khớp nhau)

`service.limits` (đọc) và `service.set_limits` (ghi, **toàn bộ `ResourceLimits`, không phải patch** —
`ServiceLimitsSet`'s doc nói rõ: gửi lại cả ba field kể cả cái không đổi, hoặc mất field kia) đều trả
`ServiceLimitsReport { service, limits, support, watchdog }`.

- `support: LimitSupport` nói **CPU và memory có thể khác nhau trên cùng máy** (`Enforcement` đóng 4
  biến thể: `hard`, `unsupported`, `unavailable { why }`, `advisory { why }`) — vẽ hai control độc
  lập, không một cặp khoá chung. `hard` vẽ một wall (chạm trần là bị giết); `advisory` vẽ một vạch
  cảnh báo, **không được vẽ như một bảo đảm** — đúng câu luật roadmap đã chốt.
- `watchdog?: MemoryWatchdog` — `null` gộp hai trường hợp khác nhau (máy tự ép được, hoặc service
  không khai `memory_mb`) làm một câu trả lời: không có gì đang canh. Không suy ra cái nào từ `support`
  ở phía client; nếu cần phân biệt hai lý do, đó là việc mới không phải Pha này.
- `priority: Priority` (`"normal" | "background"`) — một switch, `support.priority` nói có tác dụng gì
  không trên máy này.

### Idle (một field, ba trạng thái)

`service.set_idle` nhận `ServiceIdleSet { service, minutes? }`. **Không phải hai state (bật/tắt) mà ba**:
`null` (theo recipe), `0` (tắt hẳn bất kể recipe), `n` (n phút). Một dropdown ba lựa chọn + ô số khi
chọn "n phút", không một checkbox.

### Database — T3.4 và T3.5

- **Tạo.** `database.create` (`DatabaseCreate { service, database, user? }`) → `DatabaseAccount
  { service, database, user, secret: SecretAddress, made: Provisioned }`. `made` nói cái nào **đã có
  sẵn** và cái nào **mới tạo** — vẽ hai câu khác nhau ("database đã có từ trước" vs "vừa tạo"), không
  gộp thành một "thành công". Không bao giờ nhận mật khẩu về; chỉ địa chỉ keyring.
- **Client có mở được không.** `database.client` (đọc, không khởi động gì) →
  `DatabaseClientReport { service, protocol?, secret?, client }`. Ba trạng thái của `client`
  (`installed`/`not_installed`/`no_client`) và `protocol: null` (service không client nào mở, ví dụ
  memcached) đều là **trạng thái phải vẽ**, không phải lỗi — đúng luật roadmap đã ghi hai lần.
- **"Open" — không đi qua `database.open`.** Đây là điểm khác với luồng OS-handoff Pha 0.
  `database.open` khởi động một **process ngoài** với `DesktopClient` tìm được — và với service kiểu
  `mysql`/`postgres`, `DesktopClient` đó chính là MixDB (`extension: "desktop-app"`, `name: "MixDB"`,
  đã đăng ký từ Pha 0). Gọi `database.open` từ trong MixDB nghĩa là MixDB tự bảo daemon **mở một tiến
  trình MixDB khác** — vòng ra ngoài rồi vòng lại, đúng thứ roadmap T3.5 nói "không nên đi qua OS".

  Đường thay thế: gọi `database.client` (đọc `secret: SecretAddress`), rồi dùng lại nguyên
  `secrets_resolve_mixengine` (Pha 0,
  [savedConnections.ts:80](../../../src/modules/db/savedConnections.ts)) với `secret.key` để lấy mật
  khẩu, dựng một `ConnectionConfig` tạm (host `127.0.0.1`, cổng từ `ServiceSummary.port`, protocol từ
  `DatabaseClientReport.protocol`), rồi mở nó như **một tab `db` mới trong cùng tiến trình đang chạy**.

  **Chưa có đường mở tab module khác từ trong module đang chạy.** Cơ chế tab-request hiện có
  (`shell/launch.ts`, `takeTabRequests`, `onTabRequest` ở [App.tsx:136](../../../src/shell/App.tsx))
  là hàng đợi backend cho **handoff từ OS** (`mixdb://` gọi vào một instance khác hoặc instance này từ
  ngoài) — không phải một API để một module tự mở tab module khác cùng tiến trình. Đây là quyết định
  còn để ngỏ trước khi viết màn hình Database; xem **Quyết định D2**.

## 5. Logs

`GET /logs/{service_id}?tail=N&follow=1` theo `daemon-and-ipc.md` đọc hôm nay; `LogSubject` đã vendor
lại nói route là `GET /logs/service/{id}` (hai đoạn, tách khỏi `GET /logs/job/{id}`) — một khác biệt
nữa giữa hai nguồn, xem **Quyết định D1**. `LogFrame` framed SSE giống `/events`:

- `{"type":"line", stream, at, text}` — một dòng thật, `stream: "stdout" | "stderr"`.
- `{"type":"historic", text}` — dòng từ trước khi kết nối, không có timestamp/stream (đã có trong text
  nếu service tự ghi).
- `{"type":"gap", missed}` — client chậm hơn service, số dòng bị bỏ. Vẽ một dòng phân cách kiểu "— bỏ
  qua N dòng —", không im lặng nuốt.

`tail=N` một mình là ảnh chụp rồi đóng kết nối; `follow=1` giữ sống. UI: mở trang Logs của một service
là `tail=200&follow=1` một lần; nút "Xem thêm phía trên" gọi lại với `tail` lớn hơn — **không phải
phân trang qua daemon**, đây vẫn là log ring trong bộ nhớ của daemon (`LogPolicy.ring_lines`), không
phải file.

**Log không bao giờ trộn vào `/events`** (ADR 0009, nhắc lại từ roadmap) — hai kết nối SSE độc lập
mở song song khi trang Logs đang mở, đóng khi rời trang.

**Không có nút "Mở thư mục chứa log" — xác nhận, không phải thiếu sót.** Roadmap T3.6 viết "lộ luôn
đường file trên đĩa", nhưng không field nào trên `LogLine`/`LogFrame` mang một đường dẫn, và đây là
chủ đích của ADR 0009: daemon không bao giờ trả layout lưu trữ của nó cho client — một phần vì một
client không cùng máy (thiết kế tương lai) không có gì để mở đường dẫn đó. `LogExcerpt` cũng không
phải type của trang này (xác nhận ở Hiện trạng) — nó thuộc `daemon.bundle`, Pha 4. MixDB tiêu thụ log
**chỉ qua stream** (`tail`/`follow`), không có đường vòng qua file — kể cả khi daemon chạy cùng máy.
Roadmap nên bỏ câu "lộ luôn đường file trên đĩa" khỏi T3.6.

## Kiểm thử

Phần thuần, không cần daemon nào:

| Test | Nội dung |
| --- | --- |
| `projectPins` | vẽ đúng `source` (file/row) và `resolved`/`hint` của mỗi `ProjectPin`; không suy ra `resolved` từ `constraint` phía client |
| `jobState` | `job_progress` cập nhật đúng job theo `id`; `job_finished` chốt `outcome`; message của job khác không đụng job này; dùng chung được cho cả `JobKind` runtime lẫn package |
| `poolOutcome` | ba giá trị `PoolOutcome` map đúng ba cách vẽ; `"pool_not_running"` không bị vẽ như lỗi |
| `logState`/parser SSE `/logs` | `line`/`historic`/`gap` phân biệt đúng; `gap` không làm mất các dòng trước nó |
| `limitsForm` | `support.cpu = "unsupported"` ẩn control CPU; `advisory` vẽ khác `hard`; gửi lại luôn cả ba field của `ResourceLimits` |
| `idleSelect` | ba trạng thái map đúng `null`/`0`/`n` hai chiều |
| Đường "Open in MixDB" | dựng đúng `ConnectionConfig` từ `DatabaseClientReport` + mật khẩu resolve được; `protocol: null` hoặc `client: "no_client"` không hiện nút |

**Không test được bằng vitest**, cần MixEngine thật: `package.*` có đúng như bindings suy ra không —
đây là namespace duy nhất trong bảng ở Hiện trạng còn chưa đối chiếu trực tiếp với `rpc.rs`;
`runtime.install`/`package.install` một bản thật có tiến độ hợp lý không hay nhảy thẳng 0→100; xoá một
project mà site đang trỏ tới có bị refuse hay để lại site mồ côi.

## Rủi ro

- **Method không tồn tại như tài liệu nói.** Bảng ở Hiện trạng liệt kê năm chỗ lệch; viết `commands.rs`
  cho một method đoán sai tên là một buổi tối debug một `not_found` không rõ do sai tên hay do daemon
  cũ. Giảm bằng D1.
- **Lọc `bindings/` theo tiền tố tên rồi kết luận vội — đã xảy ra thật một lần ở đây.** Bản nháp đầu
  loại bỏ toàn bộ cụm `Extension*` vì đoán chúng thuộc `extension.*` (Pha 4), trong khi
  `ExtensionChoice`/`ExtensionChange` thuộc `runtime.*`. Gần 300 file trong `api/types/`, việc này có
  thể còn lặp lại ở một góc khác của Pha 3 hay Pha 4 — trước khi kết luận một khả năng "không có
  method nào hỗ trợ", đọc doc comment của từng type nghi ngờ, không chỉ đọc tên file.
- **`force` của `runtime.uninstall` bị hiểu nhầm như `force` của `service.delete`** (Pha 2 chưa dùng,
  nhưng `ServiceDelete.force` cùng tên field, nghĩa khác — vượt qua site declare, không vượt qua
  project pin). `package.uninstall` **không có** `force` gì cả — ba khái niệm trông giống nhau, ba
  nghĩa khác nhau. Một hằng số hay một hàm helper dùng chung tên `force` cho cả hai chỗ có nó là điểm
  dễ lẫn nhất file này để lại cho code review.
- **"Open in MixDB" mở tab qua hàng đợi backend vốn cho OS-handoff** (nếu D2 chọn hướng đó) có thể kéo
  theo hành vi phụ không định trước — hàng đợi đó được `drain()` mỗi khi có `onTabRequest`, sự kiện
  vốn để báo một instance khác vừa gọi vào; tái dùng nó cho một thao tác cùng tiến trình cần đọc kỹ
  [launch.ts](../../../src/shell/launch.ts) trước, không chỉ đọc chỗ gọi ở `App.tsx`.

## Quyết định

**D1 — Ba việc cụ thể đã xác nhận bằng `rpc.rs` thật, không cần hỏi thêm; vẫn vendor lại `bindings/`
trước khi viết `commands.rs` cho phần còn lại.** Đã chốt: method sửa project là `project.update`, không
phải `set_runtime`; `service.config_get`/`config_set` **không tồn tại**, và đây là chủ đích kiến trúc
("config sinh ra dùng một lần, không phải blob đọc-ghi chung") chứ không phải chỗ chờ code — sửa
port/bind/data_dir/autostart của một service đã tồn tại ở ngoài phạm vi vĩnh viễn, không phải "chưa
tới lượt"; `GET /logs/...` không mang path nào, theo đúng ADR 0009, nút "Mở thư mục" không viết được.
`npm run bindings` (script có sẵn từ D2 của Transport spec) vẫn nên chạy trước khi code, cho phần
Pha này chưa đối chiếu trực tiếp với `rpc.rs` — cụ thể là `package.*` (bảng ở Hiện trạng còn ghi "chưa
tra") và mọi type mới `runtime.list_extensions`/`set_extension` có thể kéo theo mà bindings hiện tại
chưa vendor đủ.

**D2 — "Open in MixDB" chờ quyết ở buổi viết code, không chốt ở spec này.** Hai hướng: (a) một API
mới, nhỏ — một event bus trong tiến trình (`window` custom event hoặc một store) mà `App.tsx` lắng
nghe để `openTab(moduleId, state)`, tách hẳn khỏi hàng đợi backend của OS-handoff; (b) tái dùng hàng
đợi backend hiện có bằng cách chính module `mixengine` tự ghi vào cùng chỗ `launch.ts` đọc, dù đang
cùng tiến trình. (a) sạch hơn về khái niệm (không mượn cơ chế nghĩ cho một tình huống khác) nhưng là
code mới trong `shell/`, nơi ba module còn lại không ai chạm; (b) không thêm API nhưng mượn một cơ chế
được viết cho một invariant khác ("có một request từ ngoài tới") cho một tình huống nó không phải vậy
("tôi tự muốn mở"). Quyết trước khi viết màn hình Database.

**D3 — `RuntimeCatalogue.stale` và `PackageCatalogue.stale` vẽ cùng một component.** Cùng hình dạng,
cùng lý do tồn tại (cache không refresh được vẫn dùng được, im lặng về nó là nói dối), nên một badge
"Danh sách có thể cũ" nhận `stale: boolean` chung cho cả hai tab thay vì viết hai lần.

**D4 — Projects là mục sidebar thứ hai, ngay sau Dashboard, trước Sites.** Site cần chọn Project lúc
tạo, nên thứ tự sidebar nên đi trước thứ nó phục vụ. Đây là mục **ngoài** 9 màn hình `client-surface.md`
liệt kê — comment ở [Sidebar.tsx:6](../../../src/modules/mixengine/components/Sidebar/Sidebar.tsx)
("Chín mục cố định của `client-surface.md`") phải sửa lại, ghi rõ Projects là một mục MixDB tự thêm và
vì sao (Sites không dùng được nếu không có project nào, và `project.*` đã đủ method cho một màn hình
đầy đủ chứ không phải nửa vời).

**D5 — Runtimes và Packages là một sidebar item, hai tab con — không phải hai mục sidebar.** Cùng hình
dạng RPC (`RuntimeSummary`~`PackageSummary`, `RuntimeCatalogue`~`PackageCatalogue`, `RuntimeTarget`~
`PackageTarget`), cùng hình dạng job, khác đúng namespace gọi và đúng một khả năng (`force` chỉ
`runtime.uninstall` có). Tách hai mục sidebar là vẽ hai lần một thứ giống hệt nhau và làm sidebar phình
thêm một mục nữa ngoài 9 mục gốc — Projects (D4) đã là một ngoại lệ, không nên thành tiền lệ cho mỗi
namespace mới.

**D6 — `package.uninstall` bị refuse thì dừng ở đó, không có bước hai.** Không giống
`runtime.uninstall` có `force` để vượt qua refusal-vì-pin, `package.uninstall` không có tham số nào
tương tự — refuse vì `services` không rỗng là chốt. UI vẽ danh sách service đang phụ thuộc và một câu
giải thích, không vẽ một nút "vẫn gỡ" gọi vào chỗ không có gì nhận nó.
