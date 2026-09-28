import React from 'react';

interface PropLeadLogoProps {
  className?: string;
  size?: number | string;
  alt?: string;
  showShadow?: boolean;
}

/**
 * PropLead for Agents - Official 3D Application Logo
 * High-definition 3D blue squircle with white house, ascending bar chart,
 * lime-green growth arrow, agent bust, and checklist clipboard.
 */
export const PropLeadLogo: React.FC<PropLeadLogoProps> = ({
  className = 'w-8 h-8',
  size,
  alt = 'PropLead Logo',
  showShadow = false,
}) => {
  const style: React.CSSProperties = size
    ? { width: size, height: size, objectFit: 'contain' }
    : { objectFit: 'contain' };

  return (
    <img
      src="/logo.png"
      alt={alt}
      style={style}
      className={`select-none flex-shrink-0 object-contain aspect-square ${showShadow ? 'drop-shadow-xs' : ''} ${className}`}
      loading="eager"
      decoding="async"
    />
  );
};

export default PropLeadLogo;
