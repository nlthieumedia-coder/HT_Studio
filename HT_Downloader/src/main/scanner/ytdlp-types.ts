export interface YtDlpFormat {
  format_id?: string; format?: string; url?: string; manifest_url?: string; protocol?: string;
  width?: number; height?: number; resolution?: string; fps?: number; ext?: string;
  vcodec?: string; acodec?: string; filesize?: number; filesize_approx?: number;
}
export interface YtDlpEntry {
  id?: string; title?: string; webpage_url?: string; original_url?: string; url?: string;
  extractor?: string; extractor_key?: string; thumbnail?: string; duration?: number;
  upload_date?: string; timestamp?: number;
  formats?: YtDlpFormat[]; entries?: Array<YtDlpEntry | null>; _type?: string;
}
