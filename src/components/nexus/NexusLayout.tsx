import type { ReactNode } from 'react';
import { CoreShell } from './core/CoreShell';
export function NexusLayout({ children }: { children: ReactNode }) { return <CoreShell>{children}</CoreShell>; }
