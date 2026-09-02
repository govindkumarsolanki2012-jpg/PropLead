import {
  Lead,
  Property,
  PropertyMatchResult,
  LeadMatchResult,
  MatchCategory,
  PropertyType,
  RequirementType,
  PropertyTransactionType,
} from '../types';
import { formatIndianCurrency } from './formatters';

// ============================================================================
// STEP 1: STRING NORMALIZATION & TOKEN CLEANING LAYER
// ============================================================================

/**
 * Strips punctuation, trims whitespace, collapses multiple spaces, and converts to lowercase.
 */
export function cleanString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"?<>|@+[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes common real estate abbreviations, suffixes, and common typos.
 * Reusable across any city.
 */
export function normalizeLocationTokens(str?: string): string {
  if (!str) return '';
  const s = cleanString(str);
  if (!s) return '';

  const tokenMap: Record<string, string> = {
    // Sectors / Phases
    sec: 'sector',
    sect: 'sector',
    sct: 'sector',
    ph: 'phase',
    phs: 'phase',
    // Roads / Streets
    rd: 'road',
    st: 'street',
    str: 'street',
    marg: 'road',
    // Layouts / Enclaves / Colonies
    ext: 'extension',
    extn: 'extension',
    clny: 'colony',
    coloni: 'colony',
    colny: 'colony',
    ngr: 'nagar',
    enclv: 'enclave',
    soc: 'society',
    blk: 'block',
    // Apartments / Flats
    apt: 'apartment',
    apts: 'apartments',
    flt: 'flat',
    flts: 'flats',
    // Directions & Positions
    w: 'west',
    e: 'east',
    n: 'north',
    s: 'south',
    nr: 'near',
    opp: 'opposite',
    gtr: 'greater',
    gt: 'greater',
  };

  const words = s.split(' ');
  const normalizedWords = words.map((w) => tokenMap[w] || w);
  return normalizedWords.join(' ');
}

// ============================================================================
// STEP 2 & 3: FUZZY MATCHING WITH CONFIDENCE THRESHOLDS
// ============================================================================

/**
 * Calculates Damerau-Levenshtein distance (insertions, deletions, substitutions, transpositions).
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const lenA = a.length;
  const lenB = b.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      // Damerau transposition check
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }

  return matrix[lenA][lenB];
}

/**
 * Multi-strategy fuzzy string similarity returning 0.0 to 1.0.
 * Handles space removal ("White Field" vs "Whitefield"), token abbreviations ("Sec 57" vs "Sector 57"),
 * token set intersections, and Levenshtein typo distance.
 */
export function calculateStringSimilarity(str1?: string, str2?: string): number {
  if (!str1 || !str2) return 0;

  const s1 = cleanString(str1);
  const s2 = cleanString(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;

  // 1. Space-removed equality (e.g. "white field" vs "whitefield", "indra nagar" vs "indiranagar")
  const compact1 = s1.replace(/\s+/g, '');
  const compact2 = s2.replace(/\s+/g, '');
  if (compact1 === compact2) return 0.98;

  // 2. Normalized tokens equality (e.g. "sec 57" vs "sector 57", "mvp coloni" vs "mvp colony")
  const norm1 = normalizeLocationTokens(s1);
  const norm2 = normalizeLocationTokens(s2);
  if (norm1 === norm2) return 0.96;

  const compactNorm1 = norm1.replace(/\s+/g, '');
  const compactNorm2 = norm2.replace(/\s+/g, '');
  if (compactNorm1 === compactNorm2) return 0.96;

  // 3. Substring containment for rich descriptions
  if (norm1.length >= 4 && norm2.length >= 4) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      return Math.max(0.85, ratio);
    }
  }

  // 4. Token Set Jaccard similarity
  const tokens1 = new Set(norm1.split(' ').filter((t) => t.length > 1));
  const tokens2 = new Set(norm2.split(' ').filter((t) => t.length > 1));
  if (tokens1.size > 0 && tokens2.size > 0) {
    let intersection = 0;
    tokens1.forEach((t) => {
      if (tokens2.has(t)) intersection++;
    });
    const union = new Set([...tokens1, ...tokens2]).size;
    const jaccard = intersection / union;
    if (jaccard === 1.0) return 0.95;
    if (jaccard >= 0.66) return 0.88;
  }

  // 5. Normalized Damerau-Levenshtein similarity on compact string
  const dist = calculateLevenshteinDistance(compactNorm1, compactNorm2);
  const maxLen = Math.max(compactNorm1.length, compactNorm2.length);
  if (maxLen === 0) return 1.0;

  // Safeguard: Short words (< 4 chars) require exact match to prevent false positives
  if (maxLen <= 3) {
    return dist === 0 ? 1.0 : 0.0;
  }

  const levSim = 1 - dist / maxLen;
  return Math.max(0, levSim);
}

// ============================================================================
// STEP 4 & 6: CANONICAL CITY ALIASES & CITY NORMALIZATION
// ============================================================================

/**
 * Standard canonical mappings for Indian cities with historical, vernacular, and typo aliases.
 */
