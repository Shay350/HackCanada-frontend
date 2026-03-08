import { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embedded') === 'true';
const pageBg = params.get('bg') || 'var(--bg-base)';

function App() {
  const [activeTab, setActiveTab] = useState('Doctor');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', backgroundColor: pageBg }}>
      {!embedded && <Header activeTab={activeTab} setActiveTab={setActiveTab} />}
      <main style={{ flex: 1, padding: '2rem 1.5rem', margin: '0 auto', width: '100%', maxWidth: '1200px' }}>
        {activeTab === 'Doctor' ? (
          <Dashboard />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{activeTab}</h2>
            <p>This is a placeholder for the {activeTab} view.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
