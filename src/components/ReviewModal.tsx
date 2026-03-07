import { X, Check, AlertTriangle } from 'lucide-react';
import { Incident } from '../lib/types';

const ReviewModal = ({ incident, onClose }: { incident: Incident, onClose: () => void }) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }} className="animate-fade-in">
      
      <div className="ts-panel" style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--borderColor)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-3">
             <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <AlertTriangle size={18} color="var(--status-issue)" />
             </div>
             <div>
               <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Review Fix: {incident.service}</h2>
             </div>
          </div>
          <button onClick={onClose} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: 'var(--radius-sm)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: 'var(--bg-base)' }}>
          
          <div className="ts-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Diagnosis Summary</h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {incident.proposedFix?.description}
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, paddingLeft: '0.25rem' }}>Execution Plan</h3>
            <div className="ts-panel flex-col" style={{ overflow: 'hidden' }}>
              {incident.proposedFix?.steps.map((step: string, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', borderBottom: idx !== incident.proposedFix!.steps.length - 1 ? '1px solid var(--borderColor)' : 'none', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-base)', border: '1px solid var(--borderColor)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Monaco, monospace', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: '#FFFBEB', borderRadius: 'var(--radius-md)', border: '1px solid #FDE68A', display: 'flex', gap: '0.75rem' }}>
             <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
             <div style={{ fontSize: '0.875rem', color: '#92400E' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Destructive Actions Included</strong>
                This fix involves deleting database WAL cache files. A backup script is automatically executed in step 1.
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--borderColor)', backgroundColor: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
             <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Node</span>
             <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>100.95.82.{incident.id === 'inc-012' ? '12' : '18'}</span>
          </div>
          
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
            <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.5rem 1rem', gap: '0.5rem' }}>
               <Check size={16} /> Deploy Fix
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReviewModal;
