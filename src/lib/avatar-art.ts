// Avatar artwork: 80s subway-graffiti stickers drawn as SVG on a 100x100 canvas (thick ink outlines,
// gradient fills, neon glow), matching the app icon. Each one fills the round frame of TagAvatar.

const INK = '#0B0B0C';

/** Brick wall in a colour wash with a few paint splatters, behind every avatar. */
const wall = (id: string, top: string, bottom: string) => `
<defs>
  <radialGradient id="${id}bg" cx="50%" cy="35%" r="75%">
    <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
  </radialGradient>
</defs>
<rect width="100" height="100" fill="url(#${id}bg)"/>
<g stroke="${INK}" stroke-opacity="0.22" stroke-width="1.2">
  <path d="M0 12H100M0 26H100M0 40H100M0 54H100M0 68H100M0 82H100M0 96H100"/>
  <path d="M20 0V12M60 0V12M40 12V26M80 12V26M20 26V40M60 26V40M40 40V54M80 40V54M20 54V68M60 54V68M40 68V82M80 68V82M20 82V96M60 82V96"/>
</g>
<g fill="#FFFFFF" fill-opacity="0.35"><circle cx="12" cy="20" r="1.6"/><circle cx="86" cy="16" r="1.2"/><circle cx="90" cy="78" r="1.8"/><circle cx="9" cy="70" r="1.1"/></g>`;

/** Paint drips running down from a shape's bottom edge. */
const drips = (color: string, xs: number[], y: number) =>
  xs.map((x, i) => `<path d="M${x - 2.2} ${y}V${y + 7 + (i % 3) * 4}a2.2 2.2 0 0 0 4.4 0V${y}Z" fill="${color}" stroke="${INK}" stroke-width="1.6"/>`).join('');

