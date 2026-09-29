import React from 'react';
import { Property, PropertyType } from '../../types';

type ExtraPropertyFields = Partial<Property>;

interface Props {
  propertyType: PropertyType;
  values: ExtraPropertyFields;
  onChange: (field: keyof Property, value: Property[keyof Property] | undefined) => void;
}

const inputClass = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-hidden focus:ring-2 focus:ring-emerald-500';

export const PropertyTypeSpecificFields: React.FC<Props> = ({ propertyType, values, onChange }) => {
  const textField = (field: keyof Property, label: string, placeholder?: string) => (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      <input
        type="text"
        value={(values[field] as string | undefined) || ''}
        onChange={(e) => onChange(field, e.target.value || undefined)}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );

  const numberField = (field: keyof Property, label: string) => (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      <input
        type="number"
        min="0"
        value={(values[field] as number | undefined) ?? ''}
        onChange={(e) => onChange(field, e.target.value === '' ? undefined : Number(e.target.value))}
        className={inputClass}
      />
    </label>
  );

  const yesNoField = (field: keyof Property, label: string) => (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      <select
        value={values[field] === undefined ? '' : values[field] ? 'yes' : 'no'}
        onChange={(e) => onChange(field, e.target.value === '' ? undefined : e.target.value === 'yes')}
        className={inputClass}
      >
        <option value="">Not specified</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );

  const selectField = (field: keyof Property, label: string, options: Array<[string, string]>) => (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{label}</span>
      <select
        value={(values[field] as string | undefined) || ''}
        onChange={(e) => onChange(field, e.target.value || undefined)}
        className={inputClass}
      >
        <option value="">Not specified</option>
        {options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </label>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {propertyType === 'flat' && <>
        {numberField('balconyCount', 'Balcony Count')}
        {textField('parking', 'Parking', 'e.g. 1 covered parking')}
      </>}

      {(propertyType === 'house' || propertyType === 'villa') && <>
        {numberField('plotAreaSqFt', 'Plot Area (sq.ft)')}
        {numberField('builtUpAreaSqFt', 'Built-Up Area (sq.ft)')}
        {numberField('totalFloors', 'Total Floors')}
        {textField('parking', 'Parking')}
        {yesNoField('garden', propertyType === 'villa' ? 'Private Garden' : 'Garden')}
        {propertyType === 'house' && yesNoField('terrace', 'Terrace')}
        {propertyType === 'house' && yesNoField('waterAvailability', 'Water Availability')}
        {propertyType === 'house' && yesNoField('electricityAvailability', 'Electricity Availability')}
        {propertyType === 'house' && yesNoField('boundaryWall', 'Boundary Wall')}
      </>}

      {(propertyType === 'plot' || propertyType === 'land') && <>
        {numberField('plotAreaSqFt', 'Plot Area (sq.ft)')}
        {textField('plotDimension', 'Plot Dimension', 'e.g. 30 × 50 ft')}
        {textField('roadWidth', 'Road Width', 'e.g. 30 ft')}
        {yesNoField('cornerPlot', 'Corner Plot')}
        {yesNoField('boundaryWall', 'Boundary Wall')}
        {selectField('approvalType', 'Approval Type', [['patta', 'Patta'], ['registry', 'Registry'], ['dtcp', 'DTCP'], ['rera', 'RERA'], ['panchayat', 'Panchayat'], ['not_specified', 'Not specified']])}
        {yesNoField('waterAvailability', 'Water Availability')}
        {yesNoField('electricityAvailability', 'Electricity Availability')}
        {yesNoField('drainageAvailability', 'Drainage Availability')}
        {selectField('roadType', 'Road Type', [['main_road', 'Main Road'], ['internal_road', 'Internal Road'], ['mud_road', 'Mud Road'], ['cc_road', 'CC Road'], ['highway_facing', 'Highway Facing']])}
        {textField('nearbyLandmark', 'Nearby Landmark')}
      </>}

      {propertyType === 'commercial' && <>
        {selectField('commercialType', 'Commercial Type', [['office', 'Office'], ['shop', 'Shop'], ['showroom', 'Showroom'], ['godown', 'Godown'], ['warehouse', 'Warehouse'], ['clinic', 'Clinic'], ['co_working', 'Co-working']])}
        {numberField('builtUpAreaSqFt', 'Built-Up Area (sq.ft)')}
        {yesNoField('washroom', 'Washroom')}
        {textField('parking', 'Parking')}
        {textField('frontage', 'Frontage', 'e.g. 20 ft')}
        {textField('roadWidth', 'Road Width', 'e.g. 40 ft')}
        {selectField('suitableFor', 'Suitable For', [['office', 'Office'], ['retail', 'Retail'], ['clinic', 'Clinic'], ['restaurant', 'Restaurant'], ['warehouse', 'Warehouse']])}
      </>}

      {propertyType === 'penthouse' && <>
        {numberField('totalFloors', 'Total Floors')}
        {numberField('terraceAreaSqFt', 'Terrace Area (sq.ft)')}
        {numberField('balconyCount', 'Balcony Count')}
        {textField('parking', 'Parking')}
        {yesNoField('privateTerrace', 'Private Terrace')}
      </>}

      {propertyType === 'farmhouse' && <>
        {numberField('landAreaSqFt', 'Land Area (sq.ft)')}
        {numberField('builtUpAreaSqFt', 'Built-Up Area (sq.ft)')}
        {textField('roadAccess', 'Road Access', 'e.g. All-weather road')}
        {textField('roadWidth', 'Road Width', 'e.g. 20 ft')}
        {selectField('waterSource', 'Water Source', [['borewell', 'Borewell'], ['well', 'Well'], ['municipal', 'Municipal'], ['tanker', 'Tanker'], ['not_specified', 'Not specified']])}
        {yesNoField('electricityAvailability', 'Electricity Availability')}
        {yesNoField('boundaryWall', 'Boundary Wall')}
        {yesNoField('fencing', 'Fencing')}
        {textField('treesOrGarden', 'Trees / Garden / Farm Area')}
        {textField('parking', 'Parking')}
        {textField('nearbyVillageOrCity', 'Nearby Village / City')}
      </>}
    </div>
  );
};
