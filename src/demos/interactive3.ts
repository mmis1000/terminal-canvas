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
const canvas = new TerminalBuffer(tty.columns, tty.rows - 4)

async function main() {
    let x = 0;
    let y = 0;
    let color: Color = Color.red
    let message = ''
    let down = false
    function handler(key: string) {
        if (key === '\x1b[A') {
            y -= 1
            message = `Up (${y})`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
        }
        if (key === '\x1b[B') {
            y += 1
            message = `Down (${y})`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
        }
        if (key === '\x1b[D') {
            x -= 1
            message = `Left (${x})`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
        }
        if (key === '\x1b[C') {
            x += 1
            message = `Right (${x})`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
        }
        if (key === 'c' || key === 'C') {
            color = (color + 1) % 16
            message = `Color (${Color[color]})`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
        }
        if (key === 'r' || key === 'R') {
            printer.updateScreenFull()
            message = `Force refreshed`
        }
        if (key === 'z' || key === 'Z') {
            down = !down
            message = `Put the pen ${down ? 'down' : 'up'}`

            if (down) {
                canvas.fill(y, x, 1, 1, '', Attribute.from({
                    colorBackgroundMode: ColorMode.Palette,
                    colorBackground: color
                }))
            }
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

    const title = 'Interactive 3'
    const titleWidth = TerminalBuffer.lengthOf(title)

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

        printer.draw(canvas, 0, 0, 1, 0, canvas.height, canvas.width)

        printer.write(y + 1, x, down ? '+' : '-', Attribute.from({
            colorBackgroundMode: ColorMode.Palette,
            colorBackground: color,
            colorForegroundMode: ColorMode.Palette,
            colorForeground: color === Color.black ? Color.white : Color.black
        }))

        printer.write(
            printer.height - 3, 0,
            'Last message: ' + message,
            Attribute.DEFAULT,
        )

        let offset = 0
        offset += printer.write(
            printer.height - 2, offset,
            `[Z] pen down / pen up (${down ? 'down' : 'up'})  `,
            Attribute.DEFAULT,
        )
        offset += printer.write(
            printer.height - 2, offset,
            '[C] change color  ',
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