'use strict'

const { readConfig } = require('../src/config')
const { createJavaBot } = require('../src/java-bot')

let botController

module.exports = function statusHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const config = readConfig()
    if (config.edition !== 'java') {
      return res.status(501).json({
        error: 'Vercel status runner saat ini mendukung Minecraft Java Edition.'
      })
    }

    if (!botController) botController = createJavaBot(config)

    res.setHeader('Cache-Control', 'no-store, max-age=0')
    return res.status(200).json({
      api: 'online',
      bot: botController.getStatus(),
      server: {
        edition: config.edition,
        host: config.host,
        port: config.port
      },
      checkedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Gagal memulai atau membaca status bot:', error)
    return res.status(500).json({ error: error.message })
  }
}
