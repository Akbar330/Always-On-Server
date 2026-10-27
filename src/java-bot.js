'use strict'

const mineflayer = require('mineflayer')
const { addLog } = require('./log-store')

const MIN_RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_DELAY_MS = 60000
const SNEAK_DURATION_MS = 1500

function describeReason(reason) {
  if (typeof reason === 'string') return reason
  if (reason instanceof Error) return reason.message
  if (reason === undefined || reason === null) return ''

  try {
    return JSON.stringify(reason)
  } catch {
    return String(reason)
  }
}

function createJavaBot(config) {
  const state = {
    status: 'starting',
    username: config.username,
    type: config.type,
    reconnectAttempts: 0,
    connectedAt: null,
    lastActivityAt: null,
    lastError: null
  }

  let bot
  let activityTimer
  let releaseSneakTimer
  let reconnectTimer
  let yaw = 0
  let stopped = false

  function clearActivityTimers() {
    clearInterval(activityTimer)
    clearTimeout(releaseSneakTimer)
    activityTimer = undefined
    releaseSneakTimer = undefined
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return

    state.reconnectAttempts += 1
    const exponent = Math.min(state.reconnectAttempts - 1, 5)
    const delay = Math.min(
      MIN_RECONNECT_DELAY_MS * (2 ** exponent),
      MAX_RECONNECT_DELAY_MS
    )
    state.status = 'reconnecting'
    addLog('warn', 'bot', `Koneksi terputus. Mencoba lagi dalam ${Math.round(delay / 1000)} detik.`)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      connect()
    }, delay)
  }

  function doActivity() {
    if (!bot?.entity) return

    yaw = (yaw + Math.PI / 6) % (Math.PI * 2)
    bot.look(yaw, 0, true).catch((error) => {
      state.lastError = `Look gagal: ${error.message}`
      addLog('error', config.username, `Gerak kamera gagal: ${error.message}`)
    })
    if (config.sneakEnabled) {
      bot.setControlState('sneak', true)
      clearTimeout(releaseSneakTimer)
      releaseSneakTimer = setTimeout(() => {
        if (bot?.entity) bot.setControlState('sneak', false)
      }, SNEAK_DURATION_MS)
    }
    state.lastActivityAt = new Date().toISOString()
    addLog('info', config.username, 'Aktivitas anti-AFK dikirim.')
  }

  function connect() {
    if (stopped) return

    state.status = 'connecting'
    addLog('info', config.username, `Menghubungkan ke ${config.host}:${config.port}.`)
    try {
      bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: config.type,
        ...(config.version ? { version: config.version } : {})
      })
    } catch (error) {
      state.lastError = error.message
      scheduleReconnect()
      return
    }

    bot.on('login', () => {
      state.status = 'joining'
      addLog('info', config.username, `Login berhasil ke ${config.host}:${config.port}.`)
      console.log(`Bot login ke ${config.host}:${config.port}.`)
    })

    bot.on('spawn', () => {
      state.status = 'online'
      state.connectedAt = new Date().toISOString()
      state.reconnectAttempts = 0
      state.lastError = null
      addLog('info', config.username, 'Bot masuk ke dunia.')
      if (config.antiAfkEnabled && !activityTimer) {
        activityTimer = setInterval(doActivity, config.intervalMs)
      }
      console.log(`Bot spawn; aktivitas tiap ${config.intervalMs / 1000} detik.`)
    })

    bot.on('kicked', (reason) => {
      state.lastError = describeReason(reason) || 'Kicked oleh server'
      addLog('error', config.username, `Dikeluarkan server: ${state.lastError}`)
      console.error('Bot dikeluarkan server:', state.lastError)
    })

    bot.on('error', (error) => {
      state.lastError = error.message
      addLog('error', config.username, error.message)
      console.error('Kesalahan bot Java:', error.message)
    })

    bot.on('message', (message) => {
      addLog('chat', 'server', message.toString())
    })

    bot.on('playerJoined', (player) => {
      addLog('info', 'server', `${player.username} masuk ke server.`)
    })

    bot.on('playerLeft', (player) => {
      addLog('info', 'server', `${player.username} keluar dari server.`)
    })

    bot.on('end', (reason) => {
      clearActivityTimers()
      state.status = 'disconnected'
      if (reason) state.lastError = describeReason(reason)
      addLog('warn', config.username, `Koneksi berakhir${state.lastError ? `: ${state.lastError}` : '.'}`)
      scheduleReconnect()
    })
  }

  connect()

  return {
    getStatus() {
      return { ...state }
    },
    getPlayers() {
      if (!bot?.players) return []
      return Object.values(bot.players).map((player) => ({
        username: player.username,
        uuid: player.uuid || null,
        ping: Number.isFinite(player.ping) ? player.ping : null,
        gamemode: Number.isFinite(player.gamemode) ? player.gamemode : null,
        position: player.entity?.position
          ? {
              x: Math.floor(player.entity.position.x),
              y: Math.floor(player.entity.position.y),
              z: Math.floor(player.entity.position.z)
            }
          : null
      })).filter((player) => typeof player.username === 'string' && player.username.length > 0)
    },
    sendChat(message) {
      if (!config.chatEnabled) {
        throw new Error('Pengiriman chat dinonaktifkan di settings.json.')
      }
      if (!bot?.entity || state.status !== 'online') {
        throw new Error('Bot belum online; pesan tidak dikirim.')
      }

      const text = String(message).trim()
      if (!text || text.length > 256) {
        throw new Error('Pesan wajib diisi dan maksimal 256 karakter.')
      }
      if (/[\u0000-\u001f\u007f]/.test(text)) {
        throw new Error('Pesan hanya boleh berisi satu baris teks.')
      }
      if (text.startsWith('/') && !config.consoleCommandsEnabled) {
        throw new Error('Perintah chat dinonaktifkan di settings.json.')
      }

      bot.chat(text)
      addLog('outgoing', config.username, text)
    },
    stop() {
      stopped = true
      state.status = 'stopped'
      clearActivityTimers()
      clearTimeout(reconnectTimer)
      reconnectTimer = undefined
      if (bot) bot.quit('Bot dihentikan.')
    }
  }
}

module.exports = { createJavaBot }
