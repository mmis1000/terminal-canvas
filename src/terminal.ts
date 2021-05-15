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

export enum CompositeMode {
    /** keep style and content of original slot unless specified in source */
    OverrideNone = 0,
    /** override the original slot even if content is null */
    OverrideContent = 1 << 0,
    /** override the original slot style even if style are default */
    OverrideStyle = 1 << 1,
    /** (Default) override the original slot even if content is null or style are default */
    OverrideBoth = OverrideContent | OverrideStyle,
}

export class Attribute {

    public readonly colorForeground: number = 0
    public readonly colorBackground: number = 0

    protected constructor(
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

    idDefault() {
        return this.colorBackgroundMode === ColorMode.Default && this.colorForegroundMode === ColorMode.Default
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

    mixWith(attr: Attribute) {
        const bgm = attr.colorBackgroundMode === ColorMode.Default ? this.colorBackgroundMode : attr.colorBackgroundMode
        const bg = attr.colorBackgroundMode === ColorMode.Default ? this.colorBackground: attr.colorBackground
        const fgm = attr.colorForegroundMode === ColorMode.Default ? this.colorForegroundMode : attr.colorForegroundMode
        const fg = attr.colorForegroundMode === ColorMode.Default ? this.colorForeground: attr.colorForeground

        return new Attribute(
            fgm,
            fg,
            bgm,
            bg
        )
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
    isPlaceHolder() {
        return this.length === 0
    }

    /**
     * This slot is a null cell
     */
    isNull() {
        return this.text === ''
    }

    clone() {
        const slot = new Slot()
        slot.length = this.length
        slot.text = this.text
        slot.attributes = this.attributes

        return slot
    }
}

export class TerminalBuffer {
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

    constructor(public width: number, public height: number) {
        this.grid = new Array(height).fill(this.nullFillCharacter).map(
            () => new Array(width).fill(this.nullFillCharacter).map(() => new Slot())
        )
    }

    resize(width: number, height: number) {
        if (height > this.height) {
            for (let i = 0; i < height - this.height; i++) {
                this.grid.push([])
            }
        }

        if (height < this.height) {
            this.grid = this.grid.slice(0, height)
        }

        for (let [index, row] of this.grid.entries()) {
            if (row.length < width) {
                const addition = width - row.length

                for (let i = 0; i < addition; i++) {
                    row.push(new Slot())
                }
            }

            if (row.length > width) {
                this.grid[index] = row.slice(0, width)
            }
        }

        for (let row of this.grid) {
            const last = row[row.length -1]
            if (last.length === 2) {
                last.length = 1
                last.text = this.nullFillCharacter
            }
        }

        this.width = width
        this.height = height
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

    /**
     * Write a text to the screen
     * @param row The row
     * @param col The cow
     * @param text Text you want to write
     * @param attr Text Style, tries to reuse original style at such pos if not specified
     * @param boundStart Cap the text on head at given bound
     * @param boundEnd Cap the text on end at given bound
     * @returns The off set of terminal cursor from the `row`
     */
    write(row: number, col: number, text: string, attr?: Attribute, boundStart = -Infinity, boundEnd = Infinity): number {
        if (text === '') return 0
        if (row < 0 || row >= this.height) return 0
        if (col >= this.width) return 0
        if (attr ? !attr.isValid() : false) throw new Error('invalid color')

        const realBoundStart = Math.max(col, 0, boundStart)
        const maxLength = Math.min(boundEnd - col, this.width - col)

        let offset = 0
        const checked: [offset: number, width: number, char: string][] = []

        const chars = [...text]

        let endCapped = false

        for (let char of chars) {
            const wc = TerminalBuffer.unicode.wcwidth(char.codePointAt(0)!)

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

        if (col + actualLength <= 0) return actualLength

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
            this.grid[row][i].text = this.nullFillCharacter
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
                this.grid[row][item[0] + 1].text = ''
                this.grid[row][item[0] + 1].length = 0
            }
        }

        return actualLength
    }

    /**
     * Serialize this buffer into a string for print to console
     * @returns The serialized text buffer
     */
    serialize() {
        const CLEAR = `\x1b[0m`

        const grid = this.grid

        let output = ''
        output += CLEAR

        let currentCursorStyle = Attribute.from({})

        for (const [rowNum, row] of grid.entries()) {
            let nullCount = 0
            for (const [colNum, slot] of row.entries()) {
                if (slot.text && slot.length !== TerminalBuffer.unicode.wcwidth(slot.text.codePointAt(0)!)) {
                    debugger
                }

                if (slot.length === 2 && row[colNum + 1].length !== 0) {
                    debugger
                }

                if (slot.isPlaceHolder()) {
                    continue
                }

                const styleDiff = slot.isNull()
                    ? TerminalBuffer.diffBgOnly(currentCursorStyle, slot.attributes)
                    : TerminalBuffer.diffStyle(currentCursorStyle, slot.attributes)

                if (styleDiff) {
                    // pad backgrounds
                    if (nullCount > 0) {
                        if (TerminalBuffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
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
                        if (TerminalBuffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
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

            if (nullCount > 0 && TerminalBuffer.diffBgOnly(this.defaultStyle, currentCursorStyle)) {
                output += `\x1b[${nullCount}X`;
            }

            // return output

            if (rowNum !== this.height - 1) {
                output += '\r\n'
            }
        }

        return output
    }

    private styleAt(row: number, col: number) {
        const cell = this.grid[row]?.[col]
        if (cell === undefined) {
            return null
        }

        if (cell.length === 0) {
            return this.grid[row][col - 1].attributes
        }

        return cell.attributes
    }

    clear (attr: Attribute = Attribute.DEFAULT) {
        this.fill(0, 0, this.height, this.width, '', attr)
    }

    /**
     * Fill the screen area with given text and style
     * @param dy row
     * @param dx col
     * @param h height
     * @param w width
     * @param text text to fill
     * @param attr style, reuse original if not specified
     * @param mode control how the result is handled when there is no text or there is no color
     */
    fill (
        dy: number,
        dx: number,
        h: number,
        w: number,
        text: string,
        attr?: Attribute,
        mode = CompositeMode.OverrideBoth
    ) {
        if (attr ? !attr.isValid() : false) throw new Error('invalid color')

        for (let r = 0; r < h; r++) {
            const row = this.grid[r + dy]
            if (row === undefined) continue

            for (let c = 0; c < w; c++) {
                const cell = row[c + dx]
                if (cell === undefined) continue

                if (c === 0 && cell.length === 0) {
                    if (mode & CompositeMode.OverrideContent) {
                        row[c + dx - 1].length = 1
                        row[c + dx - 1].text = this.nullFillCharacter
                    } else {
                        // we shouldn't
                        continue
                    }
                } else if (c === w - 1 && cell.length === 2) {
                    if (mode & CompositeMode.OverrideContent) {
                        row[c + dx + 1].length = 1
                        row[c + dx + 1].text = this.nullFillCharacter
                    } else {
                        // we shouldn't
                        continue
                    }
                } else {
                    // nos special handle
                }
                // if (cell.length === 0) {
                //     row[c + dx - 1].length = 1
                //     row[c + dx - 1].text = this.nullFillCharacter
                // }

                // if (cell.length === 2) {
                //     row[c + dx + 1].length = 1
                //     row[c + dx + 1].text = this.nullFillCharacter
                // }

                if (mode & CompositeMode.OverrideContent) {
                    cell.length = 1
                    cell.text = this.nullFillCharacter
                }

                if (attr !== undefined) {
                    if (mode & CompositeMode.OverrideStyle) {
                        cell.attributes = attr
                    } else {
                        cell.attributes = cell.attributes.mixWith(attr)
                    }
                }
            }
        }

        if (text !== '') {
            const style = mode | CompositeMode.OverrideContent ? attr : undefined
            for (let r = dy; r < dy + h; r++) {
                let pos = dx
                while (pos < dx + w) {
                    const length = this.write(r, pos, text, style, dx, dx + w)
                    pos = pos + length
                    if (length <= 0) {
                        break
                    }
                }
            }
        }
    }

    /**
     * Draw another (or current) buffer over current buffer, throws if origin and target overlaps
     * @param buf Source buffer
     * @param sy source row
     * @param sx source col
     * @param dy dist row
     * @param dx dist cow
     * @param h height
     * @param w width
     */
    draw(buf: TerminalBuffer, sy: number, sx: number, dy: number, dx: number, h: number, w: number) {
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
                        this.grid[r + dy][c + dx + 1].text = ''
                    }
                }
            }
        }
    }

    /**
     * Generate a diff that is used to turn targeted screen status into this buffer's screen status
     * @param toBuf The initial state
     * @param fromY row in current buffer
     * @param fromX col in current buffer
     * @param toY row in initial state
     * @param toX col in initial state
     * @param h height
     * @param w width
     * @returns Diff
     */
    diff(toBuf: TerminalBuffer, fromY: number, fromX: number, toY: number, toX: number, h: number, w: number): string {
        let res = ''

        let currentCursorStyle = Attribute.from({
            colorBackgroundMode: ColorMode.Invalid
        })

        let defaultSlot = new Slot()

        for (let r = 0; r < h; r++) {
            let skip = 0
            let nullFill = 0

            for (let c = 0; c < w; c++) {
                let oldSlot: Slot = toBuf.grid[r + toY]?.[c + toX] || defaultSlot
                let newSlot: Slot = this.grid[r + fromY]?.[c + fromX] || defaultSlot

                if (c === 0) {
                    if (oldSlot.length === 0) {
                        const prev = oldSlot
                        oldSlot = new Slot()
                        oldSlot.text = this.nullFillCharacter
                        oldSlot.attributes = prev.attributes.with({
                            colorBackgroundMode: ColorMode.Invalid
                        })
                    }
                    if (newSlot.length === 0) {
                        const prev = newSlot
                        newSlot = new Slot()
                        newSlot.text = this.nullFillCharacter
                        newSlot.attributes = prev.attributes
                    }
                }

                if (c === w - 1) {
                    if (oldSlot.length === 2) {
                        const prev = oldSlot
                        oldSlot = new Slot()
                        oldSlot.text = this.nullFillCharacter
                        oldSlot.attributes = prev.attributes.with({
                            colorBackgroundMode: ColorMode.Invalid
                        })
                    }

                    if (newSlot.length === 2) {
                        const prev = newSlot
                        newSlot = new Slot()
                        newSlot.text = this.nullFillCharacter
                        newSlot.attributes = prev.attributes
                    }
                }

                const textChanged = oldSlot.length !== newSlot.length ||
                    oldSlot.text !== newSlot.text

                const styleChange = newSlot.isNull() && oldSlot.isNull()
                    ? TerminalBuffer.diffBgOnly(oldSlot.attributes, newSlot.attributes)
                    : TerminalBuffer.diffStyle(oldSlot.attributes, newSlot.attributes)

                const styleSwitch = newSlot.isNull()
                    ? TerminalBuffer.diffBgOnly(currentCursorStyle, newSlot.attributes)
                    : TerminalBuffer.diffStyle(currentCursorStyle, newSlot.attributes)

                const needSwitchStyle = styleSwitch.length > 0
                const needOutput = newSlot.length > 0 && (textChanged || styleChange)

                if (!needOutput) {
                    if (nullFill > 0) {
                        res += `\x1b[${nullFill}X`
                        res += `\x1b[${nullFill}C`
                        nullFill = 0
                    }

                    skip += newSlot.length
                } else {
                    if (skip > 0) {
                        res += `\x1b[${skip}C`
                        skip = 0
                    }

                    if (styleChange || needSwitchStyle) {
                        if (nullFill > 0) {
                            res += `\x1b[${nullFill}X`
                            res += `\x1b[${nullFill}C`
                            nullFill = 0
                        }
                    }

                    if (needSwitchStyle) {
                        res += styleSwitch
                        if (newSlot.isNull()) {
                            currentCursorStyle = currentCursorStyle.with({
                                colorBackgroundMode: newSlot.attributes.colorBackgroundMode,
                                colorBackground: newSlot.attributes.colorBackground
                            })
                        } else {
                            currentCursorStyle = newSlot.attributes
                        }
                    }

                    if (newSlot.isNull()) {
                        nullFill++
                    } else {
                        if (nullFill > 0) {
                            res += `\x1b[${nullFill}X`
                            res += `\x1b[${nullFill}C`
                            nullFill = 0
                        }

                        res += newSlot.text
                    }
                }
            }

            if (nullFill > 0) {
                res += `\x1b[${nullFill}X`
                res += `\x1b[${nullFill}C`
                nullFill = 0
            }

            if (r !== h - 1) {
                res += '\r\n'
            }
        }

        return res
    }
}

export class Printer extends TerminalBuffer {
    private currentScreen: TerminalBuffer

    constructor(width: number, height: number) {
        super(width, height)

        this.currentScreen = new TerminalBuffer(width, height)
    }

    resize(width: number, height: number) {
        super.resize(width, height)
        this.currentScreen.resize(width, height)
    }

    async initScreen() {
        this.currentScreen.draw(this, 0, 0, 0, 0, this.height, this.width)
        const res = this.currentScreen.serialize()

        await new Promise(r => {
            process.stdout.write('\r\n'.repeat(this.height - 1) + '\x1b[1;1H\x1b[0m' + res, r)
        })
    }

    async updateScreenFull() {
        this.currentScreen.draw(this, 0, 0, 0, 0, this.height, this.width)
        const res = this.currentScreen.serialize()

        await new Promise(r => {
            process.stdout.write('\x1b[1;1H\x1b[0m' + res, r)
        })
    }

    async updateScreen() {
        const diff = this.diff(this.currentScreen, 0, 0, 0, 0, this.height, this.width)
        this.currentScreen.draw(this, 0, 0, 0, 0, this.height, this.width)

        await new Promise(r => {
            process.stdout.write(`\x1b[1;1H\x1b[0m${ diff }\x1b[0m`, r)
        })
    }
}