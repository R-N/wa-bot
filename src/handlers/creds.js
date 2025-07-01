export const event = 'creds.update'
export const enabled = true

export default async (data, { saveCreds }) => {
	await saveCreds()
}
