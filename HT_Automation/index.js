// ==== HT_Automation — v3.0.5: Premiere Pro UXP Plugin ====
// Tab 1: Ảnh + Âm thanh
// Tab 2: Video + Âm thanh (dùng HTTP Bridge gọi FFmpeg đổi tốc độ video khớp audio)

const { storage, entrypoints } = require("uxp");
const fs = storage.localFileSystem;
let ppro = null;
try {
  ppro = require("premierepro");
} catch (e) {
  console.warn("Module premierepro chưa sẵn sàng:", e.message);
}

async function runFfmpegProcess(exePath, args, timeoutMs = 0) {
  // Local Bridge HTTP Server (chạy ngầm port 19888)
  try {
    const response = await fetch("http://127.0.0.1:19888/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exePath, args, timeoutMs })
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (netErr) {
    throw new Error(
      `Lỗi kết nối Server (${netErr.message}).\n` +
      `👉 Hãy chạy lại bộ cài một click để bật FFmpeg Bridge.`
    );
  }
}

async function runProcessWithHeartbeat(exePath, args, timeoutMs, label, detail, percent) {
  const started = Date.now();
  const update = () => showTaskProgress(label, `${detail} · đang chạy ${formatClockDuration((Date.now() - started) / 1000)}`, percent);
  update();
  const timer = setInterval(update, 1000);
  try { return await runFfmpegProcess(exePath, args, timeoutMs); }
  finally { clearInterval(timer); }
}

// ---- Safe DOM Helpers ----
function getEl(id) {
  return document.getElementById(id);
}

function listen(id, eventName, callback) {
  const el = typeof id === "string" ? getEl(id) : id;
  if (el) {
    el.addEventListener(eventName, callback);
  } else {
    console.warn(`[HT_Automation] Element #${id} not found when attaching listener.`);
  }
}

function log(msg) {
  console.log(msg);
  const logEl = getEl("log");
  if (logEl) {
    const current = String(logEl.textContent || "");
    const lines = `${current}\n${msg}`.split("\n");
    logEl.textContent = lines.slice(-300).join("\n");
    const container = document.querySelector(".log-container");
    if (container && !container.classList.contains("collapsed")) logEl.scrollTop = logEl.scrollHeight;
  }
}

function setBtnDisabled(btnId, disabled) {
  const btn = getEl(btnId);
  if (!btn) return;
  btn.disabled = disabled;
  if (disabled) {
    btn.setAttribute("disabled", "true");
    btn.classList.add("disabled");
  } else {
    btn.removeAttribute("disabled");
    btn.classList.remove("disabled");
  }
}

function setSystemState(kind, label, stateClass) {
  const capitalized = kind.charAt(0).toUpperCase() + kind.slice(1);
  const home = getEl(`home${capitalized}State`);
  const settings = getEl(`settings${capitalized}State`);
  if (home) home.textContent = label;
  if (settings) {
    settings.textContent = label;
    settings.classList.remove("success", "warning", "error");
    if (stateClass) settings.classList.add(stateClass);
  }
}

let activeTaskStartedAt = 0;
let taskPauseRequested = false;
let subtitleBuildRunning = false;

// Bind the primary subtitle action early. It must remain usable even if an
// optional editor/export initializer later in this file fails in Premiere UXP.
listen("btnBuildSubtitle", "click", handleBuildSubtitle);
const earlySubtitleButton = getEl("btnBuildSubtitle");
if (earlySubtitleButton) {
  earlySubtitleButton.classList.remove("disabled", "is-running");
  earlySubtitleButton.removeAttribute("disabled");
}

async function waitIfTaskPaused() {
  if (!taskPauseRequested) return;
  const box = getEl("taskStatus");
  if (box) box.classList.add("paused");
  while (taskPauseRequested) await new Promise((resolve) => setTimeout(resolve, 150));
  if (box) box.classList.remove("paused");
}

listen("btnPauseTask", "click", () => {
  taskPauseRequested = !taskPauseRequested;
  const button = getEl("btnPauseTask");
  if (button) button.textContent = taskPauseRequested ? "Tiếp tục" : "Tạm dừng";
  const box = getEl("taskStatus");
  if (box) box.classList.toggle("paused", taskPauseRequested);
  const detail = getEl("taskStatusDetail");
  if (detail && taskPauseRequested) detail.textContent = "Sẽ tạm dừng ngay sau file hoặc clip hiện tại...";
});

function showTaskProgress(label, detail = "", percent = 0) {
  activeTaskStartedAt = activeTaskStartedAt || Date.now();
  const box = getEl("taskStatus");
  if (box) box.style.display = "block";
  getEl("taskStatusText").textContent = label;
  const elapsed = Math.floor((Date.now() - activeTaskStartedAt) / 1000);
  getEl("taskStatusDetail").textContent = `${detail}${detail ? " · " : ""}${formatClockDuration(elapsed)}`;
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  getEl("taskStatusPercent").textContent = `${safePercent}%`;
  getEl("taskProgressBar").style.width = `${safePercent}%`;
  const alert = getEl("resultAlert");
  if (alert) alert.style.display = "none";
}

function finishTask(message, kind = "success") {
  const box = getEl("taskStatus");
  if (box) box.style.display = "none";
  const alert = getEl("resultAlert");
  if (alert) {
    alert.className = `alert ${kind}`;
    alert.textContent = message;
    alert.style.display = "flex";
  }
  activeTaskStartedAt = 0;
  taskPauseRequested = false;
  if (getEl("btnPauseTask")) getEl("btnPauseTask").textContent = "Tạm dừng";
  if (getEl("taskStatus")) getEl("taskStatus").classList.remove("paused");
  if (kind === "error") {
    const logContainer = document.querySelector(".log-container");
    if (logContainer) logContainer.classList.remove("collapsed");
    if (getEl("btnToggleLog")) getEl("btnToggleLog").textContent = "Ẩn";
  }
}

function saveUiPreferences() {
  try {
    localStorage.setItem("htAutomationPreferences", JSON.stringify({
      subtitleLanguage: getEl("selectSubtitleLanguage") ? getEl("selectSubtitleLanguage").value : "auto",
      subtitleQuality: getEl("selectSubtitleQuality") ? getEl("selectSubtitleQuality").value : "accurate",
      subtitleLineLength: getEl("inputSubtitleLineLength") ? getEl("inputSubtitleLineLength").value : "42",
      subtitleMaxLines: getEl("selectSubtitleMaxLines") ? getEl("selectSubtitleMaxLines").value : "2",
      subtitleImport: getEl("checkSubtitleImport") ? getEl("checkSubtitleImport").checked : true,
      subtitleTrack: getEl("selectSubtitleTrack") ? getEl("selectSubtitleTrack").value : "1",
      audioOnlySpacing: getEl("selectAudioOnlySpacing") ? getEl("selectAudioOnlySpacing").value : "continuous",
      audioOnlyGapFrames: getEl("inputAudioOnlyGapFrames") ? getEl("inputAudioOnlyGapFrames").value : "10",
      musicLufs: getEl("inputMusicLufs") ? getEl("inputMusicLufs").value : "-25",
      musicTrack: getEl("inputMusicTrack") ? getEl("inputMusicTrack").value : "2",
      musicLoop: getEl("checkMusicLoop") ? getEl("checkMusicLoop").checked : true,
      musicNormalize: getEl("checkMusicNormalize") ? getEl("checkMusicNormalize").checked : false
    }));
  } catch (e) {}
}

function restoreUiPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem("htAutomationPreferences") || "{}");
    if (saved.subtitleLanguage && getEl("selectSubtitleLanguage")) getEl("selectSubtitleLanguage").value = saved.subtitleLanguage;
    if (["accurate", "fast"].includes(saved.subtitleQuality) && getEl("selectSubtitleQuality")) getEl("selectSubtitleQuality").value = saved.subtitleQuality;
    if (saved.subtitleLineLength && getEl("inputSubtitleLineLength")) getEl("inputSubtitleLineLength").value = saved.subtitleLineLength;
    if (saved.subtitleMaxLines && getEl("selectSubtitleMaxLines")) getEl("selectSubtitleMaxLines").value = saved.subtitleMaxLines;
    if (typeof saved.subtitleImport === "boolean" && getEl("checkSubtitleImport")) getEl("checkSubtitleImport").checked = saved.subtitleImport;
    if (/^[1-9]\d*$/.test(String(saved.subtitleTrack || "")) && getEl("selectSubtitleTrack")) getEl("selectSubtitleTrack").value = String(saved.subtitleTrack);
    if (["continuous", "frames"].includes(saved.audioOnlySpacing) && getEl("selectAudioOnlySpacing")) getEl("selectAudioOnlySpacing").value = saved.audioOnlySpacing;
    if (/^\d+$/.test(String(saved.audioOnlyGapFrames || "")) && getEl("inputAudioOnlyGapFrames")) getEl("inputAudioOnlyGapFrames").value = saved.audioOnlyGapFrames;
    if (saved.musicLufs && getEl("inputMusicLufs")) getEl("inputMusicLufs").value = saved.musicLufs;
    if (saved.musicTrack && getEl("inputMusicTrack")) getEl("inputMusicTrack").value = saved.musicTrack;
    if (typeof saved.musicLoop === "boolean" && getEl("checkMusicLoop")) getEl("checkMusicLoop").checked = saved.musicLoop;
    if (typeof saved.musicNormalize === "boolean" && getEl("checkMusicNormalize")) getEl("checkMusicNormalize").checked = saved.musicNormalize;
  } catch (e) {}
}
restoreUiPreferences();
for (const preferenceId of ["selectSubtitleLanguage", "selectSubtitleQuality", "inputSubtitleLineLength", "selectSubtitleMaxLines", "checkSubtitleImport", "selectSubtitleTrack", "selectAudioOnlySpacing", "inputAudioOnlyGapFrames", "inputMusicLufs", "inputMusicTrack", "checkMusicLoop", "checkMusicNormalize"]) {
  listen(preferenceId, "change", saveUiPreferences);
  listen(preferenceId, "input", saveUiPreferences);
}

// ---- State chung ----
let imageFolder = null;
let audioFolder = null;
let videoFolder = null;
let videoAudioFolder = null;
let audioOnlyFolder = null;
let syncedSubfolderEntry = null;
let musicFolder = null;
let musicEntries = [];
let normalizedMusicFolder = null;
let overlayEntries = [];
let bundledFfmpegPath = "ffmpeg";

// Xác định FFmpeg theo thư mục plugin thay vì gắn cứng đường dẫn máy phát triển.
(async () => {
  try {
    if (typeof fs.getPluginFolder !== "function") return;
    const pluginFolder = await fs.getPluginFolder();
    if (!pluginFolder || !pluginFolder.nativePath) return;
    bundledFfmpegPath = `${pluginFolder.nativePath}\\bin\\ffmpeg.exe`;
    const inputEl = getEl("inputFfmpegPath");
    if (inputEl && !(inputEl.value || "").trim()) inputEl.value = bundledFfmpegPath;
  } catch (e) {}
})();

// ---- Tab Switcher ----
function activateTab(tab) {
  const names = ["home", "build", "subtitle", "post", "settings"];
  const pairs = [
    [getEl("tabBtnHome"), getEl("tabPanelHome"), tab === "home"],
    [getEl("tabBtnBuild"), getEl("tabPanelBuild"), tab === "build"],
    [getEl("tabBtnSubtitle"), getEl("tabPanelSubtitle"), tab === "subtitle"],
    [getEl("tabBtnPost"), getEl("tabPanelPost"), tab === "post"],
    [getEl("tabBtnSettings"), getEl("tabPanelSettings"), tab === "settings"]
  ];
  for (const [button, panel, active] of pairs) {
    if (button) button.classList.toggle("active", active);
    if (panel) { panel.classList.toggle("active", active); panel.style.display = active ? "block" : "none"; }
  }
  if (!names.includes(tab)) return;
  if ((tab === "build" || tab === "post" || tab === "subtitle" || tab === "settings") && typeof autoCheckFfmpeg === "function") autoCheckFfmpeg(true);
  if (tab === "subtitle" && typeof discoverSubtitleAudioTracks === "function") discoverSubtitleAudioTracks();
}
window.activateTab = activateTab;

function activateBuildMode(mode) {
  const imageActive = mode === "image";
  const videoActive = mode === "video";
  const audioActive = mode === "audio";
  getEl("modeBtnImage").classList.toggle("active", imageActive);
  getEl("modeBtnVideo").classList.toggle("active", videoActive);
  getEl("modeBtnAudio").classList.toggle("active", audioActive);
  getEl("tabPanelImage").classList.toggle("active", imageActive);
  getEl("tabPanelVideo").classList.toggle("active", videoActive);
  getEl("tabPanelAudio").classList.toggle("active", audioActive);
  getEl("tabPanelImage").style.display = imageActive ? "block" : "none";
  getEl("tabPanelVideo").style.display = videoActive ? "block" : "none";
  getEl("tabPanelAudio").style.display = audioActive ? "block" : "none";
  if (videoActive && typeof autoCheckFfmpeg === "function") autoCheckFfmpeg(true);
}

function activatePostMode(mode) {
  const musicActive = mode === "music";
  getEl("modeBtnMusic").classList.toggle("active", musicActive);
  getEl("modeBtnOverlay").classList.toggle("active", !musicActive);
  getEl("postMusicPanel").classList.toggle("active", musicActive);
  getEl("postOverlayPanel").classList.toggle("active", !musicActive);
}

listen("tabBtnHome", "click", () => activateTab("home"));
listen("tabBtnBuild", "click", () => activateTab("build"));
listen("tabBtnPost", "click", () => activateTab("post"));
listen("tabBtnSubtitle", "click", () => activateTab("subtitle"));
listen("tabBtnSettings", "click", () => activateTab("settings"));
listen("modeBtnImage", "click", () => activateBuildMode("image"));
listen("modeBtnVideo", "click", () => activateBuildMode("video"));
listen("modeBtnAudio", "click", () => activateBuildMode("audio"));
listen("modeBtnMusic", "click", () => activatePostMode("music"));
listen("modeBtnOverlay", "click", () => activatePostMode("overlay"));
listen("quickBuildImage", "click", () => { activateTab("build"); activateBuildMode("image"); });
listen("quickBuildVideo", "click", () => { activateTab("build"); activateBuildMode("video"); });
listen("quickSubtitle", "click", () => activateTab("subtitle"));
listen("quickPost", "click", () => activateTab("post"));

for (const tabButton of ["tabBtnHome", "tabBtnBuild", "tabBtnSubtitle", "tabBtnPost", "tabBtnSettings"]) {
  listen(tabButton, "keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      getEl(tabButton).click();
    }
  });
}

// Move technical controls to Settings without changing their IDs/listeners.
const settingsTechnical = getEl("settingsTechnical");
for (const technicalElement of [getEl("ffmpegSettingsCard"), getEl("whisperExeSetting"), getEl("whisperModelSetting")]) {
  if (settingsTechnical && technicalElement) settingsTechnical.appendChild(technicalElement);
}

listen("btnReloadPanel", "click", () => {
  log("🔄 Đang tải lại giao diện Plugin...");
  window.location.reload();
});

listen("btnClearLog", "click", () => {
  const logEl = getEl("log");
  if (logEl) logEl.textContent = "Sẵn sàng thực thi quy trình.";
});
listen("btnToggleLog", "click", () => {
  const container = document.querySelector(".log-container");
  if (!container) return;
  const collapsed = container.classList.toggle("collapsed");
  getEl("btnToggleLog").textContent = collapsed ? "Xem" : "Ẩn";
});

// ==========================================================================
// ---- Quan ly danh sach Sequence (dung chung cho ca 2 tab) ----
// ==========================================================================
let availableSequences = [];
let selectedSequenceIndex = "CREATE_NEW";

async function refreshSequenceDropdown(project) {
  const selectEl = getEl("selectSequence");
  if (!selectEl) return null;
  selectEl.innerHTML = "";

  try {
    let seqs = [];
    if (typeof project.getSequences === "function") {
      seqs = await project.getSequences();
    } else if (project.sequences) {
      seqs = project.sequences;
    }

    availableSequences = [];
    if (seqs) {
      for (let i = 0; i < seqs.length; i++) {
        availableSequences.push(seqs[i]);
      }
    }

    const optNew = document.createElement("option");
    optNew.value = "CREATE_NEW";
    optNew.textContent = "✨ ➕ Tự động tạo Timeline mới";
    selectEl.appendChild(optNew);

    const activeSeq = await project.getActiveSequence();
    let defaultIndex = "CREATE_NEW";

    if (availableSequences.length > 0) {
      availableSequences.forEach((seq, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        opt.textContent = `🎬 Timeline: ${seq.name}`;
        if (activeSeq && (activeSeq.id === seq.id || activeSeq.name === seq.name)) {
          opt.selected = true;
          defaultIndex = idx;
        }
        selectEl.appendChild(opt);
      });

      selectedSequenceIndex = defaultIndex;
      selectEl.value = defaultIndex;
      const currentName = typeof defaultIndex === "number" ? availableSequences[defaultIndex].name : "Tự động tạo mới";
      log(`Đã nạp ${availableSequences.length} Sequence. Đang chọn: "${currentName}".`);
      return typeof defaultIndex === "number" ? availableSequences[defaultIndex] : null;
    } else {
      selectedSequenceIndex = "CREATE_NEW";
      selectEl.value = "CREATE_NEW";
      log("Project chưa có Sequence nào. Đã chọn chế độ '✨ Tự động tạo Timeline mới'.");
      return null;
    }
  } catch (err) {
    log("Lỗi tải danh sách Sequence: " + err.message);
    return null;
  }
}

