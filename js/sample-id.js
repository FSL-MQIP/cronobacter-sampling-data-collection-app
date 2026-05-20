const TYPE_CODES = { soil: 'U_SL', swab: 'U_SG', water: 'U_W' };

export function generateSampleId(state, initials, number, type) {
  const code = TYPE_CODES[type];
  if (!code) throw new Error(`Unknown sample type: ${type}`);
  return `${state}-${initials}-${number}_${code}`;
}
