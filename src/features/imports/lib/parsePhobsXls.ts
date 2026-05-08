import type { PhobsParsedRow } from '../types'

export type ParseResult =
  | { ok: true; rows: PhobsParsedRow[] }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// 0-based column indices in the Phobs HTML table.
// Column 0 is "#" (Phobs internal row ID, "Br. #" / "Stavka"). It differs
// for each room row in a multi-room booking and is used as the internalId
// component of the composite phobs_reservation_id.
// ---------------------------------------------------------------------------
const COL = {
  internalId: 0,
  code: 1,
  origin: 2,
  dolazak: 8,
  odlazak: 9,
  nositeljRezervacije: 11,
  drzava: 21,
  smjestaj: 22,
  odraslih: 25,
  djeca: 26,
  valuta: 29,
  ukupno: 33,
  status: 42,
  datumNastanka: 44,
  bookiranoUnaprijed: 46,
} as const

export function parsePhobsXls(fileText: string): ParseResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(fileText, 'text/html')

  const table = doc.querySelector('table')
  if (!table) {
    return {
      ok: false,
      error:
        "No table found. Make sure you exported as HTML/XLS from Phobs Reservations List.",
    }
  }

  const rows = Array.from(table.querySelectorAll('tr'))
  if (rows.length < 3) {
    return {
      ok: false,
      error:
        'File has too few rows — expected a title row, a header row, and at least one data row.',
    }
  }

  // rows[0] = title, rows[1] = column headers, rows[2+] = data
  const dataRows = rows.slice(2)
  const parsed: PhobsParsedRow[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const cells = Array.from(dataRows[i].querySelectorAll('td')).map(
      (td) => td.textContent?.trim() ?? ''
    )

    // Skip entirely blank rows (can appear at file end)
    if (cells.every((c) => c === '')) continue

    const get = (idx: number): string => cells[idx] ?? ''

    parsed.push({
      rowIndex: i + 3, // human-readable: title(1) + header(2) + data from 3
      internalId: get(COL.internalId),
      code: get(COL.code),
      origin: get(COL.origin),
      dolazak: get(COL.dolazak),
      odlazak: get(COL.odlazak),
      nositeljRezervacije: get(COL.nositeljRezervacije),
      drzava: get(COL.drzava),
      smjestaj: get(COL.smjestaj),
      odraslih: get(COL.odraslih),
      djeca: get(COL.djeca),
      valuta: get(COL.valuta),
      ukupno: get(COL.ukupno),
      status: get(COL.status),
      datumNastanka: get(COL.datumNastanka),
      bookiranoUnaprijed: get(COL.bookiranoUnaprijed),
      allCells: cells,
    })
  }

  if (parsed.length === 0) {
    return { ok: false, error: 'No data rows found in the table.' }
  }

  return { ok: true, rows: parsed }
}