listen("selectSequence", "change", async (e) => {
  const val = e.target.value;
  if (val === "CREATE_NEW") {
    selectedSequenceIndex = "CREATE_NEW";
    log("👉 Bạn đã chọn: ✨ Tự động tạo Timeline mới khi dựng project.");
    return;
  }

  const idx = parseInt(val, 10);
  if (!isNaN(idx) && idx >= 0 && availableSequences[idx]) {
    selectedSequenceIndex = idx;
    const seq = availableSequences[idx];
    log(`👉 Bạn đã chọn Timeline: "${seq.name}"`);
    try {
      if (!ppro) ppro = require("premierepro");
      const project = await ppro.Project.getActiveProject();
      if (project && typeof project.openSequence === "function") {
        await project.openSequence(seq);
        log(`Đã mở Timeline: "${seq.name}"`);
      } else if (seq && typeof seq.openInTimeline === "function") {
        await seq.openInTimeline();
      }
    } catch (openErr) {}
  }
});

// ---- Test ket noi toi Premiere (dung chung) ----
listen("btnTestConnection", "click", async () => {
  try {
    log("⚡ Đang kiểm tra kết nối Premiere Pro...");
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    const statusDotEl = getEl("statusDot");
    const statusTextEl = getEl("statusText");
    if (!project) {
      if (statusDotEl) statusDotEl.classList.remove("active");
      if (statusTextEl) statusTextEl.textContent = "Không tìm thấy Project";
      log("⚠️ Chưa tìm thấy Project nào đang mở trong Premiere Pro.");
      setSystemState("premiere", "Chưa kết nối", "warning");
      return;
    }

    if (statusDotEl) statusDotEl.classList.add("active");
    if (statusTextEl) statusTextEl.textContent = "Đã kết nối";
    setSystemState("premiere", "Sẵn sàng", "success");
    log(`✅ Kết nối THÀNH CÔNG với Project: "${project.name}". Đang nạp danh sách Sequence...`);

    const currentSeq = await refreshSequenceDropdown(project);
    if (currentSeq) {
      log(`👉 Timeline đang chọn: "${currentSeq.name}"`);
    } else {
      log("👉 Project chưa có Sequence nào. Đã bật chế độ tự động tạo Timeline mới.");
    }
    setTimeout(() => autoCheckFfmpeg(true), 500);
  } catch (err) {
    const statusDotEl = getEl("statusDot");
    const statusTextEl = getEl("statusText");
    if (statusDotEl) statusDotEl.classList.remove("active");
    if (statusTextEl) statusTextEl.textContent = "Lỗi kết nối";
    setSystemState("premiere", "Lỗi", "error");
    log("❌ Lỗi kết nối tới Premiere Pro: " + err.message);
  }
});

// ==========================================================================
// ---- Core Helper Functions ----
// ==========================================================================
function extractNumberFromFilename(filename) {
  if (!filename) return null;
  const dotIdx = filename.lastIndexOf(".");
  const nameWithoutExt = dotIdx > 0 ? filename.substring(0, dotIdx) : filename;

  const matches = nameWithoutExt.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  // 1. Ưu tiên số ở đầu tên file (e.g. "1_video", "01-clip")
  const leadingMatch = nameWithoutExt.match(/^(\d+)/);
  if (leadingMatch) {
    return parseInt(leadingMatch[1], 10).toString();
  }

  // 2. Ưu tiên số ở cuối tên file (e.g. "video_1", "scene-01")
  const trailingMatch = nameWithoutExt.match(/(\d+)$/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1], 10).toString();
  }

  // 3. Mặc định lấy nhóm chữ số đầu tiên trong tên
  return parseInt(matches[0], 10).toString();
}

async function scanFolderByNumber(folder, allowedExt) {
  const result = {};
  const entries = await folder.getEntries();
  for (const entry of entries) {
    if (!entry.isFile) continue;
    const lowerName = entry.name.toLowerCase();
    if (!allowedExt.some((ext) => lowerName.endsWith(ext))) continue;

    const numStr = extractNumberFromFilename(entry.name);
    if (numStr) {
      result[numStr] = entry;
    }
  }
  return result;
}

// Chạy 1 Action chuẩn qua executeTransaction
async function runAction(project, actionOrFactory, undoLabel) {
  let actionResult = null;
  let success = false;
  let thrownErr = null;

  try {
    if (typeof project.executeTransaction === "function") {
      success = project.executeTransaction((compoundAction) => {
        const action = typeof actionOrFactory === "function" ? actionOrFactory() : actionOrFactory;
        if (action) {
          actionResult = action;
          compoundAction.addAction(action);
        }
      }, undoLabel || "HT_Automation Action");
    } else {
      const action = typeof actionOrFactory === "function" ? actionOrFactory() : actionOrFactory;
      actionResult = action;
      success = true;
    }
  } catch (e) {
    thrownErr = e;
  }

  if (thrownErr) throw thrownErr;
  if (success === false) {
    throw new Error(`executeTransaction failed for: ${undoLabel}`);
  }
  return actionResult;
}

function getItemCount(children) {
  if (!children) return 0;
  if (typeof children.length === "number") return children.length;
  if (typeof children.numItems === "number") return children.numItems;
  if (Array.isArray(children)) return children.length;
  return 0;
}

function getItemAtIndex(children, idx) {
  if (!children) return null;
  if (typeof children.getItemAt === "function") return children.getItemAt(idx);
  if (children[idx] !== undefined) return children[idx];
  return null;
}

function castToFolder(item) {
  if (!item) return null;
  if (typeof item.getItems === "function") return item;
  if (ppro && ppro.FolderItem && typeof ppro.FolderItem.cast === "function") {
    return ppro.FolderItem.cast(item);
  }
  return item;
}

function castToClip(item) {
  if (!item) return null;
  if (typeof item.getMedia === "function") return item;
  if (ppro && ppro.ClipProjectItem && typeof ppro.ClipProjectItem.cast === "function") {
    return ppro.ClipProjectItem.cast(item);
  }
  return item;
}

async function getBinChildren(binOrRoot) {
  if (!binOrRoot) return [];
  try {
    const folder = castToFolder(binOrRoot);
    if (folder && typeof folder.getItems === "function") {
      const items = await folder.getItems();
      if (items && Array.isArray(items)) return items;
    }
    let raw = binOrRoot.children;
    if (typeof raw === "function") raw = await raw();
    else if (raw && typeof raw.then === "function") raw = await raw;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw.length === "number") return Array.from(raw);
    return [];
  } catch (e) {
    return [];
  }
}

