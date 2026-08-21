/**
 * Content screening for scraped posts.
 *
 * A keyword search returns far more than open roles: job-seekers announcing
 * availability, commentary, course ads, and staffing-agency reposts. These
 * checks decide whether a post is a genuine hiring post from the employer.
 *
 * Every rule here is a text heuristic and will occasionally be wrong, so each
 * verdict carries the reason that produced it.
 */

/**
 * Evidence that the post is advertising an open role. Deliberately broad:
 * plenty of real listings never use the word "hiring" - "Lead Data Analyst
 * opportunity at HelloFresh in London" is a job post.
 */
const HIRING = [
  /\b(?:we(?:'| a)?re )?hiring\b/i,
  /\bnow hiring\b/i,
  /\brecrut(?:e|ons|ement|ent)\b/i,
  /\bjob (?:opening|opportunit|alert|post|ad)/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjoin (?:our|the|my) team\b/i,
  /\bapply (?:now|here|via|today|through)\b/i,
  /\bwe(?:'| a)?re looking for\b/i,
  /\bwe are (?:looking|seeking|searching)\b/i,
  /\bnous (?:recherchons|cherchons)\b/i,
  /\b(?:open|new) (?:role|position|opportunit)/i,
  /\b(?:role|position|opportunity|opening|job)\s+(?:at|with|for|based)\b/i,
  /\boffre d[’']emploi\b/i,
  /\bposte [àa] pourvoir\b/i,
  /\b(?:h\/f|f\/h|m\/f|f\/m|m\/w|d\/f)\b/i,
  /\bsend (?:me )?your (?:cv|resume|profile)\b/i,
  /\bshare your (?:cv|resume|profile)\b/i,
  /\bdrop (?:me )?(?:your|a) (?:cv|resume|dm)\b/i,
  /\bapplications? (?:are )?(?:open|welcome)\b/i,
  /\b(?:interested candidates?|ideal candidate|the successful candidate)\b/i,
  /\bjob description\b/i,
  /\bapply\b.{0,20}\blink\b/i,
  /#hiring\b/i,
  /#recrutement\b/i,
];

/**
 * First-person availability posts. Narrow on purpose: a hiring post routinely
 * says "looking for", so only self-referential phrasing counts.
 */
const SEEKER = [
  /#opentowork\b/i,
  /\bopen to work\b/i,
  /\bi(?:'| a)?m (?:currently )?(?:looking|searching) for (?:a |my |new )?(?:new )?(?:job|role|position|opportunit)/i,
  /\bi am (?:currently )?(?:looking|searching|seeking)\b.{0,40}\b(?:role|job|position|opportunit)/i,
  /\b(?:je (?:suis )?(?:recherche|cherche)|[àa] la recherche d[’'](?:un|une))\b.{0,30}\b(?:poste|opportunit|emploi|stage|alternance)/i,
  /\bmy (?:cv|resume) is (?:attached|below|available)\b/i,
  /\bavailable (?:immediately|for new opportunit)/i,
  /\bseeking (?:my )?next (?:role|opportunit|challenge)\b/i,
  /\bhelp me find\b/i,
];

/**
 * Wording that only appears when a third party is hiring on someone else's
 * behalf. "our client" and the UK contract vocabulary are the strongest tells.
 */
const AGENCY_BODY = [
  /\b(?:our|my|the) client\b/i,
  /\bon behalf of\b/i,
  /\bconfidential (?:search|client)\b/i,
  /\bc2c\b/i,
  /\bw2\b/i,
  /\b(?:inside|outside) ir35\b/i,
  /\bumbrella\b/i,
  /\bstaffing\b/i,
  /\brecruit(?:ment|ing) (?:agency|agencies|firm|partner)\b/i,
  /\bcabinet de recrutement\b/i,
  /\bagence de recrutement\b/i,
  /\bheadhunt/i,
  /\b(?:esn|rpo|psl)\b/i,
  /\bthird[- ]party (?:agencies|recruiters)\b/i,
  /\bplacement (?:agency|firm)\b/i,
  /\bconsultancy is (?:looking|hiring)\b/i,
];

/**
 * Job titles held only by agency-side recruiters. Titles that also belong to
 * in-house teams - "Talent Acquisition", plain "Recruiter", "People" - are
 * excluded, since an employer's own recruiter is exactly who the search wants.
 */
const AGENCY_HEADLINE = [
  /\brecruit(?:ment|ing) consultant\b/i,
  /\bexecutive recruiter\b/i,
  /\bexecutive search\b/i,
  /\bheadhunter\b/i,
  /\bit recruiter\b/i,
  /\btechnical recruiter\b/i,
  /\brecruitment (?:specialist|manager|lead|director|partner)\b/i,
  /\btalent (?:sourcer|scout)\b/i,
  /\bsourcing specialist\b/i,
  /\bstaffing\b/i,
  /\b(?:managing|principal|delivery|senior) consultant\b/i,
  /\brecruitment (?:agency|firm)\b/i,
  /\bcabinet de recrutement\b/i,
  /\bchasseur de t[êe]tes\b/i,
  /\bfreelance recruiter\b/i,
];

/** Titles that look agency-ish but belong to an employer's own hiring team. */
const IN_HOUSE = [
  /\bcorporate recruiter\b/i,
  /\bin[- ]house recruit/i,
  /\binternal recruit/i,
  /\bhead of (?:talent|people|hr)\b/i,
  /\bpeople (?:partner|team|operations)\b/i,
];

export interface PostVerdict {
  allowed: boolean;
  reason: string;
}

const matches = (patterns: RegExp[], text: string) => patterns.some(p => p.test(text));

/**
 * Decide whether a post is a genuine employer hiring post.
 *
 * Rejects posts with no sign of an open role, first-person job-seeker posts, and
 * posts written by agency-side recruiters or advertising a client's role.
 */
export function screenPost(description: string, authorOccupation = ''): PostVerdict {
  const text = description || '';
  if (!text.trim()) {
    return { allowed: false, reason: 'empty post' };
  }

  if (matches(SEEKER, text)) {
    return { allowed: false, reason: 'job-seeker post, not a vacancy' };
  }

  if (!matches(HIRING, text)) {
    return { allowed: false, reason: 'no sign of an open role' };
  }

  const agencyBody = matches(AGENCY_BODY, text);
  const agencyTitle = matches(AGENCY_HEADLINE, authorOccupation) && !matches(IN_HOUSE, authorOccupation);

  if (agencyBody || agencyTitle) {
    return {
      allowed: false,
      reason: agencyBody ? 'recruiting agency (wording)' : 'recruiting agency (author title)',
    };
  }

  return { allowed: true, reason: 'employer hiring post' };
}
