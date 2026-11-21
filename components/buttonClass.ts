export type Variant = 'primary' | 'outline' | 'danger';
export type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
    primary: 'bg-accent text-accent-ink',
    outline: 'border-2 border-line bg-background/75 text-foreground',
    danger: 'bg-danger text-danger-ink',
};

const SIZES: Record<Size, string> = {
    sm: 'rounded-lg px-3 py-2 text-base',
    md: 'rounded-xl px-4 py-3 text-lg',
    lg: 'rounded-xl px-5 py-3 text-xl',
    xl: 'rounded-2xl px-10 py-5 text-3xl',
};

/** The classes of a button, for elements that only look like one */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md'): string {
    return `inline-flex items-center justify-center font-bold disabled:opacity-50 aria-disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]}`;
}
