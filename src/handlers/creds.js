export const event = 'creds.update'

export default async (data, { saveCreds }) => {
	await saveCreds()
}
