import React, { useEffect, useState } from 'react'
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
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>
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
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState(null)

  useEffect(() => {
    let active = true

    async function refreshStatus() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
        if (!active) return
        setData(result)
        setError('')
        setCheckedAt(result.checkedAt)
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'Tidak dapat mengambil status bot.')
      }
    }

    refreshStatus()
    const timer = window.setInterval(refreshStatus, 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const bot = data?.bot
  const isOnline = bot?.status === 'online'
  const label = error ? 'Tidak terhubung' : (STATUS_LABELS[bot?.status] || 'Memeriksa status')
  const serverName = data?.server?.host
    ? `${data.server.host}${data.server.port ? `:${data.server.port}` : ''}`
    : 'Server dari settings.json'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="AFK Bot dashboard">
          <span className="brand-mark"><Icon name="activity" size={21} /></span>
          <span>BLOCK<span className="brand-light">KEEP</span></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <a className="nav-item active" href="#overview"><Icon name="grid" /> Overview</a>
        <a className="nav-item" href="#connection"><Icon name="server" /> Koneksi</a>
        <div className="sidebar-bottom">
          <div className="mini-status"><span className={`pulse ${isOnline ? 'green' : ''}`} />{label}</div>
          <div className="sidebar-note">Minecraft Java<br />AFK Control</div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="top-meta"><span className="live-dot" /> LIVE STATUS</div>
        </header>

        <section className="page-heading">
          <div>
            <div className="eyebrow">MINECRAFT SERVER MONITOR</div>
            <h1>Bot Control Center</h1>
            <p>Pantau koneksi bot dan aktivitas server kamu.</p>
          </div>
          <div className="updated-chip"><Icon name="clock" size={15} /> Update {formatTime(checkedAt)}</div>
        </section>

        <section className={`hero-card ${isOnline ? 'is-online' : ''}`}>
          <div className="hero-glow" />
          <div className="hero-copy">
            <div className="status-pill"><span className="pulse" />{label.toUpperCase()}</div>
            <h2>{isOnline ? 'Bot siap menjaga server.' : 'Menunggu koneksi bot.'}</h2>
            <p>{error || bot?.lastError || 'Dashboard melakukan pemeriksaan status secara berkala.'}</p>
          </div>
          <div className="hero-orb" aria-hidden="true">
            <div className="orb-ring ring-one" />
            <div className="orb-ring ring-two" />
            <div className="orb-core"><Icon name="activity" size={34} /></div>
          </div>
          <div className="hero-footer">
            <span><span className="pulse" /> AUTO-RECONNECT AKTIF</span>
            <span>Refresh otomatis · 15 detik</span>
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
            <a className="api-link" href="/api/status">Buka API status <Icon name="arrow" size={15} /></a>
          </article>
        </section>

        <footer className="footer"><span>BLOCKKEEP <span className="footer-sep">/</span> AFK MONITOR</span><span>Built for your Minecraft world</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BotDashboard />
  </React.StrictMode>
)
