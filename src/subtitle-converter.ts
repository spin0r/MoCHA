import type { SubtitleFormat, SubtitleResult } from './types';

/**
 * SubtitleConverter — converts SRT / ASS / SSA files to WebVTT
 * and returns a blob URL that DPlayer can consume natively.
 */
export class SubtitleConverter {
  /**
   * Read a File object as text.
   */
  private _readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read subtitle file"));
      reader.readAsText(file);
    });
  }

  /**
   * Detect the subtitle format from extension + content sniffing.
   */
  private _detectFormat(fileName: string, content: string): SubtitleFormat {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? '';
    if (ext === "vtt" || content.trimStart().startsWith("WEBVTT")) return "vtt";
    if (ext === "srt") return "srt";
    if (ext === "ass" || ext === "ssa") return "ass";
    // Fallback: try to sniff
    if (content.includes("[Script Info]") || content.includes("[V4+ Styles]"))
      return "ass";
    if (/\d+\r?\n\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(content)) return "srt";
    return "srt"; // default assumption
  }

  /**
   * Convert SRT text to WebVTT text.
   */
  private _srtToVtt(srt: string): string {
    let vtt = "WEBVTT\n\n";
    // Normalise line endings
    const text = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length < 2) continue;

      // Find the timing line (contains "-->")
      let timingIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("-->")) {
          timingIdx = i;
          break;
        }
      }
      if (timingIdx === -1) continue;

      // Convert commas to dots in timestamps  (00:01:23,456 → 00:01:23.456)
      const timing = lines[timingIdx].replace(/,/g, ".");
      const subtitle = lines.slice(timingIdx + 1).join("\n");

      if (subtitle.trim()) {
        vtt += timing + "\n" + subtitle + "\n\n";
      }
    }
    return vtt;
  }

  /**
   * Convert ASS / SSA text to WebVTT text.
   * Handles basic Dialogue lines and strips inline style overrides.
   */
  private _assToVtt(ass: string): string {
    let vtt = "WEBVTT\n\n";
    const lines = ass.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

    // Find the [Events] section and its Format line
    let formatFields: string[] | null = null;
    let inEvents = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.toLowerCase() === "[events]") {
        inEvents = true;
        continue;
      }
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        inEvents = false;
        continue;
      }

      if (!inEvents) continue;

      if (trimmed.toLowerCase().startsWith("format:")) {
        formatFields = trimmed
          .substring(7)
          .split(",")
          .map((f: string) => f.trim().toLowerCase());
        continue;
      }

      if (!trimmed.toLowerCase().startsWith("dialogue:")) continue;
      if (!formatFields) continue;

      // Parse the dialogue line — fields are comma-separated, but the last
      // field (Text) may contain commas so we only split up to n-1 commas.
      const data = trimmed.substring(trimmed.indexOf(":") + 1);
      const parts = data.split(",");
      const fieldCount = formatFields.length;

      if (parts.length < fieldCount) continue;

      const values: Record<string, string> = {};
      for (let i = 0; i < fieldCount - 1; i++) {
        values[formatFields[i]] = parts[i].trim();
      }
      // Last field gets the remainder (may contain commas)
      values[formatFields[fieldCount - 1]] = parts
        .slice(fieldCount - 1)
        .join(",")
        .trim();

      const start = this._assTimeToVtt(values.start);
      const end = this._assTimeToVtt(values.end);
      let text = values.text || "";

      // Strip ASS style overrides  {\\...}
      text = text.replace(/\{[^}]*\}/g, "");
      // Convert \N and \n to real newlines
      text = text.replace(/\\[Nn]/g, "\n");

      if (start && end && text.trim()) {
        vtt += `${start} --> ${end}\n${text.trim()}\n\n`;
      }
    }
    return vtt;
  }

  /**
   * Convert an ASS timestamp (H:MM:SS.cc) to VTT format (HH:MM:SS.mmm).
   */
  private _assTimeToVtt(ts: string | undefined): string | null {
    if (!ts) return null;
    const match = ts.match(/(\d+):(\d{2}):(\d{2})\.(\d{2,3})/);
    if (!match) return null;
    const h = match[1].padStart(2, "0");
    const m = match[2];
    const s = match[3];
    let ms = match[4];
    // ASS uses centiseconds (2 digits) — pad to 3 for milliseconds
    if (ms.length === 2) ms += "0";
    return `${h}:${m}:${s}.${ms}`;
  }

  /**
   * Main entry point — accepts a File, returns { url, format, originalName }.
   */
  async convertToWebVTT(file: File): Promise<SubtitleResult> {
    const content = await this._readFileAsText(file);
    const format = this._detectFormat(file.name, content);

    let vttContent: string;
    switch (format) {
      case "vtt":
        vttContent = content;
        break;
      case "srt":
        vttContent = this._srtToVtt(content);
        break;
      case "ass":
        vttContent = this._assToVtt(content);
        break;
      default:
        vttContent = this._srtToVtt(content);
    }

    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);

    return {
      url,
      format,
      originalName: file.name,
    };
  }
}
