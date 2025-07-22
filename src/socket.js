import readline from 'readline'
import qrcode from 'qrcode-terminal'
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys'

export const createReadline = () => {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	const question = (text) => new Promise((resolve) => rl.question(text, resolve))
	return { rl, question }
}

export const startSock = async (logger) => {
	const auth_info = await useMultiFileAuthState('auth_info')
	const { state } = auth_info
	const { version } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}`)

	const sock = makeWASocket({
		version,
		logger,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
	})

	return { sock, auth_info }
}
