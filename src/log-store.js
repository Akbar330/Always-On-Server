'use strict'

const { randomUUID } = require('node:crypto')

const MAX_LOG_ENTRIES = 200
const entries = []
let nextId = 1
const instanceId = randomUUID()

function addLog(level, source, message) {
  const entry = {
    id: nextId++,
    at: new Date().toISOString(),
    level,
    source,
    message: String(message).slice(0, 1000)
  }

  entries.push(entry)
  if (entries.length > MAX_LOG_ENTRIES) entries.shift()
  return entry
}

function getLogs(afterId = 0) {
  return entries.filter((entry) => entry.id > afterId)
}

module.exports = { addLog, getLogs, instanceId }
