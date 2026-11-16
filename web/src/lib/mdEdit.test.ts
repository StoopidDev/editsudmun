import { describe, expect, it } from 'vitest'
import { prefixLines, wrapSelection } from './mdEdit'
import { shortcutKey } from './shortcut'

describe('mdEdit', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapSelection('ก ข ค', 2, 3, '**')).toEqual({ value: 'ก **ข** ค', start: 4, end: 5 })
  })
  it('with no selection leaves the caret between the markers', () => {
    expect(wrapSelection('', 0, 0, '**')).toEqual({ value: '****', start: 2, end: 2 })
  })
  it('unwraps on the second press', () => {
    expect(wrapSelection('ก **ข** ค', 4, 5, '**')).toEqual({ value: 'ก ข ค', start: 2, end: 3 })
  })
  it('italic on bold text adds a star instead of stripping the bold', () => {
    expect(wrapSelection('**ข**', 2, 3, '*').value).toBe('***ข***')
    expect(wrapSelection('***ข***', 3, 4, '*').value).toBe('**ข**')
    expect(wrapSelection('***ข***', 3, 4, '**').value).toBe('*ข*')
  })
  it('a triple-click selection (ends after the line break) formats only its own line', () => {
    expect(prefixLines('a\nb', 0, 2, '- ').value).toBe('- a\nb')
  })
  it('formats the first line when the text starts with a line break and the caret is at 0', () => {
    expect(prefixLines('\nb', 0, 0, '- ').value).toBe('- \nb')
  })
  it('shortcutKey reads the physical key under a Thai layout and the printed key under a Latin one', () => {
    expect(shortcutKey({ key: 'ห', code: 'KeyS' })).toBe('s')
    expect(shortcutKey({ key: 'S', code: 'KeyS' })).toBe('s')
    expect(shortcutKey({ key: 'o', code: 'KeyS' })).toBe('o')
    expect(shortcutKey({ key: 'Enter', code: 'Enter' })).toBe('')
  })
  it('prefixes every selected line, and only those', () => {
    expect(prefixLines('a\nb\nc', 2, 5, '- ').value).toBe('a\n- b\n- c')
  })
  it('takes the prefix off when every line has it', () => {
    expect(prefixLines('- a\n- b', 0, 7, '- ').value).toBe('a\nb')
  })
  it('works on the caret line with no selection', () => {
    expect(prefixLines('a\nb', 3, 3, '## ')).toEqual({ value: 'a\n## b', start: 2, end: 6 })
  })
})
