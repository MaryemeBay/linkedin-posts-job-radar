/**
 * Country detection for scraped LinkedIn posts.
 *
 * Hiring posts never carry a structured location field, so the country is
 * inferred from the post text: city names, country names in several languages,
 * bracketed ISO code lists ("Remote EU (CZ/EE/FI/PL)"), and remote-region
 * phrasings. A post may legitimately span several countries, so the result is a
 * comma-separated list, which the UI splits the same way it splits keywords.
 */

interface CountryRule {
  country: string;
  patterns: RegExp[];
}

/**
 * City and country tokens per country. Patterns are matched case-insensitively
 * against the whole post, so anything ambiguous in lowercase (US, UK) is
 * anchored with word boundaries or paired with a qualifier.
 */
const COUNTRY_RULES: CountryRule[] = [
  { country: 'France', patterns: [/\bfrance\b/i, /\bparis(?:ien)?\b/i, /\blyon\b/i, /\bbordeaux\b/i, /\btoulouse\b/i, /\bnantes\b/i, /\blille\b/i, /\bmarseille\b/i, /\bsophia antipolis\b/i, /\bîle-de-france\b/i, /\bile-de-france\b/i, /\bidf\b/i] },
  { country: 'United Kingdom', patterns: [/\bunited kingdom\b/i, /\bu\.?k\.?\b/, /\blondon\b/i, /\bmanchester\b/i, /\bedinburgh\b/i, /\bbirmingham\b/i, /\bglasgow\b/i, /\bbristol\b/i, /\bleeds\b/i, /\bcambridge\b/i, /\bengland\b/i, /\bscotland\b/i, /\bwales\b/i] },
  { country: 'Germany', patterns: [/\bgermany\b/i, /\bdeutschland\b/i, /\ballemagne\b/i, /\bberlin\b/i, /\bmunich\b/i, /\bmünchen\b/i, /\bhamburg\b/i, /\bfrankfurt\b/i, /\bcologne\b/i, /\bköln\b/i, /\bstuttgart\b/i, /\bdüsseldorf\b/i] },
  { country: 'Spain', patterns: [/\bspain\b/i, /\bespaña\b/i, /\bespagne\b/i, /\bmadrid\b/i, /\bbarcelona\b/i, /\bvalencia\b/i, /\bmálaga\b/i, /\bmalaga\b/i, /\bseville\b/i] },
  { country: 'Netherlands', patterns: [/\bnetherlands\b/i, /\bholland\b/i, /\bpays-bas\b/i, /\bamsterdam\b/i, /\brotterdam\b/i, /\butrecht\b/i, /\beindhoven\b/i, /\bthe hague\b/i] },
  { country: 'Ireland', patterns: [/\bireland\b/i, /\birlande\b/i, /\bdublin\b/i, /\bcork\b/i] },
  { country: 'Portugal', patterns: [/\bportugal\b/i, /\blisbon\b/i, /\blisboa\b/i, /\bporto\b/i] },
  { country: 'Poland', patterns: [/\bpoland\b/i, /\bpolska\b/i, /\bpologne\b/i, /\bwarsaw\b/i, /\bwarszawa\b/i, /\bkrak[oó]w\b/i, /\bwroc[lł]aw\b/i, /\bgda[nń]sk\b/i] },
  { country: 'Estonia', patterns: [/\bestonia\b/i, /\btallinn\b/i, /\btartu\b/i] },
  { country: 'Finland', patterns: [/\bfinland\b/i, /\bhelsinki\b/i] },
  { country: 'Sweden', patterns: [/\bsweden\b/i, /\bstockholm\b/i, /\bgothenburg\b/i, /\bmalm[oö]\b/i] },
  { country: 'Denmark', patterns: [/\bdenmark\b/i, /\bcopenhagen\b/i, /\bk[oø]benhavn\b/i] },
  { country: 'Norway', patterns: [/\bnorway\b/i, /\boslo\b/i] },
  { country: 'Switzerland', patterns: [/\bswitzerland\b/i, /\bsuisse\b/i, /\bschweiz\b/i, /\bz[uü]rich\b/i, /\bgeneva\b/i, /\bgen[eè]ve\b/i, /\bbasel\b/i, /\blausanne\b/i] },
  { country: 'Belgium', patterns: [/\bbelgium\b/i, /\bbelgique\b/i, /\bbrussels\b/i, /\bbruxelles\b/i, /\bantwerp\b/i, /\bghent\b/i] },
  { country: 'Italy', patterns: [/\bitaly\b/i, /\bitalia\b/i, /\bitalie\b/i, /\bmilan(?:o)?\b/i, /\brome\b/i, /\broma\b/i, /\btorino\b/i, /\bturin\b/i, /\bbologna\b/i] },
  { country: 'Czechia', patterns: [/\bczechia\b/i, /\bczech republic\b/i, /\bprague\b/i, /\bpraha\b/i, /\bbrno\b/i] },
  { country: 'Austria', patterns: [/\baustria\b/i, /\bvienna\b/i, /\bwien\b/i, /\bgraz\b/i] },
  { country: 'Greece', patterns: [/\bgreece\b/i, /\bathens\b/i, /\bthessaloniki\b/i] },
  { country: 'Romania', patterns: [/\bromania\b/i, /\broumanie\b/i, /\bbucharest\b/i, /\bbucure[sș]ti\b/i, /\bcluj\b/i] },
  { country: 'Hungary', patterns: [/\bhungary\b/i, /\bbudapest\b/i] },
  { country: 'Luxembourg', patterns: [/\bluxembourg\b/i] },
  { country: 'Ukraine', patterns: [/\bukraine\b/i, /\bkyiv\b/i, /\bkiev\b/i, /\blviv\b/i] },
  { country: 'Bulgaria', patterns: [/\bbulgaria\b/i, /\bsofia\b/i] },
  { country: 'Croatia', patterns: [/\bcroatia\b/i, /\bzagreb\b/i] },
  { country: 'Serbia', patterns: [/\bserbia\b/i, /\bbelgrade\b/i] },
  { country: 'Lithuania', patterns: [/\blithuania\b/i, /\bvilnius\b/i, /\bkaunas\b/i] },
  { country: 'Latvia', patterns: [/\blatvia\b/i, /\briga\b/i] },
  { country: 'Slovakia', patterns: [/\bslovakia\b/i, /\bbratislava\b/i] },
  { country: 'Slovenia', patterns: [/\bslovenia\b/i, /\bljubljana\b/i] },
  { country: 'Turkey', patterns: [/\bturkey\b/i, /\bt[uü]rkiye\b/i, /\bistanbul\b/i, /\bankara\b/i] },
  { country: 'United States', patterns: [/\bunited states\b/i, /\bu\.?s\.?a\.?\b/, /\bUS-based\b/i, /\bUS only\b/i, /\bremote\s*\(?\s*US\b/i, /\bnew york\b/i, /\bnyc\b/i, /\bsan francisco\b/i, /\bseattle\b/i, /\baustin,? (?:tx|texas)\b/i, /\bchicago\b/i, /\bboston\b/i, /\batlanta\b/i, /\bdenver\b/i, /\blos angeles\b/i, /\bw2\b/i, /\bh1-?b\b/i, /\bc2c\b/i] },
  { country: 'Canada', patterns: [/\bcanada\b/i, /\btoronto\b/i, /\bvancouver\b/i, /\bmontr[eé]al\b/i, /\bottawa\b/i] },
  { country: 'India', patterns: [/\bindia\b/i, /\bbangalore\b/i, /\bbengaluru\b/i, /\bhyderabad\b/i, /\bpune\b/i, /\bmumbai\b/i, /\bnavi mumbai\b/i, /\bthane\b/i, /\bnew delhi\b/i, /\bnoida\b/i, /\bgurgaon\b/i, /\bgurugram\b/i, /\bchennai\b/i, /\bmohali\b/i, /\bchandigarh\b/i, /\bahmedabad\b/i, /\bkolkata\b/i, /\bjaipur\b/i, /\bindore\b/i, /\bcoimbatore\b/i, /\bkochi\b/i, /\btrivandrum\b/i, /\bthiruvananthapuram\b/i, /\bnagpur\b/i, /\bsurat\b/i, /\bvadodara\b/i, /\blucknow\b/i, /\bbhubaneswar\b/i, /\bmysore\b/i, /\bmysuru\b/i, /\bvisakhapatnam\b/i, /\bludhiana\b/i, /\bmadurai\b/i, /\bvijayawada\b/i, /\bnashik\b/i, /\bpunjab\b/i, /\bkerala\b/i, /\bkarnataka\b/i, /\btelangana\b/i, /\bmaharashtra\b/i, /\btamil nadu\b/i, /\bharyana\b/i, /\bgujarat\b/i] },
  { country: 'United Arab Emirates', patterns: [/\bunited arab emirates\b/i, /\buae\b/i, /\bdubai\b/i, /\babu dhabi\b/i] },
  { country: 'Saudi Arabia', patterns: [/\bsaudi arabia\b/i, /\briyadh\b/i, /\bjeddah\b/i] },
  { country: 'Israel', patterns: [/\bisrael\b/i, /\btel aviv\b/i] },
  { country: 'Australia', patterns: [/\baustralia\b/i, /\bsydney\b/i, /\bmelbourne\b/i, /\bbrisbane\b/i] },
  { country: 'Singapore', patterns: [/\bsingapore\b/i] },
  { country: 'Brazil', patterns: [/\bbrazil\b/i, /\bbrasil\b/i, /\bs[aã]o paulo\b/i] },
  { country: 'Mexico', patterns: [/\bmexico\b/i, /\bm[eé]xico\b/i, /\bguadalajara\b/i] },
  { country: 'Morocco', patterns: [/\bmorocco\b/i, /\bmaroc\b/i, /\bcasablanca\b/i, /\brabat\b/i] },
  { country: 'Tunisia', patterns: [/\btunisia\b/i, /\btunisie\b/i, /\btunis\b/i] },
  { country: 'Egypt', patterns: [/\begypt\b/i, /\bcairo\b/i] },
  { country: 'South Africa', patterns: [/\bsouth africa\b/i, /\bcape town\b/i, /\bjohannesburg\b/i] },
  { country: 'Japan', patterns: [/\bjapan\b/i, /\btokyo\b/i] },
  { country: 'China', patterns: [/\bchina\b/i, /\bbeijing\b/i, /\bshanghai\b/i] },
  { country: 'Pakistan', patterns: [/\bpakistan\b/i, /\bislamabad\b/i, /\blahore\b/i, /\bkarachi\b/i, /\brawalpindi\b/i, /\bfaisalabad\b/i, /\bpeshawar\b/i, /\bmultan\b/i] },
  { country: 'Bangladesh', patterns: [/\bbangladesh\b/i, /\bdhaka\b/i] },
  { country: 'Sri Lanka', patterns: [/\bsri lanka\b/i, /\bcolombo\b/i] },
  { country: 'Nepal', patterns: [/\bnepal\b/i, /\bkathmandu\b/i] },
  { country: 'Philippines', patterns: [/\bphilippines\b/i, /\bmanila\b/i, /\bcebu\b/i, /\bdavao\b/i] },
  { country: 'Vietnam', patterns: [/\bvietnam\b/i, /\bhanoi\b/i, /\bho chi minh\b/i, /\bda nang\b/i] },
  { country: 'Thailand', patterns: [/\bthailand\b/i, /\bbangkok\b/i] },
  { country: 'Indonesia', patterns: [/\bindonesia\b/i, /\bjakarta\b/i, /\bbandung\b/i] },
  { country: 'Malaysia', patterns: [/\bmalaysia\b/i, /\bkuala lumpur\b/i, /\bpenang\b/i] },
  { country: 'South Korea', patterns: [/\bsouth korea\b/i, /\bseoul\b/i] },
  { country: 'Taiwan', patterns: [/\btaiwan\b/i, /\btaipei\b/i] },
  { country: 'Hong Kong', patterns: [/\bhong kong\b/i] },
  { country: 'New Zealand', patterns: [/\bnew zealand\b/i, /\bauckland\b/i, /\bwellington\b/i] },
  { country: 'Argentina', patterns: [/\bargentina\b/i, /\bbuenos aires\b/i] },
  { country: 'Colombia', patterns: [/\bcolombia\b/i, /\bbogot[aá]\b/i, /\bmedell[ií]n\b/i] },
  { country: 'Chile', patterns: [/\bchile\b/i, /\bsantiago\b/i] },
  { country: 'Peru', patterns: [/\bperu\b/i, /\bper[uú]\b/i, /\blima\b/i] },
  { country: 'Uruguay', patterns: [/\buruguay\b/i, /\bmontevideo\b/i] },
  { country: 'Costa Rica', patterns: [/\bcosta rica\b/i, /\bsan jos[eé], cr\b/i] },
  { country: 'Ecuador', patterns: [/\becuador\b/i, /\bquito\b/i, /\bguayaquil\b/i] },
  { country: 'Panama', patterns: [/\bpanama\b/i, /\bpanam[aá]\b/i] },
  { country: 'Guatemala', patterns: [/\bguatemala\b/i] },
  { country: 'Dominican Republic', patterns: [/\bdominican republic\b/i, /\bsanto domingo\b/i] },
  { country: 'Venezuela', patterns: [/\bvenezuela\b/i, /\bcaracas\b/i] },
  { country: 'Bolivia', patterns: [/\bbolivia\b/i, /\bla paz, bo\b/i] },
  { country: 'Paraguay', patterns: [/\bparaguay\b/i, /\basunci[oó]n\b/i] },
  { country: 'Qatar', patterns: [/\bqatar\b/i, /\bdoha\b/i] },
  { country: 'Kuwait', patterns: [/\bkuwait\b/i] },
  { country: 'Bahrain', patterns: [/\bbahrain\b/i, /\bmanama\b/i] },
  { country: 'Oman', patterns: [/\boman\b/i, /\bmuscat\b/i] },
  { country: 'Jordan', patterns: [/\bjordan\b/i, /\bamman\b/i] },
  { country: 'Lebanon', patterns: [/\blebanon\b/i, /\bbeirut\b/i] },
  { country: 'Armenia', patterns: [/\barmenia\b/i, /\byerevan\b/i] },
  { country: 'Georgia (country)', patterns: [/\btbilisi\b/i] },
  { country: 'Azerbaijan', patterns: [/\bazerbaijan\b/i, /\bbaku\b/i] },
  { country: 'Kazakhstan', patterns: [/\bkazakhstan\b/i, /\balmaty\b/i, /\bastana\b/i] },
  { country: 'Uzbekistan', patterns: [/\buzbekistan\b/i, /\btashkent\b/i] },
  { country: 'Belarus', patterns: [/\bbelarus\b/i, /\bminsk\b/i] },
  { country: 'Moldova', patterns: [/\bmoldova\b/i, /\bchisinau\b/i, /\bchi[sș]in[aă]u\b/i] },
  { country: 'Russia', patterns: [/\brussia\b/i, /\bmoscow\b/i, /\bsaint petersburg\b/i, /\bst\.? petersburg\b/i] },
  { country: 'Cyprus', patterns: [/\bcyprus\b/i, /\bnicosia\b/i, /\blimassol\b/i] },
  { country: 'Malta', patterns: [/\bmalta\b/i, /\bvalletta\b/i] },
  { country: 'Iceland', patterns: [/\biceland\b/i, /\breykjav[ií]k\b/i] },
  { country: 'Albania', patterns: [/\balbania\b/i, /\btirana\b/i] },
  { country: 'Bosnia and Herzegovina', patterns: [/\bbosnia\b/i, /\bsarajevo\b/i] },
  { country: 'North Macedonia', patterns: [/\bnorth macedonia\b/i, /\bskopje\b/i] },
  { country: 'Algeria', patterns: [/\balgeria\b/i, /\balg[eé]rie\b/i, /\balgiers\b/i, /\balger\b/i] },
  { country: 'Senegal', patterns: [/\bsenegal\b/i, /\bs[eé]n[eé]gal\b/i, /\bdakar\b/i] },
  { country: 'Ivory Coast', patterns: [/\bivory coast\b/i, /\bc[oô]te d[’']ivoire\b/i, /\babidjan\b/i] },
  { country: 'Cameroon', patterns: [/\bcameroon\b/i, /\bcameroun\b/i, /\bdouala\b/i, /\byaound[eé]\b/i] },
  { country: 'Nigeria', patterns: [/\bnigeria\b/i, /\blagos\b/i, /\babuja\b/i] },
  { country: 'Ghana', patterns: [/\bghana\b/i, /\baccra\b/i] },
  { country: 'Kenya', patterns: [/\bkenya\b/i, /\bnairobi\b/i] },
  { country: 'Ethiopia', patterns: [/\bethiopia\b/i, /\baddis ababa\b/i] },
  { country: 'Rwanda', patterns: [/\brwanda\b/i, /\bkigali\b/i] },
  { country: 'Tanzania', patterns: [/\btanzania\b/i, /\bdar es salaam\b/i] },
  { country: 'Uganda', patterns: [/\buganda\b/i, /\bkampala\b/i] },
  { country: 'Mauritius', patterns: [/\bmauritius\b/i, /\bmaurice\b/i] },
];

/**
 * ISO 3166-1 alpha-2 codes, resolved only inside a bracketed or slash-separated
 * group ("Remote EU (CZ/EE/FI/PL/ES/SE)"). Bare two-letter tokens are far too
 * common in prose to match safely on their own.
 */
const ISO_CODES: Record<string, string> = {
  FR: 'France', GB: 'United Kingdom', UK: 'United Kingdom', DE: 'Germany',
  ES: 'Spain', NL: 'Netherlands', IE: 'Ireland', PT: 'Portugal', PL: 'Poland',
  EE: 'Estonia', FI: 'Finland', SE: 'Sweden', DK: 'Denmark', NO: 'Norway',
  CH: 'Switzerland', BE: 'Belgium', IT: 'Italy', CZ: 'Czechia', AT: 'Austria',
  GR: 'Greece', RO: 'Romania', HU: 'Hungary', LU: 'Luxembourg', UA: 'Ukraine',
  BG: 'Bulgaria', HR: 'Croatia', RS: 'Serbia', LT: 'Lithuania', LV: 'Latvia',
  SK: 'Slovakia', SI: 'Slovenia', TR: 'Turkey', US: 'United States',
  CA: 'Canada', IN: 'India', AE: 'United Arab Emirates', IL: 'Israel',
  AU: 'Australia', SG: 'Singapore', BR: 'Brazil', MX: 'Mexico', MA: 'Morocco',
  TN: 'Tunisia', EG: 'Egypt', ZA: 'South Africa', JP: 'Japan', CN: 'China',
  PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', NP: 'Nepal',
  PH: 'Philippines', VN: 'Vietnam', TH: 'Thailand', ID: 'Indonesia',
  MY: 'Malaysia', KR: 'South Korea', TW: 'Taiwan', HK: 'Hong Kong',
  NZ: 'New Zealand', AR: 'Argentina', CO: 'Colombia', CL: 'Chile',
  PE: 'Peru', UY: 'Uruguay', CR: 'Costa Rica', EC: 'Ecuador', PA: 'Panama',
  GT: 'Guatemala', DO: 'Dominican Republic', VE: 'Venezuela', BO: 'Bolivia',
  PY: 'Paraguay', QA: 'Qatar', KW: 'Kuwait', BH: 'Bahrain', OM: 'Oman',
  JO: 'Jordan', LB: 'Lebanon', AM: 'Armenia', AZ: 'Azerbaijan',
  KZ: 'Kazakhstan', UZ: 'Uzbekistan', BY: 'Belarus', MD: 'Moldova',
  RU: 'Russia', CY: 'Cyprus', MT: 'Malta', IS: 'Iceland', AL: 'Albania',
  BA: 'Bosnia and Herzegovina', MK: 'North Macedonia', DZ: 'Algeria',
  SN: 'Senegal', CI: 'Ivory Coast', CM: 'Cameroon', NG: 'Nigeria',
  GH: 'Ghana', KE: 'Kenya', ET: 'Ethiopia', RW: 'Rwanda', TZ: 'Tanzania',
  UG: 'Uganda', MU: 'Mauritius',
};

const CODE_GROUP = /[([]([A-Z]{2}(?:\s*[/,|]\s*[A-Z]{2})+)[)\]]/g;

/**
 * Hiring idioms used almost exclusively in the Indian job market. Agency posts
 * from India routinely give the location as nothing more than "Remote", so
 * these phrases are the only location signal such a post carries.
 */
const INDIA_RECRUITMENT = /\b(?:pvt\.?\s*ltd|private limited|CTC\b|LPA\b|lakhs?\b|crores?\b|immediate joiners?\b|notice period|expected ctc|current ctc|freshers?\b)/i;

const REMOTE = /\b(?:remote|t[eé]l[eé]travail|full[- ]remote|work[- ]from[- ]home|wfh)\b/i;
const REMOTE_EUROPE = /\b(?:remote\s+(?:in\s+|from\s+|across\s+)?(?:europe|eu|emea)|europe(?:an)?[- ]wide|eu[- ]remote|emea)\b/i;
const REMOTE_ANYWHERE = /\b(?:work[- ]from[- ]anywhere|wfa|anywhere in the world|worldwide|fully distributed|global(?:ly)? remote)\b/i;

/**
 * Infer the countries a post refers to.
 *
 * Returns a comma-separated list of country names, or one of the pseudo-values
 * "Remote (Europe)" / "Remote (Worldwide)" when the post is explicitly remote
 * across a region without naming a country. Empty string when nothing matches.
 */
export function detectCountries(text: string): string {
  if (!text) return '';

  const found = new Set<string>();

  for (const rule of COUNTRY_RULES) {
    if (rule.patterns.some(pattern => pattern.test(text))) {
      found.add(rule.country);
    }
  }

  if (INDIA_RECRUITMENT.test(text)) {
    found.add('India');
  }

  for (const match of text.matchAll(CODE_GROUP)) {
    for (const code of match[1].split(/[/,|]/)) {
      const country = ISO_CODES[code.trim().toUpperCase()];
      if (country) found.add(country);
    }
  }

  if (REMOTE_ANYWHERE.test(text)) {
    found.add('Remote (Worldwide)');
  } else if (REMOTE_EUROPE.test(text)) {
    found.add('Remote (Europe)');
  }

  if (found.size === 0 && REMOTE.test(text)) {
    return 'Remote (unspecified)';
  }

  return Array.from(found).sort().join(', ');
}

/**
 * Lines where a post states the role's location outright - "📍 Location: London,
 * UK", "Lieu : Paris", "Based in Lisbon". A country named on one of these lines
 * is the role's actual location, unlike a country mentioned anywhere in the body
 * (visa notes, team locations, the poster's own market).
 */
const LOCATION_LINE = /^\s*(?:[\u{1F4CD}\u{1F30D}\u{1F30E}\u{1F30F}\u{1F3E2}]\s*)?(?:location|locations|lieu|localisation|based in|based|office|onsite in|site)\s*[:\-]?\s*(.+)$/iu;

const LOCATION_PREFIX_EMOJI = /^\s*[\u{1F4CD}\u{1F30D}\u{1F30E}\u{1F30F}]\s*(.+)$/u;

/**
 * Countries named on an explicit location line, as a comma-separated list.
 * Returns '' when the post states no location line, in which case callers should
 * fall back to detectCountries() over the whole text.
 */
export function detectStatedLocation(text: string): string {
  if (!text) return '';

  const stated: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = LOCATION_LINE.exec(line) ?? LOCATION_PREFIX_EMOJI.exec(line);
    if (match) stated.push(match[1]);
  }

  if (stated.length === 0) return '';
  return detectCountries(stated.join('\n'));
}

/**
 * The country to record for a post.
 *
 * An explicit location line wins outright: a post headed "📍 Islamabad" is an
 * Islamabad role even when it mentions London further down, and taking the union
 * of both would let it pass a London-only filter. Falls back to scanning the
 * whole post when no location line is present.
 */
export function resolveCountry(text: string): string {
  return detectStatedLocation(text) || detectCountries(text);
}
