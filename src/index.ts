import { Attribute, Color, ColorMode, Terminal } from "./terminal";

if (!process.stdout.isTTY) {
    throw new Error('Not tty')
}

const tty = process.stdout as import('tty').WriteStream

const term = new Terminal(tty.columns, tty.rows)

async function main () {
    let index = 0

    await new Promise(r => {
        process.stdout.write('\r\n'.repeat(tty.rows - 1), r)
    })


    const border = 6

    for (let row = border; row < term.height - border; row++) {
        for (let col = border; col < term.width - border; col++) {
            const cell = term.grid[row][col]
            cell.attributes.setBackground(ColorMode.Palette, ~~(/*+index  row + */col / 4) % 16)
            cell.attributes.setForeground(ColorMode.Palette, ~~(/*index + row + */col / 4 + 8) % 16)
            cell.length = 1
            cell.text = ' '//(~~(index /*+ row*/ + col) % 16).toString(16)
        }
    }

    while (true) {
        const str = '中文測試, Test中文測試'
        const strLength = Terminal.lengthOf(str)

        const attr = new Attribute()
        attr.setForeground(ColorMode.Palette, Color.black)
        attr.setBackground(ColorMode.Palette, Color.red)

        for (let i = 0; i < 2; i++) {
            attr.setBackground(ColorMode.Palette, ~~(Math.random() * 8 + 8))

            const x = ~~((term.width + strLength) * Math.random()) - strLength

            term.write(border + ~~(Math.random() * (term.height - border * 2)), x, '中文測試, Test中文測試', attr, border, term.width - border)
        }

        const res = term.serialize()

        await new Promise(r => {
            process.stdout.write(`\x1b[1;1H` + res + '\x1b[0m', r)
        })

        index++
        await new Promise(r => setTimeout(r, 100))
    }
}

main()