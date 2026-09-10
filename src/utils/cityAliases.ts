import { Property, Lead } from '../types';

/**
 * Common alternate, historical, official, and colloquial names for Indian cities.
 * Grouped in bidirectional clusters so searching any name in a cluster will match
 * records stored with any other name from the same cluster.
 */
export const INDIAN_CITY_ALIAS_CLUSTERS: string[][] = [
  // Visakhapatnam / Vizag
  ['visakhapatnam', 'vizag', 'waltair'],
  // Mumbai / Bombay
  ['mumbai', 'bombay'],
  // Gurgaon / Gurugram
  ['gurgaon', 'gurugram'],
  // Bengaluru / Bangalore
  ['bengaluru', 'bangalore'],
  // Kolkata / Calcutta
  ['kolkata', 'calcutta'],
  // Chennai / Madras
  ['chennai', 'madras'],
  // Kochi / Cochin / Ernakulam
  ['kochi', 'cochin', 'ernakulam'],
  // Thiruvananthapuram / Trivandrum
  ['thiruvananthapuram', 'trivandrum'],
  // Pune / Poona
  ['pune', 'poona'],
  // Vadodara / Baroda
  ['vadodara', 'baroda'],
  // Varanasi / Banaras / Benares / Kashi
  ['varanasi', 'banaras', 'benares', 'kashi'],
  // Prayagraj / Allahabad
  ['prayagraj', 'allahabad'],
  // Mangaluru / Mangalore
  ['mangaluru', 'mangalore'],
  // Mysuru / Mysore
  ['mysuru', 'mysore'],
  // Belagavi / Belgaum
  ['belagavi', 'belgaum'],
  // Hubballi / Hubli
  ['hubballi', 'hubli', 'hubli-dharwad', 'dharwad'],
  // Puducherry / Pondicherry
  ['puducherry', 'pondicherry', 'pondy'],
  // Kozhikode / Calicut
  ['kozhikode', 'calicut'],
  // Tiruchirappalli / Trichy
  ['tiruchirappalli', 'trichy', 'tiruchi'],
  // Shimla / Simla
  ['shimla', 'simla'],
  // Udhagamandalam / Ooty
  ['udhagamandalam', 'ooty'],
  // Vijayawada / Bezawada
  ['vijayawada', 'bezawada'],
  // Panaji / Panjim
  ['panaji', 'panjim'],
  // Kalaburagi / Gulbarga
  ['kalaburagi', 'gulbarga'],
  // Vijayapura / Bijapur
  ['vijayapura', 'bijapur'],
  // Ballari / Bellary
  ['ballari', 'bellary'],
  // Shivamogga / Shimoga
  ['shivamogga', 'shimoga'],
  // Chikkamagaluru / Chikmagalur
  ['chikkamagaluru', 'chikmagalur'],
  // Tumakuru / Tumkur
  ['tumakuru', 'tumkur'],
  // Hosapete / Hospet
  ['hosapete', 'hospet'],
  // Kannur / Cannanore
  ['kannur', 'cannanore'],
  // Palakkad / Palghat
  ['palakkad', 'palghat'],
  // Alappuzha / Alleppey
  ['alappuzha', 'alleppey'],
  // Kollam / Quilon
  ['kollam', 'quilon'],
  // Thalassery / Tellicherry
  ['thalassery', 'tellicherry'],
  // Tirunelveli / Nellai
  ['tirunelveli', 'nellai'],
  // Thanjavur / Tanjore
  ['thanjavur', 'tanjore'],
  // Thoothukudi / Tuticorin
  ['thoothukudi', 'tuticorin'],
  // Jalandhar / Jullundur
  ['jalandhar', 'jullundur'],
  // Guwahati / Gauhati
  ['guwahati', 'gauhati'],
  // Bhubaneswar / Bhubaneshwar
  ['bhubaneswar', 'bhubaneshwar'],
  // Cuttack / Kataka
  ['cuttack', 'kataka'],
  // Ahmedabad / Amdavad
  ['ahmedabad', 'amdavad'],
  // Ayodhya / Faizabad
  ['ayodhya', 'faizabad'],
];

// Lookup map from each alias to its full cluster
const CITY_TO_CLUSTER_MAP: Map<string, string[]> = new Map();

INDIAN_CITY_ALIAS_CLUSTERS.forEach((cluster) => {
  cluster.forEach((name) => {
    CITY_TO_CLUSTER_MAP.set(name.toLowerCase().trim(), cluster);
  });
});

/**
 * Returns all aliases for a city or text string if recognized in the cluster.
 */
export function getCityAliases(cityOrText?: string): string[] {
  if (!cityOrText) return [];
  const normalized = cityOrText.toLowerCase().trim();
  if (!normalized) return [];

  // 1. Direct match
  const directCluster = CITY_TO_CLUSTER_MAP.get(normalized);
  if (directCluster) {
    return directCluster;
  }

  // 2. Check if the text contains any known alias as a word or token
  const matched = new Set<string>();
  for (const [alias, cluster] of CITY_TO_CLUSTER_MAP.entries()) {
    if (normalized === alias || normalized.includes(alias)) {
      cluster.forEach((c) => matched.add(c));
    }
  }

  if (matched.size > 0) {
    return Array.from(matched);
  }

  return [normalized];
}

