import fs from 'node:fs'
import { PATH } from './config'

export class Notified {
  public static isFirst(): boolean {
    const path = PATH.notified
    return !fs.existsSync(path)
  }

  public static isChanged(name: string, value: string): boolean {
    const path = PATH.notified
    const json = fs.existsSync(path)
      ? JSON.parse(fs.readFileSync(path, 'utf8'))
      : {}
    return json[name] !== value
  }

  public static setNotified(name: string, value: string): void {
    const path = PATH.notified
    const json = fs.existsSync(path)
      ? JSON.parse(fs.readFileSync(path, 'utf8'))
      : {}
    json[name] = value
    fs.writeFileSync(path, JSON.stringify(json, null, 2), 'utf8')
  }
}
