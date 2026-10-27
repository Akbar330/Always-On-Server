import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './ui.css'

const STATUS_LABELS = {
  starting: 'Memulai bot',
  connecting: 'Menghubungkan',
  joining: 'Masuk ke dunia',
  online: 'Online',
  disconnected: 'Terputus',
  reconnecting: 'Menyambungkan ulang',
  stopped: 'Berhenti'
}

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    terminal: <><path d="m4 17 6-5-6-5M12 19h8" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function formatTime(value) {
  if (!value) return 'Belum ada'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Belum ada'
    : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function BotDashboard() {
  const [token, setToken] = useState(() => window.sessionStorage.getItem('dashboardToken') || '')
  const [tokenDraft, setTokenDraft] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState(null)
  const [logs, setLogs] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [botActionError, setBotActionError] = useState('')
  const [botActionBusy, setBotActionBusy] = useState(false)
  const logsRef = useRef(null)
  const logCursor = useRef(0)
  const logInstance = useRef(null)

  useEffect(() => {
    if (!token) return undefined
    let active = true

    async function apiFetch(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers
        }
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
      return result
    }

    async function refreshStatus() {
      try {
        const result = await apiFetch('/api/status')
        const after = logInstance.current && logInstance.current !== result.instanceId
          ? 0
          : logCursor.current
        const logResult = await apiFetch(`/api/logs?after=${after}`)
        if (!active) return
        setData(result)
        setError('')
        setCheckedAt(result.checkedAt)
        if (logInstance.current !== logResult.instanceId) {
          logInstance.current = logResult.instanceId
          logCursor.current = 0
          setLogs(logResult.logs)
        } else if (logResult.logs.length) {
          logCursor.current = logResult.logs[logResult.logs.length - 1].id
          setLogs((previous) => [...previous, ...logResult.logs].slice(-150))
        }
        if (logResult.logs.length) {
          logCursor.current = logResult.logs[logResult.logs.length - 1].id
        }
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Tidak dapat mengambil status bot.')
      }
    }

    refreshStatus()
    const timer = window.setInterval(refreshStatus, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [token])

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight
  }, [logs])

  function unlockDashboard(event) {
    event.preventDefault()
    const value = tokenDraft.trim()
    if (!value) return
    window.sessionStorage.setItem('dashboardToken', value)
    setToken(value)
    setTokenDraft('')
    setError('')
  }

  function lockDashboard() {
    window.sessionStorage.removeItem('dashboardToken')
    setToken('')
    setData(null)
    setLogs([])
    logCursor.current = 0
    logInstance.current = null
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setChatError('')
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
      setMessage('')
    } catch (sendError) {
      setChatError(sendError.message)
    } finally {
      setSending(false)
    }
  }

  async function manageBot(method, username) {
    setBotActionBusy(true)
    setBotActionError('')
    try {
      const response = await fetch('/api/bots', {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        ...(username ? { body: JSON.stringify({ username }) } : {})
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
      setBotUsername('')
      setData((previous) => previous ? { ...previous, bots: result.bots, maxBots: result.maxBots } : previous)
    } catch (requestError) {
      setBotActionError(requestError.message)
    } finally {
      setBotActionBusy(false)
    }
  }

  function addBot(event) {
    event.preventDefault()
    if (!botUsername.trim() || botActionBusy) return
    manageBot('POST', botUsername.trim())
  }

  const bot = data?.bot
  const isOnline = bot?.status === 'online'
  const label = error ? 'Tidak terhubung' : (STATUS_LABELS[bot?.status] || 'Memeriksa status')
  const serverName = data?.server?.host
    ? `${data.server.host}${data.server.port ? `:${data.server.port}` : ''}`
    : 'Server dari settings.json'

  if (!token) {
    return (
      <div className="access-screen">
        <form className="access-card" onSubmit={unlockDashboard}>
          <span className="brand-mark"><Icon name="terminal" size={21} /></span>
          <div className="eyebrow">AKSES DASHBOARD</div>
          <h1>Masuk ke dashboard</h1>
          <p>Atur <code>DASHBOARD_TOKEN</code> minimal 32 karakter di Vercel Environment Variables. Token ini melindungi log dan kontrol chat bot.</p>
          <input
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Dashboard token"
            type="password"
            value={tokenDraft}
          />
          <button className="send-button" type="submit">Lanjutkan <Icon name="arrow" size={15} /></button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="AFK Bot dashboard">
          <span className="brand-mark"><Icon name="activity" size={21} /></span>
          <span>SERVER<span className="brand-light">PANEL</span></span>
        </a>
        <div className="side-label">MENU</div>
        <a className="nav-item active" href="#overview"><Icon name="grid" /> Overview</a>
        <a className="nav-item" href="#connection"><Icon name="server" /> Koneksi</a>
        <a className="nav-item" href="#players"><Icon name="users" /> Pemain</a>
        <a className="nav-item" href="#bots"><Icon name="server" /> Bot</a>
        <a className="nav-item" href="#console"><Icon name="terminal" /> Console</a>
        <div className="sidebar-bottom">
          <div className="mini-status"><span className={`pulse ${isOnline ? 'green' : ''}`} />{label}</div>
          <div className="sidebar-note">Minecraft Java<br />AFK Control</div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="top-actions">          <div className="top-meta"><span className="live-dot" /> STATUS LANGSUNG</div><button className="lock-button" onClick={lockDashboard} type="button">Keluar</button></div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow">RINGKASAN SERVER</div>
            <h1>Panel server</h1>
            <p>Status koneksi, pemain, dan bot Minecraft.</p>
          </div>
          <div className="updated-chip"><Icon name="clock" size={15} /> Update {formatTime(checkedAt)}</div>
        </section>

        <section className={`hero-card ${isOnline ? 'is-online' : ''}`}>
          <div className="hero-copy">
            <div className="status-pill"><span className={`pulse ${isOnline ? 'green' : ''}`} />{label.toUpperCase()}</div>
            <h2>{isOnline ? 'Bot terhubung' : 'Bot belum terhubung'}</h2>
            <p>{error || bot?.lastError || 'Dashboard melakukan pemeriksaan status secara berkala.'}</p>
          </div>
          <div className="hero-footer">
            <span><span className={`pulse ${isOnline ? 'green' : ''}`} /> SAMBUNG ULANG OTOMATIS</span>
            <span>Pembaruan setiap 5 detik</span>
          </div>
        </section>

        <section className="metrics-grid" aria-label="Informasi bot">
          <article className="metric-card">
            <div className="metric-label"><span className="metric-icon"><Icon name="server" /></span> SERVER</div>
            <div className="metric-value server-value">{serverName}</div>
            <div className="metric-sub">Minecraft Java Edition</div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span className="metric-icon"><Icon name="activity" /></span> PLAYER</div>
            <div className="metric-value">{bot?.username || '—'}</div>
            <div className="metric-sub">Mode login: {bot?.type || data?.server?.type || '—'}</div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span className="metric-icon"><Icon name="refresh" /></span> RECONNECT</div>
            <div className="metric-value">{bot?.reconnectAttempts ?? '—'}</div>
            <div className="metric-sub">Percobaan koneksi ulang</div>
          </article>
          <article className="metric-card">
            <div className="metric-label"><span className="metric-icon"><Icon name="clock" /></span> LAST ACTIVITY</div>
            <div className="metric-value">{formatTime(bot?.lastActivityAt)}</div>
            <div className="metric-sub">Aktivitas anti-AFK terakhir</div>
          </article>
        </section>

        <section className="people-grid" id="players">
          <article className="info-card players-card">
            <div className="section-title">
              <span className="metric-icon"><Icon name="users" /></span>
              <div><h3>Pemain di server</h3><p>Daftar berdasarkan tab list yang diterima bot</p></div>
              <span className="section-count">{data?.players?.length ?? 0}</span>
            </div>
            <div className="people-list">
              {data?.players?.length ? data.players.map((player) => (
                <div className="person-row" key={player.uuid || player.username}>
                  <span className={`avatar ${player.isBot ? 'bot-avatar' : ''}`}>{player.username.slice(0, 1).toUpperCase()}</span>
                  <div className="person-name">{player.username}<span>{player.isBot ? 'BOT' : 'PLAYER'}</span></div>
                  <span className={`person-state ${player.isBot ? 'bot-state' : ''}`}>{player.isBot ? 'BOT' : 'ONLINE'}</span>
                </div>
              )) : <div className="empty-people">{isOnline ? 'Belum ada data pemain dari server.' : 'Daftar pemain tersedia setelah bot tersambung.'}</div>}
            </div>
          </article>

          <article className="info-card bots-card" id="bots">
            <div className="section-title">
              <span className="metric-icon"><Icon name="server" /></span>
              <div><h3>Bot aktif</h3><p>Maksimal {data?.maxBots || 3} bot di runtime ini</p></div>
              <span className="section-count">{data?.bots?.length || 0}/{data?.maxBots || 3}</span>
            </div>
            <div className="bot-list">
              {(data?.bots || []).map((managedBot) => (
                <div className="person-row" key={managedBot.username}>
                  <span className={`avatar ${managedBot.status === 'online' ? 'bot-avatar' : ''}`}>{managedBot.username.slice(0, 1).toUpperCase()}</span>
                  <div className="person-name">{managedBot.username}<span>{STATUS_LABELS[managedBot.status] || managedBot.status}</span></div>
                  {!managedBot.primary && <button aria-label={`Hapus bot ${managedBot.username}`} className="icon-button" disabled={botActionBusy} onClick={() => manageBot('DELETE', managedBot.username)} type="button"><Icon name="trash" size={15} /></button>}
                </div>
              ))}
              {!data?.bots?.length && <div className="empty-people">Bot belum dimulai.</div>}
            </div>
            <form className="add-bot-form" onSubmit={addBot}>
              <input
                autoComplete="off"
                maxLength={16}
                onChange={(event) => setBotUsername(event.target.value)}
                placeholder="Nama akun offline"
                value={botUsername}
              />
              <button className="send-button" disabled={botActionBusy || !botUsername.trim() || (data?.bots?.length || 0) >= (data?.maxBots || 3)} type="submit">
                <Icon name="plus" size={15} /> Tambah
              </button>
            </form>
            {botActionError && <p className="chat-error" role="alert">{botActionError}</p>}
            <p className="small-note">Bot tambahan hanya hidup di instance runtime ini. Batas total: 3, termasuk bot utama.</p>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="info-card" id="connection">
            <div className="section-title"><span className="metric-icon"><Icon name="server" /></span><div><h3>Detail koneksi</h3><p>Ringkasan koneksi server Minecraft</p></div></div>
            <div className="detail-row"><span>Status bot</span><strong className={isOnline ? 'text-green' : ''}>{label}</strong></div>
            <div className="detail-row"><span>Terhubung sejak</span><strong>{formatTime(bot?.connectedAt)}</strong></div>
            <div className="detail-row"><span>Pemeriksaan terakhir</span><strong>{formatTime(checkedAt)}</strong></div>
          </article>
          <article className="info-card">
            <div className="section-title"><span className="metric-icon"><Icon name="activity" /></span><div><h3>Catatan</h3><p>Informasi deployment</p></div></div>
            <p className="note-copy">Mode login saat ini <strong>offline</strong>, sesuai nilai <code>type</code> di <code>settings.json</code>. Jika status <code>socketClosed</code> muncul, itu masalah koneksi server/runtime, bukan jenis autentikasi.</p>
            <p className="note-copy">Log disimpan sementara di memori runtime; runtime Vercel baru dapat memiliki log terpisah.</p>
          </article>
        </section>

        <section className="console-card" id="console">
          <div className="console-heading">
            <div className="section-title"><span className="metric-icon"><Icon name="terminal" /></span><div><h3>Minecraft Console</h3><p>Kirim chat atau command game; bukan shell OS</p></div></div>
            <span className="console-count">{logs.length} LOG</span>
          </div>
          <div aria-live="polite" className="log-window" ref={logsRef}>
            {logs.length ? logs.map((entry) => (
              <div className={`log-line log-${entry.level}`} key={entry.id}>
                <time>{formatTime(entry.at)}</time>
                <span className="log-source">[{entry.source}]</span>
                <span className="log-message">{entry.message}</span>
              </div>
            )) : <div className="empty-logs">Belum ada log. Log koneksi dan chat akan muncul di sini.</div>}
          </div>
          {chatError && <p className="chat-error" role="alert">{chatError}</p>}
          <form className="console-input" onSubmit={sendMessage}>
            <span className="prompt">&gt;_</span>
            <input
              aria-label="Pesan atau command Minecraft"
              disabled={!data?.server?.chatEnabled || sending}
              maxLength={256}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={data?.server?.chatEnabled ? 'Tulis pesan atau /command...' : 'Aktifkan modules.chat di settings.json'}
              value={message}
            />
            <button className="send-button" disabled={!data?.server?.chatEnabled || sending || !message.trim()} type="submit">
              {sending ? 'Mengirim...' : 'Kirim'} <Icon name="send" size={15} />
            </button>
          </form>
          {data?.server?.consoleCommandsEnabled && <div className="console-hint">Command diawali <code>/</code> akan dikirim ke chat Minecraft menggunakan izin akun bot.</div>}
        </section>

        <footer className="footer"><span>SERVER PANEL <span className="footer-sep">/</span> MINECRAFT</span><span>Waktu server mengikuti runtime</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BotDashboard />
  </React.StrictMode>
)
