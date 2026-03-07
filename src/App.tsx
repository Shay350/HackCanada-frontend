import Header from './components/Header';
import Dashboard from './components/Dashboard';

const params = new URLSearchParams(window.location.search);
const embedded = params.get('embedded') === 'true';
const pageBg = params.get('bg') || 'var(--bg-base)';

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', backgroundColor: pageBg }}>
      {!embedded && <Header />}
      <main style={{ flex: 1, padding: '2rem 1.5rem', margin: '0 auto', width: '100%', maxWidth: '1200px' }}>
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
