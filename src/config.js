'use strict'

const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_INTERVAL_SECONDS = 300
const MIN_INTERVAL_SECONDS = 30

function readConfig() {
  const configPath = path.join(__dirname, '..', 'settings.json')
  let settings

  try {
    settings = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('settings.json tidak ditemukan di root project.')
    }
    if (error instanceof SyntaxError) {
      throw new Error(`settings.json bukan JSON yang valid: ${error.message}`)
    }
    throw error
  }

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('settings.json harus berisi object JSON.')
  }

  const account = settings['bot-account'] || settings
  const server = settings.server || settings
  const modules = settings.modules || {}
  const antiAfk = settings.utils?.['anti-afk'] || {}

  const edition = String(server.edition || settings.edition || 'java').trim().toLowerCase()
  if (!['java', 'bedrock'].includes(edition)) {
    throw new Error('edition di settings.json harus "java" atau "bedrock".')
  }

  const username = String(account.username || '').trim()
  if (!username) {
    throw new Error('username wajib diisi di settings.json.')
  }

  const type = String(account.type || 'offline').trim().toLowerCase()
  if (type !== 'offline') {
    throw new Error('type di settings.json saat ini hanya mendukung "offline".')
  }

  const host = String(server.ip || server.host || '').trim()
  if (!host) {
    throw new Error('host wajib diisi di settings.json.')
  }

  const defaultPort = edition === 'java' ? 25565 : 19132
  const portValue = server.port
  const port = portValue === undefined || portValue === null || portValue === ''
    ? defaultPort
    : Number(portValue)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port di settings.json harus berupa angka antara 1 dan 65535.')
  }

  const intervalSeconds = antiAfk.intervalSeconds === undefined && antiAfk.interval === undefined && settings.intervalSeconds === undefined
    ? DEFAULT_INTERVAL_SECONDS
    : Number(antiAfk.intervalSeconds ?? antiAfk.interval ?? settings.intervalSeconds)
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < MIN_INTERVAL_SECONDS) {
    throw new Error(`intervalSeconds di settings.json harus minimal ${MIN_INTERVAL_SECONDS}.`)
  }

  return {
    edition,
    type,
    host,
    port,
    username,
    version: String(server.version || settings.version || '').trim() || undefined,
    intervalMs: intervalSeconds * 1000,
    antiAfkEnabled: antiAfk.enabled !== false,
    sneakEnabled: antiAfk.sneak === true,
    chatEnabled: modules.chat === true,
    consoleCommandsEnabled: modules['console-commands'] === true
  }
}

module.exports = { readConfig }
