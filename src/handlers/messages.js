import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { isJidNewsletter } from '@whiskeysockets/baileys'

export const event = 'messages.upsert'

const messageHandlers = []

const loadMessageHandlers = async () => {
	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const dir = path.join(__dirname, 'messages')

	const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))

	for (const file of files) {
		const module = await import(`./messages/${file}`)
		if (typeof module.default !== 'function' || typeof module.priority !== 'number') {
			console.warn(`Skipping invalid message handler: ${file}`)
			continue
		}
		messageHandlers.push({ fn: module.default, priority: module.priority })
		console.log(`Loaded message handler from ${file} with priority ${module.priority}`)
	}

	// Sort descending: higher priority runs first
	messageHandlers.sort((a, b) => b.priority - a.priority)
}

await loadMessageHandlers()

export default async (upsert, { getSock, queueMessage }) => {
	if (upsert.type !== 'notify') return

	for (const msg of upsert.messages) {
		const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
		if (!text || msg.key.fromMe || isJidNewsletter(msg.key.remoteJid)) {
			continue
		}

    const sock = getSock()

		console.log('processing message from', msg.key.remoteJid)
		await sock.readMessages([msg.key])

		for (const handler of messageHandlers) {
			const handled = await handler.fn(msg, { sock, queueMessage })
			if (handled) break
		}
	}
}
