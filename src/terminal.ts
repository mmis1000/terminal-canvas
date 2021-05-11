import { UnicodeV11 } from "./unicode11"

export enum ColorMode {
    Default,
    Palette,
    Real
}

export enum Color {
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    blackBright,
    redBright,
    greenBright,
    yellowBright,
    blueBright,
    magentaBright,
    cyanBright,
    whiteBright,

    gray = blackBright,
    grey = blackBright,
}

export class Attribute {
    colorForegroundMode: ColorMode = ColorMode.Default
    colorForeground: number = 0
    colorBackgroundMode: ColorMode = ColorMode.Default
    colorBackground: number = 0

    clone () {
        const attr = new Attribute()
        attr.colorForegroundMode = this.colorForegroundMode
        attr.colorForeground = this.colorForeground
        attr.colorBackgroundMode = this.colorBackgroundMode
        attr.colorBackground = this.colorBackground
        return attr
    }

    hasBackground () {
        return this.colorBackground !== 0
    }

    applyBackground(attr: Attribute) {
        const newAttr = new Attribute()
        newAttr.colorForegroundMode = this.colorForegroundMode
        newAttr.colorForeground = this.colorForeground
        newAttr.colorBackgroundMode = attr.colorBackgroundMode
        newAttr.colorBackground = attr.colorBackground
        return newAttr
    }

    setForeground(mode: ColorMode, color: number) {
        if (mode !== ColorMode.Default) {
            this.colorForegroundMode = mode
            this.colorForeground = color
        } else {
            this.colorForegroundMode = mode
            this.colorForeground = 0
        }
    }

    setBackground(mode: ColorMode, color: number) {
        if (mode !== ColorMode.Default) {
            this.colorBackgroundMode = mode
            this.colorBackground = color
        } else {
            this.colorBackgroundMode = mode
            this.colorBackground = 0
        }
    }
}

export class Slot {
    length: number = 1
    text: string = ''
    attributes: Attribute = new Attribute()

    /**
     * This slot didn't exist, it is a placeholder after cjk text
     */
    isPlaceHolder () {
        return this.length === 0
    }

    /**
     * This slot is a null cell
     */
    isNull () {
        return this.text === ''
    }

    clone () {
        const slot = new Slot()
        slot.length = this.length
        slot.text = this.text
        slot.attributes = this.attributes.clone()
    }
}

export class Terminal {
    grid: Slot[][]
    static unicode = new UnicodeV11

    static lengthOf(str: string) {
        return [...str].map(c => this.unicode.wcwidth(c.codePointAt(0)!)).reduce<number>((a, b) => a + b, 0)
    }

    constructor (public width: number, public height: number) {
        this.grid = new Array(height).fill('').map(
            () => new Array(width).fill('').map(() => new Slot())
        )
    }

    resize(width: number, height: number) {
        this.width = width
        this.height = height

        this.grid = new Array(height).fill('').map(
            () => new Array(width).fill('').map(() => new Slot())
        )
    }

    static diffBgOnly(prev: Attribute, next: Attribute): string {
        if (prev.colorBackgroundMode === next.colorBackgroundMode &&
            prev.colorBackground === next.colorBackground) {
            return ''
        }

        const color = next.colorBackground
        if (next.colorBackgroundMode === ColorMode.Palette) {
            if (color < 16) {
                return `\x1b[${color & 8 ? 100 + (color & 7) : 40 + (color & 7)}m`
            } else {
                return `\x1b[48;5;${color}m`
            }
        } else if (next.colorForegroundMode === ColorMode.Default) {
            return `\x1b[49m`
        } else {
            return `\x1b[48;2;${(color >>> 16) & 0xFF};${(color >>> 8) & 0xFF};${color & 0xFF}m`
        }
    }

    static diffStyle(prev: Attribute, next: Attribute): string {
        const bgChanged = prev.colorBackgroundMode !== next.colorBackgroundMode ||
        prev.colorBackground !== next.colorBackground
        const fgChanged = prev.colorForegroundMode !== next.colorForegroundMode ||
        prev.colorForeground !== next.colorForeground

        if (!bgChanged && !fgChanged) {
            return ''
        }

        const sgrSeq = []
        if (fgChanged) {
            const color = next.colorForeground
            if (next.colorForegroundMode === ColorMode.Palette) {
                if (color < 16) {
                    sgrSeq.push(color & 8 ? 90 + (color & 7) : 30 + (color & 7));
                } else {
                    sgrSeq.push(38, 5, color);
                }
            } else if (next.colorForegroundMode === ColorMode.Default) {
                sgrSeq.push(39);
            } else {
                sgrSeq.push(38, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF);
            }
        }
        if (bgChanged) {
            const color = next.colorBackground
            if (next.colorBackgroundMode === ColorMode.Palette) {
                if (color < 16) {
                    sgrSeq.push(color & 8 ? 100 + (color & 7) : 40 + (color & 7));
                } else {
                    sgrSeq.push(48, 5, color);
                }
            } else if (next.colorBackgroundMode === ColorMode.Default) {
                sgrSeq.push(49);
            } else {
                sgrSeq.push(48, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF);
            }
        }

        return `\x1b[${sgrSeq.join(';')}m`
    }

