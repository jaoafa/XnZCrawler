import fs from 'fs'
import yaml from 'js-yaml'

export const PATH = {
  config: process.env.CONFIG_PATH || './config.yml',
  notified: process.env.NOTIFIED_PATH || './notified.json',
}

export interface Config {
  discord: {
    webhookUrl: string
  }
  proxy?: {
    server: string
    username?: string
    password?: string
  }
}

export function getConfig(): Config {
  const path = PATH.config
  return yaml.load(fs.readFileSync(path, 'utf8')) as Config
}
