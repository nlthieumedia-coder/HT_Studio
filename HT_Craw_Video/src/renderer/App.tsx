import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  FolderInput,
  Gauge,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import type {
  AppStatus,
  Dataset,
  MatchResult,
  SearchJob,
  SearchMode,
  Settings,
} from "../shared/types";
import { FREE_LOCAL_NOTICE } from "../shared/constants/defaults";

type Page = "dashboard" | "datasets" | "search" | "results" | "settings";
const modes: SearchMode[] = [
  "EXACT_MATCH",
  "NEAR_DUPLICATE",
  "SEMANTIC_SIMILARITY",
  "FORMAT_SIMILARITY",
];
const modeLabels: Record<SearchMode, string> = {
  EXACT_MATCH: "Trùng khớp chính xác",
  NEAR_DUPLICATE: "Gần trùng lặp",
  SEMANTIC_SIMILARITY: "Tương đồng nội dung",
  FORMAT_SIMILARITY: "Tương đồng định dạng",
};
const statusLabels: Record<string, string> = {
  ready: "Sẵn sàng",
  missing: "Chưa có",
  fallback: "Dự phòng",
  checking: "Đang kiểm tra",
  queued: "Đang chờ",
  running: "Đang chạy",
  paused: "Tạm dừng",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  failed: "Thất bại",
  NOT_CONNECTED: "Chưa kết nối",
  MOCK: "Mô phỏng",
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  folder: "Thư mục",
  manifest: "Tệp danh sách",
};

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [status, setStatus] = useState<AppStatus>();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [activeJob, setActiveJob] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = async () => {
    const [s, d, j] = await Promise.all([
      window.ht.status(),
      window.ht.datasets.list(),
      window.ht.search.list(),
    ]);
    setStatus(s);
    setDatasets(d);
    setJobs(j);
  };
  useEffect(() => {
    void refresh();
    return window.ht.onProgress((e) => {
      setMessage(`${e.step} (${e.progress}%)`);
      void refresh();
    });
  }, []);
  const nav = [
    ["dashboard", Gauge, "Tổng quan"],
    ["datasets", Database, "Quản lý kho dữ liệu"],
    ["search", Search, "Tìm kiếm mới"],
    ["results", Activity, "Kết quả tìm kiếm"],
    ["settings", SettingsIcon, "Cài đặt"],
  ] as const;
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="logo">HT</div>
          <div>
            <b>HT Craw Video</b>
            <small>Phân tích video cục bộ</small>
          </div>
        </div>
        <div className="mode">
          <ShieldCheck size={16} /> CHẾ ĐỘ CỤC BỘ
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
              key={id}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="notice">{FREE_LOCAL_NOTICE}</div>
      </aside>
      <main>
        <header>
          <div>
            <h1>{nav.find((n) => n[0] === page)?.[2]}</h1>
            <p>Dữ liệu và mô hình được xử lý hoàn toàn trên máy của bạn</p>
          </div>
          {message && <span className="pill">{message}</span>}
        </header>
        {page === "dashboard" && <Dashboard data={status} />}
        {page === "datasets" && (
          <Datasets
            rows={datasets}
            busy={busy}
            run={async (type) => {
              setBusy(true);
              try {
                const r =
                  type === "folder"
                    ? await window.ht.datasets.importFolder()
                    : await window.ht.datasets.importManifest();
                if (r)
                  setMessage(
                    `Đã nhập ${r.imported}, trùng ${r.duplicates}, lỗi ${r.failed}`,
                  );
                await refresh();
              } finally {
                setBusy(false);
              }
            }}
            refresh={refresh}
          />
        )}
        {page === "search" && (
          <NewSearch
            datasets={datasets}
            onStarted={async (j) => {
              setActiveJob(j.id);
              setPage("results");
              await refresh();
            }}
          />
        )}
        {page === "results" && (
          <Results
            jobs={jobs}
            active={activeJob}
            setActive={async (id) => {
              setActiveJob(id);
              setResults(await window.ht.search.results(id));
            }}
            rows={results}
          />
        )}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function Dashboard({ data }: { data?: AppStatus }) {
  const cards = [
    ["Kho dữ liệu", data?.datasetCount ?? 0],
    ["Video đã lập chỉ mục", data?.videoCount ?? 0],
    ["Đang xử lý", data?.processingCount ?? 0],
    ["Lượt tìm kiếm", data?.searchCount ?? 0],
    ["Kết quả", data?.resultCount ?? 0],
    ["Thời gian xử lý", `${Math.round(data?.processingSeconds ?? 0)} giây`],
  ];
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">RIÊNG TƯ · ƯU TIÊN NGOẠI TUYẾN</span>
          <h2>
            Phân tích video,
            <br />
            <em>hoàn toàn cục bộ.</em>
          </h2>
          <p>
            Tìm bản đăng lại, video cùng chủ đề và cùng công thức sản xuất mà
            không gửi dữ liệu lên đám mây.
          </p>
        </div>
        <Activity size={90} />
      </section>
      <section className="cards">
        {cards.map((x) => (
          <article key={x[0]}>
            <small>{x[0]}</small>
            <strong>{x[1]}</strong>
          </article>
        ))}
      </section>
      <section className="panel">
        <h3>Trạng thái hệ thống</h3>
        <div className="statusgrid">
          <Status name="FFmpeg / FFprobe" value={data?.ffmpeg} />
          <Status name="Tiến trình Python" value={data?.python} />
          <Status name="Chỉ mục véc-tơ" value={data?.vectorIndex} />
          {data?.connectors.map((x) => (
            <Status key={x.name} name={x.name} value={x.status} />
          ))}
        </div>
        {data?.python === "missing" && (
          <div className="runtime-help">
            <b>Không tìm thấy Python 3.10+</b>
            <p>
              Cài Python từ python.org và bật “Add Python to PATH”, sau đó chạy:
            </p>
            <code>python -m venv .venv</code>
            <code>
              .venv\Scripts\python -m pip install -r
              python-worker\requirements.txt
            </code>
            <p>
              Có thể đặt biến môi trường <code>HT_PYTHON_BIN</code> trỏ tới
              python.exe. Ứng dụng không giả lập kết quả AI khi runtime hoặc
              dependency bị thiếu.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
function Status({ name, value }: { name: string; value?: string }) {
  return (
    <div className="status">
      <i className={value === "ready" ? "ok" : ""} />
      <span>{name}</span>
      <b>{statusLabels[value ?? "checking"] ?? value}</b>
    </div>
  );
}

function Datasets({
  rows,
  busy,
  run,
  refresh,
}: {
  rows: Dataset[];
  busy: boolean;
  run: (t: "folder" | "manifest") => void;
  refresh: () => Promise<void>;
}) {
  return (
    <>
      <div className="toolbar">
        <button
          className="primary"
          disabled={busy}
          onClick={() => run("folder")}
        >
          <FolderInput size={17} />
          Nhập thư mục
        </button>
        <button disabled={busy} onClick={() => run("manifest")}>
          Nhập CSV / JSON
        </button>
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Nguồn</th>
              <th>Số mục</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <b>{d.name}</b>
                  <small>{d.rootPath}</small>
                </td>
                <td>{statusLabels[d.sourceType] ?? d.sourceType}</td>
                <td>{d.itemCount}</td>
                <td>
                  <span className="badge">
                    {statusLabels[d.status] ?? d.status}
                  </span>
                </td>
                <td>{new Date(d.createdAt).toLocaleString("vi-VN")}</td>
                <td>
                  <button
                    className="danger"
                    onClick={async () => {
                      await window.ht.datasets.control(d.id, "delete");
                      await refresh();
                    }}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty text="Chưa có kho dữ liệu. Hãy nhập một thư mục video hoặc tệp CSV/JSON." />
        )}
      </section>
    </>
  );
}

function NewSearch({
  datasets,
  onStarted,
}: {
  datasets: Dataset[];
  onStarted: (j: SearchJob) => void;
}) {
  const [source, setSource] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [mode, setMode] = useState<SearchMode>("NEAR_DUPLICATE"),
    [level, setLevel] = useState<"fast" | "balanced" | "deep">("balanced"),
    [whisper, setWhisper] = useState(true),
    [ocr, setOcr] = useState(true),
    [limit, setLimit] = useState(30),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel form">
      <label>
        Video mẫu
        <div className="picker">
          <input readOnly value={source} placeholder="Chọn video trên máy..." />
          <button
            onClick={async () =>
              setSource((await window.ht.search.chooseSource()) ?? "")
            }
          >
            Chọn tệp
          </button>
        </div>
      </label>
      <label>
        Kho dữ liệu
        <div className="checks">
          {datasets.map((d) => (
            <label key={d.id}>
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, d.id]
                      : selected.filter((x) => x !== d.id),
                  )
                }
              />
              {d.name} ({d.itemCount})
            </label>
          ))}
        </div>
      </label>
      <div className="grid2">
        <label>
          Chế độ tìm kiếm
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as SearchMode)}
          >
            {modes.map((m) => (
              <option value={m} key={m}>
                {modeLabels[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mức xử lý
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
          >
            <option value="fast">Nhanh</option>
            <option value="balanced">Cân bằng</option>
            <option value="deep">Chuyên sâu</option>
          </select>
        </label>
        <label>
          Số kết quả tối đa
          <input
            type="number"
            min="1"
            max="200"
            value={limit}
            onChange={(e) => setLimit(+e.target.value)}
          />
        </label>
      </div>
      <div className="toggles">
        <label>
          <input
            type="checkbox"
            checked={whisper}
            onChange={(e) => setWhisper(e.target.checked)}
          />{" "}
          Nhận dạng giọng nói Whisper cục bộ
        </label>
        <label>
          <input
            type="checkbox"
            checked={ocr}
            onChange={(e) => setOcr(e.target.checked)}
          />{" "}
          Nhận dạng chữ OCR cục bộ
        </label>
      </div>
      <button
        className="primary big"
        disabled={busy || !source || !selected.length}
        onClick={async () => {
          setBusy(true);
          try {
            onStarted(
              await window.ht.search.start({
                sourceFile: source,
                datasetIds: selected,
                mode,
                limit,
                level,
                enableWhisper: whisper,
                enableOcr: ocr,
              }),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Bắt đầu tìm kiếm cục bộ
      </button>
    </section>
  );
}

function Results({
  jobs,
  active,
  setActive,
  rows,
}: {
  jobs: SearchJob[];
  active: string;
  setActive: (s: string) => void;
  rows: MatchResult[];
}) {
  return (
    <>
      <div className="toolbar">
        <select value={active} onChange={(e) => void setActive(e.target.value)}>
          <option value="">Chọn một lượt tìm kiếm</option>
          {jobs.map((j) => (
            <option value={j.id} key={j.id}>
              {modeLabels[j.searchMode]} · {statusLabels[j.status]} ·{" "}
              {new Date(j.createdAt).toLocaleString("vi-VN")}
            </option>
          ))}
        </select>
        {active && (
          <>
            <button onClick={() => window.ht.search.export(active, "csv")}>
              Xuất CSV
            </button>
            <button onClick={() => window.ht.search.export(active, "xlsx")}>
              Xuất XLSX
            </button>
            <button
              className="danger"
              onClick={() => window.ht.search.cancel(active)}
            >
              Hủy tìm kiếm
            </button>
          </>
        )}
      </div>
      <div className="resultgrid">
        {rows.map((r) => (
          <article className="result" key={r.id}>
            {r.item?.thumbnailPath ? (
              <img src={`file://${r.item.thumbnailPath}`} />
            ) : (
              <div className="thumb">VIDEO</div>
            )}
            <div>
              <span className="badge">{modeLabels[r.matchType]}</span>
              <h3>
                {r.item?.caption || r.item?.filePath || r.item?.sourceUrl}
              </h3>
              <p>
                {r.item?.accountName || "Nguồn cục bộ"} · {r.item?.platform}
              </p>
              <div className="score">
                <strong>{r.totalScore.toFixed(1)}%</strong>
                <span>
                  Độ tin cậy {statusLabels[r.confidence]?.toLowerCase()}
                </span>
              </div>
              <details>
                <summary>Bằng chứng tương đồng</summary>
                <pre>{JSON.stringify(r.evidence, null, 2)}</pre>
              </details>
              <div className="actions">
                <button
                  onClick={() =>
                    r.item?.filePath &&
                    window.ht.system.openPath(r.item.filePath)
                  }
                >
                  Mở tệp
                </button>
                <button
                  onClick={() => window.ht.search.feedback(r.id, "relevant")}
                >
                  Phù hợp
                </button>
                <button
                  onClick={() =>
                    window.ht.search.feedback(r.id, "not_relevant")
                  }
                >
                  Không phù hợp
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {active && !rows.length && (
        <Empty text="Lượt tìm kiếm chưa có kết quả hoặc vẫn đang xử lý." />
      )}
    </>
  );
}

function SettingsPage() {
  const [value, setValue] = useState<Settings>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void window.ht.settings.get().then(setValue);
  }, []);
  if (!value) return null;
  const field = (key: keyof Settings, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={String(value[key])}
        onChange={(e) =>
          setValue({
            ...value,
            [key]: type === "number" ? +e.target.value : e.target.value,
          })
        }
      />
    </label>
  );
  return (
    <section className="panel form">
      <div className="grid2">
        {field("ffmpegPath", "Đường dẫn FFmpeg")}
        {field("ffprobePath", "Đường dẫn FFprobe")}
        {field("pythonPath", "Đường dẫn Python")}
        {field("whisperModel", "Mô hình Whisper")}
        {field("ocrModel", "Mô hình OCR")}
        {field("datasetFolder", "Thư mục kho dữ liệu")}
        {field("cacheFolder", "Thư mục bộ nhớ đệm")}
        {field("workers", "Số tiến trình xử lý", "number")}
        {field("deepCandidateLimit", "Số ứng viên phân tích sâu", "number")}
        {field("modelCacheDirectory", "Thư mục lưu mô hình")}
        <label>
          Thiết bị tính toán
          <select
            value={value.computeMode}
            onChange={(e) =>
              setValue({
                ...value,
                computeMode: e.target.value as Settings["computeMode"],
              })
            }
          >
            <option value="auto">Tự động</option>
            <option value="cpu">Bộ xử lý CPU</option>
            <option value="gpu">Card đồ họa GPU</option>
          </select>
        </label>
      </div>
      <label>
        <input
          type="checkbox"
          checked={value.deleteTempFiles}
          onChange={(e) =>
            setValue({ ...value, deleteTempFiles: e.target.checked })
          }
        />{" "}
        Tự động xóa tệp tạm
      </label>
      <button
        className="primary"
        onClick={async () => {
          await window.ht.settings.save(value);
          setSaved(true);
        }}
      >
        Lưu cài đặt
      </button>
      {saved && <span className="pill">Đã lưu cài đặt</span>}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Database size={42} />
      <p>{text}</p>
    </div>
  );
}
