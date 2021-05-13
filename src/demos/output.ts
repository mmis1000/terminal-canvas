import { Attribute, ColorMode, TerminalBuffer, Printer } from "../terminal";

if (!process.stdout.isTTY) {
    throw new Error('Not tty')
}

const border = 4
const panelWidth = 8
const gap = 8

let lastInput = ''

const tty = process.stdout as import('tty').WriteStream
process.stdin.setRawMode(true)
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (key: string) => {
    const CTRL_C = '\x03'
    lastInput = ''
    for (let k of key) {
        if (k === CTRL_C) {
            process.emit('SIGINT', 'SIGINT')
        } else {
            lastInput += k
        }
    }
})

const scrollBuf = new TerminalBuffer(tty.columns + panelWidth + gap, tty.rows)
const subBuf = new TerminalBuffer(tty.columns, 1)
const printer = new Printer(tty.columns, tty.rows)

async function main () {
    await printer.initScreen()

    let offset = 0
    let y = 0

    const MAX_RECORD_SIZE = 20
    let lastRecords = [0]
    let sum = 0

    const str = '中文測試, Test中文測試'
    const strLength = TerminalBuffer.lengthOf(str)

    let prevCol = tty.columns
    let prevRow = tty.rows

    while (!tty.writableEnded) {
        const resized = prevCol !== tty.columns || prevRow !== tty.rows

        if (resized) {
            scrollBuf.resize(tty.columns + panelWidth + gap, tty.rows)
            subBuf.resize(tty.columns, 1)
            printer.resize(tty.columns, tty.rows)

            prevCol = tty.columns
            prevRow = tty.rows
        }

        offset = (offset + 1) % (panelWidth + gap)

        const start = Date.now()
        if (offset === 0) {
            y = (y + 1) % (scrollBuf.height - border * 2)

            for (let i = 0; i < 2; i++) {
                const attr = Attribute.from({
                    colorForegroundMode: ColorMode.Palette,
                    colorForeground: ~~(Math.random() * 8),
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: ~~(Math.random() * 8 + 8)
                })

                const x = ~~((panelWidth + strLength) * Math.random()) - strLength

                scrollBuf.write(
                    y + border, x,
                    str, attr,
                    0, panelWidth
                )
            }
        }

        const h = scrollBuf.height - border * 2

        for (let i = 1; panelWidth + panelWidth * (i - 1) + gap * i < scrollBuf.width; i++) {
            scrollBuf.draw(scrollBuf,
                border, 0,
                border, panelWidth + panelWidth * (i - 1) + gap * i,
                h, panelWidth
            )
        }

        subBuf.clear()
        subBuf.write(
            0, 0,
            `Last ${lastRecords.length.toString().padStart(2, ' ')} draw average: ${Math.floor(sum / lastRecords.length).toString().padStart(4, ' ')} ms, `
            + `Surface: ${printer.width} x ${printer.height}, `
            + `Last input: ${lastInput.replace(/[\x00-\x1f\x20\x7f]/g, c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}`
        )

        printer.draw(scrollBuf, 0, offset, 0, 0, scrollBuf.height, scrollBuf.width)
        printer.draw(subBuf, 0, 0, printer.height - 1, 0, subBuf.height, subBuf.width)

        if (!resized) {
            await printer.updateScreen()
        } else {
            await printer.updateScreenFull()
        }

        const current = Date.now() - start

        lastRecords.push(current)
        sum += current

        if (lastRecords.length > MAX_RECORD_SIZE) {
            const item = lastRecords.shift()!
            sum -= item
        }

        await new Promise(r => setTimeout(r, 50))
    }
}

process.stdout.on('finish', () => {
    process.exit(0)
})

process.on('SIGINT', () => {
    process.stdout.write('\r\n')
    process.stdout.end()
})

process.on('SIGTERM', () => {
    process.stdout.write('\r\n')
    process.stdout.end()
})
main()