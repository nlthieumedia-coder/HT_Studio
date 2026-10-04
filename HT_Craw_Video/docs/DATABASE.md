# Database

SQLite chạy WAL qua libSQL client và Drizzle ORM. Schema gồm `datasets`, `dataset_items`, `media_features`, `search_jobs`, `match_results`, `processing_metrics`, `analysis_cache`. Foreign keys cascade khi xóa dataset/job; file hash và cache version có unique indexes. Migration gốc ở `drizzle/0000_free_local_mode.sql`.
