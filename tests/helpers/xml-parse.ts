import { parseStringPromise } from 'xml2js'

/** Parsea un string XML a objeto JS (arrays colapsados a objeto cuando hay un solo elemento). */
export function parser(xml: string): Promise<any> {
  return parseStringPromise(xml, { explicitArray: false, trim: true })
}
