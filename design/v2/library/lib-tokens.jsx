// library/lib-tokens.jsx — visual cards for every token.
(function () {
  const T = window.WMT;
  const { ArtboardFrame, ABTitle, MicroLabel, TokenTag, Icon } = window;

  // ─────────────────────────────────────────────────────────────────────
  // COLORS
  // ─────────────────────────────────────────────────────────────────────
  function ColorSwatch({ name, value, role, fg = '#000' }) {
    return (
      <div style={{
        background: value, color: fg, borderRadius: 14,
        padding: 18, minHeight: 156,
        border: '1px solid rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
      }}>
        <div>
          <div style={{ font: `700 13px/1 ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase' }}>{name}</div>
          <div style={{ font: `400 13px/1.4 ${T.font.sans}`, opacity: 0.7, marginTop: 6 }}>{role}</div>
        </div>
        <div style={{ font: `600 18px/1 ${T.font.mono}`, letterSpacing: 0.5 }}>{value}</div>
      </div>
    );
  }
  function TextSwatch({ token, value, sample, fg = T.color.ink, bg }) {
    return (
      <div style={{
        background: bg || 'rgba(255,255,255,0.025)', borderRadius: 10,
        padding: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ color: fg, font: `500 14px/1.4 ${T.font.sans}` }}>{sample}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ font: `600 10.5px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>{token}</span>
          <span style={{ font: `400 10.5px/1 ${T.font.mono}`, color: T.color.t40 }}>{value}</span>
        </div>
      </div>
    );
  }

  function TokensColors() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.1 / color" title="Warm ink + amber" italic="brand" lead="One signature accent. Three brand secondaries. Five text levels. Never pure black, never pure white." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          <ColorSwatch name="accent"   value="#FFC452" role="primary · amber" />
          <ColorSwatch name="second"   value="#86efac" role="success · mint" />
          <ColorSwatch name="third"    value="#FF8FAB" role="highlight · pink" />
          <ColorSwatch name="alarm"    value="#FF6B6B" role="danger · red" />
          <ColorSwatch name="info-blue"   value="#7DD3FC" role="company chip" />
          <ColorSwatch name="info-violet" value="#A78BFA" role="concept chip" />
          <ColorSwatch name="ink"      value="#f4f1ea" role="warm newsprint" />
          <div style={{
            background: '#0a0a0a', borderRadius: 14, padding: 18, minHeight: 156,
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            color: T.color.ink,
            backgroundImage:
              'radial-gradient(ellipse at 20% 0%, rgba(255,196,82,0.06) 0%, transparent 50%),' +
              'radial-gradient(ellipse at 80% 100%, rgba(255,107,107,0.04) 0%, transparent 50%)',
          }}>
            <div>
              <div style={{ font: `700 13px/1 ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase' }}>bg-page</div>
              <div style={{ font: `400 13px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 6 }}>deep ink + radials</div>
            </div>
            <div style={{ font: `600 18px/1 ${T.font.mono}`, color: T.color.t70 }}>#0a0a0a</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <MicroLabel style={{ marginBottom: 8 }}>text on dark</MicroLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <TextSwatch token="--text-100" value="#fff"            sample="Headline 100%"          fg="#fff" />
              <TextSwatch token="--text-85"  value="rgba(_,_,_,.85)" sample="Body emphasis 85%"     fg="rgba(255,255,255,0.85)" />
              <TextSwatch token="--text-70"  value="rgba(_,_,_,.70)" sample="Body 70%"               fg="rgba(255,255,255,0.70)" />
              <TextSwatch token="--text-55"  value="rgba(_,_,_,.55)" sample="Secondary body 55%"    fg="rgba(255,255,255,0.55)" />
              <TextSwatch token="--text-40"  value="rgba(_,_,_,.40)" sample="Metadata 40%"          fg="rgba(255,255,255,0.40)" />
              <TextSwatch token="--text-30"  value="rgba(_,_,_,.30)" sample="Ghosts · timestamps 30%" fg="rgba(255,255,255,0.30)" />
            </div>
          </div>

          <div>
            <MicroLabel style={{ marginBottom: 8 }}>surfaces (translucent)</MicroLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { t: '--surface-1', v: 'rgba(_,_,_,.025)', bg: 'rgba(255,255,255,0.025)', s: 'card base' },
                { t: '--surface-2', v: 'rgba(_,_,_,.04)',  bg: 'rgba(255,255,255,0.04)',  s: 'card hover / nested' },
                { t: '--surface-3', v: 'rgba(_,_,_,.06)',  bg: 'rgba(255,255,255,0.06)',  s: 'input / pill' },
                { t: '--bg-card',   v: '#08080d',          bg: '#08080d',                 s: 'terminal / code block' },
                { t: '--bg-raised', v: '#0e0e12',          bg: '#0e0e12',                 s: 'raised card' },
              ].map(x => (
                <TextSwatch key={x.t} token={x.t} value={x.v} sample={x.s} bg={x.bg} fg={T.color.ink} />
              ))}
            </div>
          </div>

          <div>
            <MicroLabel style={{ marginBottom: 8 }}>borders</MicroLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { t: '--border-soft', v: 'rgba(_,_,_,.06)', w: 1 },
                { t: '--border-mid',  v: 'rgba(_,_,_,.10)', w: 1 },
                { t: '--border-hard', v: 'rgba(_,_,_,.15)', w: 1 },
                { t: '--border-acc',  v: '#FFC452 @ 40%',   w: 1.5, c: 'rgba(255,196,82,0.4)' },
                { t: '--border-blk',  v: '#000 (1.5px)',    w: 1.5, c: '#000' },
              ].map(x => (
                <div key={x.t} style={{
                  padding: 14, borderRadius: 10,
                  border: `${x.w}px solid ${x.c || `rgba(255,255,255,${x.t === '--border-soft' ? '0.06' : x.t === '--border-mid' ? '0.10' : '0.15'})`}`,
                  background: 'rgba(255,255,255,0.015)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span style={{ font: `600 11px/1 ${T.font.mono}`, color: T.color.accent }}>{x.t}</span>
                  <span style={{ font: `400 11px/1 ${T.font.mono}`, color: T.color.t40 }}>{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // TYPE
  // ─────────────────────────────────────────────────────────────────────
  function TypeRow({ token, family, size, weight, lh, ls, sample, italic, color = T.color.ink }) {
    return (
      <div style={{
        padding: '20px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28, alignItems: 'baseline',
      }}>
        <div style={{
          fontFamily: family, fontSize: size, fontWeight: weight,
          fontStyle: italic ? 'italic' : 'normal',
          lineHeight: lh, letterSpacing: ls, color,
          textTransform: token.includes('eyebrow') || token.includes('pill') ? 'uppercase' : 'none',
        }}>{sample}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ font: `700 11px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 1 }}>{token}</span>
          <span style={{ font: `500 10.5px/1.6 ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.3 }}>
            {family.split(',')[0].replace(/'/g, '')} · {size}px · {weight} · lh {lh}{ls ? ` · ls ${ls}` : ''}
          </span>
        </div>
      </div>
    );
  }
  function TokensType() {
    return (
      <ArtboardFrame padding={36} scrollY>
        <ABTitle eyebrow="01.2 / type" title="Three families." italic="One knife." lead="Inter for everything, JetBrains Mono for the chrome, Instrument Serif italic for exactly one word per heading." />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28,
        }}>
          {[
            { n: '--font-sans',  f: "'Inter'",            r: 'headlines, body, UI',          w: 'aA · 400 / 500 / 600 / 700 / 800 / 900' },
            { n: '--font-mono',  f: "'JetBrains Mono'",   r: 'labels, code, timestamps',     w: 'aA · 400 / 500 / 600 / 700' },
            { n: '--font-serif', f: "'Instrument Serif'", r: 'italic accents · numerals',    w: 'aA · 400 italic' },
          ].map(x => (
            <div key={x.n} style={{
              padding: 18, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontFamily: x.f, fontSize: 56, fontWeight: x.n === '--font-serif' ? 400 : 800,
                fontStyle: x.n === '--font-serif' ? 'italic' : 'normal',
                letterSpacing: '-0.025em', color: x.n === '--font-serif' ? T.color.accent : T.color.ink,
                lineHeight: 1, marginBottom: 14,
              }}>{x.n === '--font-serif' ? 'Aa' : 'Aa'}</div>
              <div style={{ font: `700 12px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 1 }}>{x.n}</div>
              <div style={{ font: `400 13px/1.4 ${T.font.sans}`, color: T.color.t70, marginTop: 6 }}>{x.r}</div>
              <div style={{ font: `400 11px/1.5 ${T.font.mono}`, color: T.color.t30, marginTop: 8, letterSpacing: 0.4 }}>{x.w}</div>
            </div>
          ))}
        </div>

        <MicroLabel style={{ marginBottom: 8, color: T.color.t55 }}>type scale</MicroLabel>

        <TypeRow token="--display"  family={T.font.sans}  size={88} weight={900} lh={0.95} ls="-0.04em" sample="your social RAM" />
        <TypeRow token="--h1"       family={T.font.sans}  size={60} weight={900} lh={1}    ls="-0.03em" sample={<>Stop forgetting. <i style={{ font: `400 1em/1 ${T.font.serif}`, color: T.color.accent }}>Start building.</i></>} />
        <TypeRow token="--h2"       family={T.font.sans}  size={40} weight={800} lh={1.05} ls="-0.025em" sample="One captures. One drafts." />
        <TypeRow token="--h3"       family={T.font.sans}  size={28} weight={800} lh={1.15} ls="-0.02em" sample="The graph you carry" />
        <TypeRow token="--serif-numeral" family={T.font.serif} size={84} weight={400} lh={0.85} ls="-0.04em" sample="12" italic color={T.color.accent} />
        <TypeRow token="--lead"     family={T.font.sans}  size={19} weight={500} lh={1.55} ls="normal" sample="Plain English, from anywhere. Drafts the follow-up. You just send." color={T.color.t70} />
        <TypeRow token="--body"     family={T.font.sans}  size={15} weight={500} lh={1.55} ls="normal" sample="Tap to capture. Speak naturally about who you met — we'll do the rest." color={T.color.t70} />
        <TypeRow token="--mono"     family={T.font.mono}  size={12.5} weight={500} lh={1.7} ls="0.3px" sample={'wingmic.contacts.search("rust")'} color={T.color.t85} />
        <TypeRow token="--eyebrow"  family={T.font.mono}  size={11} weight={500} lh={1.4} ls="2px" sample="◆ live activity / dev-connect" color={T.color.accent} />
        <TypeRow token="--pill"     family={T.font.mono}  size={10} weight={700} lh={1.3} ls="1px" sample="◷ reminder · 92%" color={T.color.accent} />
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // SPACING
  // ─────────────────────────────────────────────────────────────────────
  function TokensSpacing() {
    const steps = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 60, 72, 96];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.3 / spacing" title="A scale you can" italic="feel." lead="4 → 96. Use the steps. Custom values get questioned in review." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ font: `600 11px/1 ${T.font.mono}`, color: T.color.accent, width: 36, letterSpacing: 0.5 }}>{s}</span>
              <div style={{
                height: 10, width: s * 5,
                background: T.color.accent, borderRadius: 2,
                opacity: 0.85,
              }} />
              <span style={{ font: `400 10.5px/1 ${T.font.mono}`, color: T.color.t40 }}>{s}px</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, padding: 16, background: 'rgba(255,255,255,0.025)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <MicroLabel style={{ marginBottom: 8 }}>vertical rhythm</MicroLabel>
          <div style={{ font: `400 13.5px/1.55 ${T.font.sans}`, color: T.color.t70 }}>
            Hero: <span style={{ color: T.color.accent }}>120 / 60</span>. Inner section: <span style={{ color: T.color.accent }}>80–96</span>. Container max: <span style={{ color: T.color.accent }}>1280</span>. Mobile gutter: <span style={{ color: T.color.accent }}>20</span>.
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // RADII
  // ─────────────────────────────────────────────────────────────────────
  function TokensRadii() {
    const radii = [
      { n: '--r-sm', v: 6,  use: 'tags, chips' },
      { n: '--r-md', v: 10, use: 'buttons, small cards' },
      { n: '--r-lg', v: 14, use: 'code blocks, content cards' },
      { n: '--r-xl', v: 18, use: 'hero / testimonial cards' },
      { n: '--r-2xl', v: 36, use: 'phone bezels' },
      { n: '--r-pill', v: 999, use: 'pills · stickers · dots' },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.4 / radii" title="Six radii. " italic="No more." lead="Pick the smallest one that doesn't look pointy." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {radii.map(r => (
            <div key={r.n} style={{
              padding: 18, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: r.v >= 100 ? 96 : 72,
                height: r.v >= 100 ? 48 : 72,
                borderRadius: Math.min(r.v, 999),
                background: T.color.accent,
                boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ font: `700 12px/1 ${T.font.mono}`, color: T.color.accent }}>{r.n}</div>
                <div style={{ font: `500 13px/1.4 ${T.font.sans}`, color: T.color.ink, marginTop: 4 }}>{r.v}px</div>
                <div style={{ font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>{r.use}</div>
              </div>
            </div>
          ))}
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // SHADOWS
  // ─────────────────────────────────────────────────────────────────────
  function TokensShadows() {
    const shadows = [
      { n: '--shadow-sticker', v: '3px 3px 0 rgba(0,0,0,0.2)',                   use: 'stickers, badges',        bg: '#FFC452', tone: '#000' },
      { n: '--shadow-button',  v: '4px 4px 0 #000',                              use: 'primary CTA · brutalist', bg: '#FFC452', tone: '#000', border: '1.5px solid #000' },
      { n: '--shadow-card',    v: '0 20px 50px rgba(0,0,0,0.4)',                 use: 'content / code cards',    bg: '#08080d', tone: '#fff' },
      { n: '--shadow-phone',   v: '0 30px 60px rgba(0,0,0,0.5)',                 use: 'phone mocks',             bg: '#0a0a10', tone: '#fff' },
      { n: '--shadow-glow',    v: '0 0 80px rgba(255,196,82,0.15)',              use: 'floating over graph',     bg: '#08080d', tone: '#FFC452' },
      { n: '--shadow-md',      v: '0 4px 12px rgba(0,0,0,0.35)',                 use: 'panel / sheet',           bg: '#0e0e12', tone: '#fff' },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.5 / shadow" title="Two systems," italic="never mixed." lead="Buttons + stickers use hard offset shadows. Cards + sheets use soft drops." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {shadows.map(s => (
            <div key={s.n} style={{ padding: 22 }}>
              <div style={{
                height: 80, borderRadius: 10,
                background: s.bg, color: s.tone,
                boxShadow: s.v, border: s.border || '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: `700 13px/1 ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
              }}>{s.n.replace('--shadow-', '')}</div>
              <div style={{ font: `700 11px/1 ${T.font.mono}`, color: T.color.accent, marginTop: 12, letterSpacing: 0.5 }}>{s.n}</div>
              <div style={{ font: `400 11px/1.5 ${T.font.mono}`, color: T.color.t40, marginTop: 4 }}>{s.v}</div>
              <div style={{ font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>{s.use}</div>
            </div>
          ))}
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MOTION
  // ─────────────────────────────────────────────────────────────────────
  function MotionPreview({ animKey, children, height = 60 }) {
    return (
      <div style={{
        height, padding: '8px 14px',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>{children}</div>
    );
  }
  function TokensMotion() {
    const cues = [
      { n: 'blink',    d: '0.7s · step',          u: 'transcript caret · input',
        prev: <span style={{ display: 'inline-block', width: 3, height: 22, background: T.color.accent, animation: 'wm-blink 0.7s step-end infinite' }} /> },
      { n: 'pulse-d',  d: '1.5s · ease-in-out',   u: 'live status dot',
        prev: <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s ease-in-out infinite' }} /> },
      { n: 'pulse-s',  d: '1.0–1.6s · ease',      u: 'recording orb · thinking',
        prev: <span style={{ display: 'inline-block', width: 28, height: 28, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-s 1.4s ease-in-out infinite' }} /> },
      { n: 'drift-up', d: '5–6s · ease-in-out',   u: 'stat numerals',
        prev: <span style={{ font: `400 36px/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, display: 'inline-block', animation: 'wm-drift 5s ease-in-out infinite' }}>12</span> },
      { n: 'ring',     d: '1.4s · ease-out',      u: 'mic-tap ripple',
        prev: <span style={{ position: 'relative', display: 'inline-block', width: 36, height: 36 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: T.color.accent }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${T.color.accent}`, animation: 'wm-ring 1.4s ease-out infinite' }} />
        </span> },
      { n: 'shimmer',  d: '2s · linear',          u: 'skeleton loader',
        prev: <span style={{
          display: 'inline-block', width: 140, height: 12, borderRadius: 4,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
          backgroundSize: '200% 100%', animation: 'wm-shimmer 1.6s linear infinite',
        }} /> },
      { n: 'rise',     d: '0.4s · ease-out',      u: 'card entry',
        prev: <span style={{
          display: 'inline-block', padding: '8px 14px', borderRadius: 8,
          background: T.color.accent, color: '#000', font: `700 11px ${T.font.mono}`, letterSpacing: 1,
          animation: 'wm-rise 2s ease-out infinite',
        }}>RISE</span> },
      { n: 'marquee',  d: '30–40s · linear',      u: 'logo / testimonial strip',
        prev: <span style={{ display: 'inline-flex', overflow: 'hidden', width: 160, gap: 16 }}>
          <span style={{ display: 'inline-flex', gap: 16, animation: 'wm-marquee 8s linear infinite', whiteSpace: 'nowrap' }}>
            {['◆ acme', '⇌ stripe', '◷ vercel', '◇ openai', '◆ acme', '⇌ stripe'].map((x, i) => (
              <span key={i} style={{ font: `600 11px ${T.font.mono}`, color: T.color.t40 }}>{x}</span>
            ))}
          </span>
        </span> },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.6 / motion" title="Eight cues. " italic="Reused." lead="Motion is vocabulary. If a behavior doesn't appear here, ship the still — don't invent a new tween." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {cues.map(c => (
            <div key={c.n} style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <MotionPreview animKey={c.n} height={64}>{c.prev}</MotionPreview>
              <div style={{ font: `700 12px/1 ${T.font.mono}`, color: T.color.accent, marginTop: 12, letterSpacing: 0.5 }}>{c.n}</div>
              <div style={{ font: `500 10.5px/1.5 ${T.font.mono}`, color: T.color.t40, marginTop: 4 }}>{c.d}</div>
              <div style={{ font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 6 }}>{c.u}</div>
            </div>
          ))}
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // ICONOGRAPHY
  // ─────────────────────────────────────────────────────────────────────
  function TokensIcons() {
    const icons = [
      'mic','send','search','graph','home','acts','person','chat','check','x',
      'lock','arrowUp','arrowR','arrowL','trash','bell','settings','sparkle','bolt','tag','plus','filter','eye','headphones','cog','pin',
    ];
    const glyphs = [
      { g: '↗', l: 'check-in' },
      { g: '◷', l: 'reminder' },
      { g: '⇌', l: 'intro' },
      { g: '◇', l: 'step / concept' },
      { g: '›', l: 'terminal prompt' },
      { g: '↪', l: 'result' },
      { g: '◉', l: 'person' },
      { g: '▤', l: 'company' },
      { g: '◆', l: 'event / eyebrow' },
      { g: '●', l: 'live status' },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="01.7 / icons + glyphs" title="Outline. " italic="2px. Round." lead="22 viewbox · 2px stroke · round caps. Acts/entity glyphs are typographic, not iconic." />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
          <div>
            <MicroLabel style={{ marginBottom: 12 }}>outline icons</MicroLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
            }}>
              {icons.map(n => (
                <div key={n} style={{
                  padding: '14px 8px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}>
                  <Icon name={n} size={22} color={T.color.ink} />
                  <span style={{ font: `500 9.5px/1 ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.3 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <MicroLabel style={{ marginBottom: 12 }}>typographic glyphs</MicroLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {glyphs.map(g => (
                <div key={g.g + g.l} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                  borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ font: `500 22px/1 ${T.font.mono}`, color: T.color.accent, width: 28, textAlign: 'center' }}>{g.g}</span>
                  <span style={{ font: `500 12.5px/1 ${T.font.mono}`, color: T.color.t70, letterSpacing: 0.4 }}>{g.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  Object.assign(window, {
    TokensColors, TokensType, TokensSpacing, TokensRadii, TokensShadows, TokensMotion, TokensIcons,
  });
})();
