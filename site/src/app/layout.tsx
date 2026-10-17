import type { Metadata } from 'next';
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { Grain } from '@/components/Grain';
import { TIER_SCRIPT } from '@/lib/perfTier';
import './globals.css';

const grotesk = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '700', '900'], variable: '--font-grotesk' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  // the share image's absolute URL is baked into the static HTML: set SITE_URL at build time if the host changes
  metadataBase: new URL(process.env.SITE_URL ?? 'https://yogx.site'),
  title: 'Yogesh Patil — DevOps Architect · Digital Alchemist',
  description: 'YogX mission control: DevOps & Site Reliability Engineer who builds like a creative developer.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${grotesk.variable} ${serif.variable} ${mono.variable}`}>
      <head>
        {/* how much motion this device gets (full / lite / still), decided before first paint: lib/perfTier.ts */}
        <script dangerouslySetInnerHTML={{ __html: TIER_SCRIPT }} />
        {/* coming back from the fast lane: no intro: hide it before first paint (Gate drops the class once it has handled the return) */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(sessionStorage.getItem('yogx:return')!==null)document.documentElement.classList.add('yogx-returning')}catch(e){}" }} />
      </head>
      <body className="locked"><Grain />{children}</body>
    </html>
  );
}
