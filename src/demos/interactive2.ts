import EventEmitter = require("events");
import { Attribute, ColorMode, TerminalBuffer, Printer, Color, CompositeMode } from "../terminal";

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

function checkUnfinished() {
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

async function main() {
    let message = ''
    function handler(key: string) {
        if (key === '\x09') {
            index = (index + 1) % items.length
            message = `Selection changed (${index})`
        }
        if (key === '\x1b[Z') {
            index = (index - 1 + items.length) % items.length
            message = `Selection changed (${index})`
        }
        if (key === '\x1b[A') {
            items[index].y -= 1
            message = `Up (${items[index].y})`
        }
        if (key === '\x1b[B') {
            items[index].y += 1
            message = `Down (${items[index].y})`
        }
        if (key === '\x1b[D') {
            items[index].x -= 1
            message = `Left (${items[index].x})`
        }
        if (key === '\x1b[C') {
            items[index].x += 1
            message = `Right (${items[index].x})`
        }
        if (key === 'c' || key === 'C') {
            items[index].color = (items[index].color + 1) % 16
            message = `Color (${Color[items[index].color]})`
        }
        if (key === 'v' || key === 'V') {
            items[index].contentVisible = !items[index].contentVisible
            message = `Content Visible (${items[index].contentVisible})`
        }
        if (key === 'b' || key === 'B') {
            items[index].compositeMode = (items[index].compositeMode + 1) % 4
            message = `Composite Mode (${CompositeMode[items[index].compositeMode]})`
        }
        if (key === 'r' || key === 'R') {
            printer.updateScreenFull()
            message = `Force refreshed`
        }

        paint()
    }

    keyboard.on('key', handler)

    function resizeHandler() {
        printer.resize(tty.columns, tty.rows)
        printer.updateScreenFull()
        paint()
    }

    tty.on('resize', resizeHandler)

    const title = 'Interactive 2'
    const titleWidth = TerminalBuffer.lengthOf(title)

    const item = (t: string, color: number, x: number, y: number) => ({
        x,
        y,
        text: t,

        contentVisible: true,
        color,

        compositeMode: CompositeMode.OverrideBoth
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

    async function paint() {
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
                item.contentVisible ? item.text : '',
                Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: item.color,
                    colorForegroundMode: item.contentVisible ? ColorMode.Palette : ColorMode.Default,
                    colorForeground: i === index ? Color.blueBright : Color.white
                }),
                item.compositeMode
            )
        }

        printer.write(
            printer.height - 3, 0,
            'Last message: ' + message,
            Attribute.DEFAULT,
        )

        let offset = 0
        offset += printer.write(
            printer.height - 2, offset,
            '[Shift+Tab] switch prev  ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 2, offset,
            '[Tab] switch next  ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 2, offset,
            '[C] change color  ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 2, offset,
            '[V] toggle content  ',
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 2, offset,
            '[R] force refresh  ',
            Attribute.DEFAULT,
        )
        offset = 0
        offset += printer.write(
            printer.height - 1, offset,
            '[B] toggle composite mode  ',
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