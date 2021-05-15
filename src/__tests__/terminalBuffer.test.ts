import { Attribute, Color, ColorMode, TerminalBuffer } from '../'

test('resize up', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })

    const buf1 = new TerminalBuffer(1, 1)
    buf1.resize(2, 2)

    expect(buf1.grid.length).toBe(2)
    expect(buf1.grid[0].length).toBe(2)
})
test('resize down', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })

    const buf1 = new TerminalBuffer(2, 2)
    buf1.resize(1, 1)

    expect(buf1.grid.length).toBe(1)
    expect(buf1.grid[0].length).toBe(1)
})

test('clear', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })

    const buf1 = new TerminalBuffer(1, 1)
    buf1.nullFillCharacter = '.'
    buf1.clear(c1)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][0].text).toBe('.')
})

test('write: simple', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const buf1 = new TerminalBuffer(4, 1)
    buf1.write(0, 0, '中1', c1)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][0].text).toBe('中')
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].text).toBe('1')
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('write: clip on head', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const buf1 = new TerminalBuffer(4, 1)
    buf1.nullFillCharacter = '.'
    buf1.write(0, 0, '中1', c1, 1)

    expect(buf1.grid[0][0].attributes.colorBackgroundMode).toBe(ColorMode.Default)
    expect(buf1.grid[0][0].text).toBe('.')
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][1].text).toBe('.')
    expect(buf1.grid[0][2].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].text).toBe('1')
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})
test('write: clip on end', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const buf1 = new TerminalBuffer(4, 1)
    buf1.nullFillCharacter = '.'
    buf1.write(0, 0, '1中', c1, undefined, 2)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][0].text).toBe('1')
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][1].text).toBe('.')
    expect(buf1.grid[0][2].attributes.colorBackgroundMode).toBe(ColorMode.Default)
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('fill: horizontal', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const buf1 = new TerminalBuffer(4, 2)
    buf1.fill(0, 0, 2, 2, '', c1)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].attributes.colorBackgroundMode).toBe(ColorMode.Default)
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('fill: vertical', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const buf1 = new TerminalBuffer(2, 4)
    buf1.fill(0, 0, 2, 2, '', c1)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[1][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[2][0].attributes.colorBackgroundMode).toBe(ColorMode.Default)
    expect(buf1.grid[3][0].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('fill: double width on edge', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })

    const buf1 = new TerminalBuffer(4, 2)
    buf1.nullFillCharacter = '.'

    buf1.fill(0, 0, 2, 3, '中', c1)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][0].text).toBe('中')
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][2].text).toBe('.')
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('draw: horizontal', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const c2 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.red
    })
    const buf1 = new TerminalBuffer(4, 2)
    buf1.fill(0, 0, 2, 2, '', c1)

    const buf2 = new TerminalBuffer(2, 2)
    buf2.fill(0, 0, 2, 2, '', c2)

    buf1.draw(buf2, 0, 0, 0, 1, 2, 2)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[0][2].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('draw: horizontal with double width - text overlap', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const c2 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.red
    })
    const buf1 = new TerminalBuffer(4, 2)
    buf1.fill(0, 0, 2, 2, '中', c1)

    const buf2 = new TerminalBuffer(2, 2)
    buf2.fill(0, 0, 2, 2, '中', c2)

    buf1.draw(buf2, 0, 0, 0, 1, 2, 2)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[0][0].text).toBe('')
    expect(buf1.grid[0][1].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[0][1].text).toBe('中')
    expect(buf1.grid[0][2].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[0][3].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})

test('draw: vertical', () => {
    const c1 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.blue
    })
    const c2 = Attribute.from({
        colorBackgroundMode: ColorMode.Palette,
        colorBackground: Color.red
    })
    const buf1 = new TerminalBuffer(2, 4)
    buf1.fill(0, 0, 2, 2, '', c1)

    const buf2 = new TerminalBuffer(2, 2)
    buf2.fill(0, 0, 2, 2, '', c2)

    buf1.draw(buf2, 0, 0, 1, 0, 2, 2)

    expect(buf1.grid[0][0].attributes.colorBackground).toBe(Color.blue)
    expect(buf1.grid[1][0].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[2][0].attributes.colorBackground).toBe(Color.red)
    expect(buf1.grid[3][0].attributes.colorBackgroundMode).toBe(ColorMode.Default)
})