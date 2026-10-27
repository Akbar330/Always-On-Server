const { readConfig } = require('./config')
const { createJavaBot } = require('./java-bot')

function startJavaBot(config) {
  const controller = createJavaBot(config)
  return () => controller.stop()
}

function startBedrockBot(config) {
  let bedrock
  try {
    bedrock = require('bedrock-protocol')
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'bedrock-protocol tidak dipasang dalam build yang kompatibel dengan Vercel. Runner Vercel project ini hanya mendukung Java Edition.'
      )
    }
    throw error
  }

  const client = bedrock.createClient({
    host: config.host,
    port: config.port,
    username: config.username,
    offline: true,
    ...(config.version ? { version: config.version } : {})
  })

  let position
  let rotation = { pitch: 0, yaw: 0 }
  let runtimeEntityId
  let tick = 0n
  let activityTimer
  let releaseSneakTimer

  function sendActivity(sneaking) {
    if (!position) {
      console.error('Posisi pemain Bedrock belum tersedia; aktivitas dilewati.')
      return
    }

    rotation.yaw = ((rotation.yaw + 30 + 180) % 360 + 360) % 360 - 180
    const yawRadians = rotation.yaw * Math.PI / 180
    const pitchRadians = rotation.pitch * Math.PI / 180
    const inputData = { block_breaking_delay_enabled: true }
    if (sneaking) {
      inputData.sneaking = true
      inputData.start_sneaking = true
    } else {
      inputData.stop_sneaking = true
    }

    client.queue('player_auth_input', {
      pitch: rotation.pitch,
      yaw: rotation.yaw,
      position,
      move_vector: { x: 0, z: 0 },
      head_yaw: rotation.yaw,
      input_data: inputData,
      input_mode: 1,
      play_mode: 2,
      interaction_model: 1,
      interact_rotation: { x: rotation.pitch, z: rotation.yaw },
      tick: tick++,
      delta: { x: 0, y: 0, z: 0 },
      analogue_move_vector: { x: 0, z: 0 },
      camera_orientation: {
        x: -Math.sin(yawRadians) * Math.cos(pitchRadians),
        y: -Math.sin(pitchRadians),
        z: Math.cos(yawRadians) * Math.cos(pitchRadians)
      },
      raw_move_vector: { x: 0, z: 0 }
    })
  }

  client.on('start_game', (packet) => {
    position = packet.player_position
    rotation = {
      pitch: packet.rotation?.x ?? 0,
      yaw: packet.rotation?.z ?? 0
    }
    runtimeEntityId = packet.runtime_entity_id
    tick = BigInt(packet.current_tick ?? 0)
  })

  client.on('move_player', (packet) => {
    if (
      runtimeEntityId !== undefined &&
      String(packet.runtime_id) === String(runtimeEntityId)
    ) {
      position = packet.position
      rotation = { pitch: packet.pitch, yaw: packet.yaw }
    }
  })

  client.on('spawn', () => {
    if (activityTimer) return
    console.log(`Terhubung ke server Bedrock ${config.host}:${config.port}.`)
    console.log(`Bot aktif. Aktivitas tiap ${config.intervalMs / 1000} detik.`)
    activityTimer = setInterval(() => {
      sendActivity(true)
      clearTimeout(releaseSneakTimer)
      releaseSneakTimer = setTimeout(() => sendActivity(false), 1500)
    }, config.intervalMs)
  })

  client.on('kick', (reason) => {
    console.error('Bot dikeluarkan server:', reason)
  })
  client.on('error', (error) => {
    console.error('Kesalahan bot Bedrock:', error.message)
  })
  client.on('close', () => {
    console.log('Koneksi bot Bedrock berakhir.')
    clearInterval(activityTimer)
    clearTimeout(releaseSneakTimer)
  })

  return () => {
    clearInterval(activityTimer)
    clearTimeout(releaseSneakTimer)
    client.close()
  }
}

try {
  const config = readConfig()
  console.log(`Menghubungkan bot ${config.username} ke ${config.host}:${config.port}...`)
  const stop = config.edition === 'java'
    ? startJavaBot(config)
    : startBedrockBot(config)

  process.once('SIGINT', () => {
    console.log('\nMenghentikan bot...')
    stop()
  })
  process.once('SIGTERM', stop)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