/**
 * Given a query, returns all equivalent search query terms/variants,
 * substituting city aliases if present or matching partial alias prefixes.
 */
export function getQuerySearchVariants(query: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const variants = new Set<string>([q]);

  // 1. Check direct alias match for the whole query
  const directCluster = CITY_TO_CLUSTER_MAP.get(q);
  if (directCluster) {
    directCluster.forEach((alias) => variants.add(alias));
  }

  // 2. Check prefix matches if query is at least 3 characters
  // e.g. "viza" -> "visakhapatnam", "vizag"
  // e.g. "bomb" -> "mumbai", "bombay"
  // e.g. "gurug" -> "gurgaon", "gurugram"
  // e.g. "beng" -> "bangalore", "bengaluru"
  // e.g. "banar" -> "varanasi", "banaras", "kashi"
  // e.g. "prayag" -> "allahabad", "prayagraj"
  // e.g. "trivan" -> "trivandrum", "thiruvananthapuram"
  if (q.length >= 3) {
    for (const [alias, cluster] of CITY_TO_CLUSTER_MAP.entries()) {
      if (alias.startsWith(q) || q.startsWith(alias)) {
        cluster.forEach((name) => variants.add(name));
      }
    }
  }

  // 3. Multi-word queries: check individual tokens (e.g. "3 bhk in vizag", "flat bombay")
  const tokens = q.split(/[\s,+/]+/);
  if (tokens.length > 1) {
    for (const token of tokens) {
      if (token.length < 3) continue;
      const tokenCluster =
        CITY_TO_CLUSTER_MAP.get(token) ||
        (token.length >= 3
          ? Array.from(CITY_TO_CLUSTER_MAP.entries()).find(([alias]) => alias.startsWith(token) || token.startsWith(alias))?.[1]
          : undefined);

      if (tokenCluster) {
        for (const alias of tokenCluster) {
          variants.add(alias);
          const replaced = q.replace(token, alias);
          variants.add(replaced);
        }
      }
    }
  }

  return Array.from(variants);
}

/**
 * Matches a Property against a search query using existing fields plus
 * bidirectional Indian city alias recognition.
 */
export function matchPropertyWithCityAliases(p: Property, searchQuery: string): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase().trim();

  // 1. Direct standard field checks
  const matchTitle = (p.title || '').toLowerCase().includes(q);
  const matchLocality = (p.locality || '').toLowerCase().includes(q);
  const matchCity = (p.city || '').toLowerCase().includes(q);
  const matchBhk = (p.bhk || '').toLowerCase().includes(q);
  const matchOwner = (p.ownerName || '').toLowerCase().includes(q);
  const matchType = (p.propertyType || '').toLowerCase().includes(q);

  if (matchTitle || matchLocality || matchCity || matchBhk || matchOwner || matchType) {
    return true;
  }

  // 2. City alias variants of the search query
  const queryVariants = getQuerySearchVariants(q);
  for (const variant of queryVariants) {
    if (variant === q) continue;
    if (
      (p.city && p.city.toLowerCase().includes(variant)) ||
      (p.locality && p.locality.toLowerCase().includes(variant)) ||
      (p.title && p.title.toLowerCase().includes(variant))
    ) {
      return true;
    }
  }

  // 3. Check if property's stored city or locality has aliases matching the query
  if (p.city) {
    const cityAliases = getCityAliases(p.city);
    for (const alias of cityAliases) {
      if (alias.includes(q) || q.includes(alias)) {
        return true;
      }
    }
  }

  if (p.locality) {
    const locAliases = getCityAliases(p.locality);
    for (const alias of locAliases) {
      if (alias.includes(q) || q.includes(alias)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Matches a Lead against a search query using existing fields plus
 * bidirectional Indian city alias recognition.
 */
export function matchLeadWithCityAliases(lead: Lead, searchQuery: string): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase().trim();

  // 1. Direct standard field checks
  const matchName = (lead.name || '').toLowerCase().includes(q);
  const matchPhone = (lead.phone || '').includes(q);
  const matchLoc = (lead.preferredLocations || []).some((loc) =>
    loc.toLowerCase().includes(q)
  );
  const matchBhk = (lead.bhk || '').toLowerCase().includes(q);
  const matchNotes = (lead.notes || '').toLowerCase().includes(q);

  if (matchName || matchPhone || matchLoc || matchBhk || matchNotes) {
    return true;
  }

  // 2. City alias variants of the search query
  const queryVariants = getQuerySearchVariants(q);
  for (const variant of queryVariants) {
    if (variant === q) continue;
    const matchLocVariant = (lead.preferredLocations || []).some((loc) =>
      loc.toLowerCase().includes(variant)
    );
    const matchNotesVariant = (lead.notes || '').toLowerCase().includes(variant);
    if (matchLocVariant || matchNotesVariant) {
      return true;
    }
  }

  // 3. Check if any preferred location in lead has aliases matching the query
  for (const loc of lead.preferredLocations || []) {
    const aliases = getCityAliases(loc);
    for (const alias of aliases) {
      if (alias.includes(q) || q.includes(alias)) {
        return true;
      }
    }
  }

  return false;
}
