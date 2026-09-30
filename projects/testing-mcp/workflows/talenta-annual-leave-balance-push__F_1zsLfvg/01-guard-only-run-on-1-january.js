var todayWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
if (todayWib.getUTCMonth() !== 0 || todayWib.getUTCDate() !== 1) {
  _log('Skipped: today is not 1 January (WIB).');
  _stopAutomation();
}
