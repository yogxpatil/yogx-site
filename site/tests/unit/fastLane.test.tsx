import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import FastLanePage, { metadata } from '@/app/fast-lane/page';

afterEach(cleanup);

describe('fast lane page', () => {
  it('shows the six numbers exactly', () => {
    const { container } = render(<FastLanePage />);
    const vals = [...container.querySelectorAll('[data-number]')].map((e) => e.getAttribute('data-number'));
    expect(vals).toEqual(['100+', '6', '75%', '60%', '50+', '~75%']);
    for (const n of vals) expect(container.textContent).toContain(n!);
  });
  it('shows both job date ranges', () => {
    const { container } = render(<FastLanePage />);
    expect(container.textContent).toContain('Jul 2023 – present');
    expect(container.textContent).toContain('Aug – Dec 2021');
  });
  it("has the contact links, the photo placeholder and Robo's line", () => {
    const { container } = render(<FastLanePage />);
    expect(container.querySelector('a[href="mailto:yogeshpatil6717@gmail.com"]')).not.toBeNull();
    const li = container.querySelector('a[href="https://www.linkedin.com/in/yogeshp-dev"]');
    expect(li).not.toBeNull();
    expect(li).toHaveAttribute('target', '_blank');
    expect(container.textContent).toContain('PHOTO · PENDING');
    expect(container.textContent).toContain('Told you he was good.');
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
  });
  it('never shows a phone number', () => {
    const { container } = render(<FastLanePage />);
    expect(container.textContent).not.toMatch(/(?:\+91[\s-]?)?[6-9]\d{9}/); // no phone number of any kind
    expect(container.textContent).not.toContain('+91');
  });
  it('has exactly one h1 and its own metadata', () => {
    const { container } = render(<FastLanePage />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(metadata.title).toBe('Yogesh Patil — DevOps Engineer · Fast lane');
    // the share image is a real .png file (served as image/png by any static host)
    const imgs = (metadata.openGraph as { images: { url: string }[] }).images;
    expect(imgs[0].url).toBe('/og/fast-lane.png');
  });
  it('lists HeartBeat as soon, not as a dead link', () => {
    const { container } = render(<FastLanePage />);
    expect(container.textContent).toMatch(/HeartBeat/);
    expect(container.textContent).toMatch(/soon/i);
  });
});
