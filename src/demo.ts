import { Attribute, ColorMode, TerminalBuffer, Color } from "./terminal";

if (!process.stdout.isTTY) {
    throw new Error('Not tty')
}

const border = 4
const panelWidth = 8
const gap = 8

const tty = process.stdout as import('tty').WriteStream

const term = new TerminalBuffer(tty.columns, tty.rows)
const scrollBuf = new TerminalBuffer(tty.columns + panelWidth + gap, tty.rows)


async function main () {
    let index = 0

    await new Promise(r => {
        process.stdout.write('\r\n'.repeat(tty.rows - 1), r)
    })

    // const attr = new Attribute()
    // attr.setBackground(ColorMode.Palette, Color.black)
    // scrollBuf.fill(0, 0, scrollBuf.height, scrollBuf.width, ' ', attr)

    let offset = 0
    let offset1 = 0

    const MAX_RECORD_SIZE = 20
    let lastRecords = [0]
    let sum = 0

    while (true) {
        const str = '中文測試, Test中文測試'
        const strLength = TerminalBuffer.lengthOf(str)

        offset = (offset + 1) % (panelWidth + gap)

        if (offset === 0) {
            for (let i = 0; i < 2; i++) {
                const attr = Attribute.from({
                    colorForegroundMode: ColorMode.Palette,
                    colorForeground: ~~(Math.random() * 8),
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: ~~(Math.random() * 8 + 8)
                })

                const x = ~~((panelWidth + strLength) * Math.random()) - strLength
                // const x = -5
                // const x = term.width - border - 3

                scrollBuf.write(
                    border + ~~(Math.random() * (scrollBuf.height - border * 2)), x,
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

        scrollBuf.fill(scrollBuf.height - 1, 0, 1, scrollBuf.width, '', Attribute.DEFAULT)
        scrollBuf.write(
            scrollBuf.height - 1, offset,
            `Last ${lastRecords.length} draw average: ${Math.floor(sum / lastRecords.length).toString().padStart(4, ' ')} ms, Surface: ${term.width} x ${term.height}`
        )

        const diff = scrollBuf.diff(term, 0, offset, 0, 0, term.height, term.width)
        
        const start = Date.now()
        await new Promise(r => {
            process.stdout.write(`\x1b[1;1H\x1b[0m` + diff + '\x1b[0m', r)
        })

        term.draw(scrollBuf, 0, offset, 0, 0, term.height, term.width)
        const current = Date.now() - start

        lastRecords.push(current)
        sum += current

        if (lastRecords.length > MAX_RECORD_SIZE) {
            const item = lastRecords.shift()!
            sum -= item
        }

        // const attr1 = new Attribute()
        // attr1.setForeground(ColorMode.Palette, Color.black)
        // attr1.setBackground(ColorMode.Palette, Color.blueBright)

        // term.draw(term, border, border, border, border + 32, h, 32)
        // term.fill(border, border + 64, h, 32, 'AAB中文', attr1)
        // term.draw(term, border, border, border, border + 96, h, 32)

        // const res = term.serialize()

        // await new Promise(r => {
        //     process.stdout.write(`\x1b[1;1H` + res + '\x1b[0m', r)
        // })

        index++
        await new Promise(r => setTimeout(r, 10))
    }
}

main()