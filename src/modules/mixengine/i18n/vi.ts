import type en from "./en";

const vi: typeof en = {
  mixengine: {
    newTabTitle: "MixEngine",
    gate: {
      notRunning: "MixEngine đã cài nhưng chưa chạy.",
      notAnswering: "Daemon MixEngine không trả lời.",
      notInstalled: "Không tìm thấy MixEngine trên máy này.",
      start: "Khởi động MixEngine",
      starting: "Đang khởi động\u2026",
      retry: "Thử lại",
      getIt: "Cài MixEngine",
    },
    dashboard: {
      service: "Service",
      state: "Trạng thái",
      port: "Cổng",
      actions: "Hành động",
      start: "Bật",
      stop: "Tắt",
      restart: "Khởi động lại",
      starting: "Đang bật…",
      stopping: "Đang tắt…",
      restarting: "Đang khởi động lại…",
      stopAll: "Tắt tất cả",
      noServices: "Chưa có gì được dựng.",
      job: "Đang chạy",
      elevationWaiting: "{{count}} thao tác đang chờ quyền quản trị",
    },
    elevation: {
      title: "MixEngine cần quyền quản trị",
      lead: "Mọi thứ dưới đây sẽ được đổi trong đúng một lần hỏi.",
      grant: "Cho phép",
      drop: "Bỏ đi",
    },
  },
  error: {},
};

export default vi;
