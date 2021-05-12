import { Attribute, ColorMode, Buffer, Color } from "./terminal";

if (!process.stdout.isTTY) {
    throw new Error('Not tty')
}

const border = 4
const panelWidth = 16
const gap = 2

const tty = process.stdout as import('tty').WriteStream

const term = new Buffer(tty.columns, tty.rows)
const scrollBuf = new Buffer(tty.columns + panelWidth + gap, tty.rows)


async function main () {
    let index = 0

    await new Promise(r => {
        process.stdout.write('\r\n'.repeat(tty.rows - 1), r)
    })

    const attr = new Attribute()
    attr.setBackground(ColorMode.Palette, Color.black)
    scrollBuf.fill(0, 0, scrollBuf.height, scrollBuf.width, ' ', attr)

    let offset = 0

    while (true) {
        const str = '中文測試, Test中文測試'
        const strLength = Buffer.lengthOf(str)

        offset = (offset + 1) % (panelWidth + gap)

        const attr = new Attribute()
        // attr.setForeground(ColorMode.Palette, Color.black)
        // attr.setBackground(ColorMode.Palette, Color.red)


        
        for (let i = 0; i < 2; i++) {
            attr.setForeground(ColorMode.Palette, ~~(Math.random() * 8))
            attr.setBackground(ColorMode.Palette, ~~(Math.random() * 8 + 8))

            const x = ~~((panelWidth + strLength) * Math.random()) - strLength
            // const x = term.width - border - 3

            scrollBuf.write(
                border + ~~(Math.random() * (scrollBuf.height - border * 2)), x,
                '中文測試, Test中文測試', attr,
                0, panelWidth
            )
        }

        const h = scrollBuf.height - border * 2

        for (let i = 1; panelWidth + panelWidth * (i - 1) + gap * i < scrollBuf.width; i++) {
            scrollBuf.draw(scrollBuf,
                border, 0,
                border, panelWidth + panelWidth * (i - 1) + gap * i,
                h, panelWidth
            )
        }

        term.draw(scrollBuf, 0, offset, 0, 0, term.height, term.width)


        // const attr1 = new Attribute()
        // attr1.setForeground(ColorMode.Palette, Color.black)
        // attr1.setBackground(ColorMode.Palette, Color.blueBright)

        // term.draw(term, border, border, border, border + 32, h, 32)
        // term.fill(border, border + 64, h, 32, 'AAB中文', attr1)
        // term.draw(term, border, border, border, border + 96, h, 32)

        const res = term.serialize()

        await new Promise(r => {
            process.stdout.write(`\x1b[1;1H` + res + '\x1b[0m', r)
        })

        index++
        await new Promise(r => setTimeout(r, 100))
    }
}

main()