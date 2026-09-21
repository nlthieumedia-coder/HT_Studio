# Batch Import Guide

Open a project and select **Import Scenes**. The wizard analyzes a local path before any job is created.

- CSV supports UTF-8/BOM and comma, semicolon, or tab delimiters. Common headers such as `prompt`, `scene`, `image`, `duration`, `ratio`, and `resolution` are mapped automatically.
- XLSX reads the first sheet by default and reports available sheets.
- TXT supports one non-empty line per job or paragraph mode.
- Folder import matches `.txt`, image, video, and audio files by normalized basename in one folder; recursive scanning is optional.
- Relative media paths in CSV/XLSX resolve relative to the source file. Media paths are checked but never executed or copied.
- Strict mode blocks all commits with errors. Lenient mode imports valid rows and skips invalid rows.

Defaults such as provider, duration, aspect ratio, and resolution inherit from the selected project. Import creates Draft jobs transactionally. CSV export writes UTF-8 with a BOM for spreadsheet compatibility.
