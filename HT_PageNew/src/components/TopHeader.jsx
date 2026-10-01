import React from 'react';
import { RefreshCw, Cpu, Send } from 'lucide-react';

export default function TopHeader({ activeTabTitle, profilesCount, activeProfilesCount, onRefresh, onOpenTelegram }) {
  return (
    <header className="top-bar">
      <div className="page-header-title">
        {activeTabTitle}
      </div>

      <div className="top-bar-actions">
        {/* Status Pills */}
        <div className="header-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="dot dot-active"></span>
            <span style={{ color: 'var(--text-muted)' }}>Hồ sơ đang bật:</span>
            <span style={{ fontWeight: 700, color: '#34d399' }}>{activeProfilesCount} / {profilesCount}</span>
          </div>

          <div style={{ width: '1px', height: '14px', background: 'var(--border-color)', margin: '0 1rem' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} className="text-blue-400" />
            <span style={{ color: 'var(--text-muted)' }}>Mô phỏng:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Feed & Reels</span>
          </div>

        </div>

        {/* Refresh button */}
        <button onClick={onOpenTelegram} className="btn btn-secondary btn-sm" title="Cấu hình thông báo Telegram">
          <Send size={15} /> Telegram
        </button>
        <button
          onClick={onRefresh}
          className="btn btn-secondary btn-sm"
          title="Tải lại dữ liệu"
        >
          <RefreshCw size={15} /> Làm mới
        </button>
      </div>
    </header>
  );
}
