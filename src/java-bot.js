'use strict'

const mineflayer = require('mineflayer')

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
    })
    bot.setControlState('sneak', true)
    clearTimeout(releaseSneakTimer)
    releaseSneakTimer = setTimeout(() => {
      if (bot?.entity) bot.setControlState('sneak', false)
    }, SNEAK_DURATION_MS)
    state.lastActivityAt = new Date().toISOString()
  }

  function connect() {
    if (stopped) return

    state.status = 'connecting'
    try {
      bot = mineflayer.createBot({
        host: config.host,
        port: config.port,
        username: config.username,
        auth: 'offline',
        ...(config.version ? { version: config.version } : {})
      })
    } catch (error) {
      state.lastError = error.message
      scheduleReconnect()
      return
    }

    bot.on('login', () => {
      state.status = 'joining'
      console.log(`Bot login ke ${config.host}:${config.port}.`)
    })

    bot.on('spawn', () => {
      state.status = 'online'
      state.connectedAt = new Date().toISOString()
      state.reconnectAttempts = 0
      state.lastError = null
      if (!activityTimer) {
        activityTimer = setInterval(doActivity, config.intervalMs)
      }
      console.log(`Bot spawn; aktivitas tiap ${config.intervalMs / 1000} detik.`)
    })

    bot.on('kicked', (reason) => {
      state.lastError = describeReason(reason) || 'Kicked oleh server'
      console.error('Bot dikeluarkan server:', state.lastError)
    })

    bot.on('error', (error) => {
      state.lastError = error.message
      console.error('Kesalahan bot Java:', error.message)
    })

    bot.on('end', (reason) => {
      clearActivityTimers()
      state.status = 'disconnected'
      if (reason) state.lastError = describeReason(reason)
      scheduleReconnect()
    })
  }

  connect()

  return {
    getStatus() {
      return { ...state }
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
