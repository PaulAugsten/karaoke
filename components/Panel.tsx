import type { ReactNode } from 'react';

/** A raised box that groups a form or a set of controls. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`.trim()}>
            {children}
        </div>
    );
}
