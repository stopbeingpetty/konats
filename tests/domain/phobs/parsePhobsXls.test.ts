import { describe, it, expect } from 'vitest'
import { parsePhobsXls } from '@/features/imports/lib/parsePhobsXls'

// ---------------------------------------------------------------------------
// HTML builder helpers
// ---------------------------------------------------------------------------

function makeCells(overrides: Record<number, string>, totalCells = 50): string {
  const cells: string[] = []
  for (let i = 0; i < totalCells; i++) {
    cells.push(`<td>${overrides[i] ?? ''}</td>`)
  }
  return cells.join('')
}

// Cell indices per spec (0-based, where col 0 = "#")
const HDR: Record<number, string> = {
  0: '#',
  1: 'Code',
  2: 'Origin',
  8: 'Dolazak',
  9: 'Odlazak',
  11: 'Nositelj rezervacije',
  21: 'Država',
  22: 'Smještaj',
  25: 'Odraslih',
  26: 'Djeca',
  29: 'Valuta',
  33: 'Ukupno',
  42: 'Status',
  44: 'Datum nastanka',
  46: 'Bookirano unaprijed (dana)',
}

// Three sample data rows
const ROW1: Record<number, string> = {
  0: '1',
  1: '2449938597',
  2: 'Expedia.com',
  8: '2024-07-10',
  9: '2024-07-14',
  11: 'JUAN CARLOS GARCIA',
  21: 'ES',
  22: 'Superior Room 101',
  25: '2',
  26: '0',
  29: 'EUR',
  33: '1.200,00',
  42: 'ok',
  44: '2024-05-01T10:00:00',
  46: '70',
}

const ROW2: Record<number, string> = {
  0: '2',
  1: '2449938598',
  2: 'Booking.com',
  8: '2024-07-15',
  9: '2024-07-18',
  11: 'ANNA SMITH',
  21: 'GB',
  22: 'Junior Suite 202',
  25: '2',
  26: '1',
  29: 'EUR',
  33: '1.800,00',
  42: 'ok',
  44: '2024-06-01T09:00:00',
  46: '44',
}

const ROW3: Record<number, string> = {
  0: '3',
  1: '2449938599',
  2: 'Object',
  8: '2024-08-01',
  9: '2024-08-05',
  11: 'IVAN HORVAT',
  21: 'HR',
  22: 'Executive Suite',
  25: '1',
  26: '0',
  29: 'EUR',
  33: '2.400,00',
  42: 'Poništena',
  44: '2024-07-01T14:00:00',
  46: '31',
}

const SAMPLE_HTML = `<html><body><table>
  <tr><td colspan="100%">Phobs Export — Hotel Navis</td></tr>
  <tr>${makeCells(HDR)}</tr>
  <tr>${makeCells(ROW1)}</tr>
  <tr>${makeCells(ROW2)}</tr>
  <tr>${makeCells(ROW3)}</tr>
</table></body></html>`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parsePhobsXls', () => {
  it('parses 3 data rows from the sample HTML', () => {
    const result = parsePhobsXls(SAMPLE_HTML)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(3)
  })

  it('extracts all required fields from row 1 (Expedia)', () => {
    const result = parsePhobsXls(SAMPLE_HTML)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[0]
    expect(row.internalId).toBe('1')  // column 0 value from ROW1
    expect(row.code).toBe('2449938597')
    expect(row.origin).toBe('Expedia.com')
    expect(row.dolazak).toBe('2024-07-10')
    expect(row.odlazak).toBe('2024-07-14')
    expect(row.nositeljRezervacije).toBe('JUAN CARLOS GARCIA')
    expect(row.drzava).toBe('ES')
    expect(row.smjestaj).toBe('Superior Room 101')
    expect(row.odraslih).toBe('2')
    expect(row.djeca).toBe('0')
    expect(row.valuta).toBe('EUR')
    expect(row.ukupno).toBe('1.200,00')
    expect(row.status).toBe('ok')
    expect(row.datumNastanka).toBe('2024-05-01T10:00:00')
    expect(row.bookiranoUnaprijed).toBe('70')
  })

  it('extracts fields from row 3 (cancelled, direct channel)', () => {
    const result = parsePhobsXls(SAMPLE_HTML)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[2]
    expect(row.code).toBe('2449938599')
    expect(row.origin).toBe('Object')
    expect(row.status).toBe('Poništena')
    expect(row.smjestaj).toBe('Executive Suite')
  })

  it('returns an error when input has no table element', () => {
    const result = parsePhobsXls('<html><body><p>no table here</p></body></html>')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/no table/i)
  })

  it('returns an error for non-HTML plaintext', () => {
    const result = parsePhobsXls('some plain text content without any HTML')
    // DOMParser will create a document but there will be no table
    expect(result.ok).toBe(false)
  })

  it('returns an error when fewer than 3 rows are present', () => {
    const twoRowHtml = `<html><body><table>
      <tr><td>Title</td></tr>
      <tr><td>Header</td></tr>
    </table></body></html>`
    const result = parsePhobsXls(twoRowHtml)
    expect(result.ok).toBe(false)
  })

  it('skips blank rows without erroring', () => {
    const htmlWithBlank = `<html><body><table>
      <tr><td colspan="100%">Title</td></tr>
      <tr>${makeCells(HDR)}</tr>
      <tr>${makeCells(ROW1)}</tr>
      <tr>${Array.from({ length: 50 }, () => '<td></td>').join('')}</tr>
      <tr>${makeCells(ROW2)}</tr>
    </table></body></html>`
    const result = parsePhobsXls(htmlWithBlank)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(2)
  })

  it('preserves allCells array on each row', () => {
    const result = parsePhobsXls(SAMPLE_HTML)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].allCells).toHaveLength(50)
    expect(result.rows[0].allCells[1]).toBe('2449938597')
  })

  it('extracts distinct internalIds for two rows that share the same Code (multi-room booking)', () => {
    // Simulate Ernest Debreslioski's 2-room booking: same Code, different col-0 IDs
    const MULTI_ROW_A: Record<number, string> = {
      0: '27759512',  // Phobs internal ID — room 1
      1: '6413243407',
      2: 'Expedia.com',
      8: '2024-07-10',
      9: '2024-07-14',
      11: 'ERNEST DEBRESLIOSKI',
      21: 'HR',
      22: 'Superior Room 101',
      25: '2',
      26: '0',
      29: 'EUR',
      33: '1.200,00',
      42: 'ok',
      44: '2024-05-01T10:00:00',
      46: '70',
    }
    const MULTI_ROW_B: Record<number, string> = {
      ...MULTI_ROW_A,
      0: '27759513',  // Phobs internal ID — room 2
    }
    const html = `<html><body><table>
      <tr><td colspan="100%">Title</td></tr>
      <tr>${makeCells(HDR)}</tr>
      <tr>${makeCells(MULTI_ROW_A)}</tr>
      <tr>${makeCells(MULTI_ROW_B)}</tr>
    </table></body></html>`

    const result = parsePhobsXls(html)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].internalId).toBe('27759512')
    expect(result.rows[1].internalId).toBe('27759513')
    expect(result.rows[0].code).toBe('6413243407')
    expect(result.rows[1].code).toBe('6413243407')
    // internalIds differ — no collision possible in upsert
    expect(result.rows[0].internalId).not.toBe(result.rows[1].internalId)
  })
})
