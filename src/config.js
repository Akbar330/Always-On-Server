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

  const edition = String(settings.edition || 'java').trim().toLowerCase()
  if (!['java', 'bedrock'].includes(edition)) {
    throw new Error('edition di settings.json harus "java" atau "bedrock".')
  }

  const username = String(settings.username || '').trim()
  if (!username) {
    throw new Error('username wajib diisi di settings.json.')
  }

  const host = String(settings.host || '').trim()
  if (!host) {
    throw new Error('host wajib diisi di settings.json.')
  }

  const defaultPort = edition === 'java' ? 25565 : 19132
  const port = settings.port === undefined || settings.port === null || settings.port === ''
    ? defaultPort
    : Number(settings.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port di settings.json harus berupa angka antara 1 dan 65535.')
  }

  const intervalSeconds = settings.intervalSeconds === undefined
    ? DEFAULT_INTERVAL_SECONDS
    : Number(settings.intervalSeconds)
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < MIN_INTERVAL_SECONDS) {
    throw new Error(`intervalSeconds di settings.json harus minimal ${MIN_INTERVAL_SECONDS}.`)
  }

  return {
    edition,
    host,
    port,
    username,
    version: String(settings.version || '').trim() || undefined,
    intervalMs: intervalSeconds * 1000
  }
}

module.exports = { readConfig }
