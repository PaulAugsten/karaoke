import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, buttonClass } from '@/components/Button';

describe('Button', () => {
    it('is a plain button with the accent fill by default', () => {
        render(<Button>Join</Button>);
        const button = screen.getByRole('button', { name: 'Join' });
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveClass('bg-accent', 'text-accent-ink');
    });

    it('takes its colours from the variant and keeps extra classes', () => {
        render(
            <Button variant="danger" size="lg" className="w-full" type="submit">
                End party
            </Button>,
        );
        const button = screen.getByRole('button', { name: 'End party' });
        expect(button).toHaveAttribute('type', 'submit');
        expect(button).toHaveClass('bg-danger', 'text-danger-ink', 'text-xl', 'w-full');
        expect(button).not.toHaveClass('bg-accent');
    });

    it('offers the same classes to links', () => {
        expect(buttonClass('outline')).toContain('border-line');
    });
});
