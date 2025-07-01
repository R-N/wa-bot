import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { isJidNewsletter } from '@whiskeysockets/baileys'

export const event = 'messages.upsert'
export const enabled = true

const messageHandlers = []

const blacklistEnv = process.env.MESSAGE_HANDLER_BLACKLIST || ''
const whitelistEnv = process.env.MESSAGE_HANDLER_WHITELIST || ''

const blacklist = blacklistEnv.split(',').map(f => f.trim()).filter(Boolean)
const whitelist = whitelistEnv.split(',').map(f => f.trim()).filter(Boolean)

const loadMessageHandlers = async () => {
	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const dir = path.join(__dirname, 'messages')

	const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))

	for (const file of files) {
		const fileName = file.replace('.js', '')

		if (blacklist.includes(fileName)) {
			console.log(`Skipped blacklisted message handler: ${file}`)
			continue
		}

		if (whitelist.length > 0 && !whitelist.includes(fileName)) {
			console.log(`Skipped non-whitelisted message handler: ${file}`)
			continue
		}

		const module = await import(`./messages/${file}`)

		if (module.enabled === false) {
			console.log(`Skipped disabled message handler: ${file}`)
			continue
		}

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
