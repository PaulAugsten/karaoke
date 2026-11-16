import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoomCode } from '@/components/RoomCode';

describe('RoomCode', () => {
    it('reads as one word and draws one box per letter', () => {
        const { container } = render(<RoomCode code="KXQM" />);

        expect(screen.getByText('KXQM')).toHaveClass('sr-only');
        const boxes = container.querySelector('[aria-hidden="true"]')!;
        expect([...boxes.children].map((box) => box.textContent)).toEqual(['K', 'X', 'Q', 'M']);
    });

    it('copes with a repeated letter', () => {
        const { container } = render(<RoomCode code="AABA" size="lg" />);
        expect(container.querySelector('[aria-hidden="true"]')!.children).toHaveLength(4);
    });
});
