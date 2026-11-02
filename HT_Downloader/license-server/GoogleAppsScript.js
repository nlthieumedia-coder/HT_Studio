/**
 * HT DOWNLOADER - GOOGLE SHEETS LICENSE SERVER
 * Dùng riêng cho HT Downloader. Không dùng chung salt, key hoặc sheet với HT VidsGG.
 */
var PRODUCT = "HT_DOWNLOADER";
var LICENSE_SALT = "HT_DOWNLOADER_KEY_SALT_2026_V1";
var SHEET_NAME = "Licenses";
var STATUSES = ["UNUSED", "READY", "ACTIVE", "BLOCKED", "REVOKED", "RESET"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("HT Downloader License")
    .addItem("Khởi tạo / chuẩn hóa bảng", "setupLicenseSheet")
    .addToUi();
}

function setupLicenseSheet() {
  var sheet = getLicenseSheet_();
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUSES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 4, rows, 1).setDataValidation(rule);
  sheet.getRange(2, 2, rows, 1).setNumberFormat("@");
  sheet.getRange(2, 5, rows, 1).setNumberFormat("@");
  return "HT Downloader license sheet is ready";
}

/** Nhập HWID HTD-XXXX-XXXX vào cột E để tự sinh key HTDOWN riêng cho máy. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME || e.range.getRow() < 2) return;
  var row = e.range.getRow();
  var column = e.range.getColumn();

  if (column === 5) {
    var hwid = normalize_(e.range.getValue());
    if (!hwid) return;
    if (!/^HTD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(hwid)) {
      e.range.setNote("HWID Downloader không đúng. Ví dụ: HTD-1234-ABCD");
      return;
    }
    sheet.getRange(row, 1).setValue(row - 1);
    sheet.getRange(row, 2).setValue(generateKey_(hwid));
    var status = normalize_(sheet.getRange(row, 4).getValue());
    if (status !== "BLOCKED" && status !== "REVOKED") sheet.getRange(row, 4).setValue("READY");
    sheet.getRange(row, 5).setValue(hwid).setNote("");
    sheet.getRange(row, 6).clearContent();
    sheet.getRange(row, 7).setValue("Tạo key HT Downloader lúc " + now_());
  }

  if (column === 4) {
    var newStatus = normalize_(e.range.getValue());
    e.range.setValue(newStatus);
    if (newStatus === "RESET") {
      sheet.getRange(row, 2).clearContent();
      sheet.getRange(row, 5, 1, 2).clearContent();
      sheet.getRange(row, 4).setValue("UNUSED");
      sheet.getRange(row, 7).setValue("Reset lúc " + now_() + "; chờ nhập HWID mới");
    }
  }
}

function doGet(e) { return handleRequest_(e); }
function doPost(e) { return handleRequest_(e); }

function handleRequest_(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = normalize_(params.action).toLowerCase();
    var key = normalize_(params.key);
    var hwid = normalize_(params.hwid);
    var customer = String(params.name || params.clientName || "").trim();

    if (action === "ping") return json_({ success: true, product: PRODUCT, message: "HT Downloader License Server hoạt động", time: new Date().toISOString() });
    if (!key) return json_({ success: false, error: "Thiếu mã key HT Downloader." });
    if (!/^HTDOWN-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) return json_({ success: false, error: "Key không thuộc sản phẩm HT Downloader." });

    var sheet = getLicenseSheet_();
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    var rowData = null;
    for (var i = 1; i < data.length; i++) {
      if (normalize_(data[i][1]) === key) {
        rowIndex = i + 1;
        rowData = data[i];
        break;
      }
    }

    if (action === "activate") {
      if (!/^HTD-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(hwid)) return json_({ success: false, error: "Thiếu hoặc sai HWID của HT Downloader." });
      if (rowIndex < 0) return json_({ success: false, error: "Key không tồn tại trong sheet HT Downloader." });
      if (generateKey_(hwid) !== key) return json_({ success: false, error: "Key không khớp với HWID của thiết bị này." });

      var status = normalize_(rowData[3]);
      var currentHwid = normalize_(rowData[4]);
      if (status === "BLOCKED" || status === "REVOKED") {
        return json_({ success: false, error: status === "BLOCKED" ? "Bản quyền HT Downloader đang bị tạm khóa." : "Bản quyền HT Downloader đã bị thu hồi." });
      }
      if (status === "ACTIVE" && currentHwid && currentHwid !== hwid) return json_({ success: false, error: "Key đã được kích hoạt trên thiết bị khác." });
      if (status === "READY" && currentHwid && currentHwid !== hwid) return json_({ success: false, error: "Key được cấp cho một HWID khác." });
      if (["UNUSED", "READY", "ACTIVE"].indexOf(status) < 0) return json_({ success: false, error: "Trạng thái key không cho phép kích hoạt: " + status });

      sheet.getRange(rowIndex, 4).setValue("ACTIVE");
      sheet.getRange(rowIndex, 5).setValue(hwid);
      sheet.getRange(rowIndex, 6).setValue(now_());
      if (customer && !sheet.getRange(rowIndex, 3).getValue()) sheet.getRange(rowIndex, 3).setValue(customer);
      return json_({ success: true, product: PRODUCT, key: key, hwid: hwid, type: "LIFETIME", message: "Kích hoạt HT Downloader thành công." });
    }

    if (action === "check") {
      if (rowIndex < 0) return json_({ valid: false, error: "Không tìm thấy key trong sheet HT Downloader." });
      var checkStatus = normalize_(rowData[3]);
      var boundHwid = normalize_(rowData[4]);
      if (checkStatus !== "ACTIVE") return json_({ valid: false, error: checkStatus === "BLOCKED" ? "Bản quyền HT Downloader đang bị tạm khóa." : "Bản quyền không hoạt động: " + checkStatus });
      if (boundHwid && hwid && boundHwid !== hwid) return json_({ valid: false, error: "HWID không khớp bản quyền HT Downloader." });
      return json_({ valid: true, product: PRODUCT, status: checkStatus, type: "LIFETIME" });
    }

    return json_({ success: false, error: "Hành động không hợp lệ: " + action });
  } catch (error) {
    return json_({ success: false, error: "Lỗi máy chủ HT Downloader: " + error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function generateKey_(hwid) {
  var seed = normalize_(hwid).replace(/^HTD-/, "").replace(/[^A-Z0-9]/g, "");
  seed = (seed + "00000000").substring(0, 8);
  var bytes = Utilities.computeHmacSha256Signature(seed, LICENSE_SALT, Utilities.Charset.UTF_8);
  var hex = bytes.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("").toUpperCase();
  return "HTDOWN-" + seed.substring(0, 4) + "-" + seed.substring(4, 8) + "-" + hex.substring(0, 4) + "-" + hex.substring(4, 8);
}

function getLicenseSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["STT", "Mã Key HT Downloader", "Khách Hàng (Tên/Zalo)", "Trạng Thái", "Mã Máy HTD (HWID)", "Ngày Giờ Kích Hoạt", "Ghi Chú"]);
    var header = sheet.getRange("A1:G1");
    header.setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 280);
    sheet.setColumnWidth(3, 190);
    sheet.setColumnWidth(4, 120);
    sheet.setColumnWidth(5, 170);
    sheet.setColumnWidth(6, 175);
    sheet.setColumnWidth(7, 260);
  }
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sheet.getRange(2, 4, rows, 1).setDataValidation(rule);
  return sheet;
}

function normalize_(value) { return String(value || "").trim().toUpperCase(); }
function now_() { return Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss"); }
function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
