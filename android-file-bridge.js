import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { App } from "@capacitor/app";
import { Share } from "@capacitor/share";

let lastBackPressAt = 0;
let backExitMessage;
let backExitMessageTimeout;

function showBackExitMessage() {
  if (!backExitMessage) {
    backExitMessage = document.createElement("div");
    backExitMessage.setAttribute("role", "status");
    backExitMessage.setAttribute("aria-live", "polite");
    backExitMessage.textContent = "Press Back again to exit";
    Object.assign(backExitMessage.style, {
      position: "fixed",
      left: "50%",
      bottom: "max(24px, env(safe-area-inset-bottom))",
      transform: "translateX(-50%)",
      zIndex: "9999",
      maxWidth: "calc(100vw - 32px)",
      padding: "10px 16px",
      borderRadius: "999px",
      background: "rgba(25, 31, 43, 0.96)",
      color: "#fff",
      font: "600 14px system-ui, sans-serif",
      textAlign: "center",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
      pointerEvents: "none"
    });
    document.body.append(backExitMessage);
  }

  backExitMessage.hidden = false;
  clearTimeout(backExitMessageTimeout);
  backExitMessageTimeout = setTimeout(() => {
    backExitMessage.hidden = true;
    lastBackPressAt = 0;
  }, 2000);
}

App.addListener("backButton", () => {
  const openDialog = [...document.querySelectorAll("dialog[open]")].reverse()[0];
  if (openDialog) {
    lastBackPressAt = 0;
    clearTimeout(backExitMessageTimeout);
    if (backExitMessage) backExitMessage.hidden = true;
    if (openDialog.id === "remainingTopicsDialog") {
      openDialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    } else {
      openDialog.close();
    }
    return;
  }

  const now = Date.now();
  if (now - lastBackPressAt < 2000) {
    App.exitApp();
    return;
  }

  lastBackPressAt = now;
  showBackExitMessage();
});

window.csirTrackerAndroidFiles = {
  async exportCsv(csv) {
    const { uri } = await Filesystem.writeFile({
      path: "csir_progress.csv",
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    return Share.share({
      title: "CSIR Tracker progress",
      text: "Export your CSIR Tracker progress.",
      url: uri,
      dialogTitle: "Share progress CSV"
    });
  }
};