const CANONICAL_CITY_ALIASES: Record<string, string[]> = {
  mumbai: ['mumbai', 'bombay', 'mumbay', 'navi mumbai', 'thane', 'mumbaicity', 'mumbaisuburban'],
  gurgaon: ['gurgaon', 'gurugram', 'gurgao', 'gurgoan', 'gurgaun', 'gurgram', 'gurgon', 'gurgown'],
  bangalore: ['bangalore', 'bengaluru', 'bangaluru', 'banglore', 'bengluru', 'bangalore urban', 'bangalore rural', 'bengalooru'],
  chennai: ['chennai', 'madras', 'chenai', 'chennay'],
  kolkata: ['kolkata', 'calcutta', 'calcata', 'kolkatha', 'kolkatta'],
  delhi: ['delhi', 'new delhi', 'newdelhi', 'delhi ncr', 'ncr', 'dilli'],
  noida: ['noida', 'greater noida', 'noida extension', 'greaternoida', 'noida sec'],
  hyderabad: ['hyderabad', 'secunderabad', 'hydrabad', 'hyderabaad', 'cyberabad'],
  pune: ['pune', 'poona', 'punecity'],
  visakhapatnam: ['visakhapatnam', 'vizag', 'vishakhapatnam', 'waltair', 'vizagpatnam'],
  ahmedabad: ['ahmedabad', 'amdavad', 'ahmadabad', 'karnavati'],
  kochi: ['kochi', 'cochin', 'ernakulam'],
  thiruvananthapuram: ['thiruvananthapuram', 'trivandrum'],
  varanasi: ['varanasi', 'benares', 'banaras', 'kashi'],
  vadodara: ['vadodara', 'baroda'],
  mysuru: ['mysuru', 'mysore'],
  prayagraj: ['prayagraj', 'allahabad'],
  chandigarh: ['chandigarh', 'tricity', 'mohali', 'panchkula'],
  jaipur: ['jaipur', 'pink city'],
  lucknow: ['lucknow', 'lakhnau'],
  indore: ['indore', 'indaur'],
  bhopal: ['bhopal'],
  surat: ['surat'],
  nagpur: ['nagpur'],
  patna: ['patna', 'patliputra'],
  goa: ['goa', 'panaji', 'north goa', 'south goa'],
};

/**
 * Normalizes city names for robust comparisons, resolving aliases and fuzzy typos.
 */
export function normalizeCityName(cityStr?: string): string {
  if (!cityStr) return '';
  const raw = cleanString(cityStr);
  if (!raw) return '';

  // 1. Direct check in canonical aliases
  for (const [canonical, aliases] of Object.entries(CANONICAL_CITY_ALIASES)) {
    if (canonical === raw || aliases.includes(raw)) {
      return canonical;
    }
    for (const alias of aliases) {
      if (raw === alias || (raw.length > 4 && (raw.includes(alias) || alias.includes(raw)))) {
        return canonical;
      }
    }
  }

  // 2. Fuzzy match against canonical aliases with high confidence
  let bestCanonical = raw;
  let highestSim = 0;

  for (const [canonical, aliases] of Object.entries(CANONICAL_CITY_ALIASES)) {
    const simCanonical = calculateStringSimilarity(raw, canonical);
    if (simCanonical > highestSim) {
      highestSim = simCanonical;
      bestCanonical = canonical;
    }
    for (const alias of aliases) {
      const simAlias = calculateStringSimilarity(raw, alias);
      if (simAlias > highestSim) {
        highestSim = simAlias;
        bestCanonical = canonical;
      }
    }
  }

  if (highestSim >= 0.78) {
    return bestCanonical;
  }

  return raw;
}

/**
 * Checks if two city names match (considering aliases, substrings, and fuzzy similarity).
 */
export function isSameCity(city1?: string, city2?: string): boolean {
  if (!city1 || !city2) return false;
  const n1 = normalizeCityName(city1);
  const n2 = normalizeCityName(city2);

  if (!n1 || !n2) return false;
  if (n1 === n2) return true;

  // Allow sub-clusters like "noida" & "greater noida"
  if ((n1.length >= 4 && n2.length >= 4) && (n1.includes(n2) || n2.includes(n1))) {
    return true;
  }

  return calculateStringSimilarity(n1, n2) >= 0.80;
}

// ============================================================================
// STEP 5: NEARBY LOCALITY, SECTORS & GEOGRAPHIC DISTANCE
// ============================================================================

/**
 * Calculates geographic Haversine distance in kilometers between two GPS coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extracts a numeric sector from a locality string (e.g. "Sector 57", "Sec 56", "Sector-54").
 */
