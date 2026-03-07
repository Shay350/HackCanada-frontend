import { Incident } from './types';

export const mockIncidents: Incident[] = [
  {
    id: 'inc-012',
    service: 'Plex Media Server',
    serviceType: 'media',
    status: 'issue',
    logs: [
      'Received HTTP Hook from Uptime Kuma: Endpoint Timeout',
      'Pinging 100.95.82.12 over Tailscale... Success (12ms)',
      'Checking Docker container status... Down',
      'Reading latest container logs...',
      'Analyzed stderr: "Database locked - timeout during schema migration"'
    ],
    confidence: 94,
    proposedFix: {
      description: 'The SQLite database is locked preventing startup. I will create a backup, clear WAL/SHM files, and restart the container.',
      steps: [
        'cp /data/plex/db/com.plexapp.plugins.library.db /data/plex/db/backup.db',
        'rm -f /data/plex/db/*-wal /data/plex/db/*-shm',
        'docker restart plex'
      ]
    }
  },
  {
    id: 'inc-013',
    service: 'PostgreSQL Home DB',
    serviceType: 'database',
    status: 'resolving',
    logs: [
      'Received HTTP Hook: Connection Refused',
      'Connecting to tailscale node...',
      'Checking systemctl status postgresql...',
      'Process aborted due to OOM (Out Of Memory) killer',
      'Analyzing journalctl...'
    ],
    confidence: 88,
    proposedFix: null // Still diagnosing
  }
];
