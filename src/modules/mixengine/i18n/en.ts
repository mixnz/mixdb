export default {
  mixengine: {
    newTabTitle: "MixEngine",
    // The three states in front of a daemon that is not answering. Each says what to do next,
    // because "error" alone leaves somebody guessing whether to install, to start, or to wait.
    gate: {
      notRunning: "MixEngine is installed but not running.",
      notAnswering: "The MixEngine daemon is not answering.",
      notInstalled: "MixEngine was not found on this machine.",
      start: "Start MixEngine",
      starting: "Starting\u2026",
      retry: "Try again",
      getIt: "Install MixEngine",
    },
    dashboard: {
      service: "Service",
      state: "State",
      port: "Port",
      actions: "Actions",
      start: "Start",
      stop: "Stop",
      restart: "Restart",
      stopAll: "Stop all",
      noServices: "Nothing is set up yet.",
      job: "Working",
    },
    elevation: {
      title: "MixEngine needs an administrator",
      lead: "Everything below will be changed in one prompt.",
      grant: "Allow",
      drop: "Discard",
    },
  },
  error: {},
};
