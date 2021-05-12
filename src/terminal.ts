import { UnicodeV11 } from "./unicode11"

export enum ColorMode {
    Default,
    Palette,
    Real,
    /** 
     * This color can only be used as default background to force the color opcode to flush to console.
     * Try to draw this color triggers a panic immediately
     * */
    Invalid
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
    
    public readonly colorForeground: number = 0
    public readonly colorBackground: number = 0

    protected constructor (
        public readonly colorForegroundMode: ColorMode = ColorMode.Default,
        colorForeground: number = 0,
        public readonly colorBackgroundMode: ColorMode = ColorMode.Default,
        colorBackground: number = 0
    ) {
        if (colorForegroundMode === ColorMode.Default || colorForegroundMode === ColorMode.Invalid) {
            this.colorForeground = 0
        } else {
            this.colorForeground = colorForeground
        }

        if (colorBackgroundMode === ColorMode.Default || colorBackgroundMode === ColorMode.Invalid) {
            this.colorBackground = 0
        } else {
            this.colorBackground = colorBackground
        }
    }

    with({
        colorForegroundMode,
        colorForeground,
        colorBackgroundMode,
        colorBackground
    }: {
        colorForegroundMode?: ColorMode,
        colorForeground?: number,
        colorBackgroundMode?: ColorMode,
        colorBackground?: number
    } = {}) {
        const newAttr = new Attribute(
            colorForegroundMode ?? this.colorForegroundMode,
            colorForeground ?? this.colorForeground,
            colorBackgroundMode ?? this.colorBackgroundMode,
            colorBackground ?? this.colorBackground
        )

        return newAttr
    }

    isValid() {
        return this.colorBackgroundMode !== ColorMode.Invalid && this.colorForegroundMode !== ColorMode.Invalid
    }

    static from({
        colorForegroundMode = ColorMode.Default,
        colorForeground = 0,
        colorBackgroundMode = ColorMode.Default,
        colorBackground = 0
    }: {
        colorForegroundMode?: ColorMode,
        colorForeground?: number,
        colorBackgroundMode?: ColorMode,
        colorBackground?: number
    } = {}) {
        const attr = new Attribute(
            colorForegroundMode,
            colorForeground,
            colorBackgroundMode,
            colorBackground
        )
        return attr
    }

    static DEFAULT = new Attribute()
}

export class Slot {
    length: number = 1
    text: string = ''
    attributes: Attribute = Attribute.DEFAULT

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
        slot.attributes = this.attributes
    }
}

export class Buffer {
    grid: Slot[][]
    static unicode = new UnicodeV11

    nullFillCharacter = ''
    defaultStyle = Attribute.from({
        colorBackgroundMode: ColorMode.Invalid,
        colorForegroundMode: ColorMode.Invalid
    })

    static lengthOf(str: string) {
        return [...str].map(c => this.unicode.wcwidth(c.codePointAt(0)!)).reduce<number>((a, b) => a + b, 0)
    }

    constructor (public width: number, public height: number) {
        this.grid = new Array(height).fill(this.nullFillCharacter).map(
            () => new Array(width).fill(this.nullFillCharacter).map(() => new Slot())
        )
    }

    resize(width: number, height: number) {
        this.width = width
        this.height = height

        this.grid = new Array(height).fill(this.nullFillCharacter).map(
            () => new Array(width).fill(this.nullFillCharacter).map(() => new Slot())
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
        } else if (next.colorBackgroundMode === ColorMode.Default) {
            return `\x1b[49m`
        } else if (next.colorBackgroundMode === ColorMode.Real) {
            return `\x1b[48;2;${(color >>> 16) & 0xFF};${(color >>> 8) & 0xFF};${color & 0xFF}m`
        } else {
            throw new Error('Invalid color mode')
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
            } else if (next.colorForegroundMode === ColorMode.Real) {
                sgrSeq.push(38, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF);
            } else {
                throw new Error('Invalid color mode')
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
            } else if (next.colorBackgroundMode === ColorMode.Real) {
                sgrSeq.push(48, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF);
            } else {
                throw new Error('Invalid color mode')
            }
        }

