export function listAlarms(pcs: Record<string, unknown>) {
  const alarms: { code: string; severity: string; message: string }[] = [];
  const binary = String(pcs.binary_status ?? '00000000');
  if (binary[1] === '1') {
    // bit 6 from left = index 1 in 8-char string
    alarms.push({ code: 'WARN', severity: 'warn', message: 'Warning bit set on PCS/BESS binary' });
  }
  if (binary[0] === '1') {
    alarms.push({ code: 'TRIP', severity: 'alarm', message: 'Trip / emergency shutdown' });
  }
  if (pcs.alarm_code) {
    alarms.push({
      code: String(pcs.alarm_code),
      severity: 'alarm',
      message: `PCS alarm_code ${pcs.alarm_code}`,
    });
  }
  return alarms;
}