    write (row: number, col: number, text: string, attr?: Attribute, boundStart = -Infinity, boundEnd = Infinity): number {
        if (row >= this.height) return 0
        if (col >= this.width) return 0

        const realBoundStart = Math.max(col, 0, boundStart)
        const maxLength = Math.min(boundEnd - col, this.width - col)

        let offset = 0
        const checked: [offset: number, width: number, char: string][] = []

        const chars = [...text]

        for (let char of chars) {
            const wc = Terminal.unicode.wcwidth(char.codePointAt(0)!)

            if (wc + offset > maxLength) break

            checked.push([
                col + offset,
                wc,
                char
            ])

            offset = offset + wc
        }

        const actualLength = offset

        if (col + actualLength < 0) return 0

        // double width head fix
        if (
            this.grid[row][realBoundStart] &&
            this.grid[row][realBoundStart].length === 0
        ) {
            this.grid[row][realBoundStart - 1].length = 1
            this.grid[row][realBoundStart - 1].text = ''
            this.grid[row][realBoundStart].length = 1
            this.grid[row][realBoundStart].text = ''
        }

        // double width end fix
        if (
            this.grid[row][col + actualLength - 1] &&
            this.grid[row][col + actualLength - 1].length === 2
        ) {
            this.grid[row][col + actualLength - 1].length = 1
            this.grid[row][col + actualLength - 1].text = ''
            this.grid[row][col + actualLength].length = 1
            this.grid[row][col + actualLength].text = ''
        }

        // zoning
        for (let i = realBoundStart; i < col + actualLength; i++) {
            this.grid[row][i].length = 1
            this.grid[row][i].text = ''
            if (attr) {
                this.grid[row][i].attributes = attr.clone()
            }
        }

        //fill
        for (let item of checked) {
            if (item[0] < realBoundStart) {
                if (item[0] + item[1] > realBoundStart) {
                    this.grid[row][item[0]].length = 1
                    this.grid[row][item[0]].text = ''
                    this.grid[row][item[0] + 1].length = 1
                    this.grid[row][item[0] + 1].text = ''
                }
                continue
            }

            if (item[1] === 1) {
                this.grid[row][item[0]].text = item[2]
                this.grid[row][item[0]].length = 1
            }

            if (item[1] === 2) {
                this.grid[row][item[0]].text = item[2]
                this.grid[row][item[0]].length = 2
                this.grid[row][item[0] + 1].text = ''
                this.grid[row][item[0] + 1].length = 0
            }
        }

        return actualLength
    }

    serialize() {
        const CLEAR = `\x1b[0m`

        const grid = this.grid

        let output = ''
        output += CLEAR

        let currentCursorStyle = new Attribute()

        for (const [rowNum, row] of grid.entries()) {
            let nullCount = 0
            for (const [colNum, slot] of row.entries()) {
                if (slot.text && slot.length !== Terminal.unicode.wcwidth(slot.text.codePointAt(0)!)) {
                    debugger
                }

                if (slot.length === 2 && row[colNum + 1].length !== 0) {
                    debugger
                }

                if (slot.isPlaceHolder()) {
                    continue
                }

                const styleDiff = slot.isNull() 
                    ? Terminal.diffBgOnly(currentCursorStyle, slot.attributes)
                    : Terminal.diffStyle(currentCursorStyle, slot.attributes)
                
                if (styleDiff) {
                    // pad backgrounds
                    if (nullCount > 0) {
                        if (currentCursorStyle.hasBackground()) {
                            output += `\x1b[${nullCount}X`;
                        }

                        output += `\x1b[${nullCount}C`;
                        nullCount = 0
                    }

                    if (slot.isNull()) {
                        currentCursorStyle = currentCursorStyle.applyBackground(slot.attributes)
                    } else {
                        currentCursorStyle = slot.attributes
                    }

                    output += styleDiff
                }

                if (!slot.isNull()) {
                    if (nullCount > 0) {
                        if (currentCursorStyle.hasBackground()) {
                            output += `\x1b[${nullCount}X`;
                        }
                        output += `\x1b[${nullCount}C`;
                        nullCount = 0
                    }
                    output += slot.text
                } else {
                    nullCount += slot.length
                }
            }

            if (nullCount > 0 && currentCursorStyle.hasBackground()) {
                output += `\x1b[${nullCount}X`;
            }

            // return output

            if (rowNum !== this.height - 1) {
                output += '\r\n'
            }
        }

        return output
    }
}