import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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