async function ensureBin(project, rootItem, binName) {
  try {
    let rootChildren = await getBinChildren(rootItem);
    let bin = rootChildren.find((it) => it && it.name === binName);
    if (bin) {
      log(`  ✅ Đã thấy Bin '${binName}' sẵn có trong Project.`);
      return bin;
    }

    log(`  📁 Đang tạo Bin '${binName}'...`);

    try {
      await runAction(project, () => rootItem.createBinAction(binName, false), `Create ${binName} Bin`);
    } catch (e1) {
      try {
        await runAction(project, () => project.createBinAction(rootItem, binName), `Create ${binName} Bin`);
      } catch (e2) {
        try {
          await rootItem.createBin(binName);
        } catch (e3) {}
      }
    }

    for (let retry = 0; retry < 12; retry++) {
      rootChildren = await getBinChildren(rootItem);
      bin = rootChildren.find((it) => it && it.name === binName);
      if (bin) {
        log(`  ✅ Đã tạo thành công Bin '${binName}'.`);
        return bin;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  } catch (err) {
    log(`  Notice ensureBin (${binName}): ${err.message}`);
  }

  log(`  👉 Không tạo được Bin riêng '${binName}'. Sử dụng Thư mục gốc Project.`);
  return rootItem;
}

async function waitForItemsInBin(binItem, minCount, attempts = 10, delayMs = 250) {
  let items = [];
  for (let i = 1; i <= attempts; i++) {
    items = await getBinChildren(binItem);
    if (items && items.length >= minCount) break;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return items || [];
}

function findItemForEntry(itemsList, fileEntry) {
  if (!itemsList || itemsList.length === 0) return null;
  const fullName = fileEntry.name.toLowerCase();
  const dotIdx = fullName.lastIndexOf(".");
  const nameWithoutExt = dotIdx > 0 ? fullName.substring(0, dotIdx) : fullName;

  return itemsList.find((it) => {
    if (!it || !it.name) return false;
    const itNameLower = it.name.toLowerCase().trim();
    if (itNameLower === fullName) return true;
    if (itNameLower === nameWithoutExt) return true;
    const itDotIdx = itNameLower.lastIndexOf(".");
    const itBaseName = itDotIdx > 0 ? itNameLower.substring(0, itDotIdx) : itNameLower;
    if (itBaseName === nameWithoutExt) return true;
    return false;
  });
}

async function waitForItemInBin(binItem, fileEntry, attempts = 20, delayMs = 250) {
  for (let i = 0; i < attempts; i++) {
    const item = findItemForEntry(await getBinChildren(binItem), fileEntry);
    if (item) return item;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function getDurationFromClipItem(clipItem) {
  if (!clipItem) return null;
  try {
    if (typeof clipItem.getMedia === "function") {
      const media = await clipItem.getMedia();
      if (media && media.duration) return media.duration;
    }
    if (typeof clipItem.getDuration === "function") {
      const d = await clipItem.getDuration();
      if (d) return d;
    }
    if (clipItem.duration) return clipItem.duration;
  } catch (e) {}
  return null;
}

function getSecondsValue(durationObj) {
  if (!durationObj) return 0;
  if (typeof durationObj.seconds === "number") return durationObj.seconds;
  if (typeof durationObj.value === "number") return durationObj.value;
  if (typeof durationObj.toSeconds === "function") return durationObj.toSeconds();
  return 0;
}

function formatSeconds(tickOrSec) {
  const s = getSecondsValue(tickOrSec);
  return (s > 0 ? s : (typeof tickOrSec === "number" ? tickOrSec : 0)).toFixed(2);
}

async function getSequenceFrameSeconds(sequence) {
  let frameSeconds = 1 / 30;
  try {
    if (sequence && typeof sequence.getSettings === "function") {
      const settings = await sequence.getSettings();
      if (settings && typeof settings.getVideoFrameRate === "function") {
        const frameRate = await settings.getVideoFrameRate();
        if (frameRate && Number(frameRate.value) > 0) frameSeconds = 1 / Number(frameRate.value);
      } else {
        const rate = settings && settings.videoFrameRate;
        const detected = getSecondsValue(rate);
        if (detected > 0 && detected < 1) frameSeconds = detected;
      }
    }
  } catch (e) {}
  return frameSeconds;
}

async function getSequenceFrameRate(sequence) {
  try {
    const settings = await sequence.getSettings();
    if (settings && typeof settings.getVideoFrameRate === "function") {
      const rate = await settings.getVideoFrameRate();
      if (rate && Number(rate.value) > 0) return rate;
    }
  } catch (e) {}
  return ppro.FrameRate.createWithValue(30);
}

async function getTenFrameDuration(sequence) {
  const frameSeconds = await getSequenceFrameSeconds(sequence);
  return await ppro.TickTime.createWithSeconds(frameSeconds * 10);
}

async function alignDurationToVideoFrames(sequence, seconds) {
  const frameSeconds = await getSequenceFrameSeconds(sequence);
  const safeSeconds = Math.max(frameSeconds, Number(seconds || 0));
  // Audio is trimmed down to a complete video-frame count so Premiere cannot
  // round the still image and audio boundary in two different directions.
  const frameCount = Math.max(1, Math.floor((safeSeconds + 0.000001) / frameSeconds));
  return {
    frameCount,
    seconds: frameCount * frameSeconds,
    tickTime: await ppro.TickTime.createWithSeconds(frameCount * frameSeconds)
  };
}

async function snapTickTimeToVideoFrame(sequence, tickTime) {
  const frameSeconds = await getSequenceFrameSeconds(sequence);
  const seconds = getSecondsValue(tickTime);
  // Làm tròn về biên frame gần nhất. Hàm này được dùng chung cho cả V1 và A1
  // để Premiere không snap hai loại track theo hai cách khác nhau.
  const snappedSeconds = Math.round(seconds / frameSeconds) * frameSeconds;
  return await ppro.TickTime.createWithSeconds(snappedSeconds);
}

async function resolveSequence(project) {
  let seq = null;
  const mustCreateNew = selectedSequenceIndex === "CREATE_NEW";
  if (selectedSequenceIndex !== "CREATE_NEW" && typeof selectedSequenceIndex === "number") {
    seq = availableSequences[selectedSequenceIndex] || null;
  }
  if (!seq && !mustCreateNew) {
    try { seq = await project.getActiveSequence(); } catch (e) {}
  }
  if (!seq) {
    log("Đang tạo Timeline mới...");
    const seqName = `HT_Automation_Timeline_${Date.now().toString().slice(-4)}`;
    try {
      // createSequence() is the public Premiere UXP API and returns the newly
      // created sequence. Prefer that return value so we do not accidentally
      // continue with the sequence which happened to be active beforehand.
      if (typeof project.createSequence === "function") seq = await project.createSequence(seqName);
      else if (typeof project.createSequenceAction === "function") {
        await runAction(project, () => project.createSequenceAction(seqName), `Create Sequence ${seqName}`);
      }
    } catch (createErr) {
      log(`  Lưu ý tạo Sequence: ${createErr.message}`);
    }
    try { seq = await project.getActiveSequence(); } catch (e) {}
    if (!seq && typeof project.getSequences === "function") {
      try {
        const all = await project.getSequences();
        if (all && all.length > 0) seq = all[all.length - 1];
      } catch (e) {}
    }
  }
  return seq;
}

async function ensureTrackUnlocked(sequence, trackType, trackIndex) {
  try {
    const tracks = trackType === "video" ? await sequence.videoTracks : await sequence.audioTracks;
    if (tracks) {
      const count = getItemCount(tracks);
      if (trackIndex < count) {
        const trk = getItemAtIndex(tracks, trackIndex);
        if (trk) {
          let locked = false;
          if (typeof trk.isLocked === "boolean") locked = trk.isLocked;
          else if (typeof trk.getIsLocked === "function") locked = await trk.getIsLocked();

          if (locked) {
            log(`  🔓 Track ${trackType.toUpperCase()}${trackIndex + 1} đang bị KHÓA. Đang mở khóa...`);
            try {
              if (typeof trk.setLocked === "function") await trk.setLocked(false);
              else if (typeof trk.setIsLocked === "function") await trk.setIsLocked(false);
            } catch (unlockErr) {}
          }
        }
      }
    }
  } catch (e) {}
}

async function setTrackLockState(sequence, trackType, trackIndex, lockedState) {
  try {
    const tracks = trackType === "video" ? await sequence.videoTracks : await sequence.audioTracks;
    if (tracks) {
      const count = getItemCount(tracks);
      if (trackIndex < count) {
        const trk = getItemAtIndex(tracks, trackIndex);
        if (trk) {
          if (typeof trk.setLocked === "function") await trk.setLocked(lockedState);
          else if (typeof trk.setIsLocked === "function") await trk.setIsLocked(lockedState);
        }
      }
    }
  } catch (e) {}
}

// ==========================================================================
// ================= TAB 1: ẢNH + ÂM THANH ==================================
// ==========================================================================
function checkReadyToScan() {
  setBtnDisabled("btnScanFiles", !(imageFolder && audioFolder));
}

listen("btnPickImageFolder", "click", async () => {
  try {
    log("📂 Đang mở cửa sổ chọn Thư mục Ảnh...");
    const folder = await fs.getFolder();
    if (!folder) { log("Ban chua chon folder anh."); return; }
    imageFolder = folder;
    const pathEl = getEl("pathImageFolder");
    if (pathEl) {
      pathEl.textContent = folder.nativePath;
      pathEl.classList.add("selected");
    }
    log(`✅ Đã chọn Thư mục ẢNH: ${folder.nativePath}`);
    checkReadyToScan();
  } catch (err) { log("❌ Lỗi khi chọn folder anh: " + err.message); }
});

listen("btnPickAudioFolder", "click", async () => {
  try {
    log("📂 Đang mở cửa sổ chọn Thư mục Âm thanh...");
    const folder = await fs.getFolder();
    if (!folder) { log("Ban chua chon folder am thanh."); return; }
    audioFolder = folder;
    const pathEl = getEl("pathAudioFolder");
    if (pathEl) {
      pathEl.textContent = folder.nativePath;
      pathEl.classList.add("selected");
    }
    log(`✅ Đã chọn Thư mục ÂM THANH: ${folder.nativePath}`);
    checkReadyToScan();
  } catch (err) { log("❌ Lỗi khi chọn folder am thanh: " + err.message); }
});

let matchedPairs = []; // [{num, imageEntry|null, audioEntry|null}]
let imageScanHasMissing = false;

listen("btnScanFiles", "click", async () => {
  if (!imageFolder || !audioFolder) {
    log("⚠️ BẠN CHƯA CHỌN ĐỦ THƯ MỤC!");
    log("👉 Vui lòng chọn Thư mục Ảnh và Thư mục Âm thanh.");
    return;
  }
  try {
    const imageExt = [".jpg", ".jpeg", ".png"];
    const audioExt = [".mp3", ".wav", ".m4a"];
    const images = await scanFolderByNumber(imageFolder, imageExt);
    const audios = await scanFolderByNumber(audioFolder, audioExt);

    const allNums = Array.from(new Set([...Object.keys(images), ...Object.keys(audios)]))
      .sort((a, b) => Number(a) - Number(b));

    matchedPairs = [];
    imageScanHasMissing = false;
    const missingImages = [];
    const missingAudios = [];
    for (const num of allNums) {
      const img = images[num];
      const aud = audios[num];
      if (!img) missingImages.push(num);
      if (!aud) missingAudios.push(num);
      matchedPairs.push({ num, imageEntry: img || null, audioEntry: aud || null });
    }
    imageScanHasMissing = missingImages.length > 0 || missingAudios.length > 0;
    if (!imageScanHasMissing) {
      log(`✅ ĐỦ FILE: ${matchedPairs.length} cặp ảnh + âm thanh.`);
    } else {
      log("⚠️ THIẾU FILE:");
      if (missingImages.length) log(`  Thiếu ảnh số: ${missingImages.join(", ")}`);
      if (missingAudios.length) log(`  Thiếu âm thanh số: ${missingAudios.join(", ")}`);
      log("👉 Chọn 'Vẫn dựng timeline khi thiếu file' nếu muốn tiếp tục.");
    }
    const badgeEl = getEl("badgeMatchedPairs");
    if (badgeEl) {
      badgeEl.textContent = imageScanHasMissing ? "Thiếu file" : "Đủ file";
      badgeEl.classList.toggle("success", !imageScanHasMissing && matchedPairs.length > 0);
      badgeEl.classList.toggle("error", imageScanHasMissing);
    }
    const choiceEl = getEl("missingMediaChoice");
    if (choiceEl) choiceEl.style.display = imageScanHasMissing ? "flex" : "none";
    const allowEl = getEl("allowBuildWithMissing");
    if (allowEl) allowEl.checked = false;
    setBtnDisabled("btnBuildProject", matchedPairs.length === 0);
  } catch (err) { log("Lỗi khi quét folder: " + err.message); }
});

listen("btnBuildProject", "click", async () => {
  try {
    if (!imageFolder || !audioFolder) {
      log("⚠️ CHƯA CHỌN ĐỦ THƯ MỤC!");
      return;
    }
    if (matchedPairs.length === 0) {
      log("⚠️ CHƯA CÓ CẶP FILE NÀO ĐƯỢC QUÉT!");
      return;
    }
    if (imageScanHasMissing) {
      const allowEl = getEl("allowBuildWithMissing");
      if (!allowEl || !allowEl.checked) {
        log("⛔ Đã hủy dựng: danh sách đang thiếu file và chưa chọn cho phép dựng tiếp.");
        return;
      }
    }

    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) { log("Khong co project dang mo."); return; }

    const sequence = await resolveSequence(project);
    if (!sequence) {
      log("LỖI: Không tìm thấy hoặc không thể tạo Sequence nào.");
      return;
    }
    log(`Bắt đầu dựng project vào Timeline: "${sequence.name}"`);

    const rootItem = await project.getRootItem();
    log("Đang kiểm tra / tạo Bin 'Images' và 'Audio'...");
    const imagesBin = await ensureBin(project, rootItem, "Images");
    const audioBin = await ensureBin(project, rootItem, "Audio");

    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const VIDEO_TRACK_INDEX = 0;
    const AUDIO_TRACK_INDEX = 0;

    await ensureTrackUnlocked(sequence, "video", VIDEO_TRACK_INDEX);
    await ensureTrackUnlocked(sequence, "audio", AUDIO_TRACK_INDEX);

    // ========================================================================
    // GIAI ĐOẠN 1: BẢO VỆ & XẾP TOÀN BỘ ÂM THANH TRÊN TRACK A1 LIÊN TỤC 100%
    // ========================================================================
    log("\n🎵 --- BƯỚC 1: DỰNG TRACK ÂM THANH (A1) LIÊN TỤC LÀM MỐC CHUẨN ---");
    // Tạm khóa Video Track V1 để thao tác trên A1 hoàn toàn không bị ảnh hưởng bởi Video
    await setTrackLockState(sequence, "video", VIDEO_TRACK_INDEX, true);
    await setTrackLockState(sequence, "audio", AUDIO_TRACK_INDEX, false);

    const pairRanges = [];
    const preparedPairs = [];
    const tenFrameDuration = await getTenFrameDuration(sequence);
    let currentImageCount = 0;
    let currentAudioCount = 0;
    let imageProgressIndex = 0;

    for (const pair of matchedPairs) {
      await waitIfTaskPaused();
      showTaskProgress(`Đang chuẩn bị cặp ${imageProgressIndex + 1}/${matchedPairs.length}`, pair.imageEntry ? pair.imageEntry.name : `Mốc #${pair.num}`, 5 + (imageProgressIndex / matchedPairs.length) * 80);
      imageProgressIndex++;
      log(`\n--- Mốc #${pair.num}: ${pair.imageEntry ? pair.imageEntry.name : "THIẾU ẢNH"} <-> ${pair.audioEntry ? pair.audioEntry.name : "THIẾU AUDIO"} ---`);

      if (pair.imageEntry) {
        currentImageCount++;
        await project.importFiles([pair.imageEntry.nativePath], true, imagesBin, false);
      }
      if (pair.audioEntry) {
        currentAudioCount++;
        await project.importFiles([pair.audioEntry.nativePath], true, audioBin, false);
      }

      const imageItemsInBin = pair.imageEntry ? await waitForItemsInBin(imagesBin, currentImageCount) : [];
      const audioItemsInBin = pair.audioEntry ? await waitForItemsInBin(audioBin, currentAudioCount) : [];

      let rawImageItem = pair.imageEntry ? findItemForEntry(imageItemsInBin, pair.imageEntry) : null;
      if (pair.imageEntry && !rawImageItem && imagesBin !== rootItem) {
        const rootItems = await getBinChildren(rootItem);
        rawImageItem = findItemForEntry(rootItems, pair.imageEntry);
      }

      let rawAudioItem = pair.audioEntry ? findItemForEntry(audioItemsInBin, pair.audioEntry) : null;
      if (pair.audioEntry && !rawAudioItem && audioBin !== rootItem) {
        const rootItems = await getBinChildren(rootItem);
        rawAudioItem = findItemForEntry(rootItems, pair.audioEntry);
      }

      if ((pair.imageEntry && !rawImageItem) || (pair.audioEntry && !rawAudioItem)) {
        log(`  ❌ Không import được media của mốc #${pair.num}.`);
        continue;
      }

      let rawAudioDuration = null;
      let audioSecReal = 0;
      if (rawAudioItem) {
        const audioItem = castToClip(rawAudioItem) || rawAudioItem;
        rawAudioDuration = await getDurationFromClipItem(audioItem);
        audioSecReal = getSecondsValue(rawAudioDuration);
        if (audioSecReal <= 0) {
          try {
            audioSecReal = await probeDurationSeconds(pair.audioEntry.nativePath);
          } catch (probeErr) {}
        }
      }

      let audioDurationTickTime = tenFrameDuration;
      if (rawAudioItem && audioSecReal > 0) {
        const alignedDuration = await alignDurationToVideoFrames(sequence, audioSecReal);
        audioDurationTickTime = alignedDuration.tickTime;
        const trimmedMilliseconds = Math.max(0, (audioSecReal - alignedDuration.seconds) * 1000);
        if (trimmedMilliseconds >= 0.5) log(`  🎯 Audio #${pair.num}: căn ${alignedDuration.frameCount} frame, cắt đuôi ${trimmedMilliseconds.toFixed(1)} ms.`);
        try {
          const audioClipProjItem = (ppro && ppro.ClipProjectItem && typeof ppro.ClipProjectItem.cast === "function")
            ? ppro.ClipProjectItem.cast(rawAudioItem)
            : (castToClip(rawAudioItem) || rawAudioItem);
          const zeroTime = await ppro.TickTime.createWithSeconds(0);
          if (audioClipProjItem && typeof audioClipProjItem.createSetInOutPointsAction === "function") {
            await runAction(project, () => audioClipProjItem.createSetInOutPointsAction(zeroTime, audioDurationTickTime), `Align audio #${pair.num}`);
          } else if (audioClipProjItem && typeof audioClipProjItem.createSetOutPointAction === "function") {
            await runAction(project, () => audioClipProjItem.createSetOutPointAction(audioDurationTickTime), `Align audio #${pair.num}`);
          }
        } catch (alignAudioError) {
          log(`  ⚠️ Không đặt được Out Point audio #${pair.num}: ${alignAudioError.message}`);
        }
      }

      preparedPairs.push({
        pair,
        rawImageItem,
        rawAudioItem,
        audioDurationTickTime,
        audioSecReal
      });
    }

    const timelineZero = await ppro.TickTime.createWithSeconds(0);
    // Lập trước toàn bộ mốc timeline. Nếu thiếu audio, mốc đó dài 10 frame.
    // Nếu có audio, duration thật của audio là mốc chuẩn cho cả hai track.
    let calculatedAudioCursor = timelineZero;
    for (let i = 0; i < preparedPairs.length; i++) {
      const prepared = preparedPairs[i];
      const pairStart = calculatedAudioCursor;
      const pairEnd = pairStart.add(prepared.audioDurationTickTime);
      calculatedAudioCursor = pairEnd;

      log(`  ✅ Audio #${prepared.pair.num}: ${formatSeconds(pairStart)}s -> ${formatSeconds(pairEnd)}s`);
      pairRanges.push({
        pair: prepared.pair,
        rawImageItem: prepared.rawImageItem,
        audioDurationTickTime: prepared.audioDurationTickTime,
        start: pairStart,
        end: pairEnd
      });
    }

    // Chèn ngược từng cụm audio liên tiếp. Cách này giữ các audio trong mỗi cụm
    // khít tuyệt đối; mốc thiếu audio sẽ tách hai cụm bằng khoảng trắng 10 frame.
    let runStartIndex = 0;
    while (runStartIndex < preparedPairs.length) {
      await waitIfTaskPaused();
      if (!preparedPairs[runStartIndex].rawAudioItem) {
        log(`  ⬜ [Audio #${preparedPairs[runStartIndex].pair.num}] Để trống 10 frame.`);
        runStartIndex++;
        continue;
      }
      let runEndIndex = runStartIndex;
      while (
        runEndIndex + 1 < preparedPairs.length &&
        preparedPairs[runEndIndex].rawAudioItem &&
        preparedPairs[runEndIndex].rawImageItem &&
        preparedPairs[runEndIndex + 1].rawAudioItem &&
        preparedPairs[runEndIndex + 1].rawImageItem
      ) {
        runEndIndex++;
      }
      const runStartTime = await snapTickTimeToVideoFrame(sequence, pairRanges[runStartIndex].start);
      for (let i = runEndIndex; i >= runStartIndex; i--) {
        const prepared = preparedPairs[i];
        log(`  🔊 [Audio #${prepared.pair.num}] Ghép nối vào chuỗi A1...`);
        await runAction(
          project,
          () => editor.createInsertProjectItemAction(
            prepared.rawAudioItem,
            runStartTime,
            VIDEO_TRACK_INDEX,
            AUDIO_TRACK_INDEX,
            false
          ),
          `Insert audio #${prepared.pair.num}`
        );
      }
      runStartIndex = runEndIndex + 1;
    }

    // ========================================================================
    // GIAI ĐOẠN 2: GẮN TOÀN BỘ CHUỖI ẢNH LÊN TRACK V1 KHỚP KHÍT 100% VỚI AUDIO
    // ========================================================================
    log("\n🖼️ --- BƯỚC 2: DỰNG TRACK HÌNH ẢNH (V1) KHỚP THEO KHUNG THỜI GIAN AUDIO ---");
    // Tạm khóa Audio Track A1 để bảo vệ A1 không bị ảnh hưởng bởi Video
    await setTrackLockState(sequence, "audio", AUDIO_TRACK_INDEX, true);
    await setTrackLockState(sequence, "video", VIDEO_TRACK_INDEX, false);

    // Chuẩn bị OutPoint cho từng ảnh trước khi chèn. Video track dùng biên frame
    // (end-exclusive), vì vậy không dùng end của ảnh trước làm start ảnh sau.
    for (const range of pairRanges) {
      await waitIfTaskPaused();
      if (!range.rawImageItem) continue;
      try {
        const imageClipProjItem = (ppro && ppro.ClipProjectItem && typeof ppro.ClipProjectItem.cast === "function")
          ? ppro.ClipProjectItem.cast(range.rawImageItem)
          : (castToClip(range.rawImageItem) || range.rawImageItem);

        if (imageClipProjItem) {
          const zeroTime = await ppro.TickTime.createWithSeconds(0);
          if (typeof imageClipProjItem.createSetInOutPointsAction === "function") {
            await runAction(project, () => imageClipProjItem.createSetInOutPointsAction(zeroTime, range.audioDurationTickTime), `Set In/Out image #${range.pair.num}`);
          } else if (typeof imageClipProjItem.createSetOutPointAction === "function") {
            await runAction(project, () => imageClipProjItem.createSetOutPointAction(range.audioDurationTickTime), `Set OutPoint image #${range.pair.num}`);
          }
        }
      } catch (projErr) {
        log(`  ⚠️ Không đặt được thời lượng nguồn cho ảnh #${range.pair.num}: ${projErr.message}`);
      }
    }

    // Chèn ngược từng cụm ảnh liên tiếp. Mục thiếu ảnh được bỏ trống đúng toàn
    // bộ duration của audio tương ứng; các ảnh ở hai bên vẫn giữ đúng thứ tự.
    let imageRunStartIndex = 0;
    while (imageRunStartIndex < pairRanges.length) {
      await waitIfTaskPaused();
      if (!pairRanges[imageRunStartIndex].rawImageItem) {
        log(`  ⬜ [Ảnh #${pairRanges[imageRunStartIndex].pair.num}] Để trống theo thời lượng audio.`);
        imageRunStartIndex++;
        continue;
      }
      let imageRunEndIndex = imageRunStartIndex;
      while (
        imageRunEndIndex + 1 < pairRanges.length &&
        pairRanges[imageRunEndIndex].rawImageItem &&
        preparedPairs[imageRunEndIndex].rawAudioItem &&
        pairRanges[imageRunEndIndex + 1].rawImageItem &&
        preparedPairs[imageRunEndIndex + 1].rawAudioItem
      ) {
        imageRunEndIndex++;
      }
      const imageRunStartTime = await snapTickTimeToVideoFrame(sequence, pairRanges[imageRunStartIndex].start);
      for (let i = imageRunEndIndex; i >= imageRunStartIndex; i--) {
        const range = pairRanges[i];
        log(`  🖼️ [Ảnh #${range.pair.num}] Ghép nối vào chuỗi V1 với thời lượng ${formatSeconds(range.audioDurationTickTime)}s...`);
        await runAction(
          project,
          () => editor.createInsertProjectItemAction(
            range.rawImageItem,
            imageRunStartTime,
            VIDEO_TRACK_INDEX,
            AUDIO_TRACK_INDEX,
            true
          ),
          `Insert image #${range.pair.num}`
        );
      }
      imageRunStartIndex = imageRunEndIndex + 1;
    }

    // Mở khóa lại cả 2 track
    await setTrackLockState(sequence, "video", VIDEO_TRACK_INDEX, false);
    await setTrackLockState(sequence, "audio", AUDIO_TRACK_INDEX, false);

    log("\n🎉 HOÀN TẤT DỰNG PROJECT (ẢNH + ÂM THANH)!");
    finishTask(`Đã dựng ${matchedPairs.length} cặp ảnh và âm thanh.`, imageScanHasMissing ? "warning" : "success");
  } catch (err) {
    log("❌ Lỗi khi dựng project (ảnh): " + err.message);
    finishTask(err.message, "error");
  }
});

// ==========================================================================
// ================= TAB 2: VIDEO + ÂM THANH ================================
// ==========================================================================
function checkReadyToScanVideo() {
  setBtnDisabled("btnScanFilesVideo", !(videoFolder && videoAudioFolder));
}

function getFfmpegPath() {
  const inputEl = getEl("inputFfmpegPath");
  let v = inputEl ? (inputEl.value || "").trim() : "";
  if (!v.toLowerCase().endsWith(".exe")) {
    v = bundledFfmpegPath;
  }
  return v;
}

listen("btnPickVideoFolder", "click", async () => {
  try {
    log("📂 Đang mở cửa sổ chọn Thư mục Video...");
    const folder = await fs.getFolder();
    if (!folder) { log("Ban chua chon folder video."); return; }
    videoFolder = folder;
    syncedSubfolderEntry = null;
    const pathEl = getEl("pathVideoFolder");
    if (pathEl) {
      pathEl.textContent = folder.nativePath;
      pathEl.classList.add("selected");
    }
    log(`✅ Đã chọn Thư mục VIDEO: ${folder.nativePath}`);
    checkReadyToScanVideo();
  } catch (err) { log("❌ Lỗi khi chọn folder video: " + err.message); }
});

listen("btnPickVideoAudioFolder", "click", async () => {
  try {
    log("📂 Đang mở cửa sổ chọn Thư mục Âm thanh (Video)...");
    const folder = await fs.getFolder();
    if (!folder) { log("Ban chua chon folder am thanh."); return; }
    videoAudioFolder = folder;
    const pathEl = getEl("pathVideoAudioFolder");
    if (pathEl) {
      pathEl.textContent = folder.nativePath;
      pathEl.classList.add("selected");
    }
    log(`✅ Đã chọn Thư mục ÂM THANH (Video): ${folder.nativePath}`);
    checkReadyToScanVideo();
  } catch (err) { log("❌ Lỗi khi chọn folder am thanh: " + err.message); }
});

async function autoCheckFfmpeg(silent = true) {
  try {
    const exePath = getFfmpegPath();
    const result = await runFfmpegProcess(exePath, ["-version"]);
    const text = (result.stdout || "") + (result.stderr || "");
    const versionMatch = text.match(/ffmpeg version (\S+)/i);
    const badgeFfmpegStatusEl = getEl("badgeFfmpegStatus");
    if (versionMatch) {
      if (badgeFfmpegStatusEl) {
        badgeFfmpegStatusEl.textContent = "Sẵn sàng";
        badgeFfmpegStatusEl.title = `FFmpeg ${versionMatch[1]}`;
        badgeFfmpegStatusEl.classList.add("success");
        badgeFfmpegStatusEl.classList.remove("error");
      }
      if (!silent) log(`✅ Đã kết nối FFmpeg — Phiên bản: ${versionMatch[1]}`);
      setSystemState("ffmpeg", "Sẵn sàng", "success");
      return true;
    } else {
      if (badgeFfmpegStatusEl) {
        badgeFfmpegStatusEl.textContent = "Không xác định";
        badgeFfmpegStatusEl.classList.remove("success");
        badgeFfmpegStatusEl.classList.add("error");
      }
      setSystemState("ffmpeg", "Không xác định", "warning");
      return false;
    }
  } catch (err) {
    const badgeFfmpegStatusEl = getEl("badgeFfmpegStatus");
    if (badgeFfmpegStatusEl) {
      badgeFfmpegStatusEl.textContent = "Lỗi";
      badgeFfmpegStatusEl.classList.remove("success");
      badgeFfmpegStatusEl.classList.add("error");
    }
    if (!silent) log(`❌ LỖI kết nối FFmpeg: ${err.message}`);
    setSystemState("ffmpeg", "Lỗi", "error");
    return false;
  }
}

listen("btnTestFfmpeg", "click", async () => {
  await autoCheckFfmpeg(false);
});

let matchedPairsVideo = [];
let videoScanHasMissing = false;

listen("btnScanFilesVideo", "click", async () => {
  if (!videoFolder || !videoAudioFolder) {
    log("⚠️ BẠN CHƯA CHỌN ĐỦ 2 THƯ MỤC!");
    return;
  }
  try {
    const videoExt = [".mp4", ".mov", ".mkv", ".avi", ".m4v"];
    const audioExt = [".mp3", ".wav", ".m4a"];
    const videos = await scanFolderByNumber(videoFolder, videoExt);
    const audios = await scanFolderByNumber(videoAudioFolder, audioExt);

    const allNums = Array.from(new Set([...Object.keys(videos), ...Object.keys(audios)]))
      .sort((a, b) => Number(a) - Number(b));

    matchedPairsVideo = [];
    videoScanHasMissing = false;
    const missingVideos = [];
    const missingAudios = [];
    for (const num of allNums) {
      const vid = videos[num];
      const aud = audios[num];
      if (!vid) missingVideos.push(num);
      if (!aud) missingAudios.push(num);
      matchedPairsVideo.push({ num, videoEntry: vid || null, audioEntry: aud || null });
    }
    videoScanHasMissing = missingVideos.length > 0 || missingAudios.length > 0;
    if (!videoScanHasMissing) {
      log(`✅ ĐỦ FILE: ${matchedPairsVideo.length} cặp video + âm thanh.`);
    } else {
      log("⚠️ THIẾU FILE:");
      if (missingVideos.length) log(`  Thiếu video số: ${missingVideos.join(", ")}`);
      if (missingAudios.length) log(`  Thiếu âm thanh số: ${missingAudios.join(", ")}`);
      log("👉 Chọn 'Vẫn dựng timeline khi thiếu file' nếu muốn tiếp tục.");
    }
    const badgeEl = getEl("badgeMatchedPairsVideo");
    if (badgeEl) {
      badgeEl.textContent = videoScanHasMissing ? "Thiếu file" : "Đủ file";
      badgeEl.classList.toggle("success", !videoScanHasMissing && matchedPairsVideo.length > 0);
      badgeEl.classList.toggle("error", videoScanHasMissing);
    }
    const choiceEl = getEl("missingVideoMediaChoice");
    if (choiceEl) choiceEl.style.display = videoScanHasMissing ? "flex" : "none";
    const allowEl = getEl("allowBuildVideoWithMissing");
    if (allowEl) allowEl.checked = false;
    setBtnDisabled("btnBuildProjectVideo", matchedPairsVideo.length === 0);
  } catch (err) { log("Lỗi khi quét folder: " + err.message); }
});

async function probeDurationSeconds(filePath) {
  const result = await runFfmpegProcess(getFfmpegPath(), ["-i", filePath]);
  const text = (result.stderr || "") + (result.stdout || "");
  const m = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) {
    throw new Error(`Khong doc duoc duration cua file: ${filePath}\n${text.slice(0, 400)}`);
  }
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const seconds = parseFloat(m[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

async function ensureSyncedSubfolder() {
  if (syncedSubfolderEntry) return syncedSubfolderEntry;
  try {
    syncedSubfolderEntry = await videoFolder.createFolder("_ffmpeg_synced");
  } catch (e) {
    const entries = await videoFolder.getEntries();
    syncedSubfolderEntry = entries.find((it) => !it.isFile && it.name === "_ffmpeg_synced") || null;
    if (!syncedSubfolderEntry) throw e;
  }
  return syncedSubfolderEntry;
}

async function runFfmpegSpeedMatch(videoPath, outputEntry, ptsFactor, targetDurationSec) {
  const args = [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", videoPath,
    "-filter:v", `setpts=${ptsFactor.toFixed(6)}*PTS,tpad=stop_mode=clone:stop_duration=0.5`,
    "-t", Number(targetDurationSec).toFixed(6),
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "18",
    outputEntry.nativePath
  ];
  const result = await runProcessWithHeartbeat(
    getFfmpegPath(), args, 0,
    "Đang đồng bộ tốc độ video", outputEntry.name, 5
  );
  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg loi (exitCode=${result.exitCode}):\n${(result.stderr || "").slice(-600)}`);
  }
  return outputEntry;
}

async function runFfmpegTrim(videoPath, outputEntry, durationSec) {
  const paddedDurationSec = durationSec + 0.08;
  const args = [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-i", videoPath,
    "-t", paddedDurationSec.toFixed(6),
    "-an",
    // Trường hợp video dài hơn audio chỉ cần cắt và bỏ audio gốc. Remux
    // stream giúp hoàn tất trong vài giây thay vì mã hóa lại toàn bộ video.
    "-c:v", "copy",
    "-avoid_negative_ts", "make_zero",
    outputEntry.nativePath
  ];
  const result = await runProcessWithHeartbeat(
    getFfmpegPath(), args, 0,
    "Đang cắt video", outputEntry.name, 5
  );
  if (result.exitCode !== 0) {
    throw new Error(`FFmpeg loi (exitCode=${result.exitCode}):\n${(result.stderr || "").slice(-600)}`);
  }
  return outputEntry;
}

listen("btnBuildProjectVideo", "click", async () => {
  try {
    if (!videoFolder || !videoAudioFolder) {
      log("⚠️ CHƯA CHỌN ĐỦ THƯ MỤC!");
      return;
    }
    if (matchedPairsVideo.length === 0) {
      log("⚠️ CHƯA CÓ CẶP FILE NÀO ĐƯỢC QUÉT!");
      return;
    }
    if (videoScanHasMissing) {
      const allowEl = getEl("allowBuildVideoWithMissing");
      if (!allowEl || !allowEl.checked) {
        log("⛔ Đã hủy dựng: danh sách video đang thiếu file và chưa chọn cho phép dựng tiếp.");
        return;
      }
    }

    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) { log("Khong co project dang mo."); return; }

    const sequence = await resolveSequence(project);
    if (!sequence) {
      log("LỖI: Không tìm thấy hoặc không thể tạo Sequence nào.");
      return;
    }
    log(`Bắt đầu dựng project vào Timeline: "${sequence.name}"`);

    const rootItem = await project.getRootItem();
    log("Đang kiểm tra / tạo Bin 'Videos' và 'Audio'...");
    const videosBin = await ensureBin(project, rootItem, "Videos");
    const audioBin = await ensureBin(project, rootItem, "Audio");

    await ensureSyncedSubfolder();

    const editor = await ppro.SequenceEditor.getEditor(sequence);
    let cursor = await ppro.TickTime.createWithSeconds(0);
    const VIDEO_TRACK_INDEX = 0;
    const AUDIO_TRACK_INDEX = 0;

    const tenFrameDuration = await getTenFrameDuration(sequence);
    const tenFrameSec = getSecondsValue(tenFrameDuration);
    let videoProgressIndex = 0;

    for (const pair of matchedPairsVideo) {
      await waitIfTaskPaused();
      showTaskProgress(`Đang xử lý video ${videoProgressIndex + 1}/${matchedPairsVideo.length}`, pair.videoEntry ? pair.videoEntry.name : `Mốc #${pair.num}`, 5 + (videoProgressIndex / matchedPairsVideo.length) * 90);
      videoProgressIndex++;
      log(`\n--- Mốc #${pair.num}: ${pair.videoEntry ? pair.videoEntry.name : "THIẾU VIDEO"} <-> ${pair.audioEntry ? pair.audioEntry.name : "THIẾU AUDIO"} ---`);

      let videoDurSec = 0;
      let audioDurSec = 0;
      try {
        if (pair.videoEntry) videoDurSec = await probeDurationSeconds(pair.videoEntry.nativePath);
        if (pair.audioEntry) audioDurSec = await probeDurationSeconds(pair.audioEntry.nativePath);
      } catch (probeErr) {
        log(`  Bỏ qua mốc #${pair.num}: ${probeErr.message}`);
        continue;
      }

      const slotDurationSec = pair.audioEntry ? audioDurSec : tenFrameSec;
      const slotDurationTickTime = pair.audioEntry
        ? await ppro.TickTime.createWithSeconds(audioDurSec)
        : tenFrameDuration;
      let outputEntry = null;

      if (pair.videoEntry) {
        const dotIdx = pair.videoEntry.name.lastIndexOf(".");
        const baseName = dotIdx > 0 ? pair.videoEntry.name.substring(0, dotIdx) : pair.videoEntry.name;
        const outputName = `${baseName}_synced.mp4`;
        try {
          outputEntry = await syncedSubfolderEntry.createFile(outputName, { overwrite: true });
          if (!pair.audioEntry) {
            log(`  ⬜ Thiếu audio: giữ video #${pair.num} trong 10 frame.`);
            await runFfmpegTrim(pair.videoEntry.nativePath, outputEntry, tenFrameSec);
          } else if (videoDurSec > audioDurSec) {
            await runFfmpegTrim(pair.videoEntry.nativePath, outputEntry, audioDurSec);
          } else if (videoDurSec < audioDurSec) {
            await runFfmpegSpeedMatch(pair.videoEntry.nativePath, outputEntry, audioDurSec / videoDurSec, audioDurSec);
          } else {
            await runFfmpegTrim(pair.videoEntry.nativePath, outputEntry, audioDurSec);
          }
          log(`  ✅ Đã tạo video đầu ra: ${outputEntry.name}`);
        } catch (ffErr) {
          log(`  ❌ Bỏ qua mốc #${pair.num}: Lỗi FFmpeg — ${ffErr.message}`);
          cursor = cursor.add(slotDurationTickTime);
          continue;
        }
      }

      log(`  📦 Đang import file vào Project...`);
      if (outputEntry) {
        const importedVideo = await project.importFiles([outputEntry.nativePath], true, videosBin, false);
        if (importedVideo === false) log(`  ⚠️ Premiere báo không import được video #${pair.num}.`);
      }
      if (pair.audioEntry) {
        const importedAudio = await project.importFiles([pair.audioEntry.nativePath], true, audioBin, false);
        if (importedAudio === false) log(`  ⚠️ Premiere báo không import được audio #${pair.num}.`);
      }

      let rawVideoItem = outputEntry ? await waitForItemInBin(videosBin, outputEntry) : null;
      if (outputEntry && !rawVideoItem && videosBin !== rootItem) {
        const rootItems = await getBinChildren(rootItem);
        rawVideoItem = findItemForEntry(rootItems, outputEntry);
      }

      let rawAudioItem = pair.audioEntry ? await waitForItemInBin(audioBin, pair.audioEntry) : null;
      if (pair.audioEntry && !rawAudioItem && audioBin !== rootItem) {
        const rootItems = await getBinChildren(rootItem);
        rawAudioItem = findItemForEntry(rootItems, pair.audioEntry);
      }

      if ((outputEntry && !rawVideoItem) || (pair.audioEntry && !rawAudioItem)) {
        log(`  ❌ Không import được media của mốc #${pair.num}.`);
        cursor = cursor.add(slotDurationTickTime);
        continue;
      }

      // FFmpeg có thêm một ít frame đệm để tránh hụt hình. Riêng mốc thiếu
      // audio phải giới hạn ProjectItem đúng 10 frame trước khi đưa lên V1.
      if (rawVideoItem && !pair.audioEntry) {
        try {
          const videoClipItem = castToClip(rawVideoItem) || rawVideoItem;
          const zeroTime = await ppro.TickTime.createWithSeconds(0);
          if (typeof videoClipItem.createSetInOutPointsAction === "function") {
            await runAction(project, () => videoClipItem.createSetInOutPointsAction(zeroTime, tenFrameDuration), `Set 10-frame video #${pair.num}`);
          } else if (typeof videoClipItem.createSetOutPointAction === "function") {
            await runAction(project, () => videoClipItem.createSetOutPointAction(tenFrameDuration), `Set 10-frame video #${pair.num}`);
          }
        } catch (durationErr) {
          log(`  ⚠️ Không giới hạn được video #${pair.num} đúng 10 frame: ${durationErr.message}`);
        }
      }

      await ensureTrackUnlocked(sequence, "video", VIDEO_TRACK_INDEX);
      await ensureTrackUnlocked(sequence, "audio", AUDIO_TRACK_INDEX);
      const slotStart = await snapTickTimeToVideoFrame(sequence, cursor);

      if (rawVideoItem) {
        await runAction(
          project,
          () => editor.createInsertProjectItemAction(rawVideoItem, slotStart, VIDEO_TRACK_INDEX, AUDIO_TRACK_INDEX, true),
          `Insert video #${pair.num}`
        );
      } else {
        log(`  ⬜ V1 mốc #${pair.num}: để trống theo thời lượng audio.`);
      }

      if (rawAudioItem) {
        await runAction(
          project,
          () => editor.createInsertProjectItemAction(rawAudioItem, slotStart, VIDEO_TRACK_INDEX, AUDIO_TRACK_INDEX, false),
          `Insert audio #${pair.num}`
        );
      } else {
        log(`  ⬜ A1 mốc #${pair.num}: để trống 10 frame.`);
      }

      log(`  ✨ Đã xử lý mốc #${pair.num} tại ${formatSeconds(slotStart)}s`);
      cursor = slotStart.add(slotDurationTickTime);
    }

    log("\n🎉 HOÀN TẤT DỰNG PROJECT (VIDEO + ÂM THANH)!");
    finishTask(`Đã dựng ${matchedPairsVideo.length} cặp video và âm thanh.`, videoScanHasMissing ? "warning" : "success");
  } catch (err) {
    log("❌ Lỗi khi dựng project (video): " + err.message);
    finishTask(err.message, "error");
  }
});

// ==========================================================================
// ================= MODE: CHỈ ÂM THANH =====================================
// ==========================================================================
let audioOnlyEntries = [];

function checkReadyToScanAudioOnly() {
  setBtnDisabled("btnScanAudioOnly", !audioOnlyFolder);
}

listen("selectAudioOnlySpacing", "change", () => {
  const useFrames = getEl("selectAudioOnlySpacing").value === "frames";
  getEl("inputAudioOnlyGapFrames").disabled = !useFrames;
});

listen("btnPickAudioOnlyFolder", "click", async () => {
  try {
    log("📂 Đang mở cửa sổ chọn Thư mục âm thanh...");
    const folder = await fs.getFolder();
    if (!folder) return;
    audioOnlyFolder = folder;
    audioOnlyEntries = [];
    const pathEl = getEl("pathAudioOnlyFolder");
    pathEl.textContent = folder.nativePath;
    pathEl.classList.add("selected");
    getEl("badgeAudioOnlyFiles").textContent = "0 file";
    getEl("badgeAudioOnlyFiles").classList.remove("success", "error");
    setBtnDisabled("btnBuildAudioOnly", true);
    checkReadyToScanAudioOnly();
    log(`✅ Đã chọn thư mục âm thanh: ${folder.nativePath}`);
  } catch (err) {
    log("❌ Lỗi khi chọn folder âm thanh: " + err.message);
  }
});

listen("btnScanAudioOnly", "click", async () => {
  if (!audioOnlyFolder) return;
  try {
    const allowedExt = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".aif", ".aiff", ".ogg"];
    const entries = await audioOnlyFolder.getEntries();
    const skipped = [];
    audioOnlyEntries = entries
      .filter((entry) => entry.isFile && allowedExt.some((ext) => entry.name.toLowerCase().endsWith(ext)))
      .map((entry) => ({ entry, number: extractNumberFromFilename(entry.name) }))
      .filter((item) => {
        if (item.number !== null) return true;
        skipped.push(item.entry.name);
        return false;
      })
      .sort((a, b) => Number(a.number) - Number(b.number) || a.entry.name.localeCompare(b.entry.name, undefined, { numeric: true }))
      .map((item) => item.entry);

    const badge = getEl("badgeAudioOnlyFiles");
    badge.textContent = `${audioOnlyEntries.length} file`;
    badge.classList.toggle("success", audioOnlyEntries.length > 0);
    badge.classList.toggle("error", audioOnlyEntries.length === 0);
    setBtnDisabled("btnBuildAudioOnly", audioOnlyEntries.length === 0);
    if (audioOnlyEntries.length) {
      log(`✅ Đã quét ${audioOnlyEntries.length} file audio theo thứ tự 1 → N.`);
      log(`   ${audioOnlyEntries.map((entry) => entry.name).join(" → ")}`);
    } else {
      log("⚠️ Không tìm thấy file audio có số thứ tự trong tên.");
    }
    if (skipped.length) log(`⚠️ Bỏ qua ${skipped.length} file không có số thứ tự: ${skipped.join(", ")}`);
  } catch (err) {
    log("❌ Lỗi khi quét folder âm thanh: " + err.message);
  }
});

listen("btnBuildAudioOnly", "click", async () => {
  try {
    if (!audioOnlyFolder || !audioOnlyEntries.length) {
      log("⚠️ Hãy chọn thư mục và quét file âm thanh trước.");
      return;
    }
    const spacingMode = getEl("selectAudioOnlySpacing").value;
    const gapFrames = spacingMode === "frames" ? Number(getEl("inputAudioOnlyGapFrames").value) : 0;
    if (!Number.isInteger(gapFrames) || gapFrames < 0) {
      finishTask("Số frame cách nhau phải là số nguyên từ 0 trở lên.", "error");
      return;
    }

    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Không có project Premiere đang mở.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Không tìm thấy hoặc không thể tạo sequence.");
    const rootItem = await project.getRootItem();
    const audioBin = await ensureBin(project, rootItem, "Audio");
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    await ensureTrackUnlocked(sequence, "audio", 0);

    const frameSeconds = await getSequenceFrameSeconds(sequence);
    const gapDuration = await ppro.TickTime.createWithSeconds(gapFrames * frameSeconds);
    let cursor = await ppro.TickTime.createWithSeconds(0);
    let insertedCount = 0;

    for (let i = 0; i < audioOnlyEntries.length; i++) {
      await waitIfTaskPaused();
      const entry = audioOnlyEntries[i];
      showTaskProgress(`Đang thêm audio ${i + 1}/${audioOnlyEntries.length}`, entry.name, 5 + (i / audioOnlyEntries.length) * 90);
      await project.importFiles([entry.nativePath], true, audioBin, false);
      const binItems = await waitForItemsInBin(audioBin, 1);
      let rawAudioItem = findItemForEntry(binItems, entry);
      if (!rawAudioItem && audioBin !== rootItem) rawAudioItem = findItemForEntry(await getBinChildren(rootItem), entry);
      if (!rawAudioItem) {
        log(`❌ Không tìm thấy ${entry.name} sau khi import; đã bỏ qua.`);
        continue;
      }

      const clipItem = castToClip(rawAudioItem) || rawAudioItem;
      let duration = await getDurationFromClipItem(clipItem);
      let durationSeconds = getSecondsValue(duration);
      if (durationSeconds <= 0) {
        try {
          durationSeconds = await probeDurationSeconds(entry.nativePath);
          duration = await ppro.TickTime.createWithSeconds(durationSeconds);
        } catch (ignored) {}
      }
      if (!duration || durationSeconds <= 0) {
        log(`❌ Không đọc được thời lượng ${entry.name}; đã bỏ qua.`);
        continue;
      }

      await runAction(project, () => editor.createInsertProjectItemAction(rawAudioItem, cursor, 0, 0, false), `Insert audio ${i + 1}`);
      insertedCount++;
      log(`🔊 ${i + 1}. ${entry.name} tại ${formatSeconds(cursor)}s`);
      cursor = cursor.add(duration);
      if (i < audioOnlyEntries.length - 1 && gapFrames > 0) cursor = cursor.add(gapDuration);
    }

    if (!insertedCount) throw new Error("Không có file âm thanh nào được thêm vào timeline.");
    const spacingText = gapFrames > 0 ? `, cách nhau ${gapFrames} frame` : ", nối tiếp";
    log(`🎉 Hoàn tất: ${insertedCount} audio trên A1${spacingText}.`);
    finishTask(`Đã thêm ${insertedCount} audio vào A1${spacingText}.`, insertedCount === audioOnlyEntries.length ? "success" : "warning");
  } catch (err) {
    log("❌ Lỗi khi dựng chỉ âm thanh: " + err.message);
    finishTask(err.message, "error");
  }
});

checkReadyToScanAudioOnly();
setBtnDisabled("btnBuildAudioOnly", true);
getEl("inputAudioOnlyGapFrames").disabled = getEl("selectAudioOnlySpacing").value !== "frames";

// Tự động kiểm tra kết nối khi nạp xong script
setTimeout(() => {
  const btnTest = getEl("btnTestConnection");
  if (btnTest) btnTest.click();
}, 200);

// ===== Automated post-production: background music and timed overlays =====
function parseTimelineInput(value, fps = 30) {
  const input = String(value == null ? "" : value).trim();
  if (!input) return 0;
  if (/^\d+(\.\d+)?$/.test(input)) return Number(input);
  const p = input.split(":").map(Number);
  if (p.some((n) => !Number.isFinite(n)) || p.length < 2 || p.length > 4) return NaN;
  if (p.length === 4) return p[0] * 3600 + p[1] * 60 + p[2] + p[3] / fps;
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return p[0] * 60 + p[1];
}

async function getSequenceEndSeconds(sequence) {
  // Premiere exposes the computed timeline end directly. This is more reliable
  // than enumerating track collections, especially on 26.2.
  try {
    if (sequence && typeof sequence.getEndTime === "function") {
      const directEnd = getSecondsValue(await sequence.getEndTime());
      if (directEnd > 0) return directEnd;
    }
  } catch (e) {}

  let maximum = 0;
  for (const kind of ["video", "audio"]) {
    try {
      const countMethod = kind === "video" ? "getVideoTrackCount" : "getAudioTrackCount";
      const trackMethod = kind === "video" ? "getVideoTrack" : "getAudioTrack";
      const count = typeof sequence[countMethod] === "function" ? await sequence[countMethod]() : 0;
      for (let i = 0; i < count; i++) {
        const track = await sequence[trackMethod](i);
        if (!track || typeof track.getTrackItems !== "function") continue;
        let items = [];
        try {
          const clipType = ppro && ppro.Constants && ppro.Constants.TrackItemType ? ppro.Constants.TrackItemType.CLIP : undefined;
          items = await track.getTrackItems(clipType, false);
        } catch (e) { try { items = await track.getTrackItems(); } catch (ignored) {} }
        for (const item of (items || [])) {
          try { maximum = Math.max(maximum, getSecondsValue(await item.getEndTime())); } catch (e) {}
        }
      }
    } catch (e) {}
  }
  return maximum;
}

async function ensureChildFolder(parent, name) {
  try { return await parent.createFolder(name); }
  catch (e) {
    const entries = await parent.getEntries();
    const found = entries.find((it) => !it.isFile && it.name === name);
    if (found) return found;
    throw e;
  }
}

async function waitForImportedEntry(bin, entry, attempts = 16) {
  for (let i = 0; i < attempts; i++) {
    const found = findItemForEntry(await getBinChildren(bin), entry);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

function hashMusicCacheKey(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function getMusicCacheDescriptor(entry, targetLufs, maximumDuration) {
  let size = 0;
  let modified = 0;
  try {
    const metadata = await entry.getMetadata();
    size = Number(metadata && metadata.size) || 0;
    modified = metadata && metadata.dateModified ? new Date(metadata.dateModified).getTime() : 0;
  } catch (e) {}
  // A 30-second bucket avoids reprocessing when the timeline end changes only
  // slightly, while still preventing unnecessarily huge temporary outputs.
  const durationBucket = Math.max(30, Math.ceil(Number(maximumDuration || 0) / 30) * 30);
  const fingerprint = hashMusicCacheKey(`v2|${entry.nativePath}|${size}|${modified}|${targetLufs}`);
  return {
    durationBucket,
    fileName: `htm_${fingerprint}_${Math.abs(targetLufs)}lufs_${durationBucket}s.wav`
  };
}

async function findValidMusicCache(folder, fileName) {
  try {
    if (localStorage.getItem(`htMusicCache:${fileName}`) !== "complete") return null;
    const entries = await folder.getEntries();
    const cached = entries.find((item) => item.isFile && item.name.toLowerCase() === fileName.toLowerCase());
    if (!cached) return null;
    const metadata = await cached.getMetadata();
    return Number(metadata && metadata.size) > 44 ? cached : null;
  } catch (e) {
    return null;
  }
}

listen("btnPickMusicFolder", "click", async () => {
  try {
    const folder = await fs.getFolder();
    if (!folder) return;
    musicFolder = folder;
    normalizedMusicFolder = null;
    const extensions = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"];
    musicEntries = (await folder.getEntries()).filter((it) => it.isFile && extensions.some((ext) => it.name.toLowerCase().endsWith(ext))).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    getEl("pathMusicFolder").textContent = folder.nativePath;
    getEl("pathMusicFolder").classList.add("selected");
    getEl("badgeMusicCount").textContent = `${musicEntries.length} bài`;
    getEl("musicFileList").textContent = musicEntries.length ? musicEntries.map((e, i) => `${i + 1}. ${e.name}`).join("\n") : "Không tìm thấy file nhạc phù hợp.";
    log(`🎵 Đã nạp ${musicEntries.length} bài nhạc.`);
  } catch (err) { log(`❌ Lỗi chọn thư mục nhạc: ${err.message}`); }
});

async function normalizeMusic(entry, index, targetLufs, maximumDuration = 0) {
  if (!normalizedMusicFolder) normalizedMusicFolder = await ensureChildFolder(musicFolder, "_ht_audio_normalized");
  const cache = await getMusicCacheDescriptor(entry, targetLufs, maximumDuration);
  const cached = await findValidMusicCache(normalizedMusicFolder, cache.fileName);
  if (cached) {
    log(`  ⚡ Cache LUFS: ${entry.name}`);
    return cached;
  }
  const output = await normalizedMusicFolder.createFile(cache.fileName, { overwrite: true });
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", entry.nativePath, "-vn", "-af", `loudnorm=I=${targetLufs}:TP=-2:LRA=11`];
  args.push("-t", cache.durationBucket.toFixed(3));
  args.push("-ar", "48000", "-c:a", "pcm_s16le", output.nativePath);
  const timeoutMs = Math.min(1800000, Math.max(120000, cache.durationBucket * 2000 + 30000));
  const result = await runProcessWithHeartbeat(getFfmpegPath(), args, timeoutMs, `Đang chuẩn hóa nhạc ${index + 1}`, entry.name, 5);
  if (result.exitCode !== 0) {
    try { await output.delete(); } catch (e) {}
    throw new Error((result.stderr || "FFmpeg normalization failed").slice(-700));
  }
  localStorage.setItem(`htMusicCache:${cache.fileName}`, "complete");
  return output;
}

async function prepareMusicTrack(sequence, trackIndex) {
  const count = typeof sequence.getAudioTrackCount === "function" ? await sequence.getAudioTrackCount() : 0;
  if (trackIndex >= count) {
    throw new Error(`Timeline chỉ có ${count} audio track. Hãy tạo A${trackIndex + 1} hoặc chọn track thấp hơn.`);
  }
  await ensureTrackUnlocked(sequence, "audio", trackIndex);
  if (typeof sequence.getAudioTrack === "function") {
    const track = await sequence.getAudioTrack(trackIndex);
    if (track && typeof track.isMuted === "function" && await track.isMuted()) {
      if (typeof track.setMute === "function") await track.setMute(false);
      if (typeof track.setMute !== "function" || await track.isMuted()) {
        throw new Error(`A${trackIndex + 1} đang tắt tiếng và không thể tự bật lại.`);
      }
      log(`  🔊 Đã bật tiếng cho A${trackIndex + 1}.`);
    }
  }
}

listen("btnBuildMusic", "click", async () => {
  try {
    if (!musicFolder || !musicEntries.length) throw new Error("Hãy chọn thư mục có ít nhất một bài nhạc.");
    const target = Number(getEl("inputMusicLufs").value);
    const normalizeBeforeImport = !!(getEl("checkMusicNormalize") && getEl("checkMusicNormalize").checked);
    if (normalizeBeforeImport && (!Number.isFinite(target) || target < -26 || target > -24)) throw new Error("Loudness phải nằm trong khoảng -26 đến -24 LUFS.");
    const audioTrack = Math.max(1, Number(getEl("inputMusicTrack").value || 2) - 1);
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Không có project đang mở.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Không tìm thấy timeline.");
    await prepareMusicTrack(sequence, audioTrack);
    const sequenceFrameRate = await getSequenceFrameRate(sequence);
    const fps = Number(sequenceFrameRate.value);
    const start = parseTimelineInput(getEl("inputMusicStart").value, fps);
    let end = Number(getEl("inputMusicEnd").value) || await getSequenceEndSeconds(sequence);
    if (!Number.isFinite(start) || start < 0) throw new Error("Thời điểm bắt đầu nhạc không hợp lệ.");
    if (!end || end <= start) throw new Error("Không xác định được cuối timeline. Hãy nhập ô Kết thúc bằng số giây.");
    const root = await project.getRootItem();
    const bin = await ensureBin(project, root, "Background Music");
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const prepared = [];
    const requiredDuration = end - start;
    let preparedDuration = 0;
    log(normalizeBeforeImport
      ? `🎚️ Đang chuẩn hóa tối đa ${musicEntries.length} bài về ${target} LUFS, đủ cho ${requiredDuration.toFixed(2)}s...`
      : `⚡ Đang thêm trực tiếp tối đa ${musicEntries.length} bài, không chờ chuẩn hóa...`);
    for (let i = 0; i < musicEntries.length; i++) {
      await waitIfTaskPaused();
      showTaskProgress(normalizeBeforeImport ? `Đang chuẩn hóa nhạc ${i + 1}/${musicEntries.length}` : `Đang nhập nhạc ${i + 1}/${musicEntries.length}`, musicEntries[i].name, 5 + (i / musicEntries.length) * 70);
      const source = normalizeBeforeImport
        ? await normalizeMusic(musicEntries[i], i, target, Math.max(0.001, requiredDuration - preparedDuration))
        : musicEntries[i];
      await project.importFiles([source.nativePath], true, bin, false);
      const item = await waitForImportedEntry(bin, source);
      const clipItem = castToClip(item) || item;
      let duration = getSecondsValue(await getDurationFromClipItem(clipItem));
      if (duration <= 0) duration = await probeDurationSeconds(source.nativePath);
      if (item && duration > 0) {
        prepared.push({ item, duration });
        preparedDuration += duration;
      }
      log(`  ✅ ${musicEntries[i].name}`);
      if (preparedDuration >= requiredDuration - 0.001) {
        log(`  ⚡ Đã đủ ${requiredDuration.toFixed(2)}s; bỏ qua ${musicEntries.length - i - 1} bài không cần nhập.`);
        break;
      }
    }
    if (!prepared.length) throw new Error("Không import được nhạc đã chuẩn hóa.");
    let cursor = start;
    let index = 0;
    const loop = !!getEl("checkMusicLoop").checked;
    while (cursor < end - 0.001) {
      await waitIfTaskPaused();
      const music = prepared[index];
      const used = Math.min(music.duration, end - cursor);
      const clip = castToClip(music.item) || music.item;
      const zero = await ppro.TickTime.createWithSeconds(0);
      const out = await ppro.TickTime.createWithSeconds(used);
      if (typeof clip.createSetInOutPointsAction === "function") await runAction(project, () => clip.createSetInOutPointsAction(zero, out), `Trim music ${index + 1}`);
      else if (typeof clip.createSetOutPointAction === "function") await runAction(project, () => clip.createSetOutPointAction(out), `Trim music ${index + 1}`);
      const at = await ppro.TickTime.createWithSeconds(cursor);
      await runAction(project, () => editor.createOverwriteItemAction(music.item, at, 0, audioTrack), `Add music ${index + 1}`);
      cursor += used;
      index++;
      if (index >= prepared.length) { if (!loop) break; index = 0; }
    }
    log(`🎉 Đã thêm nhạc nền trên A${audioTrack + 1}, từ ${start.toFixed(2)}s đến ${Math.min(cursor, end).toFixed(2)}s.`);
    finishTask(`Đã thêm nhạc nền vào A${audioTrack + 1}.`, "success");
  } catch (err) { log(`❌ Lỗi thêm nhạc nền: ${err.message}`); finishTask(err.message, "error"); }
});

function renderOverlayRows() {
  const host = getEl("overlayRows");
  if (!host) return;
  host.innerHTML = "";
  overlayEntries.forEach((row, index) => {
    const el = document.createElement("div");
    el.className = "post-row";
    el.innerHTML = `<div class="folder-path selected" title="${row.entry.nativePath}">${row.entry.name}</div>
      <div class="overlay-field"><span class="overlay-field-label">Cách tạo mốc xuất hiện</span><select class="select-control overlay-mode"><option value="manual">Tự nhập số frame</option><option value="auto">Hệ thống tự động</option></select></div>
      <div class="overlay-field overlay-manual-field"><span class="overlay-field-label">Frame xuất hiện — phân cách bằng dấu phẩy</span><input class="text-input overlay-times" value="${row.times}" placeholder="Ví dụ: 50, 900, 1800"></div>
      <div class="overlay-field overlay-auto-field"><span class="overlay-field-label">Khoảng lặp tự động (frame)</span><input class="text-input overlay-interval" value="${row.interval}" placeholder="Ví dụ: 900"></div>
      <div class="overlay-field-pair">
        <div class="overlay-field"><span class="overlay-field-label">Thời lượng (giây)</span><input class="text-input overlay-duration" value="${row.duration}" placeholder="Theo file"></div>
        <div class="overlay-field"><span class="overlay-field-label">Vị trí trên màn hình</span><select class="select-control overlay-position"><option value="top-left">Trên trái</option><option value="top">Trên giữa</option><option value="top-right">Trên phải</option><option value="left">Giữa trái</option><option value="center">Chính giữa</option><option value="right">Giữa phải</option><option value="bottom-left">Dưới trái</option><option value="bottom">Dưới giữa</option><option value="bottom-right">Dưới phải</option></select></div>
      </div>
      <div class="overlay-field-pair">
        <div class="overlay-field"><span class="overlay-field-label">Tỷ lệ hiển thị (%)</span><input class="text-input overlay-scale" value="${row.scale}" placeholder="35"></div>
        <div class="overlay-field"><span class="overlay-field-label">Video track</span><input class="text-input overlay-track" value="${row.track}" placeholder="2 = V2"></div>
      </div>
      <div class="overlay-actions"><div class="btn btn-secondary mini-btn overlay-remove">Xóa</div></div>`;
    el.querySelector(".overlay-mode").value = row.mode;
    el.querySelector(".overlay-position").value = row.position;
    const updateOverlayMode = () => {
      const automatic = row.mode === "auto";
      el.querySelector(".overlay-manual-field").style.display = automatic ? "none" : "flex";
      el.querySelector(".overlay-auto-field").style.display = automatic ? "flex" : "none";
    };
    el.querySelector(".overlay-mode").addEventListener("change", (e) => { row.mode = e.target.value; updateOverlayMode(); });
    el.querySelector(".overlay-times").addEventListener("input", (e) => row.times = e.target.value);
    el.querySelector(".overlay-interval").addEventListener("input", (e) => row.interval = e.target.value);
    el.querySelector(".overlay-duration").addEventListener("input", (e) => row.duration = e.target.value);
    el.querySelector(".overlay-position").addEventListener("change", (e) => row.position = e.target.value);
    el.querySelector(".overlay-scale").addEventListener("input", (e) => row.scale = e.target.value);
    el.querySelector(".overlay-track").addEventListener("input", (e) => row.track = e.target.value);
    el.querySelector(".overlay-remove").addEventListener("click", () => { overlayEntries.splice(index, 1); renderOverlayRows(); });
    updateOverlayMode();
    host.appendChild(el);
  });
  getEl("badgeOverlayCount").textContent = `${overlayEntries.length} overlay`;
}

listen("btnAddOverlay", "click", async () => {
  try {
    const selected = await fs.getFileForOpening({
      allowMultiple: true,
      types: ["mp4", "mov", "mkv", "avi", "m4v", "webm"]
    });
    if (!selected || (Array.isArray(selected) && selected.length === 0)) return;
    const files = Array.isArray(selected) ? selected : [selected];
    const supported = [".mp4", ".mov", ".mkv", ".avi", ".m4v", ".webm"];
    let added = 0;
    for (const entry of files) {
      if (!entry || !supported.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        log(`⚠️ Bỏ qua file không hỗ trợ: ${entry && entry.name ? entry.name : "không xác định"}`);
        continue;
      }
      overlayEntries.push({ entry, mode: "manual", times: "900", interval: "900", duration: "", position: "bottom-right", scale: "35", track: "2" });
      added++;
    }
    renderOverlayRows();
    if (added) log(`🎞 Đã thêm ${added} file vào danh sách overlay.`);
  } catch (err) { log(`❌ Lỗi chọn overlay: ${err.message}`); }
});

function getOverlayPositionPoint(position) {
  const points = {
    "top-left": [0.14, 0.14], "top": [0.5, 0.14], "top-right": [0.86, 0.14],
    "left": [0.14, 0.5], "center": [0.5, 0.5], "right": [0.86, 0.5],
    "bottom-left": [0.14, 0.86], "bottom": [0.5, 0.86], "bottom-right": [0.86, 0.86]
  };
  return points[position] || points["bottom-right"];
}

async function findVideoTrackItemAt(sequence, trackIndex, startSeconds) {
  const track = await sequence.getVideoTrack(trackIndex);
  if (!track || typeof track.getTrackItems !== "function") return null;
  const clipType = ppro.Constants && ppro.Constants.TrackItemType ? ppro.Constants.TrackItemType.CLIP : 1;
  const items = await track.getTrackItems(clipType, false);
  let best = null;
  let bestDistance = Infinity;
  for (const item of (items || [])) {
    try {
      const itemStart = getSecondsValue(await item.getStartTime());
      const distance = Math.abs(itemStart - startSeconds);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    } catch (e) {}
  }
  return bestDistance <= 0.1 ? best : null;
}

async function applyOverlayMotion(project, trackItem, positionName, scalePercent) {
  if (!trackItem || typeof trackItem.getComponentChain !== "function") return false;
  const chain = await trackItem.getComponentChain();
  if (!chain) return false;
  let motion = null;
  const count = await chain.getComponentCount();
  for (let i = 0; i < count; i++) {
    const component = await chain.getComponentAtIndex(i);
    let matchName = "";
    let displayName = "";
    try { matchName = String(await component.getMatchName()).toLowerCase(); } catch (e) {}
    try { displayName = String(await component.getDisplayName()).toLowerCase(); } catch (e) {}
    if (matchName.includes("motion") || displayName.includes("motion") || displayName.includes("chuyển động")) { motion = component; break; }
  }
  if (!motion && count > 0) motion = await chain.getComponentAtIndex(0);
  if (!motion) return false;
  const positionParam = await motion.getParam(0);
  const scaleParam = await motion.getParam(1);
  const [x, y] = getOverlayPositionPoint(positionName);
  const point = new ppro.PointF();
  point.x = x;
  point.y = y;
  const positionKey = await positionParam.createKeyframe(point);
  const scaleKey = await scaleParam.createKeyframe(scalePercent);
  await runAction(project, () => positionParam.createSetValueAction(positionKey, true), "Set overlay position");
  await runAction(project, () => scaleParam.createSetValueAction(scaleKey, true), "Set overlay scale");
  return true;
}

function syncOverlayRowsFromUI() {
  const rows = getEl("overlayRows") ? getEl("overlayRows").querySelectorAll(".post-row") : [];
  for (let i = 0; i < rows.length && i < overlayEntries.length; i++) {
    const element = rows[i];
    const data = overlayEntries[i];
    const read = (selector, fallback) => {
      const input = element.querySelector(selector);
      return input ? input.value : fallback;
    };
    data.mode = read(".overlay-mode", data.mode);
    data.times = read(".overlay-times", data.times);
    data.interval = read(".overlay-interval", data.interval);
    data.duration = read(".overlay-duration", data.duration);
    data.position = read(".overlay-position", data.position);
    data.scale = read(".overlay-scale", data.scale);
    data.track = read(".overlay-track", data.track);
  }
}

listen("btnBuildOverlays", "click", async () => {
  try {
    syncOverlayRowsFromUI();
    if (!overlayEntries.length) throw new Error("Hãy thêm ít nhất một file overlay.");
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Không có project đang mở.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Không tìm thấy timeline.");
    const sequenceFrameRate = await getSequenceFrameRate(sequence);
    const fps = Number(sequenceFrameRate.value);
    const root = await project.getRootItem();
    const bin = await ensureBin(project, root, "Overlays");
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const sequenceEnd = await getSequenceEndSeconds(sequence);
    let occurrenceCount = 0;
    for (let i = 0; i < overlayEntries.length; i++) {
      await waitIfTaskPaused();
      const row = overlayEntries[i];
      showTaskProgress(`Đang thêm overlay ${i + 1}/${overlayEntries.length}`, row.entry.name, 5 + (i / overlayEntries.length) * 90);
      const sourceDuration = await probeDurationSeconds(row.entry.nativePath);
      const duration = String(row.duration).trim() ? parseTimelineInput(row.duration, fps) : sourceDuration;
      let startFrames = [];
      if (row.mode === "auto") {
        const intervalFrames = Number(row.interval);
        if (!Number.isFinite(intervalFrames) || intervalFrames <= 0 || !Number.isInteger(intervalFrames)) throw new Error(`Khoảng lặp overlay #${i + 1} phải là số frame nguyên lớn hơn 0.`);
        if (!sequenceEnd || sequenceEnd <= 0) throw new Error("Không xác định được cuối timeline để tạo mốc tự động.");
        const lastFrame = Math.floor((sequenceEnd - Math.min(duration, sourceDuration || duration)) * fps);
        for (let frame = intervalFrames; frame <= lastFrame; frame += intervalFrames) startFrames.push(frame);
      } else {
        const frameNumbers = String(row.times || "").split(/[,;\n]+/).map((value) => Number(String(value).trim()));
        if (frameNumbers.some((frame) => !Number.isFinite(frame) || frame < 0 || !Number.isInteger(frame))) throw new Error(`Danh sách frame overlay #${i + 1} chỉ được chứa số nguyên từ 0 trở lên.`);
        startFrames = frameNumbers;
      }
      const videoTrack = Math.max(1, Number(row.track || 2) - 1);
      const scale = Number(row.scale || 35);
      if (!startFrames.length || !Number.isFinite(duration) || duration <= 0) throw new Error(`Không tạo được mốc frame hợp lệ cho overlay #${i + 1}.`);
      if (!Number.isFinite(scale) || scale <= 0 || scale > 400) throw new Error(`Tỷ lệ overlay #${i + 1} phải từ 1 đến 400%.`);
      await project.importFiles([row.entry.nativePath], true, bin, false);
      const raw = await waitForImportedEntry(bin, row.entry);
      if (!raw) throw new Error(`Không import được ${row.entry.name}.`);
      const clip = castToClip(raw) || raw;
      const zero = await ppro.TickTime.createWithSeconds(0);
      const out = await ppro.TickTime.createWithSeconds(Math.min(duration, sourceDuration || duration));
      if (typeof clip.createSetInOutPointsAction === "function") await runAction(project, () => clip.createSetInOutPointsAction(zero, out), `Trim overlay ${i + 1}`);
      else if (typeof clip.createSetOutPointAction === "function") await runAction(project, () => clip.createSetOutPointAction(out), `Trim overlay ${i + 1}`);
      for (const frameNumber of startFrames) {
        await waitIfTaskPaused();
        const at = await ppro.TickTime.createWithFrameAndFrameRate(frameNumber, sequenceFrameRate);
        await runAction(project, () => editor.createOverwriteItemAction(raw, at, videoTrack, 0), `Add overlay ${i + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 120));
        const trackItem = await findVideoTrackItemAt(sequence, videoTrack, getSecondsValue(at));
        let motionApplied = false;
        try { motionApplied = await applyOverlayMotion(project, trackItem, row.position, scale); }
        catch (motionError) { log(`  ⚠️ Motion: ${motionError.message}`); }
        if (!motionApplied) log(`  ⚠️ Đã chèn nhưng chưa áp dụng được Motion cho mốc ${formatSeconds(at)}s.`);
        const wholeSeconds = Math.floor(frameNumber / fps);
        const displayFrames = frameNumber - Math.floor(wholeSeconds * fps);
        const hh = String(Math.floor(wholeSeconds / 3600)).padStart(2, "0");
        const mm = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, "0");
        const ss = String(wholeSeconds % 60).padStart(2, "0");
        const ff = String(displayFrames).padStart(2, "0");
        log(`  ✅ ${row.entry.name} → V${videoTrack + 1} @ frame ${frameNumber} = ${hh}:${mm}:${ss}:${ff} · ${row.position} · ${scale}%`);
        occurrenceCount++;
      }
    }
    log(`🎉 Đã thêm ${occurrenceCount} lần xuất hiện overlay bằng Overwrite, timeline không bị ripple.`);
    finishTask(`Đã thêm ${occurrenceCount} lần xuất hiện overlay.`, "success");
  } catch (err) { log(`❌ Lỗi thêm overlay: ${err.message}`); finishTask(err.message, "error"); }
});

// ==========================================================================
// ---- Auto Subtitle: transcribe every enabled clip on the selected audio track ----
// ==========================================================================
let whisperExePath = "";
let whisperModelPath = "";
let subtitleOutputFolder = null;
let detectedLogicalProcessors = 0;
let whisperBackend = "CPU";
let subtitleMachineProfile = { physicalMemoryGB: 0, gpuMemoryMB: 0, runtimeDriveFreeGB: 0 };
let subtitleTempPaths = [];
const HT_AUTOMATION_VERSION = "3.0.5";
let latestDiagnostics = null;

function trackSubtitleTemp(entryOrPath) {
  const path = typeof entryOrPath === "string" ? entryOrPath : (entryOrPath && entryOrPath.nativePath);
  if (path && !subtitleTempPaths.includes(path)) subtitleTempPaths.push(path);
  return entryOrPath;
}

async function cleanupSubtitleTempFiles(includeOld = false) {
  let paths = subtitleTempPaths.slice();
  if (includeOld && subtitleOutputFolder) {
    try {
      const entries = await subtitleOutputFolder.getEntries();
      paths = paths.concat(entries.filter((entry) => entry.isFile && /^ht_sub_.*\.(wav|json|txt)$/i.test(entry.name)).map((entry) => entry.nativePath));
    } catch (e) {}
  }
  paths = Array.from(new Set(paths));
  if (!paths.length) return 0;
  try {
    const response = await fetch("http://127.0.0.1:19888/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    subtitleTempPaths = [];
    return Number(result.removed) || 0;
  } catch (e) {
    log(`⚠️ Chưa dọn được file subtitle tạm: ${e.message}`);
    return 0;
  }
}

async function autoDetectWhisper() {
  try {
    const response = await fetch("http://127.0.0.1:19888/health");
    if (!response.ok) return false;
    const health = await response.json();
    if (String(health.bridgeVersion || "") !== HT_AUTOMATION_VERSION) {
      log(`⚠️ Bridge ${health.bridgeVersion || "cũ"} không khớp Plugin ${HT_AUTOMATION_VERSION}. Hãy đóng Premiere và chạy cong_cu\\cai_dat\\SUA_CHUA.bat.`);
      setSystemState("whisper", "Cần Repair", "error");
      return false;
    }
    detectedLogicalProcessors = Math.max(0, Number(health.logicalProcessors) || 0);
    whisperBackend = String(health.whisperBackend || "CPU");
    subtitleMachineProfile = {
      cpuName: String(health.cpuName || ""),
      physicalMemoryGB: Math.max(0, Number(health.physicalMemoryGB) || 0),
      gpuName: String(health.gpuName || ""),
      gpuMemoryMB: Math.max(0, Number(health.gpuMemoryMB) || 0),
      runtimeDriveFreeGB: Math.max(0, Number(health.runtimeDriveFreeGB) || 0)
    };
    if (health.whisperExe) {
      whisperExePath = health.whisperExe;
      getEl("pathWhisperExe").textContent = whisperExePath;
      getEl("pathWhisperExe").classList.add("selected");
    }
    if (health.whisperModel) {
      whisperModelPath = health.whisperModel;
      getEl("pathWhisperModel").textContent = whisperModelPath;
      getEl("pathWhisperModel").classList.add("selected");
    }
    if (whisperExePath && whisperModelPath) {
      getEl("badgeSubtitleStatus").textContent = whisperBackend.toUpperCase().includes("CUDA") ? "Whisper GPU" : "Whisper CPU";
      setSystemState("whisper", whisperBackend.toUpperCase().includes("CUDA") ? `GPU · ${whisperBackend}` : "CPU · Sẵn sàng", "success");
    } else {
      setSystemState("whisper", "Thiếu cấu hình", "warning");
    }
    return Boolean(whisperExePath && whisperModelPath);
  } catch (e) { setSystemState("whisper", "Bridge lỗi", "error"); return false; }
}

async function collectSystemDiagnostics() {
  const startedAt = new Date().toISOString();
  const report = { product: "HT_Automation", pluginVersion: HT_AUTOMATION_VERSION, testedAt: startedAt };
  try {
    const response = await fetch("http://127.0.0.1:19888/health");
    report.bridge = response.ok ? await response.json() : { error: `HTTP ${response.status}` };
  } catch (e) { report.bridge = { error: e.message }; }
  try {
    if (report.bridge && report.bridge.whisperExe) {
      const whisper = await runFfmpegProcess(report.bridge.whisperExe, ["--version"], 15000);
      report.whisperTest = { exitCode: whisper.exitCode, output: `${whisper.stdout || ""}\n${whisper.stderr || ""}`.trim().slice(0, 2000) };
    } else report.whisperTest = { error: "Không tìm thấy whisper-cli.exe" };
  } catch (e) { report.whisperTest = { error: e.message }; }
  try {
    const ffmpeg = await runFfmpegProcess("", ["-version"], 15000);
    report.ffmpegTest = { exitCode: ffmpeg.exitCode, output: `${ffmpeg.stdout || ""}\n${ffmpeg.stderr || ""}`.trim().slice(0, 1000) };
  } catch (e) { report.ffmpegTest = { error: e.message }; }
  report.compatible = Boolean(report.bridge && report.bridge.status === "ok" && String(report.bridge.bridgeVersion || "") === HT_AUTOMATION_VERSION && report.whisperTest && report.whisperTest.exitCode === 0 && report.ffmpegTest && report.ffmpegTest.exitCode === 0);
  latestDiagnostics = report;
  const summary = getEl("diagnosticsSummary");
  if (summary) summary.textContent = report.compatible ? `Sẵn sàng · Bridge ${report.bridge.bridgeVersion} · ${report.bridge.whisperBackend}` : "Phát hiện lỗi. Hãy xuất báo cáo hoặc chạy cong_cu\\cai_dat\\SUA_CHUA.bat.";
  log(report.compatible ? `✅ Chẩn đoán đạt: Bridge ${report.bridge.bridgeVersion} · ${report.bridge.whisperBackend}.` : "❌ Chẩn đoán chưa đạt; xem báo cáo trong tab Cài đặt.");
  return report;
}

listen("btnRunDiagnostics", "click", collectSystemDiagnostics);
listen("btnExportDiagnostics", "click", async () => {
  try {
    const report = latestDiagnostics || await collectSystemDiagnostics();
    const folder = await fs.getFolder();
    if (!folder) return;
    const file = await folder.createFile(`HT_Automation_Diagnostics_${Date.now()}.json`, { overwrite: true });
    await file.write(JSON.stringify(report, null, 2), { format: storage.formats.utf8 });
    log(`✅ Đã xuất báo cáo: ${file.nativePath}`);
  } catch (e) { log(`❌ Không xuất được báo cáo: ${e.message}`); }
});

async function verifyWhisperRuntime() {
  if (!whisperExePath) throw new Error("Không tìm thấy whisper-cli.exe. Hãy chạy lại bộ cài một click.");
  const check = await runFfmpegProcess(whisperExePath, ["--version"]);
  const diagnostic = `${check.stdout || ""}\n${check.stderr || ""}`;
  if (check.exitCode !== 0) throw new Error(`Whisper không khởi động được trên máy này. Hãy chạy lại bộ cài để tự chuyển GPU/CPU. ${diagnostic.slice(0, 240)}`);
  if (whisperBackend.toUpperCase().includes("CUDA") && !/CUDA|ggml-cuda/i.test(diagnostic)) {
    throw new Error("Whisper CUDA không nhận được GPU. Hãy chạy lại bộ cài một click để tự chuyển sang CPU.");
  }
  return true;
}
setTimeout(() => autoDetectWhisper(), 800);
setTimeout(async () => {
  try {
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    setSystemState("premiere", project ? "Sẵn sàng" : "Chưa mở Project", project ? "success" : "warning");
  } catch (e) { setSystemState("premiere", "Lỗi", "error"); }
  if (typeof autoCheckFfmpeg === "function") autoCheckFfmpeg(true);
}, 650);

async function pickSubtitleFile(target, extensions) {
  const entry = await fs.getFileForOpening({ types: extensions, allowMultiple: false });
  if (!entry) return null;
  getEl(target).textContent = entry.nativePath;
  getEl(target).classList.add("selected");
  return entry;
}

listen("btnPickWhisperExe", "click", async () => {
  try { const entry = await pickSubtitleFile("pathWhisperExe", ["exe"]); if (entry) whisperExePath = entry.nativePath; }
  catch (e) { log(`❌ Không chọn được whisper-cli.exe: ${e.message}`); }
});

listen("btnPickWhisperModel", "click", async () => {
  try { const entry = await pickSubtitleFile("pathWhisperModel", ["bin"]); if (entry) whisperModelPath = entry.nativePath; }
  catch (e) { log(`❌ Không chọn được model Whisper: ${e.message}`); }
});

listen("btnPickSubtitleOutput", "click", async () => {
  try {
    subtitleOutputFolder = await fs.getFolder();
    if (subtitleOutputFolder) {
      getEl("pathSubtitleOutput").textContent = subtitleOutputFolder.nativePath;
      getEl("pathSubtitleOutput").classList.add("selected");
      try {
        if (typeof fs.createPersistentToken === "function") localStorage.setItem("htSubtitleOutputToken", await fs.createPersistentToken(subtitleOutputFolder));
      } catch (ignored) {}
    }
  } catch (e) { log(`❌ Không chọn được thư mục đầu ra: ${e.message}`); }
});

setTimeout(async () => {
  try {
    const token = localStorage.getItem("htSubtitleOutputToken");
    if (token && typeof fs.getEntryForPersistentToken === "function") {
      subtitleOutputFolder = await fs.getEntryForPersistentToken(token);
      if (subtitleOutputFolder) {
        getEl("pathSubtitleOutput").textContent = subtitleOutputFolder.nativePath;
        getEl("pathSubtitleOutput").classList.add("selected");
      }
    }
  } catch (e) {}
}, 300);

function secondsToSrt(value) {
  const total = Math.max(0, Math.round(Number(value || 0) * 1000));
  const ms = total % 1000;
  const whole = Math.floor(total / 1000);
  const sec = whole % 60;
  const min = Math.floor(whole / 60) % 60;
  const hour = Math.floor(whole / 3600);
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function fitSubtitleSegmentsToLines(segments, maximum, maxLines) {
  const result = [];
  for (const segment of segments) {
    const clean = String(segment.text || "").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    const words = clean.split(" ");
    const wrappedLines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && candidate.length > maximum) { wrappedLines.push(line); line = word; }
      else line = candidate;
    }
    if (line) wrappedLines.push(line);
    const chunks = [];
    for (let i = 0; i < wrappedLines.length; i += maxLines) chunks.push(wrappedLines.slice(i, i + maxLines).join("\n"));
    if (chunks.length === 1) {
      result.push({ start: segment.start, end: segment.end, text: chunks[0] });
      continue;
    }
    const duration = Math.max(0, segment.end - segment.start);
    const weights = chunks.map((value) => Math.max(1, value.length));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let cursor = segment.start;
    chunks.forEach((value, index) => {
      const end = index === chunks.length - 1 ? segment.end : cursor + duration * (weights[index] / totalWeight);
      result.push({ start: cursor, end, text: value });
      cursor = end;
    });
  }
  return result;
}

function whisperTimeSeconds(value) {
  if (typeof value === "number") return value > 10000 ? value / 1000 : value;
  const text = String(value || "").trim();
  const match = text.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`);
  return Number(text) || 0;
}

function parseWhisperSegments(data) {
  const source = Array.isArray(data) ? data : (data.transcription || data.segments || []);
  return source.map((item) => {
    const offsets = item.offsets || {};
    const stamps = item.timestamps || {};
    const startRaw = item.start !== undefined ? item.start : (offsets.from !== undefined ? offsets.from : stamps.from);
    const endRaw = item.end !== undefined ? item.end : (offsets.to !== undefined ? offsets.to : stamps.to);
    let start = whisperTimeSeconds(startRaw);
    let end = whisperTimeSeconds(endRaw);
    if (offsets.from !== undefined) start = Number(offsets.from) / 1000;
    if (offsets.to !== undefined) end = Number(offsets.to) / 1000;
    return { start, end, text: String(item.text || item.content || "").trim() };
  }).filter((item) => item.text && item.end > item.start);
}

async function findOutputEntry(name) {
  const entries = await subtitleOutputFolder.getEntries();
  return entries.find((entry) => entry.isFile && entry.name.toLowerCase() === name.toLowerCase()) || null;
}

function getSelectedSubtitleTrackNumber() {
  const value = Number(getEl("selectSubtitleTrack") ? getEl("selectSubtitleTrack").value : 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function getSelectedSubtitleTrackLabel() {
  return `A${getSelectedSubtitleTrackNumber()}`;
}

async function getA1Clips(sequence, trackNumber = 1) {
  if (!sequence || typeof sequence.getAudioTrack !== "function") throw new Error("Premiere không cung cấp API đọc track audio.");
  const trackLabel = `A${trackNumber}`;
  const track = await sequence.getAudioTrack(trackNumber - 1);
  if (!track) throw new Error(`Timeline không có track ${trackLabel}.`);
  const clipType = ppro.Constants && ppro.Constants.TrackItemType ? ppro.Constants.TrackItemType.CLIP : 1;
  const items = await track.getTrackItems(clipType, false);
  const result = [];
  let skipped = 0;
  for (const item of items || []) {
    try {
      if (typeof item.isDisabled === "function" && await item.isDisabled()) { skipped++; continue; }
      const projectItem = await item.getProjectItem();
      const clipItem = ppro.ClipProjectItem && typeof ppro.ClipProjectItem.cast === "function" ? ppro.ClipProjectItem.cast(projectItem) : projectItem;
      const mediaPath = await clipItem.getMediaFilePath();
      const timelineStart = getSecondsValue(await item.getStartTime());
      const timelineEnd = getSecondsValue(await item.getEndTime());
      const sourceIn = getSecondsValue(await item.getInPoint());
      const sourceOut = getSecondsValue(await item.getOutPoint());
      if (mediaPath && timelineEnd > timelineStart && sourceOut > sourceIn) result.push({ mediaPath, timelineStart, timelineEnd, sourceIn, sourceOut });
    } catch (e) { skipped++; log(`  ⚠️ Bỏ qua một clip ${trackLabel} không đọc được nguồn: ${e.message}`); }
  }
  result.sort((a, b) => a.timelineStart - b.timelineStart);
  result.skipped = skipped;
  result.total = (items || []).length || result.length + skipped;
  return result;
}

let scannedA1Clips = [];
let scannedSubtitleTrackNumber = 0;
let subtitleTrackDiscoveryRunning = false;

async function discoverSubtitleAudioTracks() {
  if (subtitleTrackDiscoveryRunning || subtitleBuildRunning) return;
  const select = getEl("selectSubtitleTrack");
  if (!select) return;
  subtitleTrackDiscoveryRunning = true;
  let previousValue = select.value;
  try {
    const saved = JSON.parse(localStorage.getItem("htAutomationPreferences") || "{}");
    if (!previousValue && /^[1-9]\d*$/.test(String(saved.subtitleTrack || ""))) previousValue = String(saved.subtitleTrack);
  } catch (e) {}
  select.disabled = true;
  try {
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Hãy mở một Project trong Premiere Pro.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Hãy chọn một timeline hiện có.");
    if (typeof sequence.getAudioTrackCount !== "function" || typeof sequence.getAudioTrack !== "function") {
      throw new Error("Premiere không cung cấp API đọc danh sách audio track.");
    }
    const trackCount = Math.max(0, Number(await sequence.getAudioTrackCount()) || 0);
    const clipType = ppro.Constants && ppro.Constants.TrackItemType ? ppro.Constants.TrackItemType.CLIP : 1;
    const availableTracks = [];
    for (let index = 0; index < trackCount; index++) {
      try {
        const track = await sequence.getAudioTrack(index);
        if (!track || typeof track.getTrackItems !== "function") continue;
        const items = await track.getTrackItems(clipType, false);
        const clipCount = (items || []).length;
        if (clipCount > 0) availableTracks.push({ number: index + 1, clipCount });
      } catch (e) {
        log(`  ⚠️ Không đọc được A${index + 1} khi dò track: ${e.message}`);
      }
    }
    select.innerHTML = "";
    if (!availableTracks.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Không có track chứa audio";
      select.appendChild(option);
      scannedA1Clips = [];
      scannedSubtitleTrackNumber = 0;
      if (getEl("subtitleEmptyText")) getEl("subtitleEmptyText").textContent = "Timeline hiện tại không có audio clip để quét.";
      if (getEl("btnScanA1")) getEl("btnScanA1").textContent = "Không có audio";
      return;
    }
    for (const item of availableTracks) {
      const option = document.createElement("option");
      option.value = String(item.number);
      option.textContent = `A${item.number} · ${item.clipCount} clip`;
      select.appendChild(option);
    }
    const preserved = availableTracks.some((item) => String(item.number) === previousValue);
    select.value = preserved ? previousValue : String(availableTracks[0].number);
    refreshSubtitleTrackUi();
    saveUiPreferences();
    log(`🔎 Đã tìm thấy ${availableTracks.length} audio track có clip: ${availableTracks.map((item) => `A${item.number}`).join(", ")}.`);
  } catch (e) {
    log(`⚠️ Không dò được audio track: ${e.message}`);
  } finally {
    select.disabled = false;
    subtitleTrackDiscoveryRunning = false;
  }
}

function formatClockDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

async function scanA1ForSubtitle() {
  const validation = getEl("subtitleValidation");
  if (validation) validation.style.display = "none";
  try {
    const trackNumber = getSelectedSubtitleTrackNumber();
    const trackLabel = `A${trackNumber}`;
    showTaskProgress(`Đang quét track ${trackLabel}`, "Đọc audio clip trên timeline...", 20);
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Hãy mở một Project trong Premiere Pro.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Hãy chọn một timeline hiện có.");
    scannedA1Clips = await getA1Clips(sequence, trackNumber);
    if (getSelectedSubtitleTrackNumber() !== trackNumber) {
      scannedA1Clips = [];
      scannedSubtitleTrackNumber = 0;
      return [];
    }
    scannedSubtitleTrackNumber = trackNumber;
    if (!scannedA1Clips.length) throw new Error(`Track ${trackLabel} không có audio clip hợp lệ.`);
    const duration = scannedA1Clips.reduce((sum, clip) => sum + (clip.timelineEnd - clip.timelineStart), 0);
    getEl("subtitleClipCount").textContent = `${scannedA1Clips.length} clip hợp lệ`;
    getEl("subtitleDuration").textContent = formatClockDuration(duration);
    getEl("subtitleScanDetail").textContent = scannedA1Clips.skipped ? `Track ${trackLabel}: bỏ qua ${scannedA1Clips.skipped} clip bị tắt, offline hoặc không đọc được nguồn.` : `Tất cả clip ${trackLabel} đều sẵn sàng nhận dạng.`;
    getEl("subtitleEmptyState").style.display = "none";
    getEl("subtitleA1Summary").style.display = "flex";
    getEl("badgeSubtitleStatus").textContent = `${scannedA1Clips.length} clip`;
    finishTask(`Đã quét ${trackLabel}: ${scannedA1Clips.length} clip · ${formatClockDuration(duration)}.`, scannedA1Clips.skipped ? "warning" : "success");
    return scannedA1Clips;
  } catch (e) {
    scannedA1Clips = [];
    scannedSubtitleTrackNumber = 0;
    finishTask(e.message, "error");
    return [];
  }
}

listen("btnScanA1", "click", scanA1ForSubtitle);
listen("btnRescanA1", "click", scanA1ForSubtitle);
listen("btnRefreshSubtitleTracks", "click", discoverSubtitleAudioTracks);

function refreshSubtitleTrackUi() {
  const trackLabel = getSelectedSubtitleTrackLabel();
  scannedA1Clips = [];
  scannedSubtitleTrackNumber = 0;
  if (getEl("subtitleEmptyText")) getEl("subtitleEmptyText").textContent = `Chưa quét track ${trackLabel} trên timeline hiện tại.`;
  if (getEl("btnScanA1")) getEl("btnScanA1").textContent = `Quét ${trackLabel}`;
  if (getEl("btnBuildSubtitle")) {
    getEl("btnBuildSubtitle").setAttribute("aria-label", `Tạo subtitle từ ${trackLabel}`);
    const label = getEl("btnBuildSubtitle").querySelector("span");
    if (label) label.textContent = `Tạo subtitle từ ${trackLabel}`;
  }
  if (getEl("subtitleEmptyState")) getEl("subtitleEmptyState").style.display = "flex";
  if (getEl("subtitleA1Summary")) getEl("subtitleA1Summary").style.display = "none";
  if (getEl("badgeSubtitleStatus")) getEl("badgeSubtitleStatus").textContent = "Chưa quét";
}
listen("selectSubtitleTrack", "change", refreshSubtitleTrackUi);
refreshSubtitleTrackUi();
setTimeout(() => discoverSubtitleAudioTracks(), 1000);

function validateSubtitleRequest() {
  const errors = [];
  const trackLabel = getSelectedSubtitleTrackLabel();
  if (!scannedA1Clips.length || scannedSubtitleTrackNumber !== getSelectedSubtitleTrackNumber()) errors.push(`Hãy quét ${trackLabel} trước khi tạo subtitle.`);
  if (!whisperExePath) errors.push("Whisper CLI chưa sẵn sàng; kiểm tra trong Cài đặt.");
  if (!whisperModelPath) errors.push("Model Whisper chưa sẵn sàng; kiểm tra trong Cài đặt.");
  if (!subtitleOutputFolder) errors.push("Hãy chọn thư mục lưu WAV và SRT.");
  const lineLength = Number(getEl("inputSubtitleLineLength").value);
  if (!Number.isFinite(lineLength) || lineLength < 20 || lineLength > 80) errors.push("Độ dài dòng phải từ 20 đến 80 ký tự.");
  const box = getEl("subtitleValidation");
  if (box) {
    box.textContent = errors.join(" ");
    box.style.display = errors.length ? "block" : "none";
  }
  return errors;
}

async function transcribeA1Clip(clip, index, language, totalClips = 1) {
  const boundaryPadding = 0.35;
  const safeTotal = Math.max(1, Number(totalClips) || 1);
  const clipStartPercent = 5 + (index / safeTotal) * 90;
  const clipEndPercent = 5 + ((index + 1) / safeTotal) * 90;
  const stem = `ht_sub_${Date.now()}_${String(index + 1).padStart(3, "0")}`;
  const wavName = `${stem}.wav`;
  const wavEntry = await subtitleOutputFolder.createFile(wavName, { overwrite: true });
  trackSubtitleTemp(wavEntry);
  const sourceDuration = clip.sourceOut - clip.sourceIn;
  const seekStart = Math.max(0, clip.sourceIn - 1);
  const trimStart = clip.sourceIn - seekStart;
  const paddedDuration = sourceDuration + boundaryPadding * 2;
  const audioFilter = `atrim=start=${trimStart.toFixed(6)}:duration=${sourceDuration.toFixed(6)},asetpts=PTS-STARTPTS,aresample=16000,aformat=sample_fmts=s16:channel_layouts=mono,dynaudnorm=f=150:g=12:p=0.9:m=8,adelay=${Math.round(boundaryPadding * 1000)}:all=1,apad=pad_dur=${boundaryPadding},atrim=duration=${paddedDuration.toFixed(6)}`;
  const ffmpeg = await runProcessWithHeartbeat(getFfmpegPath(), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", String(seekStart), "-i", clip.mediaPath, "-vn", "-af", audioFilter, "-c:a", "pcm_s16le", wavEntry.nativePath], 60000, `Đang chuẩn hóa clip ${index + 1}/${safeTotal}`, clip.mediaPath, clipStartPercent);
  if (ffmpeg.exitCode !== 0) throw new Error(`FFmpeg không tách được audio clip ${index + 1}: ${ffmpeg.stderr || "unknown error"}`);
  const prefix = `${subtitleOutputFolder.nativePath}\\${stem}`;
  trackSubtitleTemp(`${prefix}.json`);
  const whisperArgs = ["-m", whisperModelPath, "-f", wavEntry.nativePath, "-l", language || "auto", "-t", String(getWhisperThreadCount())];
  if (whisperBackend.toUpperCase().includes("CUDA")) whisperArgs.push("-fa");
  else whisperArgs.push("-ng");
  whisperArgs.push("-ml", "56", "-sow", "-nth", "0.90", "-oj", "-of", prefix);
  const result = await runWhisperWithProgress(whisperArgs, paddedDuration, Math.min(clipEndPercent - 0.5, clipStartPercent + 0.5), clipEndPercent, `Clip ${index + 1}/${safeTotal}`);
  if (result.exitCode !== 0) throw new Error(`Whisper lỗi ở clip ${index + 1}: ${result.stderr || result.stdout || "unknown error"}`);
  const jsonEntry = await findOutputEntry(`${stem}.json`);
  if (!jsonEntry) throw new Error(`Whisper chưa tạo ${stem}.json.`);
  const segments = parseWhisperSegments(JSON.parse(await jsonEntry.read()));
  const timelineDuration = clip.timelineEnd - clip.timelineStart;
  const ratio = sourceDuration > 0 ? timelineDuration / sourceDuration : 1;
  return segments.map((segment) => ({
    start: clip.timelineStart + Math.max(0, segment.start - boundaryPadding) * ratio,
    end: Math.min(clip.timelineEnd, clip.timelineStart + Math.max(0, segment.end - boundaryPadding) * ratio),
    text: segment.text
  })).filter((segment) => segment.text && segment.end > segment.start && segment.start < clip.timelineEnd);
}

function getWhisperThreadCount() {
  const browserReported = Number(typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0) || 0;
  const available = detectedLogicalProcessors || browserReported || 4;
  return Math.max(2, Math.min(16, Math.floor(available * 0.75)));
}

function getAdaptiveSubtitleGroupSize() {
  const memoryGB = Number(subtitleMachineProfile.physicalMemoryGB) || 0;
  const processors = detectedLogicalProcessors || 4;
  const freeGB = Number(subtitleMachineProfile.runtimeDriveFreeGB) || 0;
  if ((memoryGB > 0 && memoryGB < 8) || processors <= 4 || (freeGB > 0 && freeGB < 5)) return 6;
  if ((memoryGB > 0 && memoryGB < 16) || processors <= 8 || (freeGB > 0 && freeGB < 12)) return 12;
  if (memoryGB >= 32 && processors >= 16) return 28;
  return 20;
}

function logSubtitleMachineProfile() {
  const profile = subtitleMachineProfile;
  const backend = whisperBackend.toUpperCase().includes("CUDA") ? `${whisperBackend}${profile.gpuName ? ` · ${profile.gpuName}` : ""}` : "CPU";
  const parts = [
    `${detectedLogicalProcessors || "?"} luồng CPU`,
    profile.physicalMemoryGB ? `${profile.physicalMemoryGB} GB RAM` : null,
    backend,
    profile.runtimeDriveFreeGB ? `${profile.runtimeDriveFreeGB} GB trống` : null,
    `nhóm ${getAdaptiveSubtitleGroupSize()} clip`
  ].filter(Boolean);
  log(`🧭 Tự tối ưu máy: ${parts.join(" · ")}.`);
}

async function runWhisperWithProgress(args, audioDuration, startPercent, endPercent, detail) {
  const threads = getWhisperThreadCount();
  const startedAt = Date.now();
  const from = Number(startPercent || 48);
  const to = Math.max(from + 1, Number(endPercent || 92));
  const usingGpu = whisperBackend.toUpperCase().includes("CUDA");
  const estimatedSeconds = Math.max(usingGpu ? 8 : 20, Number(audioDuration || 0) * (usingGpu ? 0.08 : 0.55) * (usingGpu ? 1 : (4 / Math.max(1, threads))));
  const update = () => {
    const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
    const ratio = Math.min(0.97, elapsed / estimatedSeconds);
    const percent = from + (to - from) * ratio;
    showTaskProgress(usingGpu ? "Whisper đang nhận dạng bằng GPU" : "Whisper đang nhận dạng · tiến độ ước tính", `${detail} · ${usingGpu ? whisperBackend : `${threads} luồng CPU`} · đã chạy ${formatClockDuration(elapsed)}`, percent);
  };
  update();
  const timer = setInterval(update, 1000);
  try {
    return await runFfmpegProcess(whisperExePath, args);
  } finally {
    clearInterval(timer);
  }
}

function escapeConcatPath(path) {
  return String(path || "").replace(/'/g, "'\\''");
}

async function transcribeA1Batch(clips, language) {
  const boundaryPadding = 0.35;
  const batchStem = `ht_sub_batch_${Date.now()}`;
  const wavEntries = [];
  const ranges = [];
  let cursor = 0;
  const groupSize = getAdaptiveSubtitleGroupSize();
  const groupCount = Math.ceil(clips.length / groupSize);
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    await waitIfTaskPaused();
    const groupStart = groupIndex * groupSize;
    const groupClips = clips.slice(groupStart, groupStart + groupSize);
    const wavEntry = await subtitleOutputFolder.createFile(`${batchStem}_group_${String(groupIndex + 1).padStart(3, "0")}.wav`, { overwrite: true });
    trackSubtitleTemp(wavEntry);
    const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"];
    const filterParts = [];
    const concatInputs = [];
    let groupDuration = 0;
    groupClips.forEach((clip, localIndex) => {
      const duration = clip.sourceOut - clip.sourceIn;
      const seekStart = Math.max(0, clip.sourceIn - 1);
      const trimStart = clip.sourceIn - seekStart;
      const paddedDuration = duration + boundaryPadding * 2;
      groupDuration += Math.max(0, paddedDuration);
      args.push("-ss", String(seekStart), "-i", clip.mediaPath);
      filterParts.push(`[${localIndex}:a]atrim=start=${trimStart.toFixed(6)}:duration=${duration.toFixed(6)},asetpts=PTS-STARTPTS,aresample=16000,aformat=sample_fmts=s16:channel_layouts=mono,adelay=${Math.round(boundaryPadding * 1000)}:all=1,apad=pad_dur=${boundaryPadding},atrim=duration=${paddedDuration.toFixed(6)}[a${localIndex}]`);
      concatInputs.push(`[a${localIndex}]`);
      ranges.push({ concatStart: cursor + boundaryPadding, concatEnd: cursor + boundaryPadding + duration, clip, sourceDuration: duration });
      cursor += paddedDuration;
    });
    filterParts.push(`${concatInputs.join("")}concat=n=${groupClips.length}:v=0:a=1[outa]`);
    args.push("-vn", "-filter_complex", filterParts.join(";"), "-map", "[outa]", "-c:a", "pcm_s16le", wavEntry.nativePath);
    const lastClipNumber = Math.min(clips.length, groupStart + groupClips.length);
    const groupStartPercent = Math.ceil(5 + (groupIndex / groupCount) * 35);
    const groupDonePercent = Math.ceil(5 + ((groupIndex + 1) / groupCount) * 35);
    const groupTimeoutMs = Math.min(180000, Math.max(45000, Math.ceil(groupDuration * 1500) + 15000));
    const ffmpeg = await runProcessWithHeartbeat(getFfmpegPath(), args, groupTimeoutMs, `Đang chuẩn hóa nhóm ${groupIndex + 1}/${groupCount}`, `Clip ${groupStart + 1}–${lastClipNumber} · ${formatClockDuration(groupDuration)}`, groupStartPercent);
    if (ffmpeg.exitCode !== 0) throw new Error(`Không chuẩn hóa được nhóm ${groupIndex + 1} (clip ${groupStart + 1}–${lastClipNumber}): ${ffmpeg.stderr || "unknown error"}`);
    wavEntries.push(wavEntry);
    showTaskProgress(`Đã chuẩn hóa nhóm ${groupIndex + 1}/${groupCount}`, `Clip ${groupStart + 1}–${lastClipNumber}`, groupDonePercent);
  }

  await waitIfTaskPaused();
  let batchWav = wavEntries[0];
  if (wavEntries.length > 1) {
    const listEntry = await subtitleOutputFolder.createFile(`${batchStem}_concat.txt`, { overwrite: true });
    trackSubtitleTemp(listEntry);
    await listEntry.write(wavEntries.map((entry) => `file '${escapeConcatPath(entry.nativePath)}'`).join("\n"), { format: storage.formats.utf8 });
    batchWav = await subtitleOutputFolder.createFile(`${batchStem}.wav`, { overwrite: true });
    trackSubtitleTemp(batchWav);
    showTaskProgress(`Đang ghép các nhóm ${getSelectedSubtitleTrackLabel()}`, `${wavEntries.length} nhóm · ${formatClockDuration(cursor)}`, 42);
    const concat = await runFfmpegProcess(getFfmpegPath(), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listEntry.nativePath, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", batchWav.nativePath], 300000);
    if (concat.exitCode !== 0) throw new Error(`FFmpeg không ghép được các nhóm ${getSelectedSubtitleTrackLabel()}: ${concat.stderr || "unknown error"}`);
  }

  await waitIfTaskPaused();
  const prefix = `${subtitleOutputFolder.nativePath}\\${batchStem}`;
  trackSubtitleTemp(`${prefix}.json`);
  const usingGpu = whisperBackend.toUpperCase().includes("CUDA");
  showTaskProgress("Whisper đang nhận dạng một lượt", `${formatClockDuration(cursor)} · ${usingGpu ? whisperBackend : `${getWhisperThreadCount()} luồng CPU`}`, 48);
  const whisperArgs = ["-m", whisperModelPath, "-f", batchWav.nativePath, "-l", language || "auto", "-t", String(getWhisperThreadCount())];
  if (usingGpu) whisperArgs.push("-fa");
  else whisperArgs.push("-ng");
  whisperArgs.push("-ml", "56", "-sow", "-nth", "0.75", "-oj", "-of", prefix);
  const result = await runWhisperWithProgress(whisperArgs, cursor, 48, 92, formatClockDuration(cursor));
  if (result.exitCode !== 0) throw new Error(`Whisper batch gặp lỗi: ${result.stderr || result.stdout || "unknown error"}`);
  const jsonEntry = await findOutputEntry(`${batchStem}.json`);
  if (!jsonEntry) throw new Error(`Whisper chưa tạo ${batchStem}.json.`);
  const recognized = parseWhisperSegments(JSON.parse(await jsonEntry.read()));
  return recognized.map((segment) => {
    let bestOverlap = 0;
    let range = null;
    for (const candidate of ranges) {
      const overlap = Math.max(0, Math.min(segment.end, candidate.concatEnd) - Math.max(segment.start, candidate.concatStart));
      if (overlap > bestOverlap) { bestOverlap = overlap; range = candidate; }
    }
    if (!range || bestOverlap < 0.01) return null;
    const ratio = range.sourceDuration > 0 ? (range.clip.timelineEnd - range.clip.timelineStart) / range.sourceDuration : 1;
    return {
      start: range.clip.timelineStart + Math.max(0, Math.max(segment.start, range.concatStart) - range.concatStart) * ratio,
      end: Math.min(range.clip.timelineEnd, range.clip.timelineStart + Math.max(0, Math.min(segment.end, range.concatEnd) - range.concatStart) * ratio),
      text: segment.text
    };
  }).filter((segment) => segment && segment.text && segment.end > segment.start);
}

const subtitleBuildButton = getEl("btnBuildSubtitle");
if (subtitleBuildButton) {
  subtitleBuildButton.classList.remove("disabled", "is-running");
  subtitleBuildButton.removeAttribute("disabled");
}

async function handleBuildSubtitle() {
  const button = getEl("btnBuildSubtitle");
  const badge = getEl("badgeSubtitleStatus");
  const trackNumber = getSelectedSubtitleTrackNumber();
  const trackLabel = `A${trackNumber}`;
  if (subtitleBuildRunning) {
    const validation = getEl("subtitleValidation");
    if (validation) {
      validation.textContent = "Auto Subtitle đang xử lý. Bạn có thể theo dõi tiến độ hoặc bấm Tạm dừng bên dưới.";
      validation.style.display = "block";
    }
    return;
  }
  subtitleBuildRunning = true;
  button.classList.remove("disabled");
  button.removeAttribute("disabled");
  button.classList.add("is-running");
  if (getEl("selectSubtitleTrack")) getEl("selectSubtitleTrack").disabled = true;
  badge.textContent = "Đang kiểm tra";
  showTaskProgress("Đang chuẩn bị Auto Subtitle", `Kiểm tra Whisper và nguồn ${trackLabel}...`, 1);
  try {
    if (!whisperExePath || !whisperModelPath) await autoDetectWhisper();
    await verifyWhisperRuntime();
    logSubtitleMachineProfile();
    const validationErrors = validateSubtitleRequest();
    if (validationErrors.length) throw new Error(validationErrors.join(" "));
    const oldTempRemoved = await cleanupSubtitleTempFiles(true);
    if (oldTempRemoved) log(`🧹 Đã dọn ${oldTempRemoved} file subtitle tạm cũ.`);
    if (!ppro) ppro = require("premierepro");
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("Không có project đang mở.");
    const sequence = await resolveSequence(project);
    if (!sequence) throw new Error("Hãy chọn một timeline hiện có.");
    badge.textContent = "Đang xử lý";
    const clips = scannedA1Clips;
    if (!clips.length || scannedSubtitleTrackNumber !== trackNumber) throw new Error(`${trackLabel} chưa được quét hoặc không có audio clip hợp lệ.`);
    const language = getEl("selectSubtitleLanguage").value || "auto";
    let allSegments = [];
    const qualityMode = getEl("selectSubtitleQuality") ? getEl("selectSubtitleQuality").value : "accurate";
    if (clips.length > 1 && qualityMode === "fast") {
      try {
        log(`⚡ Chế độ nhanh: chuẩn hóa ${clips.length} clip và nạp Whisper một lần.`);
        allSegments = await transcribeA1Batch(clips, language);
      } catch (batchError) {
        log(`⚠️ Không thể dùng chế độ nhanh: ${batchError.message}`);
        await cleanupSubtitleTempFiles(false);
        log("↪ Chuyển sang chế độ tương thích từng clip.");
      }
    }
    if (qualityMode === "accurate") log(`🎯 Chế độ chính xác: nhận dạng độc lập toàn bộ ${clips.length} clip để tránh mất câu trong batch.`);
    const uncoveredClipIndexes = clips.map((clip, index) => ({ clip, index })).filter(({ clip }) => !allSegments.some((segment) => {
      const overlap = Math.min(segment.end, clip.timelineEnd) - Math.max(segment.start, clip.timelineStart);
      return overlap > 0.05;
    })).map(({ index }) => index);
    if (uncoveredClipIndexes.length) {
      if (allSegments.length) log(`🔎 Chế độ nhanh bỏ sót ${uncoveredClipIndexes.length} clip; tự nhận dạng lại riêng các clip này.`);
      for (const i of uncoveredClipIndexes) {
        await waitIfTaskPaused();
        badge.textContent = `${i + 1}/${clips.length}`;
        showTaskProgress(`Đang nhận dạng clip ${i + 1}/${clips.length}`, clips[i].mediaPath, (i / clips.length) * 90 + 5);
        log(`🎙️ Đang nhận dạng clip ${trackLabel} ${i + 1}/${clips.length}...`);
        try {
          allSegments.push(...await transcribeA1Clip(clips[i], i, language, clips.length));
        } catch (clipError) {
          log(`⚠️ Bỏ qua clip ${trackLabel} #${i + 1} vì không xử lý được: ${clipError.message}`);
        }
      }
    }
    allSegments.sort((a, b) => a.start - b.start);
    if (!allSegments.length) throw new Error(`Whisper không nhận dạng được câu thoại nào trên ${trackLabel}.`);
    const safeSequenceName = String(sequence.name || "timeline").replace(/[<>:\"/\\|?*]/g, "_");
    const outputFileName = `${safeSequenceName}_${trackLabel}.srt`;
    const maxLength = Math.max(20, Math.min(80, Number(getEl("inputSubtitleLineLength").value) || 42));
    const maxLines = getEl("selectSubtitleMaxLines") && getEl("selectSubtitleMaxLines").value === "1" ? 1 : 2;
    const fittedSegments = fitSubtitleSegmentsToLines(allSegments, maxLength, maxLines);
    const outputText = fittedSegments.map((segment, index) => `${index + 1}\n${secondsToSrt(segment.start)} --> ${secondsToSrt(segment.end)}\n${segment.text}\n`).join("\n");
    showTaskProgress("Đang tạo file SRT", outputFileName, 96);
    const outputEntry = await subtitleOutputFolder.createFile(outputFileName, { overwrite: true });
    await outputEntry.write(outputText, { format: storage.formats.utf8 });
    let imported = false;
    if (getEl("checkSubtitleImport") && getEl("checkSubtitleImport").checked) {
      const root = await project.getRootItem();
      const bin = await ensureBin(project, root, "Auto Subtitles");
      await project.importFiles([outputEntry.nativePath], true, bin, false);
      imported = true;
    }
    try {
      localStorage.removeItem("htSubtitleDraft");
      localStorage.removeItem("htSubtitleRecognitionCache");
    } catch (e) {}
    badge.textContent = `${fittedSegments.length} câu`;
    showTaskProgress("Đã tạo subtitle", outputEntry.nativePath, 100);
    log(`✅ Đã tạo ${fittedSegments.length} câu subtitle, tối đa ${maxLines} dòng/câu: ${outputEntry.nativePath}`);
    finishTask(imported ? `Đã tạo và import ${fittedSegments.length} câu subtitle vào Project.` : `Đã tạo ${fittedSegments.length} câu subtitle.`, "success");
  } catch (e) {
    badge.textContent = "Lỗi";
    log(`❌ Auto Subtitle: ${e.message}`);
    finishTask(e.message, "error");
  } finally {
    const removed = await cleanupSubtitleTempFiles(false);
    if (removed) log(`🧹 Đã tự động xóa ${removed} file WAV/JSON tạm.`);
    subtitleBuildRunning = false;
    if (getEl("selectSubtitleTrack")) getEl("selectSubtitleTrack").disabled = false;
    button.classList.remove("disabled", "is-running");
    button.removeAttribute("disabled");
  }
}

// Register the panel declared in manifest.json with Premiere's UXP runtime.
// The existing HTML document owns the UI, so no create/show DOM work is needed.
entrypoints.setup({
  panels: {
    htAutomationPanel: {
      show() {},
      hide() {},
      destroy() {}
    }
  }
});
