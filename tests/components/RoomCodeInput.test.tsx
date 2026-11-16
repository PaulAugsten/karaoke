import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomCodeInput } from '@/components/RoomCodeInput';

/** The four decorative boxes, in order. */
function boxes(container: HTMLElement) {
    return [...container.querySelectorAll('span[aria-hidden="true"]')];
}

/** Index of the box that lights up while the field has focus. */
function activeBox(container: HTMLElement) {
    return boxes(container).findIndex((box) => box.className.includes('peer-focus:'));
}

describe('RoomCodeInput', () => {
    it('is one text input limited to four letters', () => {
        render(<RoomCodeInput aria-label="Room code" name="room" />);
        const input = screen.getByRole('textbox', { name: 'Room code' });

        expect(screen.getAllByRole('textbox')).toHaveLength(1);
        expect(input).toHaveAttribute('maxlength', '4');
        expect(input).toHaveAttribute('pattern', '[A-Za-z]{4}');
        expect(input).toHaveAttribute('name', 'room');
    });

    it('starts with the given code', () => {
        render(<RoomCodeInput aria-label="Room code" defaultValue="KXQM" />);
        expect(screen.getByRole('textbox')).toHaveValue('KXQM');
    });

    it('cuts a starting code that is too long down to four letters', () => {
        render(<RoomCodeInput aria-label="Room code" defaultValue="KXQMZZZ" />);
        expect(screen.getByRole('textbox')).toHaveValue('KXQM');
    });

    it('marks the box the next letter goes into', () => {
        const { container } = render(<RoomCodeInput aria-label="Room code" />);
        const input = screen.getByRole('textbox');
        expect(boxes(container)).toHaveLength(4);
        expect(activeBox(container)).toBe(0);

        fireEvent.change(input, { target: { value: 'KX' } });
        expect(activeBox(container)).toBe(2);

        fireEvent.change(input, { target: { value: 'KXQM' } });
        expect(activeBox(container)).toBe(3);
    });

    it('still tells the caller about changes', () => {
        const onChange = vi.fn();
        render(<RoomCodeInput aria-label="Room code" onChange={onChange} />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'K' } });

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
