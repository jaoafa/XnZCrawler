import puppeteer, { Browser } from 'puppeteer-core'

interface Options {
  proxy?: {
    server: string
    username?: string
    password?: string
  }
}

export type UserStatusesStatus =
  | 'Available'
  | 'Unavailable'
  | 'Too Long'
  | 'Possibly Available'

interface UserStatuses {
  status: UserStatusesStatus | null
  searches: number | null
  'drop interval'?: Date[]
  // ['0:00', '1:22:15:22']
  'time remaining'?: string[]
}

export class NameMC {
  private options: Options
  private browser: Browser | null = null

  constructor(options: Options) {
    this.options = options
  }

  private async initBrowser() {
    const puppeteerArgs = [
      '--disable-accelerated-2d-canvas',
      '--disable-blink-features=AutomationControlled',
      '--disable-default-apps',
      '--disable-dev-shm-usage',
      '--disable-infobars',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--mute-audio',
      '--no-first-run',
      '--no-sandbox',
      '--no-service-autorun',
      '--no-zygote',
      '--password-store=basic',
      '--system-developer-mode',
      '--disable-accelerated-2d-canvas',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=600,800',
    ]

    if (this.options.proxy && this.options.proxy.server) {
      puppeteerArgs.push('--proxy-server=' + this.options.proxy.server)
    }
    return await puppeteer.launch({
      headless: false,
      executablePath: '/usr/bin/chromium-browser',
      args: puppeteerArgs,
      ignoreDefaultArgs: [
        '--disable-extensions',
        '--enable-automation',
        '--disable-component-extensions-with-background-pages',
      ],
      defaultViewport: {
        width: 600,
        height: 800,
      },
    })
  }

  public async checkName(name: string) {
    if (!this.browser) {
      this.browser = await this.initBrowser()
    }

    const page = await this.browser.newPage()
    page.setDefaultNavigationTimeout(120000) // 120s

    // proxy auth
    if (
      this.options.proxy &&
      this.options.proxy.username &&
      this.options.proxy.password
    ) {
      console.log('Login proxy')
      await page.authenticate({
        username: this.options.proxy.username,
        password: this.options.proxy.password,
      })
      console.log('Login proxy... done')
    }

    await page.goto(`https://ja.namemc.com/search?q=${name}`, {
      waitUntil: 'networkidle2',
    })

    // <span id="challenge-error-text">Please enable Cookies and reload the page.</span>
    const error = await page.$('#challenge-error-text')
    if (
      error &&
      (await error.evaluate((node) => node.textContent)) ===
        'Please enable Cookies and reload the page.'
    ) {
      await page.reload()
    }

    // #content div.ctp-checkbox-container label.ctp-checkbox-label
    const checkbox = await page.$(
      '#content div.ctp-checkbox-container label.ctp-checkbox-label'
    )
    if (checkbox) {
      await checkbox.click()
    }

    await page.waitForSelector('#status-bar')

    // time remainingの描画のためちょっと待つ
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // #status-bar > div.row > div
    const rows = await page.$$('#status-bar > div.row > div.col-6')
    if (!rows) {
      throw new Error('rows not found')
    }
    const statuses = this.filterNull(
      await Promise.all(
        rows.map(async (row) => {
          const elements = await row.$$('div')

          return {
            key: await elements[0].evaluate((node) => node.textContent),
            value: (await Promise.all(
              elements
                .slice(1)
                .map((element) =>
                  element
                    .evaluate((node) => node.textContent)
                    .then((text) => text?.trim())
                )
            ).then((texts) =>
              texts.filter(
                (text) => text !== '' && text !== null && text !== undefined
              )
            )) as string[],
          }
        })
      )
    )

    const userStatuses: UserStatuses = {
      status: null,
      searches: null,
    }

    for (const status of statuses) {
      if (!status.key || !status.value) {
        continue
      }
      const key = status.key.toLocaleLowerCase() as keyof UserStatuses
      const values = status.value

      switch (key) {
        case 'searches':
          // 2 / month
          userStatuses.searches = parseInt(values[0]?.split(' ')[0])
          break
        case 'drop interval':
          // eslint-disable-next-line no-irregular-whitespace
          // [ '1/7/2023 • 8:09:39 PM', '1/10/2023 • 11:11:31 AM' ]
          userStatuses['drop interval'] = values.map(
            // add 9 hours
            (value) => {
              const date = new Date(value.replace(' • ', ' ').replace(' ', ' '))
              date.setHours(date.getHours() + 9)
              return date
            }
          )
          break
        default:
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          userStatuses[key] = values.length === 1 ? values[0] : values
          break
      }
    }

    await page.close()

    return {
      name,
      statuses: userStatuses,
    }
  }

  public async checkNames(names: string[]) {
    this.browser = await this.initBrowser()
    const results = []
    for (const name of names) {
      results.push(await this.checkName(name))
    }
    return results
  }

  public async close() {
    if (!this.browser) {
      return
    }
    const pages = await this.browser.pages()
    await Promise.all(pages.map((page) => page.close()))
    await this.browser.close()
  }

  private filterNull<T>(array: (T | null)[]): T[] {
    return array.filter((item): item is T => item !== null)
  }
}
