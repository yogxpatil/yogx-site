import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroFootnote } from '@/components/hero/HeroFootnote';
import { heroFootnotes } from '@/content/site';

afterEach(() => vi.restoreAllMocks());

describe('HeroFootnote', () => {
  it('shows one of the three lines, picked at random, and a click cycles to the next', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // -> line 2 of 3
    render(<HeroFootnote />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent(heroFootnotes[1]);
    fireEvent.click(btn); expect(btn).toHaveTextContent(heroFootnotes[2]);
    fireEvent.click(btn); expect(btn).toHaveTextContent(heroFootnotes[0]);
  });
});
