import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdleScreen } from '@/app/stage/IdleScreen';

// The real component draws the code as SVG paths, which cannot be read back.
vi.mock('qrcode.react', () => ({
    QRCodeSVG: ({ value, title }: { value: string; title: string }) => (
        <svg role="img" aria-label={title} data-value={value} />
    ),
}));

describe('IdleScreen', () => {
    it('puts the join link with the room code into the QR code', () => {
        render(<IdleScreen code="KXQM" headline="Who's next?" />);

        expect(screen.getByRole('img', { name: 'QR code to join this room' })).toHaveAttribute(
            'data-value',
            `${window.location.origin}/join?room=KXQM`,
        );
    });

    it('shows the headline, the address to open and the room code', () => {
        render(<IdleScreen code="KXQM" headline="Who's singing first?" />);

        expect(
            screen.getByRole('heading', { level: 1, name: "Who's singing first?" }),
        ).toBeInTheDocument();
        expect(screen.getByText(window.location.host)).toBeInTheDocument();
        expect(screen.getByText('KXQM')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
});
