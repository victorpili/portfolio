import { describe, expect, it } from 'vitest';
import { lerApiUrl } from '../src/config';

describe('lerApiUrl', () => {
  it('tira as barras do fim de VITE_API_URL', () => {
    expect(lerApiUrl({ VITE_API_URL: 'https://api.exemplo.com/', DEV: false })).toBe('https://api.exemplo.com');
    expect(lerApiUrl({ VITE_API_URL: 'https://api.exemplo.com///', DEV: false })).toBe('https://api.exemplo.com');
    expect(lerApiUrl({ VITE_API_URL: 'https://api.exemplo.com', DEV: true })).toBe('https://api.exemplo.com');
  });

  it('sem VITE_API_URL: localhost no dev e null no build', () => {
    expect(lerApiUrl({ DEV: true })).toBe('http://localhost:8787');
    expect(lerApiUrl({ VITE_API_URL: '', DEV: false })).toBeNull();
    expect(lerApiUrl({ VITE_API_URL: '/', DEV: false })).toBeNull();
  });
});