        return `\x1b[${sgrSeq.join(';')}m`
    }

    write (row: number, col: number, text: string, attr?: Attribute, boundStart = -Infinity, boundEnd = Infinity): number {
        if (row >= this.height) return 0
        if (col >= this.width) return 0
        if (attr ? !attr.isValid() : false) throw new Error('invalid color')

        const realBoundStart = Math.max(col, 0, boundStart)
        const maxLength = Math.min(boundEnd - col, this.width - col)

        let offset = 0
        const checked: [offset: number, width: number, char: string][] = []

        const chars = [...text]

        let endCapped = false

        for (let char of chars) {
            const wc = Buffer.unicode.wcwidth(char.codePointAt(0)!)

            if (wc + offset > maxLength) {
                if (1 + offset <= maxLength) endCapped = true
                break
            }

            checked.push([
                col + offset,
                wc,
                char
            ])

            offset = offset + wc
        }

        const actualLength = endCapped ? offset + 1 : offset

        if (col + actualLength <= 0) return 0

        // double width head fix
        if (
            this.grid[row][realBoundStart] &&
            this.grid[row][realBoundStart].length === 0
        ) {
            this.grid[row][realBoundStart - 1].length = 1
            this.grid[row][realBoundStart - 1].text = this.nullFillCharacter
            this.grid[row][realBoundStart].length = 1
            this.grid[row][realBoundStart].text = this.nullFillCharacter
        }

        // double width end fix
        if (
            this.grid[row][col + actualLength - 1] &&
            this.grid[row][col + actualLength - 1].length === 2
        ) {
            this.grid[row][col + actualLength - 1].length = 1
            this.grid[row][col + actualLength - 1].text = this.nullFillCharacter
            this.grid[row][col + actualLength].length = 1
            this.grid[row][col + actualLength].text = this.nullFillCharacter
        }

        // zoning
        for (let i = realBoundStart; i < col + actualLength; i++) {
            this.grid[row][i].length = 1
            this.grid[row][i].text = ' '
            if (attr) {
                this.grid[row][i].attributes = attr
            }
        }

        //fill
        for (let item of checked) {
            if (item[0] < realBoundStart) {
                if (item[0] >= 0 && item[0] + item[1] > realBoundStart) {
                    this.grid[row][item[0]].length = 1
                    this.grid[row][item[0]].text = this.nullFillCharacter
                    this.grid[row][item[0] + 1].length = 1
                    this.grid[row][item[0] + 1].text = this.nullFillCharacter
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
                this.grid[row][item[0] + 1].text = this.nullFillCharacter
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

        let currentCursorStyle = Attribute.from({})

        for (const [rowNum, row] of grid.entries()) {
            let nullCount = 0
            for (const [colNum, slot] of row.entries()) {
                if (slot.text && slot.length !== Buffer.unicode.wcwidth(slot.text.codePointAt(0)!)) {
                    debugger
                }

                if (slot.length === 2 && row[colNum + 1].length !== 0) {
                    debugger
                }

                if (slot.isPlaceHolder()) {
                    continue
                }

                const styleDiff = slot.isNull() 
                    ? Buffer.diffBgOnly(currentCursorStyle, slot.attributes)
                    : Buffer.diffStyle(currentCursorStyle, slot.attributes)
                
                if (styleDiff) {
                    // pad backgrounds
                    if (nullCount > 0) {
                        if (Buffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
                            output += `\x1b[${nullCount}X`;
                        }

                        output += `\x1b[${nullCount}C`;
                        nullCount = 0
                    }

                    if (slot.isNull()) {
                        currentCursorStyle = currentCursorStyle.with({
                            colorBackgroundMode: slot.attributes.colorBackgroundMode,
                            colorBackground: slot.attributes.colorBackground
                        })
                    } else {
                        currentCursorStyle = slot.attributes
                    }

                    output += styleDiff
                }

                if (!slot.isNull()) {
                    if (nullCount > 0) {
                        if (Buffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
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

            if (nullCount > 0 && Buffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
                output += `\x1b[${nullCount}X`;
            }

            // return output

            if (rowNum !== this.height - 1) {
                output += '\r\n'
            }
        }

        return output
    }

    styleAt(row: number, col: number) {
        const cell = this.grid[row]?.[col]
        if (cell === undefined) {
            return null
        }

        if (cell.length === 0) {
            return this.grid[row][col - 1].attributes
        }

        return cell.attributes
    }

    fill(dy: number, dx: number, h: number, w: number, text: string, attr?: Attribute) {
        if (attr ? !attr.isValid() : false) throw new Error('invalid color')

        for (let r = 0; r < h; r++) {
            const row = this.grid[r + dy]
            if (row === undefined) continue

            for (let c = 0; c < w; c++) {
                const cell = row[c + dx]
                if (cell === undefined) continue

                if (cell.length === 0) {
                    row[c + dx - 1].length = 1
                    row[c + dx - 1].text = this.nullFillCharacter
                }

                if (cell.length === 2) {
                    row[c + dx + 1].length = 1
                    row[c + dx + 1].text = this.nullFillCharacter
                }

                cell.length = 1
                cell.text = this.nullFillCharacter

                if (attr !== undefined) {
                    cell.attributes = attr
                }
            }
        }

        for (let r = dy; r < dy + h; r++) {
            let pos = dx
            while (pos < dx + w) {
                const length = this.write(r, pos, text, attr, dx, dx + w)
                pos = pos + length
                if (length <= 0) {
                    break
                }
            }
        }
    }

    draw(buf: Buffer, sy: number, sx: number, dy: number, dx: number, h: number, w: number) {
        if (buf === this &&
            sy + h > dy && dy + h > sy &&
            sx + w > dx && dx + w > sx
        ) {
            throw new Error('Source and target overlapped')
        }

        for (let r = 0; r < h; r++) {
            const row = this.grid[r + dy]
            if (row === undefined) continue

            for (let c = 0; c < w; c++) {
                const cell = row[c + dx]
                if (cell === undefined) continue

                if (cell.length === 0) {
                    row[c + dx - 1].length = 1
                    row[c + dx - 1].text = this.nullFillCharacter
                }
                if (cell.length === 2) {
                    row[c + dx + 1].length = 1
                    row[c + dx + 1].text = this.nullFillCharacter
                }

                cell.length = 1
                cell.text = this.nullFillCharacter
                
                const newStyle = buf.styleAt(r + sy, c + sx)
                if (newStyle !== null) {
                    cell.attributes = newStyle
                }
            }
        }

        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const from = buf.grid[r + sy]?.[c + sx]
                const to = this.grid[r + dy]?.[c + dx]

                if (from !== undefined && to !== undefined) {
                    if (from.length === 0) continue
                    if (
                        from.length === 1 &&
                        this.grid[r + dy]?.[c + dx] !== undefined
                    ) {
                        this.grid[r + dy][c + dx].length = 1
                        this.grid[r + dy][c + dx].text = from.text
                    }
                    if (
                        from.length === 2 && c + 1 < w &&
                        this.grid[r + dy]?.[c + dx] !== undefined &&
                        this.grid[r + dy]?.[c + dx + 1] !== undefined
                    ) {
                        this.grid[r + dy][c + dx].length = 2
                        this.grid[r + dy][c + dx].text = from.text
                        this.grid[r + dy][c + dx + 1].length = 0
                        this.grid[r + dy][c + dx + 1].text = this.nullFillCharacter
                    }
                }
            }
        }
    }
}