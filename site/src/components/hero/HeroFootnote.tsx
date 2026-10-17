'use client';
import { useEffect, useState } from 'react';
import { heroFootnotes } from '@/content/site';
import s from './Hero.module.css';

/** The self-aware footnote for the asterisk after the headline. One line per visit, picked at random after hydration
 *  (the server renders the first, so markup matches); a click moves to the next. Nothing is stored. */
export function HeroFootnote() {
  const [i, setI] = useState(0);
  useEffect(() => { setI(Math.floor(Math.random() * heroFootnotes.length)); }, []);
  return (
    <p className={s.note}>
      <button type="button" className={s.noteBtn} data-hero-footnote onClick={() => setI((k) => (k + 1) % heroFootnotes.length)}>
        {heroFootnotes[i]}
      </button>
    </p>
  );
}