export function extractSectorNumber(locality?: string): number | null {
  if (!locality) return null;
  const cleaned = cleanString(locality);
  const match = cleaned.match(/(?:sector|sec|s)\s*([0-9]{1,3})/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * List of cities with planned numeric sector grids.
 */
const SECTOR_GRID_CITIES = [
  'gurgaon',
  'noida',
  'greaternoida',
  'chandigarh',
  'faridabad',
  'delhi',
  'navi mumbai',
  'ghaziabad',
  'panchkula',
  'mohali',
];

/**
 * Checks if a city uses a planned numeric sector grid.
 */
export function isSectorGridCity(city?: string): boolean {
  if (!city) return false;
  const normCity = normalizeCityName(city);
  return SECTOR_GRID_CITIES.some((c) => normCity.includes(c) || isSameCity(normCity, c));
}

/**
 * Known locality proximity clusters across major Indian real estate markets.
 */
const KNOWN_LOCALITY_CLUSTERS: Record<string, string[][]> = {
  gurgaon: [
    ['golf course road', 'sector 53', 'sector 54', 'sector 55', 'sector 56', 'dlf phase 5', 'suncity'],
    ['golf course extension', 'golf course ext road', 'sector 57', 'sector 58', 'sector 61', 'sector 62', 'sector 65', 'sector 66', 'sector 67', 'tigra'],
    ['cyber city', 'dlf phase 1', 'dlf phase 2', 'dlf phase 3', 'dlf phase 4', 'mg road', 'sector 24', 'sector 25', 'sector 25a', 'sector 28', 'chakkarpur'],
    ['sohna road', 'sector 47', 'sector 48', 'sector 49', 'sector 50', 'malibu town', 'south city 2', 'rosewood city', 'islampur'],
    ['new gurgaon', 'sector 82', 'sector 83', 'sector 84', 'sector 85', 'sector 86', 'sector 89', 'sector 90', 'sector 91', 'sector 92', 'manesar'],
    ['dwarka expressway', 'sector 99', 'sector 102', 'sector 103', 'sector 104', 'sector 106', 'sector 108', 'sector 109', 'sector 110', 'sector 111', 'sector 112', 'sector 113', 'sector 114', 'bajghera'],
    ['old gurgaon', 'sector 14', 'sector 15', 'sector 17', 'sector 31', 'sector 32', 'sector 38', 'sector 39', 'sector 40', 'sector 45', 'sector 46', 'south city 1', 'jalvayu vihar', 'shanti nagar'],
  ],
  bangalore: [
    ['indiranagar', 'indira nagar', 'domlur', 'hal', 'old airport road', 'cambridge layout', 'ulsoor', 'tippasandra', 'defence colony'],
    ['koramangala', 'hsr layout', 'btm layout', 'ejipura', 'jayanagar', 'adugodi', 'st johns', 'sony world'],
    ['whitefield', 'white field', 'itpl', 'kadugodi', 'hoodi', 'varthur', 'marathahalli', 'aecs layout', 'kundalahalli', 'hope farm'],
    ['hsr layout', 'bellandur', 'sarjapur road', 'haralur', 'kasavanahalli', 'kaikondrahalli', 'ibblur'],
    ['electronic city', 'electronic city phase 1', 'electronic city phase 2', 'begur', 'bommasandra', 'neeladri nagar'],
    ['hebbal', 'sahakara nagar', 'thanisandra', 'hennur', 'nagawara', 'yelahanka', 'manyata tech park', 'kempapura'],
    ['jp nagar', 'jayanagar', 'banashankari', 'bannerghatta road', 'arekere', 'hulimavu'],
  ],
  mumbai: [
    ['bandra west', 'bandra', 'khar west', 'khar', 'santacruz west', 'santacruz', 'pali hill', 'carter road', 'bandstand'],
    ['andheri west', 'lokhandwala', 'oshiwara', 'versova', 'juhu', 'dn nagar', 'four bungalows', 'seven bungalows'],
    ['andheri east', 'marol', 'sakinaka', 'chakala', 'jb nagar', 'midc', 'chandivali'],
    ['powai', 'chandivali', 'vikhroli', 'kanjurmarg', 'hiranandani gardens', 'iit bombay'],
    ['borivali', 'borivali west', 'kandivali', 'kandivali west', 'dahisar', 'ic colony', 'shimpoli'],
    ['malad', 'malad west', 'goregaon', 'goregaon west', 'mindspace', 'chincholi bunder', 'link road'],
    ['thane', 'ghodbunder road', 'majiwada', 'vasant vihar', 'pokhran road', 'manpada', 'hiranandani estate'],
    ['navi mumbai', 'vashi', 'sanpada', 'nerul', 'seawoods', 'belapur', 'kharghar'],
  ],
  noida: [
    ['sector 62', 'sector 63', 'sector 59', 'sector 60', 'sector 64', 'indirapuram', 'mamura'],
    ['noida expressway', 'sector 137', 'sector 143', 'sector 128', 'sector 93', 'sector 108', 'sector 134', 'sector 142'],
    ['central noida', 'sector 74', 'sector 75', 'sector 76', 'sector 77', 'sector 78', 'sector 79', 'sector 120', 'sector 121'],
    ['sector 15', 'sector 16', 'sector 18', 'sector 27', 'atta market', 'sector 29', 'sector 37'],
  ],
  delhi: [
    ['saket', 'hauz khas', 'greater kailash', 'gk 1', 'gk 2', 'defence colony', 'green park', 'malviya nagar', 'south extension'],
    ['dwarka', 'dwarka sector 6', 'dwarka sector 10', 'dwarka sector 11', 'dwarka sector 12', 'dwarka sector 19', 'dwarka sector 21', 'dwarka sector 22'],
    ['rohini', 'rohini sector 7', 'rohini sector 8', 'rohini sector 9', 'rohini sector 13', 'rohini sector 14', 'rohini sector 15', 'rohini sector 24'],
    ['vasant kunj', 'vasant vihar', 'munirka', 'mahipalpur'],
  ],
  hyderabad: [
    ['gachibowli', 'hitec city', 'madhapur', 'kondapur', 'financial district', 'nanakramguda', 'khajaguda', 'manikonda'],
    ['jubilee hills', 'banjara hills', 'madhapur', 'film nagar', 'somajiguda', 'panjagutta'],
    ['kukatpally', 'kphb', 'nizampet', 'miyapur', 'hmt hills', 'pragathi nagar'],
  ],
  pune: [
    ['baner', 'balewadi', 'aundh', 'pashan', 'mahalunge', 'sus', 'bavdhan'],
    ['hinjewadi', 'hinjewadi phase 1', 'hinjewadi phase 2', 'hinjewadi phase 3', 'wakad', 'marunji', 'tathawade', 'punawale'],
    ['koregaon park', 'kalyani nagar', 'viman nagar', 'bund garden', 'camp', 'dhole patil road'],
    ['kharadi', 'viman nagar', 'wagholi', 'vadgaon sheri', 'chandan nagar', 'eon free zone'],
  ],
};

// ============================================================================
// STEP 13: LOCATION RELEVANCE SCORING (MAX 40 PTS)
// ============================================================================

export interface LocalityEvaluationResult {
  score: number; // 0 to 40
  matchType:
    | 'exact'
    | 'equivalent'
    | 'coordinates_nearby'
    | 'adjacent_sector'
    | 'nearby_cluster'
    | 'fuzzy'
    | 'same_city_distant'
    | 'different_city';
  reason: string;
  isExactOrFuzzy: boolean;
  isNearby: boolean;
}

/**
 * Calculates a Location Relevance Score (0 to 40 points) according to the multi-level hierarchy:
 * - Level 1: Exact city + exact locality (40 pts)
 * - Level 2: Equivalent city + equivalent locality (38-40 pts)
 * - Level 3: Geographic coordinates nearby (32-37 pts)
 * - Level 4: Adjacent sector / verified cluster (27-31 pts)
 * - Level 5: High-confidence fuzzy locality (26-30 pts)
 * - Level 6: Same city broader / distant (18-24 pts)
 * - Different city: 0 pts
 */
export function evaluateLocalityMatch(
  propLocality: string,
  leadLocality: string,
  city: string,
  propCoords?: { lat?: number; lng?: number },
  leadCoords?: { lat?: number; lng?: number }
): LocalityEvaluationResult {
  const normPropLoc = cleanString(propLocality);
  const normLeadLoc = cleanString(leadLocality);

  if (!normLeadLoc) {
    // If lead has no specific preferred locality, any property in target city gets a solid score
    return {
      score: 32,
      matchType: 'same_city_distant',
      reason: `City search (${propLocality || city})`,
      isExactOrFuzzy: true,
      isNearby: true,
    };
  }

  // LEVEL 1: Exact Locality Match
  if (normPropLoc === normLeadLoc) {
    return {
      score: 40,
      matchType: 'exact',
      reason: `Exact locality (${propLocality})`,
      isExactOrFuzzy: true,
      isNearby: true,
    };
  }

  // LEVEL 2: Equivalent Locality (Space collapsed / Token normalized, e.g. "White Field" vs "Whitefield", "MVP Coloni" vs "MVP Colony")
  const similarity = calculateStringSimilarity(normPropLoc, normLeadLoc);
  if (similarity >= 0.95) {
    return {
      score: 40,
      matchType: 'equivalent',
      reason: `Exact locality (${propLocality})`,
      isExactOrFuzzy: true,
      isNearby: true,
    };
  }

  // LEVEL 3: Verified Geographic Distance via Coordinates
  if (
    propCoords?.lat !== undefined &&
    propCoords?.lng !== undefined &&
    leadCoords?.lat !== undefined &&
    leadCoords?.lng !== undefined
  ) {
    const distKm = calculateHaversineDistanceKm(
      propCoords.lat,
      propCoords.lng,
      leadCoords.lat,
      leadCoords.lng
    );

    if (distKm <= 2.0) {
      return {
        score: 36,
        matchType: 'coordinates_nearby',
        reason: `Within ${distKm.toFixed(1)} km of preferred area (${propLocality})`,
        isExactOrFuzzy: false,
        isNearby: true,
      };
    } else if (distKm <= 5.0) {
      return {
        score: 30,
        matchType: 'coordinates_nearby',
        reason: `${distKm.toFixed(1)} km from preferred area (${propLocality})`,
        isExactOrFuzzy: false,
        isNearby: true,
      };
    } else if (distKm <= 10.0) {
      return {
        score: 22,
        matchType: 'coordinates_nearby',
        reason: `${distKm.toFixed(1)} km away in ${city}`,
        isExactOrFuzzy: false,
        isNearby: true,
      };
    }
  }

  // LEVEL 4: Sector Adjacency in Planned Grid Cities (e.g. Sector 56 vs Sector 57 in Gurgaon)
  const propSec = extractSectorNumber(normPropLoc);
  const leadSec = extractSectorNumber(normLeadLoc);

  if (propSec !== null && leadSec !== null) {
    const isSectorCity = isSectorGridCity(city);
    const propBase = normPropLoc.replace(/(?:sector|sec|s)\s*[0-9]+/gi, '').trim();
    const leadBase = normLeadLoc.replace(/(?:sector|sec|s)\s*[0-9]+/gi, '').trim();
    const sameLayoutPrefix =
      propBase.length > 2 &&
      leadBase.length > 2 &&
      (propBase.includes(leadBase) || leadBase.includes(propBase));

    if (isSectorCity || sameLayoutPrefix) {
      const diff = Math.abs(propSec - leadSec);
      if (diff === 0) {
        return {
          score: 40,
          matchType: 'exact',
          reason: `Exact Sector ${propSec}`,
          isExactOrFuzzy: true,
          isNearby: true,
        };
      } else if (diff <= 1) {
        return {
          score: 31,
          matchType: 'adjacent_sector',
          reason: `Adjacent sector (${propLocality} ↔ Sector ${leadSec})`,
          isExactOrFuzzy: false,
          isNearby: true,
        };
      } else if (diff <= 3) {
        return {
          score: 26,
          matchType: 'adjacent_sector',
          reason: `Nearby sector (${propLocality} ↔ Sector ${leadSec})`,
          isExactOrFuzzy: false,
          isNearby: true,
        };
      } else if (diff <= 6) {
        return {
          score: 20,
          matchType: 'adjacent_sector',
          reason: `Same sector zone (${propLocality})`,
          isExactOrFuzzy: false,
          isNearby: true,
        };
      }
    }
  }

  // LEVEL 4: Verified Locality Adjacency Clusters
  const cityKey = normalizeCityName(city);
  const clusters = KNOWN_LOCALITY_CLUSTERS[cityKey] || [];

  for (const cluster of clusters) {
    const hasProp = cluster.some((item) => normPropLoc.includes(item) || item.includes(normPropLoc));
    const hasLead = cluster.some((item) => normLeadLoc.includes(item) || item.includes(normLeadLoc));
    if (hasProp && hasLead) {
      return {
        score: 29,
        matchType: 'nearby_cluster',
        reason: `Nearby neighborhood: ${propLocality}`,
        isExactOrFuzzy: false,
        isNearby: true,
      };
    }
  }

  // LEVEL 5: High-Confidence Fuzzy Typo Match (Confidence threshold >= 0.82)
  if (similarity >= 0.82) {
    return {
      score: 28,
      matchType: 'fuzzy',
      reason: `Matching locality (${propLocality})`,
      isExactOrFuzzy: true,
      isNearby: true,
    };
  }

  // LEVEL 6: Same City Broader / Distant Locality
  return {
    score: 18,
    matchType: 'same_city_distant',
    reason: `Same city: ${propLocality}`,
    isExactOrFuzzy: false,
    isNearby: false,
  };
}

// ============================================================================
// STEP 7: BUDGET RELEVANCE SCORING (MAX 25 PTS)
// ============================================================================

export type BudgetRelevanceCategory =
  | 'WITHIN_BUDGET'
  | 'BELOW_BUDGET'
  | 'SLIGHT_STRETCH'
  | 'STRETCH'
  | 'HIGH_STRETCH'
  | 'OUT_OF_RANGE';

export interface BudgetEvaluationResult {
  score: number; // -25 to 25
  reason: string;
  budgetDiffPct: number;
  isCompatible: boolean;
  category: BudgetRelevanceCategory;
}

/**
 * Evaluates budget compatibility as a flexible target and graduated relevance factor (Max 25 pts).
 *
 * Rules:
 * - A lead's stated budget is treated as a TARGET, not a strict binary filter.
 * - Properties below target (or within stated range) are fully eligible and receive strong compatibility score (25 pts).
 * - Properties slightly above target (+0% to +10%) receive very good score (22 pts, SLIGHT_STRETCH).
 * - Properties moderately above target (+10% to +20%) receive good stretch score (17 pts, STRETCH).
 * - Properties in high stretch range (+20% to +30%) receive alternative score (11 pts, HIGH_STRETCH).
 * - Properties in weak stretch range (+30% to +40%) receive low priority score (4 pts, HIGH_STRETCH).
 * - Properties >40% above target are excluded from primary recommendations (score: -25, OUT_OF_RANGE).
 */
export function evaluateBudgetMatch(
  price: number,
  leadMinBudget?: number,
  leadMaxBudget?: number
): BudgetEvaluationResult {
  const maxBudget = leadMaxBudget && leadMaxBudget > 0 ? leadMaxBudget : 0;
  const minBudget = leadMinBudget && leadMinBudget > 0 ? leadMinBudget : 0;

  // Stated budget target: explicit maximum if provided, or minimum if only minimum exists
  const targetBudget = maxBudget > 0 ? maxBudget : minBudget;

  // Case 0: No budget specified by lead (open budget)
  if (targetBudget <= 0) {
    return {
      score: 20,
      reason: 'Budget Open',
      budgetDiffPct: 0,
      isCompatible: true,
      category: 'WITHIN_BUDGET',
    };
  }

  // Case 1: Property is at or below target budget
  if (price <= targetBudget) {
    // If an explicit range (min & max) exists and price is below minBudget
    if (minBudget > 0 && maxBudget > 0 && minBudget < maxBudget && price < minBudget) {
      const diffPct = -Math.round(((minBudget - price) / minBudget) * 100);
      return {
        score: 25,
        reason: 'Below Budget',
        budgetDiffPct: diffPct,
        isCompatible: true,
        category: 'BELOW_BUDGET',
      };
    }

    // Single target budget where property is cheaper than target (>15% below)
    if (price < targetBudget * 0.85) {
      const diffPct = -Math.round(((targetBudget - price) / targetBudget) * 100);
      return {
        score: 25,
        reason: 'Below Budget',
        budgetDiffPct: diffPct,
        isCompatible: true,
        category: 'BELOW_BUDGET',
      };
    }

    // Exact or near target budget
    const diffPct = -Math.round(((targetBudget - price) / targetBudget) * 100);
    return {
      score: 25,
      reason: 'Within Budget',
      budgetDiffPct: diffPct,
      isCompatible: true,
      category: 'WITHIN_BUDGET',
    };
  }

  // Case 2: Property is above target budget -> Calculate dynamic percentage stretch
  const diff = price - targetBudget;
  const diffPct = Math.round((diff / targetBudget) * 100);
  const diffFormatted = formatIndianCurrency(diff);

  // Bracket 1: 0% to +10% above target (e.g. ₹50L -> ₹50L-₹55L) -> Very good / slight stretch
  if (diffPct <= 10) {
    return {
      score: 22,
      reason: `${diffFormatted} Above Budget`,
      budgetDiffPct: diffPct,
      isCompatible: true,
      category: 'SLIGHT_STRETCH',
    };
  }

  // Bracket 2: +10% to +20% above target (e.g. ₹50L -> ₹55L-₹60L) -> Good alternative / stretch
  if (diffPct <= 20) {
    return {
      score: 17,
      reason: 'Stretch Budget',
      budgetDiffPct: diffPct,
      isCompatible: true,
      category: 'STRETCH',
    };
  }

  // Bracket 3: +20% to +30% above target (e.g. ₹50L -> ₹60L-₹65L) -> High stretch alternative
  if (diffPct <= 30) {
    return {
      score: 11,
      reason: 'Stretch Budget',
      budgetDiffPct: diffPct,
      isCompatible: true,
      category: 'HIGH_STRETCH',
    };
  }

  // Bracket 4: +30% to +40% above target (e.g. ₹50L -> ₹65L-₹70L) -> Weak stretch / low priority
  if (diffPct <= 40) {
    return {
      score: 4,
      reason: 'Stretch Budget',
      budgetDiffPct: diffPct,
      isCompatible: true,
      category: 'HIGH_STRETCH',
    };
  }

  // Bracket 5: >40% above target (e.g. >₹70L on ₹50L target) -> Excluded from primary recommendations
  return {
    score: -25,
    reason: `${diffFormatted} Above Budget`,
    budgetDiffPct: diffPct,
    isCompatible: false,
    category: 'OUT_OF_RANGE',
  };
}

// ============================================================================
// STEP 8: PROPERTY TYPE RELEVANCE (MAX 15 PTS)
// ============================================================================

export interface PropertyTypeEvaluationResult {
  score: number; // -25 to 15
  reason?: string;
  isCompatible: boolean;
}

/**
 * Evaluates Property Type Compatibility (Max 15 pts).
 * Incompatible types (e.g. Plot vs Apartment) receive negative score (-25) to prevent primary recommendation.
 */
export function evaluatePropertyTypeMatch(
  propType?: PropertyType,
  leadType?: PropertyType
): PropertyTypeEvaluationResult {
  if (!leadType || !propType) {
    return { score: 12, isCompatible: true };
  }

  if (propType === leadType) {
    const label = propType.charAt(0).toUpperCase() + propType.slice(1);
    return { score: 15, reason: label, isCompatible: true };
  }

  // Apartment family compatibility
  const apartmentFamily: PropertyType[] = ['flat', 'penthouse'];
  if (apartmentFamily.includes(propType) && apartmentFamily.includes(leadType)) {
    return { score: 13, reason: 'Apartment / Penthouse', isCompatible: true };
  }

  // House / Villa family compatibility
  const houseFamily: PropertyType[] = ['house', 'villa'];
  if (houseFamily.includes(propType) && houseFamily.includes(leadType)) {
    return { score: 13, reason: 'Villa / House', isCompatible: true };
  }

  // Clearly incompatible types (e.g. Plot vs Apartment or Commercial vs House)
  return { score: -25, isCompatible: false };
}

// ============================================================================
// STEP 9: BHK & CONFIGURATION (MAX 10 PTS)
// ============================================================================

/**
 * Extracts a numeric BHK count from strings like "2 BHK", "2bhk", "2 Bedroom", "2 Bed", "Studio", "1 RK", etc.
 */
export function extractNumericBhk(bhkStr?: string): number | null {
  if (!bhkStr) return null;
  const s = cleanString(bhkStr);
  if (s.includes('studio') || s.includes('1 rk') || s.includes('1rk')) return 1;

  const match = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (match && match[1]) {
    const num = parseFloat(match[1]);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Evaluates BHK compatibility (Max 10 pts).
 */
export function evaluateBhkMatch(
  propBhk?: string,
  leadBhk?: string,
  propType?: PropertyType
): { score: number; reason?: string } {
  // Non-residential or plots don't strictly require BHK
  if (propType === 'plot' || propType === 'commercial') {
    return { score: 10 };
  }

  if (!leadBhk || !propBhk) {
    return { score: 8 };
  }

  const pNum = extractNumericBhk(propBhk);
  const lNum = extractNumericBhk(leadBhk);

  if (pNum !== null && lNum !== null) {
    const diff = Math.abs(pNum - lNum);
    if (diff === 0) {
      return { score: 10, reason: `${propBhk}` };
    }
    if (diff <= 0.5) {
      return { score: 9, reason: `${propBhk} Configuration` };
    }
    if (diff === 1) {
      return { score: 6, reason: `${propBhk} (Alternative)` };
    }
    if (diff === 2) {
      return { score: 0, reason: `${propBhk}` };
    }
    return { score: -5 };
  }

  if (cleanString(propBhk) === cleanString(leadBhk)) {
    return { score: 10, reason: propBhk };
  }

  return { score: 4, reason: propBhk };
}

// ============================================================================
// STEP 10: TRANSACTION COMPATIBILITY (HARD FILTER, 10 PTS)
// ============================================================================

/**
 * Checks transaction compatibility (Sale <-> Buy/Sell, Rent <-> Rent/Lease).
 * Strict hard filter: Sale properties are never recommended to rental leads.
 */
export function isTransactionCompatible(
  leadReq?: RequirementType,
  propTxn?: PropertyTransactionType
): boolean {
  if (!leadReq || !propTxn) return true;

  const leadIsSale = leadReq === 'buy' || leadReq === 'sell';
  const propIsSale = propTxn === 'sale';
  const leadIsRent = leadReq === 'rent' || leadReq === 'lease';
  const propIsRent = propTxn === 'rent' || propTxn === 'lease';

  return (leadIsSale && propIsSale) || (leadIsRent && propIsRent);
}

// ============================================================================
// STEP 11, 12, 14, 15, 16: CORE MATCHING ENGINE
// ============================================================================

/**
 * Extracts and prioritizes the lead's Target Property Location:
 * - Preferred Property City
 * - Preferred Locality
 * - Current City (kept distinct)
 */
export function getLeadTargetLocation(lead: Lead): {
  preferredCity: string;
  preferredLocality: string;
  currentCity: string;
  allLocalities: string[];
} {
  const currentCity = (lead.currentCity || '').trim();
  let preferredCity = (lead.preferredCity || '').trim();
  let preferredLocality = (lead.preferredLocality || '').trim();
  const allLocalities: string[] = [];

  // Parse existing preferredLocations array if preferredCity or preferredLocality is not set
  if (lead.preferredLocations && lead.preferredLocations.length > 0) {
    for (const loc of lead.preferredLocations) {
      const trimmed = loc.trim();
      if (!trimmed) continue;
      allLocalities.push(trimmed);

      if (!preferredCity || !preferredLocality) {
        const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!preferredLocality) preferredLocality = parts[0];
          if (!preferredCity) preferredCity = parts[parts.length - 1];
        } else if (!preferredLocality && !preferredCity) {
          preferredLocality = trimmed;
        }
      }
    }
  }

  // If preferredCity is still not detected, scan for common Indian city keywords in preferredLocations
  if (!preferredCity) {
    const knownCities = Object.keys(CANONICAL_CITY_ALIASES);
    for (const loc of lead.preferredLocations || []) {
      const cleanLoc = cleanString(loc);
      const match = knownCities.find((c) => cleanLoc.includes(c) || isSameCity(cleanLoc, c));
      if (match) {
        preferredCity = match;
        break;
      }
    }
  }

  // If preferredLocality is not set but preferredLocations exists
  if (!preferredLocality && lead.preferredLocations && lead.preferredLocations.length > 0) {
    preferredLocality = lead.preferredLocations[0];
  }

  return {
    preferredCity,
    preferredLocality,
    currentCity,
    allLocalities: allLocalities.length > 0 ? allLocalities : [preferredLocality].filter(Boolean),
  };
}

export interface GroupedPropertyMatches {
  bestMatches: PropertyMatchResult[]; // Exact locality match or top quality in preferred city
  nearbyMatches: PropertyMatchResult[]; // Nearby localities / adjacent sectors in preferred city
  allPrimaryMatches: PropertyMatchResult[]; // All valid primary same-city matches
  expandedMatches: PropertyMatchResult[]; // Other cities (only when explicitly requested)
  preferredCity: string;
  preferredLocality: string;
  hasCityMatch: boolean;
  totalInventoryInCity: number;
}

/**
 * Evaluates a single Property against a Lead and returns a detailed PropertyMatchResult.
 */
export function scorePropertyForLead(
  property: Property,
  lead: Lead,
  targetLocation?: { preferredCity: string; preferredLocality: string; allLocalities: string[] }
): PropertyMatchResult | null {
  // 1. Availability Status Check (STEP 11)
  if (
    property.status === 'sold_rented' ||
    property.status === 'archived' ||
    (property.status as any) === 'sold' ||
    (property.status as any) === 'rented' ||
    (property.status as any) === 'inactive'
  ) {
    return null;
  }

  // 2. Transaction Compatibility Check (STEP 10)
  if (!isTransactionCompatible(lead.requirement, property.transactionType)) {
    return null;
  }

  const { preferredCity, preferredLocality, allLocalities } =
    targetLocation || getLeadTargetLocation(lead);

  const targetCityNorm = normalizeCityName(preferredCity);
  const sameCity = targetCityNorm ? isSameCity(property.city, preferredCity) : true;

  // 3. Location Relevance (STEP 12 & 13: Max 40 pts)
  const propCoords = (property as unknown as { coordinates?: { lat?: number; lng?: number } }).coordinates;
  const leadCoords = (lead as unknown as { coordinates?: { lat?: number; lng?: number } }).coordinates;

  let bestLocResult = evaluateLocalityMatch(
    property.locality || '',
    preferredLocality,
    property.city || preferredCity,
    propCoords,
    leadCoords
  );

  if (allLocalities.length > 1) {
    for (const loc of allLocalities) {
      const altResult = evaluateLocalityMatch(
        property.locality || '',
        loc,
        property.city || preferredCity,
        propCoords,
        leadCoords
      );
      if (altResult.score > bestLocResult.score) {
        bestLocResult = altResult;
      }
    }
  }

  // If different city, location score is 0
  const locationScore = sameCity ? bestLocResult.score : 0;

  // 4. Property Type Check (STEP 8: Max 15 pts)
  const typeResult = evaluatePropertyTypeMatch(property.propertyType, lead.propertyType);
  if (!typeResult.isCompatible) {
    return null;
  }

  // 5. Budget Check (STEP 7: Max 25 pts)
  const budgetResult = evaluateBudgetMatch(property.price, lead.budgetMin, lead.budgetMax);
  if (budgetResult.score < 0) {
    return null;
  }

  // 6. BHK Check (STEP 9: Max 10 pts)
  const bhkResult = evaluateBhkMatch(property.bhk, lead.bhk, property.propertyType);

  // 7. Transaction Score (STEP 10: 10 pts)
  const txnScore = 10;

  // Compile Match Reasons
  const reasons: string[] = [];
  if (bestLocResult.reason) reasons.push(bestLocResult.reason);
  if (typeResult.reason) reasons.push(typeResult.reason);
  if (budgetResult.reason) reasons.push(budgetResult.reason);
  if (bhkResult.reason) reasons.push(bhkResult.reason);

  // Total Score (0 - 100)
  const totalScore = locationScore + typeResult.score + budgetResult.score + bhkResult.score + txnScore;
  const finalScore = Math.min(100, Math.max(0, totalScore));

  // Match Category Classification
  let matchCategory: MatchCategory;
  if (sameCity) {
    if (
      (bestLocResult.isExactOrFuzzy || bestLocResult.matchType === 'adjacent_sector') &&
      finalScore >= 75
    ) {
      matchCategory = 'best_match';
    } else {
      matchCategory = 'nearby_match';
    }
  } else {
    matchCategory = 'expanded_match';
  }

  return {
    property,
    score: finalScore,
    matchReasons: reasons,
    matchCategory,
    isExactLocality: bestLocResult.isExactOrFuzzy,
    isNearbyLocality: sameCity && !bestLocResult.isExactOrFuzzy,
    isSameCity: sameCity,
    budgetDiffPercentage: budgetResult.budgetDiffPct,
  };
}

/**
 * Returns grouped property matches for a lead:
 * - Best Matches: High scoring exact/equivalent locality properties in same city
 * - Nearby Matches: Nearby localities, adjacent sectors, and valid alternatives in same city
 * - Expanded Matches: Cross-city inventory (kept separated)
 */
export function getGroupedPropertyMatches(
  lead: Lead,
  properties: Property[],
  _options?: { allowExpandedSearch?: boolean }
): GroupedPropertyMatches {
  const targetLoc = getLeadTargetLocation(lead);
  const targetCityNorm = normalizeCityName(targetLoc.preferredCity);

  const bestMatches: PropertyMatchResult[] = [];
  const nearbyMatches: PropertyMatchResult[] = [];
  const expandedMatches: PropertyMatchResult[] = [];

  let totalInventoryInCity = 0;

  for (const property of properties) {
    const isSameCityProp = targetCityNorm ? isSameCity(property.city, targetLoc.preferredCity) : true;
    if (
      isSameCityProp &&
      targetCityNorm &&
      property.status !== 'sold_rented' &&
      property.status !== 'archived'
    ) {
      totalInventoryInCity++;
    }

    const scored = scorePropertyForLead(property, lead, targetLoc);
    if (!scored) continue;

    if (scored.isSameCity) {
      if (scored.matchCategory === 'best_match') {
        bestMatches.push(scored);
      } else {
        nearbyMatches.push(scored);
      }
    } else {
      expandedMatches.push(scored);
    }
  }

  // STEP 16: Ranking order (overall score descending)
  bestMatches.sort((a, b) => b.score - a.score);
  nearbyMatches.sort((a, b) => b.score - a.score);
  expandedMatches.sort((a, b) => b.score - a.score);

  const allPrimaryMatches = [...bestMatches, ...nearbyMatches];

  return {
    bestMatches,
    nearbyMatches,
    allPrimaryMatches,
    expandedMatches,
    preferredCity: targetLoc.preferredCity,
    preferredLocality: targetLoc.preferredLocality,
    hasCityMatch: allPrimaryMatches.length > 0,
    totalInventoryInCity,
  };
}

/**
 * Finds matching properties for a lead.
 */
export function findMatchingProperties(
  lead: Lead,
  properties: Property[],
  options?: { allowExpandedSearch?: boolean }
): PropertyMatchResult[] {
  const grouped = getGroupedPropertyMatches(lead, properties, options);
  if (options?.allowExpandedSearch) {
    return [...grouped.allPrimaryMatches, ...grouped.expandedMatches];
  }
  return grouped.allPrimaryMatches;
}

/**
 * Matches potential buyers / tenants for a given property.
 * Strictly checks that each Lead's preferred property city matches the property's city.
 */
export function findMatchingLeads(property: Property, leads: Lead[]): LeadMatchResult[] {
  // Inactive, sold, rented, or archived properties cannot be matched with active buyers
  if (
    property.status === 'sold_rented' ||
    property.status === 'archived' ||
    (property.status as any) === 'sold' ||
    (property.status as any) === 'rented' ||
    (property.status as any) === 'inactive'
  ) {
    return [];
  }

  // Only match against active leads
  const activeLeads = leads.filter((l) => l.status !== 'closed' && l.status !== 'lost');
  const results: LeadMatchResult[] = [];

  for (const lead of activeLeads) {
    const scored = scorePropertyForLead(property, lead);
    if (!scored) continue;

    // Hard filter: Only same-city leads
    if (!scored.isSameCity && normalizeCityName(lead.preferredCity)) {
      continue;
    }

    if (scored.score >= 50) {
      results.push({
        lead,
        score: scored.score,
        matchReasons: scored.matchReasons,
        isExactLocality: scored.isExactLocality,
        isSameCity: scored.isSameCity,
        matchCategory: scored.matchCategory,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
