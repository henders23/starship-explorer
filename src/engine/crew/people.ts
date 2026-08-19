/**
 * The portrait pool: thirty-two faces, each a person the generator can cast.
 *
 * Casting is by apparent age, not by the insignia painted on the uniforms.
 * The grey-haired sit the science and medical chairs — those posts reward a
 * career's worth of judgement. Command draws from the mid-career faces.
 * Security officers, and the ratings who step up when a chair empties, are
 * the young ones.
 */

export interface CrewPerson {
  name: string
  portrait: string
}

const person = (name: string, file: string): CrewPerson => ({
  name,
  portrait: `/assets/portraits/${file}`,
})

/**
 * The three the intro comic puts on the bridge for the aperture test. They
 * are cast, not rolled: the faces that take the Ithaca through the gate are
 * the faces waiting at their stations when the briefing opens.
 */
export const FOUNDING_CAPTAIN = person('Alexander Vale', '01_alexander_vale.png')
export const FOUNDING_SCIENCE = person('Helen Morozova', '26_helen_morozova.png')
export const FOUNDING_SECURITY = person('Gabriel Cross', '14_gabriel_cross.png')

/** Mid-career command presences. The captain is always Vale. */
export const COMMAND_POOL: CrewPerson[] = [
  FOUNDING_CAPTAIN,
  person('Lena Mori', '02_lena_mori.png'),
  person('Jonas Kerr', '03_jonas_kerr.png'),
  person('Talia Ryder', '04_talia_ryder.png'),
  person('Thomas Grey', '27_thomas_grey.png'),
]

/** The older heads. Morozova holds science; medical is seeded from the rest. */
export const SPECIALIST_POOL: CrewPerson[] = [
  FOUNDING_SCIENCE,
  person('Isabella Corelli', '28_isabella_corelli.png'),
  person('Julian Ashford', '29_julian_ashford.png'),
  person('Margaret Halloway', '30_margaret_halloway.png'),
  person('Peter Novak', '31_peter_novak.png'),
  person('Sarah Connor', '32_sarah_connor.png'),
]

/** The young. Security is a fit body's job; Cross has the chair. */
export const SECURITY_POOL: CrewPerson[] = [
  FOUNDING_SECURITY,
  person('Darius Cole', '16_darius_cole.png'),
  person('Benjamin Taylor', '17_benjamin_taylor.png'),
  person("Kiara N'Dala", '20_kiara_n_dala.png'),
  person('Lucas Haines', '21_lucas_haines.png'),
  person('Tessa Nguyen', '22_tessa_nguyen.png'),
  person('Oliver Petrov', '23_oliver_petrov.png'),
  person('Amelia York', '24_amelia_york.png'),
]

/**
 * The ratings: generics who gain a face and a name only on promotion.
 * Kept apart from the founding pools so a promoted officer can never be
 * the twin of someone already dead on the roster.
 */
export const RATINGS_POOL: CrewPerson[] = [
  person('Ethan Drake', '05_ethan_drake.png'),
  person('Mira Solan', '06_mira_solan.png'),
  person('Devon Holt', '07_devon_holt.png'),
  person('Sloane Katz', '08_sloane_katz.png'),
  person('Matthew Crane', '09_matthew_crane.png'),
  person('Insu Park', '10_insu_park.png'),
  person('Elise Parnell', '11_elise_parnell.png'),
  person('Jacob Ryland', '12_jacob_ryland.png'),
  person('Maria Sanchez', '13_maria_sanchez.png'),
  person('Victoria Lin', '15_victoria_lin.png'),
  person('Nora Bakk', '18_nora_bakk.png'),
  person('Ryan McDougall', '19_ryan_mcdougall.png'),
  person('Adrian Bishop', '25_adrian_bishop.png'),
]
