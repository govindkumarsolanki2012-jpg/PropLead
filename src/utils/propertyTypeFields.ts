import { Property, PropertyType } from '../types';

export type BasePropertyField =
  | 'bhk'
  | 'superBuiltUpAreaSqFt'
  | 'carpetAreaSqFt'
  | 'floor'
  | 'facing'
  | 'furnishing';

const BASE_FIELDS: Record<PropertyType, readonly BasePropertyField[]> = {
  flat: ['bhk', 'superBuiltUpAreaSqFt', 'carpetAreaSqFt', 'floor', 'facing', 'furnishing'],
  house: ['bhk', 'superBuiltUpAreaSqFt', 'carpetAreaSqFt', 'facing', 'furnishing'],
  villa: ['bhk', 'superBuiltUpAreaSqFt', 'carpetAreaSqFt', 'facing', 'furnishing'],
  plot: ['facing'],
  commercial: ['superBuiltUpAreaSqFt', 'carpetAreaSqFt', 'floor', 'facing', 'furnishing'],
  land: ['facing'],
  penthouse: ['bhk', 'superBuiltUpAreaSqFt', 'carpetAreaSqFt', 'floor', 'facing', 'furnishing'],
  farmhouse: ['bhk', 'facing', 'furnishing'],
};

export const PROPERTY_TYPE_AMENITIES: Record<PropertyType, readonly string[]> = {
  flat: ['Lift with Power Backup', '24/7 Security & CCTV', 'Covered Car Parking', 'Gym & Fitness Centre', 'Swimming Pool', 'Clubhouse', 'Gated Community', '100% Vastu Compliant'],
  house: ['Covered Car Parking', '100% Vastu Compliant', 'Rainwater Harvesting'],
  villa: ['Covered Car Parking', '24/7 Security & CCTV', 'Gym & Fitness Centre', 'Swimming Pool', 'Clubhouse', 'Gated Community', 'Lift with Power Backup', '100% Vastu Compliant'],
  plot: ['100% Vastu Compliant'],
  commercial: ['Lift with Power Backup', '24/7 Security & CCTV', 'Covered Car Parking'],
  land: ['100% Vastu Compliant'],
  penthouse: ['Lift with Power Backup', '24/7 Security & CCTV', 'Covered Car Parking', 'Gym & Fitness Centre', 'Swimming Pool', 'Clubhouse'],
  farmhouse: ['Covered Car Parking', '100% Vastu Compliant', 'Rainwater Harvesting'],
};

export function isPropertyFieldVisible(propertyType: PropertyType, field: BasePropertyField): boolean {
  return BASE_FIELDS[propertyType]?.includes(field) ?? false;
}


// Canonical optional fields for both form rendering and submission sanitization.
const EXTRA_FIELDS: Record<PropertyType, readonly (keyof Property)[]> = {
  flat: ['balconyCount', 'parking'],
  house: ['plotAreaSqFt', 'builtUpAreaSqFt', 'totalFloors', 'balconyCount', 'parking', 'garden', 'terrace', 'waterAvailability', 'electricityAvailability', 'boundaryWall'],
  villa: ['plotAreaSqFt', 'builtUpAreaSqFt', 'totalFloors', 'balconyCount', 'parking', 'garden', 'terrace'],
  plot: ['plotAreaSqFt', 'plotDimension', 'roadWidth', 'cornerPlot', 'boundaryWall', 'approvalType', 'waterAvailability', 'electricityAvailability', 'drainageAvailability', 'roadType', 'nearbyLandmark'],
  land: ['plotAreaSqFt', 'plotDimension', 'roadWidth', 'cornerPlot', 'boundaryWall', 'approvalType', 'waterAvailability', 'electricityAvailability', 'drainageAvailability', 'roadType', 'nearbyLandmark'],
  commercial: ['commercialType', 'builtUpAreaSqFt', 'washroom', 'parking', 'frontage', 'roadWidth', 'suitableFor'],
  penthouse: ['totalFloors', 'terraceAreaSqFt', 'balconyCount', 'parking', 'privateTerrace'],
  farmhouse: ['landAreaSqFt', 'builtUpAreaSqFt', 'roadAccess', 'roadWidth', 'waterSource', 'electricityAvailability', 'boundaryWall', 'fencing', 'treesOrGarden', 'parking', 'nearbyVillageOrCity'],
};

