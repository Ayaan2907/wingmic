// proto-app.jsx — App shell, routing, screen selector
(function () {
  const T = window.PT;
  const { Icon } = window;

  const MOBILE_SCREENS = [
    { id: 'onboarding',     label: '01 Onboarding',      group: 'Mobile' },
    { id: 'home',           label: '02 Home',             group: 'Mobile' },
    { id: 'chat',           label: '03 Chat · Resting',   group: 'Mobile' },
    { id: 'chat-recording', label: '04 Chat · Recording', group: 'Mobile' },
    { id: 'chat-locked',    label: '05 Chat · Locked',    group: 'Mobile' },
    { id: 'chat-response',  label: '06 Chat · Response',  group: 'Mobile' },
    { id: 'graph',          label: '07 Graph',            group: 'Mobile' },
    { id: 'person',         label: '08 Person Detail',    group: 'Mobile' },
    { id: 'company',        label: '09 Company Detail',   group: 'Mobile' },
    { id: 'event',          label: '10 Event Detail',     group: 'Mobile' },
    { id: 'acts',           label: '11 Acts Inbox',       group: 'Mobile' },
    { id: 'search',         label: '12 Search',           group: 'Mobile' },
    { id: 'settings',       label: '13 Settings',         group: 'Mobile' },
    { id: 'desktop-home',   label: 'D1 Desktop · Home',   group: 'Desktop' },
    { id: 'desktop-chat',   label: 'D2 Desktop · Chat',   group: 'Desktop' },
    { id: 'desktop-graph',  label: 'D3 Desktop · Graph',  group: 'Desktop' },
    { id: 'desktop-person', label: 'D4 Desktop · Person', group: 'Desktop' },
  ];

  function App() {
    const [screen, setScreen] = React.useState(() => localStorage.getItem('wm_screen') || 'onboarding');
    const [history, setHistory] = React.useState(['onboarding']);
    const [menuOpen, setMenuOpen] = React.useState(false);

    const navigate = React.useCallback((id) => {
      if (id === -1) {
        setHistory(h => {
          const prev = h.length > 1 ? h[h.length - 2] : h[0];
          setScreen(prev);
          localStorage.setItem('wm_screen', prev);
          return h.slice(0, -1);
        });
        return;
      }
      setScreen(id);
      localStorage.setItem('wm_screen', id);
      setHistory(h => [...h, id]);
    }, []);

    const isDesktop = screen.startsWith('desktop');

    const screenMap = {
      'onboarding':     () => <ScreenOnboarding onNavigate={navigate} />,
      'home':           () => <ScreenHome onNavigate={navigate} />,
      'chat':           () => <ScreenChatResting onNavigate={navigate} />,
      'chat-recording': () => <ScreenChatRecording onNavigate={navigate} />,
      'chat-locked':    () => <ScreenChatLocked onNavigate={navigate} />,
      'chat-response':  () => <ScreenChatResponse onNavigate={navigate} />,
      'graph':          () => <ScreenGraph onNavigate={navigate} />,
      'person':         () => <ScreenPerson onNavigate={navigate} />,
      'company':        () => <ScreenCompany onNavigate={navigate} />,
      'event':          () => <ScreenEvent onNavigate={navigate} />,
      'acts':           () => <ScreenActs onNavigate={navigate} />,
      'search':         () => <ScreenSearch onNavigate={navigate} />,
      'settings':       () => <ScreenSettings onNavigate={navigate} />,
      'desktop-home':   () => <ScreenDesktopHome onNavigate={navigate} />,
      'desktop-chat':   () => <ScreenDesktopChat onNavigate={navigate} />,
      'desktop-graph':  () => <ScreenDesktopGraph onNavigate={navigate} />,
      'desktop-person': () => <ScreenDesktopPerson onNavigate={navigate} />,
      'desktop-acts':   () => <ScreenActs onNavigate={navigate} />,
      'desktop-search': () => <ScreenSearch onNavigate={navigate} />,
    };

    const current = MOBILE_SCREENS.find(s => s.id === screen);

    return (
      <div style={{ minHeight: '100vh', background: '#050508', backgroundImage: 'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.04) 0%, transparent 55%), radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.025) 0%, transparent 55%)', display: 'flex', flexDirection: 'column', fontFamily: T.font.sans }}>
        {/* Top bar */}
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,5,8,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 1000, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: T.color.bgCard, border: `1px solid ${T.color.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={13} color={T.color.accent} />
            </div>
            <span style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>wingmic<span style={{ color: T.color.accent }}>.xyz</span></span>
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(255,196,82,0.12)', color: T.color.accent, font: `600 9px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase' }}>prototype</span>
          </div>
          {/* Screen selector */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: T.color.ink, font: `500 12.5px ${T.font.sans}`, cursor: 'pointer' }}>
              <span style={{ font: `600 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>
                {current ? (isDesktop ? '▭' : '☐') : '?'}
              </span>
              {current?.label || screen}
              <Icon name={menuOpen ? 'x' : 'arrowUp'} size={14} color={T.color.t55} style={{ transform: menuOpen ? 'none' : 'rotate(180deg)' }} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: '#0e0e12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.6)', overflow: 'hidden', minWidth: 240, zIndex: 2000 }}>
                {['Mobile', 'Desktop'].map(group => (
                  <div key={group}>
                    <div style={{ padding: '8px 14px 4px', font: `500 9.5px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase' }}>{group}</div>
                    {MOBILE_SCREENS.filter(s => s.group === group).map(s => (
                      <button key={s.id} onClick={() => { navigate(s.id); setMenuOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: screen === s.id ? 'rgba(255,196,82,0.08)' : 'transparent', border: 'none', cursor: 'pointer', color: screen === s.id ? T.color.accent : T.color.t70, font: `500 12.5px ${T.font.sans}`, textAlign: 'left' }}>
                        {screen === s.id && <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.color.accent, flexShrink: 0 }} />}
                        {screen !== s.id && <span style={{ width: 4, flexShrink: 0 }} />}
                        {s.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Nav arrows */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => {
              const all = MOBILE_SCREENS.map(s => s.id);
              const i = all.indexOf(screen);
              if (i > 0) navigate(all[i - 1]);
            }} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="arrowL" size={14} color={T.color.t55} />
            </button>
            <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40 }}>
              {(MOBILE_SCREENS.findIndex(s => s.id === screen) + 1) || '?'} / {MOBILE_SCREENS.length}
            </span>
            <button onClick={() => {
              const all = MOBILE_SCREENS.map(s => s.id);
              const i = all.indexOf(screen);
              if (i < all.length - 1) navigate(all[i + 1]);
            }} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="arrowR" size={14} color={T.color.t55} />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', alignItems: isDesktop ? 'flex-start' : 'flex-start', justifyContent: 'center', padding: isDesktop ? '32px 40px' : '32px 24px', overflowY: 'auto' }}>
          {(screenMap[screen] || screenMap['home'])()}
        </div>

        {/* Screen flow hint */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.5 }}>← → arrow keys · use screen picker above · tap nav / buttons to move between screens</span>
        </div>
      </div>
    );
  }

  // keyboard nav
  document.addEventListener('keydown', e => {
    const all = MOBILE_SCREENS.map(s => s.id);
    const cur = localStorage.getItem('wm_screen') || 'onboarding';
    const i = all.indexOf(cur);
    if (e.key === 'ArrowRight' && i < all.length - 1) {
      localStorage.setItem('wm_screen', all[i + 1]);
      window.__forceUpdate && window.__forceUpdate();
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      localStorage.setItem('wm_screen', all[i - 1]);
      window.__forceUpdate && window.__forceUpdate();
    }
  });

  window.WingmicApp = App;
})();
