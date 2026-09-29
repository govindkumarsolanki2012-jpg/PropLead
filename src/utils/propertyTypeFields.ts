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
  house: ['bhk', 'facing', 'furnishing'],
  villa: ['bhk', 'facing', 'furnishing'],
  plot: ['facing'],
  commercial: ['carpetAreaSqFt', 'floor', 'facing', 'furnishing'],
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
    add('Parking', property.parking);
    add(property.propertyType === 'villa' ? 'Private Garden' : 'Garden', yesNo(property.garden));
    if (property.propertyType === 'house') {
      add('Terrace', yesNo(property.terrace));
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
