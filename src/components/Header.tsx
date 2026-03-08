import { HelpCircle, Grip, Server, AppWindow, Users, Navigation, ClipboardList, Globe, Settings, MapPin, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Header = ({ activeTab, setActiveTab }: HeaderProps) => {
  const tabs = [
    { id: 'Services', icon: Server, label: 'Services' },
    { id: 'Doctor', icon: Activity, label: 'Doctor' },
    { id: 'Apps', icon: AppWindow, label: 'Apps' },
    { id: 'Users', icon: Users, label: 'Users' },
    { id: 'Access controls', icon: Navigation, label: 'Access controls' },
    { id: 'Logs', icon: ClipboardList, label: 'Logs' },
    { id: 'DNS', icon: Globe, label: 'DNS' },
    { id: 'Settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--borderColor)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Utility Nav */}
      <div style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
             <Grip size={20} color="var(--text-secondary)" />
             <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>emen3998@gmail.com</span>
          </div>
          <span style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '0.125rem 0.375rem', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 600 }}>Free</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <HelpCircle size={18} color="var(--text-secondary)" />
           </button>
           <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#BE185D', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
             E
           </div>
        </div>

      </div>

      {/* Primary Navigation Tabs */}
      <div style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  position: 'relative',
                  paddingBottom: '0.875rem'
                }}
              >
                <Icon size={16} />
                {tab.label}
                {isActive && (
                  <div style={{ position: 'absolute', bottom: '-1px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--accent-primary)', borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }} />
                )}
              </button>
            )
          })}
        </div>

        <button style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
            paddingBottom: '0.875rem'
        }}>
          <MapPin size={16} />
          Resource hub
        </button>

      </div>

    </div>
  );
};

export default Header;
