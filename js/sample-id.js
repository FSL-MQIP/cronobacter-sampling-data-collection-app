const MODE_CODES = { urban: 'U', rural: 'R', natural: 'N' };
const TYPE_CODES = { soil: 'SL', swab: 'SG', water: 'W' };

export function generateSampleId(state, initials, number, type, mode = 'urban') {
  const modeCode = MODE_CODES[mode];
  if (!modeCode) throw new Error(`Unknown mode: ${mode}`);
  const typeCode = TYPE_CODES[type];
  if (!typeCode) throw new Error(`Unknown sample type: ${type}`);
  return `${state}-${initials}-${number}_${modeCode}_${typeCode}`;
}
