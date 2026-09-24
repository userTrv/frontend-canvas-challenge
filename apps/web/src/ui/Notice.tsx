import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'error';

interface NoticeProps {
  tone: Tone;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Notice({ tone, children, actions, className }: NoticeProps) {
  const urgent = tone === 'error' || tone === 'warning';
  return (
    <div
      className={`notice notice--${tone}${className ? ` ${className}` : ''}`}
      role={urgent ? 'alert' : 'status'}
    >
      <div className="notice__text">{children}</div>
      {actions && <div className="notice__actions">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`} role="status">
      {children}
    </span>
  );
}
