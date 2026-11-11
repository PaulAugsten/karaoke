// 100 = removed /private
// 101 & 150 owner disabled embedding
const PERMANENT_ERRORS = new Set([100, 101, 150]);

export function isPermanentError(code: number): boolean {
    return PERMANENT_ERRORS.has(code);
}
