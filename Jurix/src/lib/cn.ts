/** Minimal classnames helper — joins truthy strings with single spaces. */
export function cn(...inputs: (string | false | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}
