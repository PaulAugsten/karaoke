import type { Metadata } from 'next';
import { Stage } from './Stage';

export const metadata: Metadata = { title: 'Stage' };

export default function StagePage() {
    return <Stage />;
}
