import qrcode from 'qrcode-terminal'

export const event = 'connection.update'

export default (update, { restart }) => {
	const { connection, qr } = update
	if (qr) qrcode.generate(qr, { small: true })
	if (connection === 'close') {
		console.log('Connection closed. Reconnecting...')
		restart()
	}
	if (connection === 'open') {
		console.log('Connection opened.')
	}
}
