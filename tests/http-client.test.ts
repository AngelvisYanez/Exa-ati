import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import { resolveUrl, parseForm, HttpClient } from '../src/services/scraping/http-client'

describe('resolveUrl', () => {
  it('absolute URL returned as-is', () => {
    const result = resolveUrl('https://example.com/page', 'https://other.com/page')
    expect(result).toBe('https://other.com/page')
  })

  it('absolute URL with http returned as-is', () => {
    const result = resolveUrl('https://example.com/page', 'http://other.com/page')
    expect(result).toBe('http://other.com/page')
  })

  it('absolute-path relative URL uses base host', () => {
    const result = resolveUrl('https://example.com/old/path', '/new/path')
    expect(result).toBe('https://example.com/new/path')
  })

  it('relative URL resolved normally', () => {
    const result = resolveUrl('https://example.com/dir/page', 'next')
    expect(result).toBe('https://example.com/dir/next')
  })

  it('relative URL with query string', () => {
    const result = resolveUrl('https://example.com/base', 'page?a=1&b=2')
    expect(result).toBe('https://example.com/page?a=1&b=2')
  })
})

describe('parseForm', () => {
  it('extracts action and input fields', () => {
    const $ = cheerio.load(`
      <form action="/submit" method="post">
        <input name="username" value="admin" />
        <input name="password" value="secret" />
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.action).toBe('/submit')
    expect(result.fields).toEqual({ username: 'admin', password: 'secret' })
  })

  it('skips submit, button, checkbox, and radio inputs', () => {
    const $ = cheerio.load(`
      <form action="/submit">
        <input type="text" name="field" value="keep" />
        <input type="submit" name="submit" value="Send" />
        <input type="button" name="btn" value="Click" />
        <input type="checkbox" name="check" value="on" />
        <input type="radio" name="radio" value="opt1" />
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.fields).toEqual({ field: 'keep' })
  })

  it('extracts select values', () => {
    const $ = cheerio.load(`
      <form action="/submit">
        <select name="country">
          <option value="EC" selected>Ecuador</option>
          <option value="CO">Colombia</option>
        </select>
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.fields.country).toBe('EC')
  })

  it('extracts textarea values', () => {
    const $ = cheerio.load(`
      <form action="/submit">
        <textarea name="comments">Hello world</textarea>
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.fields.comments).toBe('Hello world')
  })

  it('handles missing action attribute', () => {
    const $ = cheerio.load(`
      <form>
        <input name="f" value="v" />
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.action).toBe('')
  })

  it('skips inputs without name attribute', () => {
    const $ = cheerio.load(`
      <form action="/submit">
        <input value="noname" />
        <input name="hasname" value="val" />
      </form>
    `)
    const result = parseForm($, 'form')
    expect(result.fields).toEqual({ hasname: 'val' })
  })
})

describe('HttpClient cookie methods', () => {
  it('setCookie and getCookie', () => {
    const client = new HttpClient()
    client.setCookie('session', 'abc123')
    expect(client.getCookie('session')).toBe('abc123')
  })

  it('hasCookie returns true and false correctly', () => {
    const client = new HttpClient()
    expect(client.hasCookie('missing')).toBe(false)
    client.setCookie('present', 'val')
    expect(client.hasCookie('present')).toBe(true)
  })

  it('allCookies returns all cookies', () => {
    const client = new HttpClient()
    client.setCookie('a', '1')
    client.setCookie('b', '2')
    const all = client.allCookies()
    expect(all).toEqual({ a: '1', b: '2' })
  })

  it('clearCookies removes all cookies', () => {
    const client = new HttpClient()
    client.setCookie('a', '1')
    client.setCookie('b', '2')
    client.clearCookies()
    expect(client.allCookies()).toEqual({})
    expect(client.hasCookie('a')).toBe(false)
  })

  it('getCookie returns undefined for missing cookie', () => {
    const client = new HttpClient()
    expect(client.getCookie('nonexistent')).toBeUndefined()
  })
})