export const AVATAR_ART: Record<string, string> = {
  spray: `${wall('sp', '#3A1C5C', '#120A1E')}
<defs><linearGradient id="spcan" x1="0" x2="1"><stop offset="0" stop-color="#FF7AB8"/><stop offset="0.45" stop-color="#FF4FA0"/><stop offset="1" stop-color="#B0186A"/></linearGradient></defs>
<g fill="#9CFF2E"><circle cx="66" cy="20" r="3"/><circle cx="74" cy="15" r="2.2"/><circle cx="72" cy="25" r="2.6"/><circle cx="81" cy="20" r="1.8"/><circle cx="80" cy="29" r="2"/><circle cx="88" cy="25" r="1.4"/><circle cx="86" cy="13" r="1.2"/></g>
<g fill="#38D6FF"><circle cx="77" cy="35" r="1.5"/><circle cx="90" cy="33" r="1.2"/></g>
<rect x="44" y="12" width="8" height="8" rx="1.5" fill="#E8ECEF" stroke="${INK}" stroke-width="3"/>
<path d="M38 24h20l3 6H35z" fill="#C9CDD0" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<rect x="33" y="30" width="30" height="56" rx="7" fill="url(#spcan)" stroke="${INK}" stroke-width="4"/>
<rect x="33" y="46" width="30" height="20" fill="#FFD23F" stroke="${INK}" stroke-width="3"/>
<path d="M37 56l5-6 4 8 5-9 4 7 4-4" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M39 34v8M39 70v12" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>`,

  cassette: `${wall('ca', '#0E4A5C', '#071820')}
<defs><linearGradient id="cabody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#FF9A3D"/></linearGradient></defs>
<g transform="rotate(-8 50 52)">
<rect x="10" y="26" width="80" height="52" rx="6" fill="url(#cabody)" stroke="${INK}" stroke-width="4"/>
<rect x="17" y="32" width="66" height="22" rx="3" fill="#F4F1E8" stroke="${INK}" stroke-width="2.5"/>
<path d="M17 38h66M17 43h66" stroke="#FF4FA0" stroke-width="3"/>
<path d="M17 48h66" stroke="#38D6FF" stroke-width="3"/>
<rect x="30" y="56" width="40" height="13" rx="6.5" fill="#1C1F21" stroke="${INK}" stroke-width="2.5"/>
<circle cx="38" cy="62.5" r="4.5" fill="#F4F1E8" stroke="${INK}" stroke-width="2"/><circle cx="62" cy="62.5" r="4.5" fill="#F4F1E8" stroke="${INK}" stroke-width="2"/>
<path d="M38 59.5v6M35 62.5h6M62 59.5v6M59 62.5h6" stroke="${INK}" stroke-width="1.6"/>
<path d="M24 78l5-8h42l5 8" fill="#FF9A3D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="36" cy="74" r="1.8" fill="${INK}"/><circle cx="64" cy="74" r="1.8" fill="${INK}"/>
</g>`,

  boombox: `${wall('bb', '#5C1A1A', '#1E0808')}
<defs><linearGradient id="bbbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2F4F5"/><stop offset="1" stop-color="#8A9399"/></linearGradient>
<radialGradient id="bbcone"><stop offset="0" stop-color="#FF7AB8"/><stop offset="1" stop-color="#7A1450"/></radialGradient></defs>
<path d="M18 24c8-4 22-2 32 6M82 24c-8-4-22-2-32 6" fill="none" stroke="#FFD23F" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
<path d="M30 36V27h40v9" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<rect x="8" y="36" width="84" height="44" rx="7" fill="url(#bbbody)" stroke="${INK}" stroke-width="4"/>
<circle cx="29" cy="60" r="14" fill="#1C1F21" stroke="${INK}" stroke-width="3"/><circle cx="29" cy="60" r="8.5" fill="url(#bbcone)" stroke="${INK}" stroke-width="2"/><circle cx="29" cy="60" r="2.5" fill="${INK}"/>
<circle cx="71" cy="60" r="14" fill="#1C1F21" stroke="${INK}" stroke-width="3"/><circle cx="71" cy="60" r="8.5" fill="url(#bbcone)" stroke="${INK}" stroke-width="2"/><circle cx="71" cy="60" r="2.5" fill="${INK}"/>
<rect x="44" y="47" width="12" height="9" rx="1.5" fill="#1C1F21" stroke="${INK}" stroke-width="2"/>
<rect x="44" y="60" width="12" height="4" fill="#38D6FF" stroke="${INK}" stroke-width="1.5"/>
<rect x="44" y="67" width="12" height="4" fill="#9CFF2E" stroke="${INK}" stroke-width="1.5"/>
<path d="M14 42h72" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
<g fill="#FF4141" stroke="${INK}" stroke-width="1.4"><rect x="16" y="38.5" width="5" height="2.5"/><rect x="24" y="38.5" width="5" height="2.5"/><rect x="71" y="38.5" width="5" height="2.5"/><rect x="79" y="38.5" width="5" height="2.5"/></g>`,

  token: `${wall('tk', '#2B2B2B', '#0B0B0C')}
<defs><radialGradient id="tkgold" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF1A8"/><stop offset="0.5" stop-color="#F2B92B"/><stop offset="1" stop-color="#A86A00"/></radialGradient></defs>
<circle cx="50" cy="52" r="38" fill="#9CFF2E" opacity="0.18"/>
<circle cx="50" cy="52" r="34" fill="url(#tkgold)" stroke="${INK}" stroke-width="4"/>
<circle cx="50" cy="52" r="26" fill="none" stroke="#7A4A00" stroke-width="2.5"/>
<path d="M40 38h7l3 8 3-8h7l-7 14v14h-6V52z" fill="#1C1F21" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
<g fill="#7A4A00"><circle cx="50" cy="22" r="1.6"/><circle cx="50" cy="82" r="1.6"/><circle cx="20" cy="52" r="1.6"/><circle cx="80" cy="52" r="1.6"/><circle cx="29" cy="31" r="1.4"/><circle cx="71" cy="31" r="1.4"/><circle cx="29" cy="73" r="1.4"/><circle cx="71" cy="73" r="1.4"/></g>
<path d="M30 34a28 28 0 0 1 14-9" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`,

  sneaker: `${wall('sn', '#1B2D6B', '#080E24')}
<g transform="rotate(-10 50 55)">
<path d="M14 72V40c0-6 4-10 10-10h14l4 14c8 2 20 6 30 10 8 3 14 8 14 14v4z" fill="#F4F1E8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M24 30h14l3 12H26z" fill="#FF4141" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M30 62c12-10 26-10 42-4" fill="none" stroke="#2B5CFF" stroke-width="6" stroke-linecap="round"/>
<path d="M30 62c12-10 26-10 42-4" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
<path d="M40 46l6 3M43 42l7 3M47 50l6 3" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M10 72h80c2 0 3 2 3 4v2c0 2-1 4-3 4H12c-2 0-3-2-3-4v-2c0-2 1-4 3-4z" fill="#FF4141" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M14 77h74" stroke="#F4F1E8" stroke-width="2" stroke-dasharray="4 3"/>
</g>
<path d="M76 22l4-8M84 28l8-4M70 18l1-8" stroke="#FFD23F" stroke-width="3" stroke-linecap="round"/>`,

  mic: `${wall('mi', '#4A1260', '#14051C')}
<defs><radialGradient id="migrille" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#C9CDD0"/><stop offset="1" stop-color="#5A6066"/></radialGradient>
<linearGradient id="mibody" x1="0" x2="1"><stop offset="0" stop-color="#3A3F44"/><stop offset="0.4" stop-color="#6A7074"/><stop offset="1" stop-color="#1C1F21"/></linearGradient></defs>
<path d="M22 26a30 30 0 0 0 0 30M14 20a40 40 0 0 0 0 42M78 26a30 30 0 0 1 0 30M86 20a40 40 0 0 1 0 42" fill="none" stroke="#38D6FF" stroke-width="3" stroke-linecap="round"/>
<path d="M42 48h16l-3 40h-10z" fill="url(#mibody)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<rect x="40" y="44" width="20" height="7" rx="2" fill="#FFD23F" stroke="${INK}" stroke-width="3"/>
<circle cx="50" cy="30" r="17" fill="url(#migrille)" stroke="${INK}" stroke-width="4"/>
<path d="M36 24h28M34 30h32M36 36h28M44 14v32M50 13v34M56 14v32" stroke="${INK}" stroke-width="1.2" opacity="0.45"/>
<path d="M40 22a12 12 0 0 1 7-5" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,

  bboy: `${wall('bo', '#0E5C3A', '#04180F')}
<path d="M14 100c2-18 16-26 36-26s34 8 36 26z" fill="#FF4141" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M38 76l4 10M62 76l-4 10" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
<path d="M30 84c6 8 34 8 40 0" fill="none" stroke="#FFD23F" stroke-width="4" stroke-dasharray="4 2.5"/>
<circle cx="50" cy="52" r="22" fill="#B07444" stroke="${INK}" stroke-width="4"/>
<path d="M27 42c0-14 10-22 23-22s23 8 23 22z" fill="#38D6FF" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M73 42h12c2 0 3 3 1 4l-14 2" fill="#38D6FF" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M50 20v22" stroke="${INK}" stroke-width="2" opacity="0.5"/>
<path d="M28 48h44l-2 8c-1 3-4 4-7 4h-8c-3 0-4-2-5-4-1 2-2 4-5 4h-8c-3 0-6-1-7-4z" fill="${INK}"/>
<path d="M33 51l6 0M56 51l6 0" stroke="#FF4FA0" stroke-width="2.4" stroke-linecap="round"/>
<path d="M42 67c4 3 12 3 16 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,

  train: `${wall('tr', '#5C3A0E', '#1E1204')}
<defs><linearGradient id="trbody" x1="0" x2="1"><stop offset="0" stop-color="#8A9399"/><stop offset="0.35" stop-color="#E8ECEF"/><stop offset="1" stop-color="#6A7074"/></linearGradient></defs>
<rect x="18" y="12" width="64" height="80" rx="10" fill="url(#trbody)" stroke="${INK}" stroke-width="4"/>
<rect x="25" y="24" width="22" height="22" rx="3" fill="#1C1F21" stroke="${INK}" stroke-width="3"/>
<rect x="53" y="24" width="22" height="22" rx="3" fill="#1C1F21" stroke="${INK}" stroke-width="3"/>
<path d="M28 42l14-14M56 42l14-14" stroke="#38D6FF" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
<circle cx="50" cy="18" r="5" fill="#2B5CFF" stroke="${INK}" stroke-width="2"/>
<path d="M48 21l2-6 2 6M48.7 19h2.6" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M24 60c4-6 8 4 12-2s6-6 10 0 8-4 10 2 6-2 8-4 6 4 10 2" fill="none" stroke="#FF4FA0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M26 66c6 2 10-4 16-1s12 2 18-2 12 0 16 2" fill="none" stroke="#9CFF2E" stroke-width="3.5" stroke-linecap="round"/>
<circle cx="30" cy="80" r="5" fill="#FFF1A8" stroke="${INK}" stroke-width="2.5"/><circle cx="70" cy="80" r="5" fill="#FFF1A8" stroke="${INK}" stroke-width="2.5"/>
<circle cx="30" cy="80" r="9" fill="#FFD23F" opacity="0.3"/><circle cx="70" cy="80" r="9" fill="#FFD23F" opacity="0.3"/>
<rect x="42" y="74" width="16" height="12" rx="2" fill="#6A7074" stroke="${INK}" stroke-width="2.5"/>`,

  crown: `${wall('cr', '#1C1F21', '#050505')}
<path d="M16 72L12 30l20 18 18-28 18 28 20-18-4 42z" fill="#FFD23F" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
${drips('#FFD23F', [26, 44, 60, 76], 72)}
<path d="M18 66h64" stroke="${INK}" stroke-width="3"/>
<circle cx="12" cy="30" r="4.5" fill="#FF4141" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="20" r="4.5" fill="#38D6FF" stroke="${INK}" stroke-width="2.5"/><circle cx="88" cy="30" r="4.5" fill="#9CFF2E" stroke="${INK}" stroke-width="2.5"/>
<path d="M30 56l4-6 4 6M46 54l4-8 4 8M62 56l4-6 4 6" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,

  skull: `${wall('sk', '#103A10', '#030A03')}
<circle cx="50" cy="44" r="34" fill="#9CFF2E" opacity="0.16"/>
<path d="M50 14c-18 0-30 12-30 28 0 10 5 17 11 21v9h38v-9c6-4 11-11 11-21 0-16-12-28-30-28z" fill="#F4F1E8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
${drips('#F4F1E8', [36, 50, 64], 72)}
<path d="M30 42c0-6 4-9 9-9s9 3 9 9-4 8-9 8-9-2-9-8zM52 42c0-6 4-9 9-9s9 3 9 9-4 8-9 8-9-2-9-8z" fill="${INK}"/>
<circle cx="39" cy="42" r="3" fill="#9CFF2E"/><circle cx="61" cy="42" r="3" fill="#9CFF2E"/>
<path d="M47 58l3-6 3 6z" fill="${INK}"/>
<path d="M40 66v6M46 66v6M54 66v6M60 66v6" stroke="${INK}" stroke-width="2"/>
<path d="M28 34c2-8 8-13 16-15" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,
};
