import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ffprobeStatic from "ffprobe-static";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DelogoCoordinates {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Tìm đường dẫn thực thi của ffmpeg.exe:
 * 1. Thư mục bin được unpack trong ứng dụng Electron portable
 * 2. Thư mục bin trong thư mục gốc của project
 * 3. Fallback vào ffmpeg trong biến môi trường PATH
 */
export function getFfmpegPath(): string {
  // Khi đóng gói bằng Electron Builder:
  const resourcesPath = (process as unknown as { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    const unpacked = join(resourcesPath, "app.asar.unpacked", "bin", "ffmpeg.exe");
    if (existsSync(unpacked)) return unpacked;
    const directRes = join(resourcesPath, "bin", "ffmpeg.exe");
    if (existsSync(directRes)) return directRes;
  }

  // Khi chạy trong môi trường dev / workspace:
  const cwdBin = join(process.cwd(), "bin", "ffmpeg.exe");
  if (existsSync(cwdBin)) return cwdBin;

  const parentBin = join(__dirname, "..", "bin", "ffmpeg.exe");
  if (existsSync(parentBin)) return parentBin;

  return "ffmpeg";
}

/**
 * Tìm đường dẫn ffprobe.exe
 */
export function getFfprobePath(): string {
  const executable = typeof ffprobeStatic === "string" ? ffprobeStatic : (ffprobeStatic as { path?: string })?.path;
  if (typeof executable === "string" && existsSync(executable)) return executable;
  return "ffprobe";
}

/**
 * Lấy kích thước và thời lượng video bằng ffprobe
 */
export async function probeVideo(videoPath: string): Promise<{ width: number; height: number; duration: number }> {
  const ffprobe = getFfprobePath();
  const { stdout } = await execFileAsync(ffprobe, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    videoPath
  ]);

  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream.height || !parsed.format?.duration) {
    throw new Error(`Không thể đọc metadata của video: ${videoPath}`);
  }

  return {
    width: stream.width,
    height: stream.height,
    duration: Number(parsed.format.duration)
  };
}

/**
 * Tính toán tọa độ và kích thước vùng watermark AI (ngôi sao Google Vids)
 * Dựa vào tỉ lệ và độ phân giải thực tế của video:
 * - Không crop, không zoom, giữ nguyên 100% kích thước pixel gốc.
 * - Tọa độ được tính đối xứng từ góc dưới bên phải.
 */
export function getDelogoCoordinates(width: number, height: number): DelogoCoordinates {
  const isPortrait = height > width;

  if (isPortrait) {
    // Chuẩn 9:16 (1080x1920): Icon ngôi sao Google AI nằm tại x=865, y=1705, w=80, h=80.
    // Lấy box 90x90 (x=860, y=1700) tạo viền 5px để thuật toán nội suy điểm ảnh mượt mà nhất.
    const scale = width / 1080;
    const x = Math.round(860 * scale);
    const y = Math.round(1700 * scale);
    const w = Math.round(90 * scale);
    const h = Math.round(90 * scale);

    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.min(w, width - x),
      h: Math.min(h, height - y)
    };
  } else {
    // Chuẩn 16:9 (1920x1080): Căn theo cạnh đáy và cạnh phải tương ứng.
    const scale = height / 1080;
    const iconSize = Math.round(90 * scale);
    const x = Math.round(width - 220 * scale);
    const y = Math.round(height - 220 * scale);

    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      w: Math.min(iconSize, width - x),
      h: Math.min(iconSize, height - y)
    };
  }
}

export interface RemoveWatermarkOptions {
  outputPath?: string;
  width?: number;
  height?: number;
  onProgress?: (message: string) => void;
}

/**
 * Xóa watermark Google AI bằng thuật toán nội suy điểm ảnh (Delogo Inpainting):
 * - Không cắt xén hay zoom video (0 pixel bị mất).
 * - Giữ nguyên 100% kích thước, tỷ lệ, thời lượng và âm thanh gốc.
 * - Sử dụng bộ mã hóa x264 ultrafast CRF 18 và faststart để xem mượt trên web.
 */
export async function removeGoogleWatermark(
  inputPath: string,
  options: RemoveWatermarkOptions = {}
): Promise<string> {
  if (!existsSync(inputPath)) {
    throw new Error(`Tệp video không tồn tại: ${inputPath}`);
  }

  // 1. Xác định kích thước video nếu chưa có
  let width = options.width;
  let height = options.height;
  if (!width || !height) {
    const meta = await probeVideo(inputPath);
    width = meta.width;
    height = meta.height;
  }

  // 2. Tính toán vùng delogo chính xác
  const { x, y, w, h } = getDelogoCoordinates(width, height);

  options.onProgress?.(`Vùng watermark AI: x=${x}, y=${y}, w=${w}, h=${h} trên khung hình ${width}x${height}`);

  // 3. Đường dẫn xuất tạm thời
  const targetOutput = options.outputPath || inputPath;
  const tempOutput = `${inputPath}.delogo-tmp.mp4`;

  const ffmpeg = getFfmpegPath();
  const args = [
    "-y",
    "-i", inputPath,
    "-vf", `delogo=x=${x}:y=${y}:w=${w}:h=${h}`,
    "-map", "0:v",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "18",
    "-map", "0:a?",
    "-c:a", "copy",
    "-movflags", "+faststart",
    tempOutput
  ];

  try {
    await execFileAsync(ffmpeg, args);

    // 4. Nếu thành công, thay thế vào file đích an toàn
    if (targetOutput === inputPath) {
      await fs.unlink(inputPath).catch(() => undefined);
      await fs.rename(tempOutput, inputPath);
      return inputPath;
    } else {
      await fs.rename(tempOutput, targetOutput);
      return targetOutput;
    }
  } catch (error) {
    // Dọn dẹp tệp tạm nếu có lỗi
    await fs.unlink(tempOutput).catch(() => undefined);
    throw new Error(`Xóa watermark thất bại: ${error instanceof Error ? error.message : String(error)}`);
  }
}
