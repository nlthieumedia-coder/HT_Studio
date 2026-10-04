import { writeFile } from 'node:fs/promises';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import type { Repositories } from '../database/repositories';

export class ExportService {
  constructor(private repo: Repositories) {}
  async export(jobId: string, path: string, format: 'csv' | 'xlsx') {
    const rows = (await this.repo.results(jobId)).map(({ result, item }) => ({
      'Tệp': item.filePath, 'Địa chỉ nguồn': item.sourceUrl, 'Tài khoản': item.accountName, 'Nền tảng': item.platform,
      'Loại đối sánh': result.matchType, 'Tổng điểm': result.totalScore, 'Độ tin cậy': result.confidence,
      'Bằng chứng': result.evidenceJson,
    }));
    if (format === 'csv') {
      await writeFile(path, `\uFEFF${Papa.unparse(rows)}`, 'utf8');
    } else {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Kết quả');
      const keys = Object.keys(rows[0] ?? { 'Tệp': '', 'Tổng điểm': 0 });
      sheet.columns = keys.map(key => ({ header: key, key, width: 24 }));
      rows.forEach(row => sheet.addRow(row));
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      await workbook.xlsx.writeFile(path);
    }
    return path;
  }
}
