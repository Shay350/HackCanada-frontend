import { useEffect, useRef, useState } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import IncidentCard from './IncidentCard';
import ReviewModal from './ReviewModal';
import { Incident } from '../lib/types';
import { mockIncidents } from '../lib/mockData';

const FAST_POLL_MS = 3000;
const IDLE_POLL_MS = 20000;

const Dashboard = () => {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRealDataRef = useRef(false);
  const lastKnownHasResolvingRef = useRef(false);

  const selectedIncident = selectedIncidentId
    ? incidents.find((incident) => incident.id === selectedIncidentId) ?? null
    : null;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const apiBaseFromQuery = params.get('apiBase')?.trim() || '';
    const apiBaseFromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const apiBase = apiBaseFromQuery || apiBaseFromEnv || 'http://127.0.0.1:8000';
    const incidentsEndpoint = `${apiBase}/api/v1/analysis/incidents`;

    const clearScheduledPoll = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const getNextPollDelay = (nextIncidents: Incident[]) => {
      const hasResolving = nextIncidents.some((incident) => incident.status === 'resolving');
      lastKnownHasResolvingRef.current = hasResolving;
      return hasResolving ? FAST_POLL_MS : IDLE_POLL_MS;
    };

    const schedulePoll = (delayMs: number) => {
      if (!active) {
        return;
      }
      clearScheduledPoll();
      timerRef.current = setTimeout(() => {
        void pollIncidents();
      }, delayMs);
    };

    const pollIncidents = async () => {
      if (!active || document.hidden || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      let shouldSetLoadingDone = true;

      try {
        const response = await fetch(incidentsEndpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load incidents: ${response.status}`);
        }
        const data: Incident[] = await response.json();
        if (!active) {
          return;
        }
        setIncidents(data);
        setLoadError(null);
        hasLoadedRealDataRef.current = true;
        schedulePoll(getNextPollDelay(data));
      } catch (error) {
        const isAbortError = error instanceof DOMException && error.name === 'AbortError';
        if (isAbortError) {
          shouldSetLoadingDone = false;
          return;
        }
        if (!active) {
          return;
        }
        if (!hasLoadedRealDataRef.current) {
          setIncidents(mockIncidents);
          schedulePoll(getNextPollDelay(mockIncidents));
        } else {
          const fallbackDelay = lastKnownHasResolvingRef.current ? FAST_POLL_MS : IDLE_POLL_MS;
          schedulePoll(fallbackDelay);
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load incidents');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        inFlightRef.current = false;
        if (active) {
          if (shouldSetLoadingDone) {
            setLoading(false);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearScheduledPoll();
        abortRef.current?.abort();
        abortRef.current = null;
        return;
      }
      clearScheduledPoll();
      void pollIncidents();
    };

    void pollIncidents();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearScheduledPoll();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedIncidentId) {
      return;
    }
    const selectedStillExists = incidents.some((incident) => incident.id === selectedIncidentId);
    if (!selectedStillExists) {
      setSelectedIncidentId(null);
    }
  }, [incidents, selectedIncidentId]);

  // We are integrating our Self-Healing metrics inside a Tailscale-like dashboard page.
  // The layout follows the exact dark-mode image provided.
  
  return (
    <div className="flex-col" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', gap: '2rem', paddingBottom: '3rem' }}>

      {/* Page Header Area */}
      <div className="flex items-start justify-between">
        <div className="flex-col gap-1">
           <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Doctor</h1>
           <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
             Monitor the health and performance of services connected to your tailnet. <a href="#" style={{ color: 'var(--accent-text)', textDecoration: 'none' }}>Learn more</a>
           </span>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Add service</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
         <div style={{ position: 'relative', flex: 1, maxWidth: '600px' }}>
           <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
           <input 
             type="text" 
             className="ts-input" 
             placeholder="Search by name, owner, tag, version..." 
             style={{ paddingLeft: '2.25rem', paddingRight: '1rem', backgroundColor: 'var(--bg-base)' }}
           />
         </div>
         <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', gap: '0.5rem', display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-base)' }}>
            <Filter size={16} color="var(--text-secondary)" /> Filters
         </button>
         <button className="btn btn-secondary" style={{ padding: '0.375rem 0.5rem', display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-base)' }}>
            <Download size={16} color="var(--text-secondary)" />
         </button>
      </div>

      <div style={{ display: 'inline-block', padding: '0.125rem 0.625rem', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'flex-start', marginBottom: '1rem' }}>
        {loading ? 'Loading...' : `${incidents.length} services`}
      </div>

      {loadError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', border: '1px solid rgba(239,68,68,0.45)', borderRadius: '0.5rem', color: '#FCA5A5', backgroundColor: 'rgba(127,29,29,0.3)', fontSize: '0.875rem' }}>
          API connection issue: {loadError}
        </div>
      )}

      {/* Main Table Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr) 40px', padding: '0 1rem 0.75rem 1rem', borderBottom: '1px solid var(--borderColor)', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <div>SERVICE</div>
        <div>ADDRESSES</div>
        <div>VERSION</div>
        <div>LAST SEEN</div>
        <div></div>
      </div>

      {/* Main Content List */}
      <div className="flex-col">
        {incidents.map((incident, index) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onReview={() => setSelectedIncidentId(incident.id)}
            isLast={index === incidents.length - 1}
          />
        ))}
        {!loading && incidents.length === 0 && (
          <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
            No incidents found.
          </div>
        )}
      </div>

      {selectedIncident && (
        <ReviewModal incident={selectedIncident} onClose={() => setSelectedIncidentId(null)} />
      )}
    </div>
  );
};

export default Dashboard;
