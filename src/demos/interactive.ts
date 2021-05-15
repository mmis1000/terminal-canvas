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
        if (key === '\x1b[A' && index > 0) {
            index -= 1
        }
        if (key === '\x1b[B' && index < options.length - 1) {
            index += 1
        }
        if (key === ' ') {
            options[index].checked = !options[index].checked
        }
        if (key === '\x1b[D') {
            options[index].pad -= 1
        }
        if (key === '\x1b[C') {
            options[index].pad += 1
        }

        paint()
    }

    keyboard.on('key', handler)

    function resizeHandler () {
        printer.resize(tty.columns, tty.rows)
        printer.updateScreenFull()
        paint()
    }

    tty.on('resize', resizeHandler)

    const title = 'Interactive 1'
    const titleWidth = TerminalBuffer.lengthOf(title)

    const item = (t: string) => ({
        checked: false,
        pad: 0,
        text: t
    })

    const options = [
        item('Item 1'),
        item('物件 2'),
        item('Item 3'),
        item('Item 4'),
    ]

    let index = 0

    async function paint () {
        printer.clear(Attribute.DEFAULT)
        const titleColor = Attribute.from({
            colorBackgroundMode: ColorMode.Palette,
            colorBackground: Color.white,
            colorForegroundMode: ColorMode.Palette,
            colorForeground: Color.black
        })

        printer.fill(0, 0, 1, printer.width, ' ', titleColor)
        printer.write(0, ~~(printer.width / 2 - titleWidth / 2), title, titleColor)

        const selectColor = Attribute.from({
            colorForegroundMode: ColorMode.Palette,
            colorForeground: Color.greenBright
        })

        for (let i = 0; i < options.length; i++) {
            printer.write(
                i + 1, options[i].pad, 
                (options[i].checked ? '[x] ' : '[ ] ') + options[i].text,
                i === index ? selectColor : Attribute.DEFAULT
            )
        }
        let offset = 0
        offset += printer.write(
            printer.height - 1, offset,
            '[Up/Down] Select  ',
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Left/Right] Move  ',
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Space] Check  ',
        )
        offset += printer.write(
            printer.height - 1, offset,
            '[Ctrl+c] Exit  ',
        )

        await printer.updateScreen()
    }

    await printer.initScreen()
    await paint()
}

main()