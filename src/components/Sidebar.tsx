import { Activity, ShieldCheck, Server, Settings, AlertCircle, LayoutDashboard } from 'lucide-react';

const Sidebar = () => {
  return (
    <aside style={{ width: '260px', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--borderColor)' }}>
      <div className="flex items-center gap-3" style={{ padding: '1rem 1.5rem', height: '60px', borderBottom: '1px solid var(--borderColor)' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={16} color="white" />
        </div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>Tailnet Admin</h2>
      </div>

      <nav className="flex-col gap-1" style={{ flex: 1, padding: '1rem 0.75rem' }}>
        <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
        <NavItem icon={<Server size={18} />} label="Services" badge="14" />
        <NavItem icon={<AlertCircle size={18} />} label="Incidents" badge="2" alert />
        <NavItem icon={<Activity size={18} />} label="Access Controls" />
      </nav>

      <div style={{ padding: '1rem 0.75rem' }}>
        <NavItem icon={<Settings size={18} />} label="Settings" />
        <div style={{ padding: '0.75rem 1rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <span className="status-dot online"></span>
           <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Connected to tailnet</span>
        </div>
      </div>
    </aside>
  );
};

const NavItem = ({ icon, label, active = false, badge, alert = false }: { icon: React.ReactNode, label: string, active?: boolean, badge?: string | number, alert?: boolean }) => {
  return (
    <a href="#" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem 0.75rem',
      borderRadius: 'var(--radius-sm)',
      color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
      backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
      fontWeight: 500,
      fontSize: '0.875rem',
      transition: 'all 0.15s ease'
    }} 
    onMouseEnter={(e) => { if(!active) e.currentTarget.style.backgroundColor = 'var(--bg-sidebar-hover)'; }}
    onMouseLeave={(e) => { if(!active) e.currentTarget.style.backgroundColor = 'transparent'; }}>
      <span style={{ color: active ? 'var(--accent-text)' : 'var(--text-muted)' }}>{icon}</span>
      {label}
      {badge && (
        <span style={{
          marginLeft: 'auto',
          backgroundColor: alert ? '#FEF2F2' : 'var(--borderColor)',
          color: alert ? 'var(--status-issue)' : 'var(--text-secondary)',
          padding: '0.125rem 0.375rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          {badge}
        </span>
      )}
    </a>
  );
};

export default Sidebar;
