import React from 'react';
import { LayoutDashboard, Users, CalendarClock, CalendarDays, History, Send } from 'lucide-react';
import brandLogo from '../../assets/branding/app-icon-128.png';

export default function Navbar({ activeTab, setActiveTab, activeProfilesCount, totalProfilesCount }) {
  const navItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'profiles', label: 'Hồ sơ tài khoản', icon: Users, badge: `${activeProfilesCount}/${totalProfilesCount}` },
    { id: 'schedule', label: 'Lịch chạy', icon: CalendarClock },
    { id: 'scheduled-runs', label: 'Lịch đã lên', icon: CalendarDays },
    { id: 'logs', label: 'Nhật ký hoạt động', icon: History },
    { id: 'telegram', label: 'Telegram & Thông báo', icon: Send },
  ];

  return (
    <aside className="sidebar">
      <div>
        {/* Brand */}
        <div className="brand-section">
          <div className="brand-logo">
            <img src={brandLogo} alt="HT PageNew" />
          </div>
          <div>
            <div className="brand-title">HT Studio</div>
            <div className="brand-subtitle">Facebook Feed & Reels</div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="nav-menu">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#93c5fd' : 'var(--text-muted)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