// Recognized legacy aliases follow the same relevance rules as their canonical field.
const FIELD_ALIASES: Partial<Record<keyof Property, keyof Property>> = {
  balconies: 'balconyCount',
  bedrooms: 'bhk',
  roadWidthFt: 'roadWidth',
  isCornerPlot: 'cornerPlot',
  waterSupply: 'waterAvailability',
  electricitySupply: 'electricityAvailability',
  washrooms: 'washroom',
  frontageFt: 'frontage',
  farmGarden: 'treesOrGarden',
};
const CATEGORY_FIELDS = new Set<keyof Property>([
  ...Object.values(BASE_FIELDS).flat(),
  ...Object.values(EXTRA_FIELDS).flat(),
  ...Object.keys(FIELD_ALIASES) as (keyof Property)[],
  'lift',
]);

export function isPropertyExtraFieldVisible(propertyType: PropertyType, field: keyof Property): boolean {
  return EXTRA_FIELDS[propertyType]?.includes(field) ?? false;
}

/**
 * Build a clean save payload without mutating the form draft or original property.
 * Omitted fields do not delete legacy Firestore fields when the caller uses merge:true.
 */
export function sanitizePropertyForType(property: Property): Property {
  const result = { ...property };
  const allowed = new Set<keyof Property>([
    ...(BASE_FIELDS[property.propertyType] || []),
    ...(EXTRA_FIELDS[property.propertyType] || []),
  ]);
  for (const [alias, canonical] of Object.entries(FIELD_ALIASES)) {
    if (allowed.has(canonical)) allowed.add(alias as keyof Property);
  }
  if (PROPERTY_TYPE_AMENITIES[property.propertyType]?.includes('Lift with Power Backup')) allowed.add('lift');

  for (const field of CATEGORY_FIELDS) {
    // Required by the existing Property interface; hidden furnishing never carries old selections.
    if (field === 'furnishing') continue;
    const value = result[field];
    if (!allowed.has(field) || value === undefined || value === null ||
      (typeof value === 'string' && !value.trim()) ||
      (typeof value === 'number' && (!Number.isFinite(value) || value < 0))) {
      Reflect.deleteProperty(result, field);
    } else if (typeof value === 'string') {
      Object.assign(result, { [field]: value.trim() });
    }
  }
  result.furnishing = allowed.has('furnishing') &&
    ['unfurnished', 'semi_furnished', 'fully_furnished'].includes(property.furnishing)
    ? property.furnishing : 'unfurnished';
  const knownAmenities = new Set(Object.values(PROPERTY_TYPE_AMENITIES).flat());
  const relevantAmenities = PROPERTY_TYPE_AMENITIES[property.propertyType] || [];
  // Preserve unclassified legacy/custom amenities; remove known amenities from other categories.
  result.amenities = (Array.isArray(property.amenities) ? property.amenities : []).filter((item) =>
    typeof item === 'string' && item.trim() &&
    (relevantAmenities.includes(item) || !knownAmenities.has(item)));
  return result;
}

export function usesBhkForMatching(propertyType: PropertyType): boolean {
  return ['flat', 'house', 'villa', 'penthouse'].includes(propertyType);
}

export function getBhkLabel(propertyType: PropertyType): string {
  return propertyType === 'farmhouse' ? 'Bedrooms / Rooms' : 'BHK / Configuration';
}

const yesNo = (value?: boolean) => value === undefined ? '' : value ? 'Yes' : 'No';
const titleCase = (value?: string) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
const area = (value?: number) => value ? `${value.toLocaleString('en-IN')} sq.ft` : '';

export interface PropertySpec {
  label: string;
  value: string;
}

