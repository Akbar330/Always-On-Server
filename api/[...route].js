'use strict'

const crypto = require('node:crypto')
const { readConfig } = require('../src/config')
const { createJavaBot } = require('../src/java-bot')
const { addLog, getLogs, instanceId } = require('../src/log-store')

let botController
let lastChatSentAt = 0

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  return res.status(status).json(body)
}

function isAuthorized(req) {
  const expected = process.env.DASHBOARD_TOKEN
  if (!expected) return null

  const expectedBuffer = Buffer.from(expected)
  if (expectedBuffer.length < 32) return null

  const authorization = req.headers.authorization || ''
  const supplied = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : ''
  const suppliedBuffer = Buffer.from(supplied)

  return expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

function ensureRuntime() {
  const config = readConfig()
  if (config.edition !== 'java') {
    throw new Error('Shell dashboard saat ini hanya mendukung Minecraft Java Edition.')
  }

  if (!botController) {
    botController = createJavaBot(config)
    addLog('info', 'system', `Runtime dimulai untuk ${config.host}:${config.port}.`)
  }

  return config
}

module.exports = function apiHandler(req, res) {
  const authorization = isAuthorized(req)
  if (authorization === null) {
    return json(res, 503, {
      error: 'DASHBOARD_TOKEN belum dikonfigurasi di Environment Variables Vercel.'
    })
  }
  if (!authorization) {
    return json(res, 401, { error: 'Token dashboard salah atau belum dikirim.' })
  }

  const pathname = new URL(req.url, 'http://localhost').pathname
  const route = pathname.split('/').filter(Boolean).at(-1)
  const allowedMethod = { status: 'GET', logs: 'GET', chat: 'POST' }[route]

  if (!allowedMethod) return json(res, 404, { error: 'Route API tidak ditemukan.' })
  if (req.method !== allowedMethod) {
    res.setHeader('Allow', allowedMethod)
    return json(res, 405, { error: 'Method not allowed.' })
  }

  try {
    const config = ensureRuntime()

    if (route === 'status') {
      return json(res, 200, {
        api: 'online',
        instanceId,
        bot: botController.getStatus(),
        server: {
          edition: config.edition,
          type: config.type,
          host: config.host,
          port: config.port,
          chatEnabled: config.chatEnabled,
          consoleCommandsEnabled: config.consoleCommandsEnabled
        },
        checkedAt: new Date().toISOString()
      })
    }

    if (route === 'logs') {
      const afterId = Number(new URL(req.url, 'http://localhost').searchParams.get('after') || 0)
      if (!Number.isSafeInteger(afterId) || afterId < 0) {
        return json(res, 400, { error: 'Parameter after tidak valid.' })
      }
      return json(res, 200, { instanceId, logs: getLogs(afterId) })
    }

    if (route === 'chat') {
      if (!config.chatEnabled) {
        return json(res, 403, { error: 'Chat dinonaktifkan di settings.json.' })
      }

      const now = Date.now()
      if (now - lastChatSentAt < 1000) {
        return json(res, 429, { error: 'Tunggu sebentar sebelum mengirim pesan lagi.' })
      }

      let body
      try {
        body = readBody(req)
      } catch {
        return json(res, 400, { error: 'Body request harus JSON yang valid.' })
      }

      if (typeof body.message !== 'string') {
        return json(res, 400, { error: 'Field message harus berupa teks.' })
      }
      if (body.message.trim().startsWith('/') && !config.consoleCommandsEnabled) {
        return json(res, 403, { error: 'Perintah chat dinonaktifkan di settings.json.' })
      }

      botController.sendChat(body.message)
      lastChatSentAt = now
      return json(res, 200, { sent: true })
    }

    return json(res, 404, { error: 'Route API tidak ditemukan.' })
  } catch (error) {
    addLog('error', 'api', error.message)
    console.error('API bot error:', error)
    return json(res, 500, { error: error.message })
  }
}
