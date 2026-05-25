// library/lib-atoms.jsx — buttons, inputs, pills, cards, avatars, etc.
(function () {
  const T = window.WMT;
  const { ArtboardFrame, ABTitle, MicroLabel, TokenTag, Pill, Avatar, EntityTag,
          Sticker, Scribble, ActivityRow, Stat, Icon, Wordmark } = window;

  // ── reusable spec row (left side = visual, right side = annotation) ──
  function SpecRow({ children, label, note, gap = 14 }) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
        padding: '20px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap, alignItems: 'center' }}>{children}</div>
        <div style={{ textAlign: 'right', minWidth: 220 }}>
          {label && <div style={{ font: `600 11px/1.4 ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>{label}</div>}
          {note  && <div style={{ font: `400 11.5px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>{note}</div>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // BUTTONS
  // ─────────────────────────────────────────────────────────────────────
  function Btn({ variant = 'primary', size = 'md', children, leading, trailing, disabled, style }) {
    const sizes = {
      sm: { pad: '8px 14px', fs: 12.5, gap: 6, icon: 14 },
      md: { pad: '13px 22px', fs: 14.5, gap: 8, icon: 16 },
      lg: { pad: '16px 26px', fs: 15.5, gap: 9, icon: 18 },
    }[size];

    const variants = {
      primary:     { bg: T.color.accent, fg: '#000', bd: '1.5px solid #000', sh: '4px 4px 0 #000' },
      destructive: { bg: T.color.alarm,  fg: '#000', bd: '1.5px solid #000', sh: '4px 4px 0 #000' },
      secondary:   { bg: '#ffffff',     fg: '#000', bd: '1px solid rgba(255,255,255,0.15)', sh: 'none' },
      ghost:       { bg: 'transparent', fg: '#fff', bd: '1.5px solid rgba(255,255,255,0.22)', sh: 'none' },
      mono:        { bg: T.color.bgCard, fg: T.color.accent, bd: `1px solid ${T.color.accent}40`, sh: 'none', font: T.font.mono },
    }[variant];

    return (
      <button disabled={disabled} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        padding: sizes.pad, borderRadius: 10,
        background: variants.bg, color: variants.fg,
        font: `700 ${sizes.fs}px ${variants.font || T.font.sans}`,
        border: variants.bd, boxShadow: variants.sh,
        cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        opacity: disabled ? 0.45 : 1, letterSpacing: variant === 'mono' ? 0.3 : 0,
        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out',
        ...style,
      }}>
        {leading && <Icon name={leading} size={sizes.icon} />}
        <span>{children}</span>
        {trailing && <Icon name={trailing} size={sizes.icon} />}
      </button>
    );
  }

  function AtomsButtons() {
    return (
      <ArtboardFrame padding={36} scrollY>
        <ABTitle eyebrow="02.1 / buttons" title="Brutalist offset. " italic="Earnest." lead="Hard offset shadow on primary + destructive. Ghost for secondary. Mono for terminal contexts." />

        <SpecRow label="<Btn variant='primary'>" note="amber on ink · 1.5px black border · 4px offset">
          <Btn variant="primary" size="sm">Send</Btn>
          <Btn variant="primary" size="md" trailing="arrowR">Send now</Btn>
          <Btn variant="primary" size="lg" leading="sparkle">Start capture</Btn>
        </SpecRow>

        <SpecRow label="<Btn variant='ghost'>" note="transparent · 22% white border · pairs with primary">
          <Btn variant="ghost" size="sm">Skip</Btn>
          <Btn variant="ghost" size="md">Edit draft</Btn>
          <Btn variant="ghost" size="lg" leading="x">Discard</Btn>
        </SpecRow>

        <SpecRow label="<Btn variant='destructive'>" note="alarm red · same brutal silhouette">
          <Btn variant="destructive" size="sm">Delete</Btn>
          <Btn variant="destructive" size="md" leading="trash">Discard recording</Btn>
        </SpecRow>

        <SpecRow label="<Btn variant='mono'>" note="bg-card · accent text · for terminal / dev contexts">
          <Btn variant="mono" size="sm">› npm i wingmic</Btn>
          <Btn variant="mono" size="md">› wingmic.contacts.search</Btn>
        </SpecRow>

        <SpecRow label="<Btn variant='secondary'>" note="white surface · use sparingly · CTA on dark hero">
          <Btn variant="secondary" size="md">Sign in with Apple</Btn>
          <Btn variant="secondary" size="md" leading="check">Connected</Btn>
        </SpecRow>

        <SpecRow label="disabled / loading" note="opacity 0.45 · pointer-events: none">
          <Btn variant="primary" size="md" disabled>Send now</Btn>
          <Btn variant="ghost" size="md" disabled>Edit draft</Btn>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 22px', borderRadius: 10, background: T.color.accent, color: '#000',
            font: `700 14.5px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
            cursor: 'wait',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#000',
              animation: 'wm-spin 0.8s linear infinite',
            }} /> Sending…
          </button>
        </SpecRow>

        <SpecRow label="icon button" note="round · 44px hit · for chrome">
          <button style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
          }}><Icon name="plus" size={20} /></button>
          <button style={{
            width: 44, height: 44, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#000', cursor: 'pointer',
          }}><Icon name="send" size={18} color="#000" /></button>
          <button style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'transparent', border: '1.5px solid rgba(255,255,255,0.22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer',
          }}><Icon name="search" size={20} /></button>
          <button style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.4)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.color.alarm, cursor: 'pointer',
          }}><Icon name="trash" size={18} color={T.color.alarm} /></button>
        </SpecRow>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // INPUTS
  // ─────────────────────────────────────────────────────────────────────
  function FieldFrame({ leading, trailing, children, focused = false, style }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: focused ? `1.5px solid ${T.color.accent}` : '1px solid rgba(255,255,255,0.08)',
        boxShadow: focused ? '0 0 0 4px rgba(255,196,82,0.08)' : 'none',
        ...style,
      }}>
        {leading}
        <div style={{ flex: 1, minWidth: 0, color: T.color.ink, font: `400 14.5px ${T.font.sans}` }}>{children}</div>
        {trailing}
      </div>
    );
  }
  function AtomsInputs() {
    return (
      <ArtboardFrame padding={36} scrollY>
        <ABTitle eyebrow="02.2 / inputs" title="Quiet on rest. " italic="Loud on focus." lead="Amber ring + 4px halo on focus. Mono caret. Voice-toggle right-anchored." />

        <MicroLabel style={{ marginBottom: 10 }}>text · resting</MicroLabel>
        <FieldFrame style={{ marginBottom: 18 }}>
          <span style={{ color: T.color.t30 }}>name your contact</span>
        </FieldFrame>

        <MicroLabel style={{ marginBottom: 10 }}>text · filled</MicroLabel>
        <FieldFrame style={{ marginBottom: 18 }}>
          <span style={{ color: T.color.ink }}>Sarah Chen — Acme Corp</span>
          <Icon name="check" size={18} color={T.color.second} />
        </FieldFrame>

        <MicroLabel style={{ marginBottom: 10 }}>text · focused</MicroLabel>
        <FieldFrame focused style={{ marginBottom: 18 }}>
          <span style={{ color: T.color.ink }}>Sarah Che<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} /></span>
        </FieldFrame>

        <MicroLabel style={{ marginBottom: 10 }}>text · error</MicroLabel>
        <FieldFrame style={{ marginBottom: 6, borderColor: `${T.color.alarm}60`, boxShadow: '0 0 0 4px rgba(255,107,107,0.08)' }}>
          <span style={{ color: T.color.ink }}>not-an-email</span>
          <Icon name="x" size={18} color={T.color.alarm} />
        </FieldFrame>
        <div style={{ font: `500 11px/1.4 ${T.font.mono}`, color: T.color.alarm, marginBottom: 22, letterSpacing: 0.2 }}>↪ needs to be an email address.</div>

        <MicroLabel style={{ marginBottom: 10 }}>search</MicroLabel>
        <FieldFrame style={{ marginBottom: 18 }} leading={<Icon name="search" size={18} color={T.color.t55} />} trailing={
          <span style={{ font: `500 10.5px/1 ${T.font.mono}`, color: T.color.t40, padding: '3px 7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>⌘ K</span>
        }>
          <span style={{ color: T.color.t40 }}>search graph · "rust at acme"</span>
        </FieldFrame>

        <MicroLabel style={{ marginBottom: 10 }}>chat composer · voice-first</MicroLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 10px 10px 16px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 18,
        }}>
          <span style={{ flex: 1, color: T.color.t40, font: `400 14.5px ${T.font.sans}` }}>ask wingmic…</span>
          <button style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="plus" size={18} color={T.color.t70} /></button>
          <button style={{
            width: 46, height: 46, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="mic" size={20} color="#000" /></button>
        </div>

        <MicroLabel style={{ marginBottom: 10 }}>chat composer · transcribing</MicroLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 999,
          background: 'rgba(255,196,82,0.06)', border: `1.5px solid ${T.color.accent}50`,
          marginBottom: 6,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-d 1s ease-in-out infinite' }} />
          <span style={{ flex: 1, color: T.color.ink, font: `400 14.5px ${T.font.sans}` }}>
            met sarah from acme, rust lead<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, verticalAlign: 'text-bottom', marginLeft: 2, animation: 'wm-blink 0.7s step-end infinite' }} />
          </span>
          <span style={{ font: `600 11px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>0:12</span>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // PILLS + CHIPS
  // ─────────────────────────────────────────────────────────────────────
  function AtomsPills() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.3 / pills + chips" title="20% alpha." italic="Full-color text." lead="Color = entity kind. Mono = chrome, sans = social. Never both in one row." />

        <SpecRow label="<EntityTag>" note="entity-typed · 20% bg, full color text">
          <EntityTag kind="person">Sarah Chen</EntityTag>
          <EntityTag kind="company">Acme Corp</EntityTag>
          <EntityTag kind="concept">edge config</EntityTag>
          <EntityTag kind="event">DevConnect 2026</EntityTag>
          <EntityTag kind="place">Sightglass · 7th</EntityTag>
        </SpecRow>

        <SpecRow label="<Pill mono>" note="UI metadata · uppercase · tracked">
          <Pill color={T.color.accent} mono>open beta</Pill>
          <Pill color={T.color.second} mono>● live</Pill>
          <Pill color={T.color.alarm} mono>● now</Pill>
          <Pill color={T.color.t70} mono>step 01</Pill>
          <Pill color={T.color.accent} mono size="lg">↗ check-in · 92%</Pill>
        </SpecRow>

        <SpecRow label="<Pill>" note="sans · sentence case · taggy">
          <Pill>#engineering</Pill>
          <Pill>#rust</Pill>
          <Pill>#follow-up</Pill>
          <Pill color={T.color.third}>#warm</Pill>
        </SpecRow>

        <SpecRow label="filter chips · selectable" note="white-fill when selected, bordered when not">
          <span style={{
            padding: '7px 13px', borderRadius: 999,
            background: '#fff', color: '#000',
            font: `600 12px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
            border: '1px solid #fff',
          }}>Pending · 5</span>
          <span style={{
            padding: '7px 13px', borderRadius: 999,
            background: 'rgba(255,255,255,0.04)', color: T.color.t55,
            font: `600 12px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>Sent · 12</span>
          <span style={{
            padding: '7px 13px', borderRadius: 999,
            background: 'rgba(255,255,255,0.04)', color: T.color.t55,
            font: `600 12px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>All</span>
        </SpecRow>

        <SpecRow label="status dot" note="6px · pulse-d 1.6s">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `500 12px ${T.font.mono}`, color: T.color.second }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s ease-in-out infinite' }} />
            connected
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `500 12px ${T.font.mono}`, color: T.color.alarm }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.alarm, animation: 'wm-pulse-d 1.6s ease-in-out infinite' }} />
            recording
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `500 12px ${T.font.mono}`, color: T.color.t40 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.t40 }} />
            offline
          </span>
        </SpecRow>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CARDS
  // ─────────────────────────────────────────────────────────────────────
  function AtomsCards() {
    const cards = [
      { name: 'default', sx: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }, note: 'card base · most content' },
      { name: 'raised',  sx: { background: '#0e0e12', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 14px 30px rgba(0,0,0,0.45)' }, note: 'lifted · floats above page' },
      { name: 'inset',   sx: { background: '#06060a', border: '1px solid rgba(255,255,255,0.06)' }, note: 'recessed · for quotes, drafts' },
      { name: 'brutal',  sx: { background: '#08080d', border: '1.5px solid #000', boxShadow: '4px 4px 0 #000' }, note: 'CTAs · hero feature · loud' },
      { name: 'glow',    sx: { background: '#08080d', border: '1px solid rgba(255,196,82,0.3)', boxShadow: '0 14px 30px rgba(0,0,0,0.45), 0 0 60px rgba(255,196,82,0.15)' }, note: 'agent activity · live event' },
      { name: 'ghost',   sx: { background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.15)' }, note: 'empty · placeholder' },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.4 / cards" title="Six surfaces. " italic="Each is a promise." lead="Every card has a 1px translucent border. Buttons hard shadow. Cards soft drop." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {cards.map(c => (
            <div key={c.name}>
              <div style={{
                ...c.sx, borderRadius: 14, padding: 18, minHeight: 150,
                color: T.color.ink, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ font: `500 10.5px/1 ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase' }}>card · {c.name}</span>
                  {c.name === 'glow' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-d 1.6s ease-in-out infinite' }} />}
                </div>
                <div>
                  <div style={{ font: `700 16px/1.3 ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                  <div style={{ font: `400 12.5px/1.4 ${T.font.mono}`, color: T.color.t55, marginTop: 4 }}>Rust Lead · Acme Corp</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ font: `600 11px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>&lt;Card tone="{c.name}"&gt;</div>
                <div style={{ font: `400 11.5px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>{c.note}</div>
              </div>
            </div>
          ))}
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // AVATARS + PERSON CARD
  // ─────────────────────────────────────────────────────────────────────
  function AtomsAvatars() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.5 / avatars" title="A single initial." italic="A flat color." lead="Square (entity chip) or round (chat). Color hashed from the initial. Never random." />
        <SpecRow label="round · sans" note="for chat threads · contact lists">
          <Avatar name="Sarah" size={24} />
          <Avatar name="Marcus" size={32} />
          <Avatar name="Priya" size={40} />
          <Avatar name="Alex"  size={56} />
          <Avatar name="Deepak" size={72} />
        </SpecRow>
        <SpecRow label="square · for acts" note="22px monogram on bright tile · radius 10">
          <Avatar name="Sarah"  size={32} square color={T.color.accent} />
          <Avatar name="Marcus" size={32} square color={T.color.blue} />
          <Avatar name="Priya"  size={32} square color={T.color.violet} />
          <Avatar name="Alex"   size={32} square color={T.color.third} />
          <Avatar name="Deepak" size={32} square color={T.color.second} />
        </SpecRow>
        <SpecRow label="stacked" note="for shared-with / participants">
          <div style={{ display: 'inline-flex' }}>
            {['Sarah','Marcus','Priya','Alex'].map((n, i) => (
              <div key={n} style={{ marginLeft: i ? -10 : 0, border: `2px solid ${T.color.bg}`, borderRadius: '50%' }}>
                <Avatar name={n} size={32} />
              </div>
            ))}
            <div style={{ marginLeft: -10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: `2px solid ${T.color.bg}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: `700 11px ${T.font.mono}`, color: T.color.t70 }}>+9</div>
          </div>
        </SpecRow>

        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {/* Person card — compact */}
          <div style={{
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name="Sarah" size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55 }}>Rust Lead · Acme Corp</div>
              </div>
              <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t30 }}>2h</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <Pill size="sm">#engineering</Pill>
              <Pill size="sm">#rust</Pill>
              <Pill size="sm" color={T.color.accent}>follow-up</Pill>
            </div>
          </div>

          {/* Person card — wide */}
          <div style={{
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: 16, display: 'flex', gap: 14,
          }}>
            <Avatar name="Marcus" size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `700 16px ${T.font.sans}`, color: T.color.ink }}>Marcus Rivera</div>
              <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>CTO · Dataweave</div>
              <div style={{ font: `400 13px/1.5 ${T.font.sans}`, color: T.color.t70, marginTop: 8 }}>
                Building a competing graph DB. Coffee next Mon.
              </div>
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // STICKERS + SCRIBBLES + TAPE
  // ─────────────────────────────────────────────────────────────────────
  function AtomsStickers() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.6 / stickers" title="Pinned in the " italic="negative space." lead="±2–6° rotation, hard offset shadow, all caps mono. Never on top of body copy." />

        <SpecRow label="<Sticker color size>" note="sm · md · lg · rotate -6..+6">
          <Sticker color={T.color.accent} size="sm" rotate={-4}>v0.1 beta</Sticker>
          <Sticker color={T.color.second} size="md" rotate={3}>open beta</Sticker>
          <Sticker color={T.color.third}  size="md" rotate={-2}>voice-first</Sticker>
          <Sticker color={T.color.blue}   size="lg" rotate={5}>MIT @ GA</Sticker>
        </SpecRow>

        <SpecRow label="<Scribble color>" note="hand-drawn SVG underline · one word per heading">
          <span style={{ font: `800 28px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
            Stop <Scribble color={T.color.accent}>forgetting</Scribble>.
          </span>
        </SpecRow>

        <SpecRow label="tape strip" note="decorative · pinned at edge · rotation OK">
          <div style={{ position: 'relative', width: 220, height: 60 }}>
            <div style={{
              position: 'absolute', top: 6, left: 30, width: 90, height: 18,
              background: 'rgba(255,196,82,0.18)', border: '1px dashed rgba(255,196,82,0.4)',
              transform: 'rotate(-5deg)',
            }} />
            <div style={{
              position: 'absolute', top: 32, left: 60, width: 110, height: 18,
              background: 'rgba(255,143,171,0.18)', border: '1px dashed rgba(255,143,171,0.4)',
              transform: 'rotate(3deg)',
            }} />
          </div>
        </SpecRow>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────────────
  function AtomsStats() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.7 / stat block" title="One italic " italic="numeral." lead="Instrument Serif italic · 56–180px · paired with a mono uppercase label. Drift-up loop." />
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 16 }}>
          <Stat value="12" label="people met" sub="DevConnect '26" color={T.color.accent} rotate={-2} />
          <Stat value="3"  label="follow-ups drafted" sub="agent · last 24h" color={T.color.second} rotate={1} />
          <Stat value="92%" label="recall" sub="when you asked" color={T.color.third} rotate={-1} />
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // ACTIVITY ROW
  // ─────────────────────────────────────────────────────────────────────
  function AtomsActivity() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.8 / activity row" title="Mono ticker. " italic="One line." lead="Live commit log style — who · what · detail · time. Use for activity feeds + audit." />
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '4px 16px' }}>
          <ActivityRow who="sarah_chen"   what="commit"     detail="met at DevConnect 2026 · 4 edges" time="14:32" color={T.color.accent} />
          <ActivityRow who="marcus_rivera" what="commit"     detail="coffee scheduled · sightglass · 9am mon" time="15:10" color={T.color.blue} />
          <ActivityRow who="priya_sharma"  what="enriched"   detail="speaker diarization paper attached" time="16:45" color={T.color.violet} />
          <ActivityRow who="agent"         what="drafted"    detail="check-in to sarah · 92% confidence" time="06:12" color={T.color.second} />
          <ActivityRow who="you"           what="sent"       detail="github.com/me/edge-reload" time="08:00" color={T.color.third} />
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // BOTTOM NAV
  // ─────────────────────────────────────────────────────────────────────
  function AtomsNav() {
    function NavBar({ active, variant = 'a' }) {
      const items = [
        { k: 'home',  icon: 'home',  label: 'home' },
        { k: 'chat',  icon: 'chat',  label: 'chat' },
        { k: 'mic',   icon: 'mic',   label: 'capture', big: true },
        { k: 'graph', icon: 'graph', label: 'graph' },
        { k: 'acts',  icon: 'bell',  label: 'acts' },
      ];
      return (
        <div style={{
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: variant === 'a' ? 18 : 999,
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          width: 360,
        }}>
          {items.map(it => {
            const isActive = active === it.k;
            if (it.big) {
              return (
                <div key={it.k} style={{ position: 'relative' }}>
                  <button style={{
                    width: 50, height: 50, borderRadius: '50%',
                    background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}><Icon name="mic" size={22} color="#000" /></button>
                </div>
              );
            }
            return (
              <button key={it.k} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '6px 8px',
                color: isActive ? T.color.accent : T.color.t40,
              }}>
                <Icon name={it.icon} size={20} color={isActive ? T.color.accent : T.color.t55} />
                <span style={{ font: `600 9.5px/1 ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>{it.label}</span>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="02.9 / bottom nav" title="The capture button " italic="lifts." lead="Five slots. The center is the mic — always primary, always brutal. Two variants: rounded rect or pill." />

        <SpecRow label="rounded · variant A" note="floats over content w/ 16px page padding">
          <NavBar active="home" variant="a" />
        </SpecRow>
        <SpecRow label="pill · variant B" note="for full-bleed surfaces · more iOS-modern">
          <NavBar active="graph" variant="b" />
        </SpecRow>
      </ArtboardFrame>
    );
  }

  Object.assign(window, {
    AtomsButtons, AtomsInputs, AtomsPills, AtomsCards,
    AtomsAvatars, AtomsStickers, AtomsStats, AtomsActivity, AtomsNav,
    Btn,
  });
})();