export function getRelevantPropertySpecs(property: Property): PropertySpec[] {
  const specs: PropertySpec[] = [];
  const add = (label: string, value: string | number | undefined) => {
    if (value !== undefined && value !== null && String(value).trim()) specs.push({ label, value: String(value) });
  };

  if (isPropertyFieldVisible(property.propertyType, 'bhk')) add(getBhkLabel(property.propertyType), property.bhk);
  if (isPropertyFieldVisible(property.propertyType, 'superBuiltUpAreaSqFt')) add('Super Built-Up Area', area(property.superBuiltUpAreaSqFt));
  if (isPropertyFieldVisible(property.propertyType, 'carpetAreaSqFt')) add('Carpet Area', area(property.carpetAreaSqFt));
  if (isPropertyFieldVisible(property.propertyType, 'floor')) add('Floor', property.floor);
  if (isPropertyFieldVisible(property.propertyType, 'facing')) add('Facing', property.facing ? `${property.facing} Facing` : '');
  if (isPropertyFieldVisible(property.propertyType, 'furnishing')) add('Furnishing', titleCase(property.furnishing));

  if (property.propertyType === 'flat') {
    add('Balconies', property.balconyCount);
    add('Parking', property.parking);
  } else if (property.propertyType === 'house' || property.propertyType === 'villa') {
    add('Plot Area', area(property.plotAreaSqFt));
    add('Built-Up Area', area(property.builtUpAreaSqFt));
    add('Total Floors', property.totalFloors);
    add('Balconies', property.balconyCount);
    add('Parking', property.parking);
    add(property.propertyType === 'villa' ? 'Private Garden' : 'Garden', yesNo(property.garden));
    add('Terrace', yesNo(property.terrace));
    if (property.propertyType === 'house') {
      add('Water Available', yesNo(property.waterAvailability));
      add('Electricity Available', yesNo(property.electricityAvailability));
      add('Boundary Wall', yesNo(property.boundaryWall));
    }
  } else if (property.propertyType === 'plot' || property.propertyType === 'land') {
    add('Plot Area', area(property.plotAreaSqFt));
    add('Plot Dimension', property.plotDimension);
    add('Road Width', property.roadWidth);
    add('Corner Plot', yesNo(property.cornerPlot));
    add('Boundary Wall', yesNo(property.boundaryWall));
    add('Approval Type', titleCase(property.approvalType));
    add('Water Available', yesNo(property.waterAvailability));
    add('Electricity Available', yesNo(property.electricityAvailability));
    add('Drainage Available', yesNo(property.drainageAvailability));
    add('Road Type', titleCase(property.roadType));
    add('Nearby Landmark', property.nearbyLandmark);
  } else if (property.propertyType === 'commercial') {
    add('Commercial Type', titleCase(property.commercialType));
    add('Built-Up Area', area(property.builtUpAreaSqFt));
    add('Washroom', yesNo(property.washroom));
    add('Parking', property.parking);
    add('Frontage', property.frontage);
    add('Road Width', property.roadWidth);
    add('Suitable For', titleCase(property.suitableFor));
  } else if (property.propertyType === 'penthouse') {
    add('Total Floors', property.totalFloors);
    add('Terrace Area', area(property.terraceAreaSqFt));
    add('Balconies', property.balconyCount);
    add('Parking', property.parking);
    add('Private Terrace', yesNo(property.privateTerrace));
  } else if (property.propertyType === 'farmhouse') {
    add('Land Area', area(property.landAreaSqFt));
    add('Built-Up Area', area(property.builtUpAreaSqFt));
    add('Road Access', property.roadAccess);
    add('Road Width', property.roadWidth);
    add('Water Source', titleCase(property.waterSource));
    add('Electricity Available', yesNo(property.electricityAvailability));
    add('Boundary Wall', yesNo(property.boundaryWall));
    add('Fencing', yesNo(property.fencing));
    add('Trees / Garden / Farm Area', property.treesOrGarden);
    add('Parking', property.parking);
    add('Nearby Village / City', property.nearbyVillageOrCity);
  }
  return specs;
}
