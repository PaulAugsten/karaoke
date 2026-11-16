import type { ComponentProps } from 'react';
import { buttonClass, type Size, type Variant } from '@/components/buttonClass';

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size };

/** Pass className for position and width only */
export function Button({ variant, size, className = '', type = 'button', ...props }: ButtonProps) {
    return (
        <button
            type={type}
            className={`${buttonClass(variant, size)} ${className}`.trim()}
            {...props}
        />
    );
}
