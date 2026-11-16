import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

describe('Home', () => {
    it('shows the wordmark as the main heading', () => {
        render(<Home />);
        expect(screen.getByRole('heading', { level: 1, name: 'Karaoke' })).toBeInTheDocument();
    });

    it('asks for a four-letter room code and sends it to the join page', () => {
        render(<Home />);
        const code = screen.getByLabelText('Room code');

        expect(code).toBeRequired();
        expect(code).toHaveAttribute('name', 'room');
        expect(code).toHaveAttribute('minlength', '4');
        expect(code).toHaveAttribute('maxlength', '4');
        expect(code.closest('form')).toHaveAttribute('action', '/join');
        expect(screen.getByRole('button', { name: 'Join the room' })).toHaveAttribute(
            'type',
            'submit',
        );
    });

    it('keeps what is typed in the code field', () => {
        render(<Home />);
        const code = screen.getByLabelText('Room code');

        fireEvent.change(code, { target: { value: 'kxq' } });

        expect(code).toHaveValue('kxq');
    });

    it('links to the stage', () => {
        render(<Home />);
        expect(screen.getByRole('link', { name: 'Start a stage' })).toHaveAttribute(
            'href',
            '/stage',
        );
    });

    it('explains the three steps', () => {
        render(<Home />);
        expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
            '1Start a stage on the TV',
            '2Enter its room code on your phone',
            '3Pick a song and sing',
        ]);
    });
});
