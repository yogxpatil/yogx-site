import type { Metadata } from 'next';
import Link from 'next/link';
import { fastLane as f } from '@/content/fastLane';
import { FAST_LANE_LINE } from '@/content/robo-script';
import { RoboChibi } from '@/components/robo/RoboChibi';
import { Unlock } from './Unlock';
import s from './FastLane.module.css';

export const metadata: Metadata = {
  title: 'Yogesh Patil — DevOps Engineer · Fast lane',
  description: `${f.intro[0]} ${f.intro[1]}`,
  // a real .png in public/: a plain static host serves it as image/png (the old opengraph-image route was written
  // without an extension and served as octet-stream). Rendered once from that route (see git history).
  openGraph: {
    title: 'Yogesh Patil — DevOps Engineer · Fast lane', description: f.intro[0], type: 'profile',
    images: [{ url: '/og/fast-lane.png', width: 1200, height: 630, alt: 'Yogesh Patil — DevOps Engineer · Fast lane' }],
  },
};

function Section({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section className={s.sec} aria-label={label}>
      <h2 className={`mono ${s.rail}`}><i>{n}</i>{label}</h2>
      <div className={s.body}>{children}</div>
    </section>
  );
}

export default function FastLanePage() {
  return (
    <div className={s.page}>
      <Unlock />
      <i className={`${s.cn} ${s.tl}`} aria-hidden /><i className={`${s.cn} ${s.tr}`} aria-hidden />
      <i className={`${s.cn} ${s.bl}`} aria-hidden /><i className={`${s.cn} ${s.br}`} aria-hidden />
      <div className={s.wrap}>
        <header className={s.top}>
          <span className={`mono ${s.tag}`}>YOGX MISSION CONTROL <i>·</i> PERSONNEL FILE Nº 01</span>
          <Link className={`mono ${s.back}`} href="/" scroll={false}>← Back to the fun version</Link>
        </header>

        <div className={s.id}>
          <figure className={s.photo}>
            <span className={`mono ${s.pl}`}>PHOTO · PENDING</span>
            <figcaption className="sr-only">Photo of {f.name} to come</figcaption>
          </figure>
          <div>
            <p className={`mono ${s.sub}`}>SUBJECT</p>
            <h1 className={s.name}>{f.name}</h1>
            <p className={`serif ${s.role}`}>{f.role}</p>
            <p className={`mono ${s.place}`}>{f.place}</p>
            <div className={s.intro}>{f.intro.map((t) => <p key={t}>{t}</p>)}</div>
          </div>
        </div>

        <ul className={s.nums} aria-label="Key numbers">
          {f.numbers.map(([v, l]) => (
            <li key={l}><b data-number={v}>{v}</b><span className="mono">{l}</span></li>
          ))}
        </ul>

        <Section n="01" label="Experience">
          {f.experience.map((e) => (
            <article key={e.org} className={s.job}>
              <div className={s.jobHead}>
                <h3>{e.org} <span className="serif">{e.role}</span></h3>
                <p className="mono"><span>{e.dates}</span><span>{e.where}</span></p>
              </div>
              <ul className={s.points}>{e.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </article>
          ))}
        </Section>

        <Section n="02" label="Projects">
          <ul className={s.rows}>
            {f.projects.map((p) => (
              <li key={p.name}>
                <h3>{p.name}</h3>
                <p>{p.line}</p>
                {p.href
                  ? <a className="mono" href={p.href} target="_blank" rel="noreferrer">Open ↗</a>
                  : <span className={`mono ${s.soon}`}>{p.name === 'HeartBeat' ? 'Link soon' : 'Internal'}</span>}
              </li>
            ))}
          </ul>
        </Section>

        <Section n="03" label="Skills">
          <dl className={s.skills}>
            {f.skills.map(([g, items]) => (
              <div key={g}><dt className="mono">{g}</dt><dd>{items}</dd></div>
            ))}
          </dl>
        </Section>

        <Section n="04" label="Certs & education">
          <div className={s.two}>
            <ul className={s.plain}>{f.certs.map((c) => <li key={c}>{c}</li>)}</ul>
            <ul className={s.plain}>{f.education.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </Section>

        <Section n="05" label="Contact">
          <p className={s.contact}>
            <a href={`mailto:${f.contact.email}`}>{f.contact.email}</a>
            <a className={s.li} href={f.contact.linkedin} target="_blank" rel="noreferrer">linkedin.com/in/yogeshp-dev ↗</a>
          </p>
        </Section>

        <footer className={s.foot}>
          <div className={s.robo}>
            <RoboChibi mood="idle" facing="right" gait={0.62} size={78} />
            <p className={`serif ${s.line}`}>{FAST_LANE_LINE}</p>
          </div>
          <Link className={`mono ${s.back}`} href="/" scroll={false}>← Back to the fun version</Link>
        </footer>
      </div>
    </div>
  );
}
