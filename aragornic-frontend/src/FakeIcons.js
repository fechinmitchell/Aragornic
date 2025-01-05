import React from 'react';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FlightIcon from '@mui/icons-material/Flight';

/**
 * Example "purple" icons for demonstration.
 * Replace them or rename them if you like.
 */

export const PurpleBrainIcon = (props) => (
  <SmartToyIcon
    {...props}
    sx={{ color: 'white', ...(props.sx || {}) }}
  />
);

export const PurpleMagicWandIcon = (props) => (
  <AutoFixHighIcon
    {...props}
    sx={{ color: 'white', ...(props.sx || {}) }}
  />
);

export const PurpleAirplaneIcon = (props) => (
  <FlightIcon
    {...props}
    sx={{ color: 'white', ...(props.sx || {}) }}
  />
);
