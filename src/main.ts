import { getConfig } from './config'
import { DiscordEmbedField, sendToDiscord } from './discord'
import { NameMC, UserStatusesStatus } from './namemc'
import { Notified } from './notified'

function formatDateTime(datetime: Date) {
  // yyyy/MM/dd HH:mm:ss
  const year = datetime.getFullYear().toString().padStart(4, '0')
  const month = (datetime.getMonth() + 1).toString().padStart(2, '0')
  const day = datetime.getDate().toString().padStart(2, '0')
  const hour = datetime.getHours().toString().padStart(2, '0')
  const minute = datetime.getMinutes().toString().padStart(2, '0')
  const second = datetime.getSeconds().toString().padStart(2, '0')
  return `${year}/${month}/${day} ${hour}:${minute}:${second}`
}

async function main() {
  const usernames = [...Array(10).keys()].map((i) => `X${i}Z`)

  const config = getConfig()
  const namemc = new NameMC({
    proxy: config.proxy,
  })
  const checks = await namemc.checkNames(usernames)
  await namemc.close()

  if (checks.length !== usernames.length) {
    throw new Error('checks.length !== usernames.length')
  }

  const notifiable = checks.filter(
    (check) =>
      check.statuses.status === 'Available' ||
      check.statuses.status === 'Possibly Available' ||
      check.statuses.status === 'Unavailable'
  )
  console.log('notifiable', notifiable)

  // 通知するのは、Availableになったとき・Unavailableになったとき・Possibly Availableになったとき。
  // 前回と変わっていたら～で対応

  for (const check of notifiable) {
    const { name, statuses } = check
    if (!statuses.status) {
      throw new Error('statuses.status is null')
    }

    let status: UserStatusesStatus | 'Comming' = statuses.status
    // drop interval が1日以内になったら Comming にする
    if (statuses['drop interval'] && statuses['drop interval'].length > 0) {
      const dropInterval = statuses['drop interval'][0]
      const now = new Date()
      const diff = dropInterval.getTime() - now.getTime()
      if (diff < 1000 * 60 * 60 * 24) {
        status = 'Comming'
      }
    }

    if (!Notified.isChanged(name, status)) {
      continue
    }
    console.log(name, statuses)

    const title =
      status !== 'Comming'
        ? `${name} は ${status} になりました`
        : `${name} がまもなく利用可能になります`
    // Available なら緑、Possibly Available か Comming なら黄色、Unavailable なら赤
    const color =
      status === 'Available'
        ? 0x00ff00
        : status === 'Unavailable'
        ? 0xff0000
        : 0xffff00

    await sendToDiscord(config.discord.webhookUrl, '', {
      title,
      url: `https://ja.namemc.com/search?q=${name}`,
      color,
      fields: [
        statuses['drop interval']
          ? {
              name: '利用可能予定日',
              value: statuses['drop interval']
                .map((text) => `・${formatDateTime(text)}`)
                .join('\n'),
            }
          : null,
      ].filter((field) => field !== null) as DiscordEmbedField[],
    })

    Notified.setNotified(name, status)
  }

  // process.exitがないと終了しない？
  process.exit(0)
}

;(async () => {
  await main()
})()
