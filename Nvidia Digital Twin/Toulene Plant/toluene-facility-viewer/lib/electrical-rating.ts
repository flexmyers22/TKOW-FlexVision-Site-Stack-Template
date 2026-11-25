/** Values recorded on the Electrical rating sheet in the property workbook.
 * The commercial and residential transformer figures have no unit named on that sheet.
 * The phase row is the row whose Phases cell is 3.
 */
export const TRANSFORMER_RATING = {
  source: "Electrical rating sheet",
  commercial: 50000,
  residential: 150000,
  phases: 3,
  voltageV: 240,
  amperageA: 20,
  watts: 72,
  frequencyHz: 50,
} as const

export const TRANSFORMER_RATING_LINES = [
  ["Phases", String(TRANSFORMER_RATING.phases)],
  ["Voltage", `${TRANSFORMER_RATING.voltageV} V`],
  ["Amperage", `${TRANSFORMER_RATING.amperageA} A`],
  ["Watts", `${TRANSFORMER_RATING.watts} W`],
  ["Frequency", `${TRANSFORMER_RATING.frequencyHz} Hz`],
  ["Commercial", TRANSFORMER_RATING.commercial.toLocaleString("en-US")],
  ["Residential", TRANSFORMER_RATING.residential.toLocaleString("en-US")],
] as const
