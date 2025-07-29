import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from './util.js'
import { createReadline, startSock } from './socket.js'
import { createMessagingHelpers } from './messaging.js'
import { createServer } from './server.js'
import { ChatSessionManager } from './session.js'

const { rl, question } = createReadline()

var sock = null
var auth_info = null

const getSock = () => sock

const { queueMessage } = createMessagingHelpers(getSock)

// Use Map to support multiple handlers per event
const handlers = new Map()

const blacklistEnv = process.env.HANDLER_BLACKLIST || ''
const whitelistEnv = process.env.HANDLER_WHITELIST || ''

const blacklist = blacklistEnv.split(',').map(f => f.trim()).filter(Boolean)
const whitelist = whitelistEnv.split(',').map(f => f.trim()).filter(Boolean)

const registerHandler = (event, fn) => {
	if (!handlers.has(event)) handlers.set(event, [])
	handlers.get(event).push(fn)
}

const loadHandlers = async () => {
	const __dirname = path.dirname(fileURLToPath(import.meta.url))
	const handlersDir = path.join(__dirname, 'handlers')

	const files = fs.readdirSync(handlersDir).filter(f => f.endsWith('.js'))

	for (const file of files) {
		const fileName = file.replace('.js', '')

		if (blacklist.includes(fileName)) {
			console.log(`Skipped blacklisted handler: ${file}`)
			continue
		}

		if (whitelist.length > 0 && !whitelist.includes(fileName)) {
			console.log(`Skipped non-whitelisted handler: ${file}`)
			continue
		}

		const module = await import(`./handlers/${file}`)

		if (module.enabled === false && !whitelist.includes(fileName)) {
			console.log(`Skipped disabled handler: ${file}`)
			continue
		}

		if (!module.event || typeof module.default !== 'function') {
			console.warn(`Skipping invalid handler: ${file}`)
			continue
		}

		if (module.init){
			await module.init();
		}
		registerHandler(module.event, module.default)
		console.log(`Loaded handler for '${module.event}' from ${file}`)
	}
}

const restartSock = async () => {
	({ sock, auth_info } = await startSock(logger))

	const botId = auth_info.state.creds.me.id || sock.user.id;
	console.log(botId);
	let sessionManager = null;
	try{
		sessionManager = new ChatSessionManager(
			botId
		);
		await sessionManager.init();
	}catch(err){
		console.error(err);
		sessionManager = null;
	}

	sock.ev.process(async (events) => {
		for (const [eventName, eventData] of Object.entries(events)) {
			const callbacks = handlers.get(eventName) || []
			for (const cb of callbacks) {
				await cb(eventData, {
					getSock,
					queueMessage,
					auth_info,
					saveCreds: auth_info.saveCreds,
					restart: restartSock,
					sessionManager
				})
			}
		}
	})
}

const main = async () => {
	await loadHandlers();
	await restartSock();

	const app = createServer(getSock, queueMessage);
	app.listen(3000, () => {
		console.log('Webhook server running on port 3000');
	});
}

main()
