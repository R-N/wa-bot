import P from 'pino'

export const logger = P({ 
  timestamp: () => `,"time":"${new Date().toJSON()}"` 
})
logger.level = 'info'
