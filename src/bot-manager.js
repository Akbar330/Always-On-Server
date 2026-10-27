'use strict'

const { createJavaBot } = require('./java-bot')

const MAX_BOTS = 3
const OFFLINE_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/

function createBotManager(config) {
  const bots = new Map()

  function startBot(username, primary = false) {
    const key = username.toLowerCase()
    const controller = createJavaBot({ ...config, username })
    bots.set(key, { username, primary, controller })
    return controller
  }

  function listBots() {
    return [...bots.values()].map(({ username, primary, controller }) => ({
      ...controller.getStatus(),
      primary
    }))
  }

  startBot(config.username, true)

  return {
    listBots,
    addBot(username) {
      const cleanUsername = String(username || '').trim()
      if (!OFFLINE_USERNAME_PATTERN.test(cleanUsername)) {
        throw new Error('Nama bot harus 3–16 karakter, hanya huruf, angka, dan underscore.')
      }

      const key = cleanUsername.toLowerCase()
      if (bots.has(key)) throw new Error('Nama bot tersebut sudah aktif.')
      if (bots.size >= MAX_BOTS) {
        throw new Error(`Batas maksimal ${MAX_BOTS} bot aktif sudah tercapai.`)
      }
      if (this.getPlayers().some((player) => player.username.toLowerCase() === key)) {
        throw new Error('Nama itu sedang dipakai pemain di server.')
      }

      startBot(cleanUsername)
      return listBots()
    },
    removeBot(username) {
      const key = String(username || '').trim().toLowerCase()
      const managedBot = bots.get(key)
      if (!managedBot) throw new Error('Bot tidak ditemukan.')
      if (managedBot.primary) throw new Error('Bot utama tidak bisa dihapus dari dashboard.')

      managedBot.controller.stop()
      bots.delete(key)
      return listBots()
    },
    getPlayers() {
      const sourceBot = [...bots.values()].find(
        ({ controller }) => controller.getStatus().status === 'online'
      )
      if (!sourceBot) return []

      const botNames = new Set([...bots.keys()])
      return sourceBot.controller.getPlayers()
        .map((player) => ({
          ...player,
          isBot: botNames.has(String(player.username || '').toLowerCase())
        }))
        .sort((a, b) => a.username.localeCompare(b.username))
    },
    getBotCount() {
      return bots.size
    },
    getMaxBots() {
      return MAX_BOTS
    },
    sendChat(message) {
      const onlineBot = [...bots.values()].find(
        ({ controller }) => controller.getStatus().status === 'online'
      )
      if (!onlineBot) throw new Error('Tidak ada bot yang online untuk mengirim pesan.')
      onlineBot.controller.sendChat(message)
    }
  }
}

module.exports = { createBotManager, MAX_BOTS }
