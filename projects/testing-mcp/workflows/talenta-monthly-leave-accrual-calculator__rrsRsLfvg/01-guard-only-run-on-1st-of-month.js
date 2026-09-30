var todayWib = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
if (todayWib.getUTCDate() !== 1) {
  _log('Skipped: today is not the 1st of the month (WIB).');
  _stopAutomation();
}
