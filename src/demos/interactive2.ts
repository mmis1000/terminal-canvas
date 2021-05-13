import EventEmitter = require("events");
import { Attribute, ColorMode, TerminalBuffer, Printer, Color } from "../terminal";

if (!process.stdout.isTTY) {
    throw new Error('Not tty')
}

const keyboard = new EventEmitter()

const tty = process.stdout as import('tty').WriteStream
process.stdin.setRawMode(true)
process.stdin.setEncoding('utf-8')

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


let part = ''
let unfinished = false

function checkUnfinished () {
    if (part.match(/^\x1b\[(?:\d+(?:;|\d+)+|\d+|)[^\d]$/)) {
        keyboard.emit('key', part)
        part = ''
        unfinished = false
    }
}

process.stdin.on('data', (key: string) => {
    const CTRL_C = '\x03'

    const keys = [...key]

    for (let i = 0; i < keys.length; i++) {
        const k = keys[i]

        if (k === CTRL_C) {
            process.emit('SIGINT', 'SIGINT')
        } else {
            if (unfinished) {
                part += k
                checkUnfinished()
            } else {
                if (k === '\x1b') {
                    unfinished = true
                    part += k
                } else {
                    keyboard.emit('key', k)
                }
            }
        }
    }
})

const printer = new Printer(tty.columns, tty.rows)

async function main () {
    function handler (key: string) {
        if (key === '\x09') {
            index = (index + 1) % items.length
        }
        if (key === '\x1b[Z') {
            index = (index - 1 + items.length) % items.length
        }
        if (key === '\x1b[A') {
            items[index].y -= 1
        }
        if (key === '\x1b[B') {
            items[index].y += 1
        }
        if (key === '\x1b[D') {
            items[index].x -= 1
        }
        if (key === '\x1b[C') {
            items[index].x += 1
        }
        if (key === 'c' || key === 'C') {
            items[index].color = (items[index].color + 1) % 16
        }

        paint()
    }

    keyboard.on('key', handler)

    function resizeHandler () {
        printer.resize(tty.columns, tty.rows)
        printer.updateScreenFull()
    }

    tty.on('resize', resizeHandler)

    const title = 'Title'
    const titleWidth = TerminalBuffer.lengthOf(title)

    const item = (t: string, color: number, x: number, y: number) => ({
        checked: false,
        x,
        y,
        text: t,
        color
    })

    const items = [
        item('Item 1', Color.blackBright, 0, 0),
        item('物件 2', Color.blue, 2, 1),
        item('Item 3', Color.cyan, 4, 2),
        item('Item 4', Color.gray, 6, 3),
        item('Item 5', Color.green, 8, 4),
        item('物件 6', Color.magenta, 10, 5),
        item('Item 7', Color.red, 12, 6),
        item('Item 8', Color.yellow, 14, 7),
    ]

    let index = 0

    async function paint () {
        printer.clear()
        const titleColor = Attribute.from({
            colorBackgroundMode: ColorMode.Palette,
            colorBackground: Color.white,
            colorForegroundMode: ColorMode.Palette,
            colorForeground: Color.black
        })

        printer.fill(0, 0, 1, printer.width, ' ', titleColor)
        printer.write(0, ~~(printer.width / 2 - titleWidth / 2), title, titleColor)

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            printer.fill(
                item.y + 1,
                item.x,
                6,
                12,
                item.text,
                Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: item.color,
                    colorForegroundMode: ColorMode.Palette,
                    colorForeground: i === index ? Color.blueBright : Color.white
                })
            )
        }
        let offset = 0
        offset += printer.write(
            printer.height - 1, offset,
            '[Shift+Tab] switch prev ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Tab] switch next ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[C] change color ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Up/Down/Left/Right] Move  ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Ctrl+C] Exit  ',
            Attribute.DEFAULT,
        )

        await printer.updateScreen()
    }

    await printer.initScreen()
    await paint()
}

main()