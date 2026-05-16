import { useEffect, useState } from 'react';
import { DebugLogEntry } from '../../utils/logging';

export function DebugLogPanel() {
  const [logs, setLogs] = useState<DebugLogEntry[]>(() => window.__GESTURE_DEBUG_LOGS ?? []);

  useEffect(() => {
    const onLog = (event: Event) => {
      const entry = (event as CustomEvent<DebugLogEntry>).detail;
      setLogs((current) => [...current, entry].slice(-12));
    };

    window.addEventListener('gesture-debug-log', onLog);
    return () => window.removeEventListener('gesture-debug-log', onLog);
  }, []);

  return (
    <div className="debug-log-panel">
      <div className="debug-log-title">Debug logs</div>
      {logs.length === 0 ? (
        <div className="debug-log-empty">No logs yet</div>
      ) : (
        logs.map((log, index) => (
          <div key={`${log.time}-${index}`} className={`debug-log-line ${log.level.toLowerCase()}`}>
            <span>{log.time}</span>
            <strong>{log.level}</strong>
            <p>{log.message}</p>
          </div>
        ))
      )}
    </div>
  );
}
