// ================================================================
// DUMMY MODE: set USE_DUMMY_DATA = false once Talenta API
// integration (base URL, HMAC creds, response field names) is
// verified in Dev. Real fetch code is kept below, just skipped.
// ================================================================
var USE_DUMMY_DATA = true;

var TALENTA_BASE_URL = _variableProject.TALENTA_BASE_URL;
var CLIENT_ID = _variableProjectSecret.TALENTA_CLIENT_ID;
var CLIENT_SECRET = _variableProjectSecret.TALENTA_CLIENT_SECRET;
var REQUIRED_WORKING_DAYS = 26;

function generateHmacHeader(method, path) {
  var currentDate = new Date().toUTCString();
  var requestLine = method + ' ' + path + ' HTTP/1.1';
  var payload = ['date: ' + currentDate, requestLine].join('\n');
  var digest = _hmacSha256(payload, CLIENT_SECRET);
  var signature = _hexToBase64(digest);
  var authorizationHeader = 'hmac username="' + CLIENT_ID + '", algorithm="hmac-sha256", headers="date request-line", signature="' + signature + '"';
  return {
    'Content-Type': 'application/json',
    'Date': currentDate,
    'Authorization': authorizationHeader
  };
}

function padTwo(n) { return n < 10 ? '0' + n : '' + n; }

var now = new Date();
var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
var periodYyyymm = prevMonthDate.getFullYear() + '-' + padTwo(prevMonthDate.getMonth() + 1);

var attendanceMap = {};
var employees = [];

if (USE_DUMMY_DATA) {
  employees = [
    { user_id: '1001', full_name: 'Budi Santoso', join_date: '2025-05-05' },
    { user_id: '1002', full_name: 'Siti Aminah', join_date: '2025-10-01' },
    { user_id: '1003', full_name: 'Andi Wijaya', join_date: '2026-01-15' },
    { user_id: '1004', full_name: 'Dewi Lestari', join_date: '2024-06-01' },
    { user_id: '1005', full_name: 'Rudi Hartono', join_date: '2025-06-15' }
  ];
  attendanceMap = {
    '1001': 26,
    '1002': 26,
    '1003': 20,
    '1004': 24,
    '1005': 26
  };
  _log('DUMMY MODE active - using hardcoded employees/attendance, no real Talenta API call made.');
} else {
  var page = 1;
  var limit = 100;
  var hasMore = true;
  var maxPages = 50;

  while (hasMore && page <= maxPages) {
    var attPath = '/v3/attendance/summary-report?limit=' + limit + '&page=' + page + '&date=' + periodYyyymm + '-01&sort=clock_in';
    var attHeader = generateHmacHeader('GET', attPath);
    var attResp = _hitExternalAPI(TALENTA_BASE_URL + attPath, 'GET', {}, attHeader);
    var rows = (attResp && attResp.data) ? attResp.data : [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var isValid = row.clock_in && row.clock_out && row.clock_in !== '00:00' && row.clock_out !== '00:00';
      if (isValid) {
        var uid = String(row.user_id);
        attendanceMap[uid] = (attendanceMap[uid] || 0) + 1;
      }
    }
    hasMore = rows.length === limit;
    page = page + 1;
  }

  page = 1;
  hasMore = true;
  while (hasMore && page <= maxPages) {
    var empPath = '/employee?limit=' + limit + '&page=' + page;
    var empHeader = generateHmacHeader('GET', empPath);
    var empResp = _hitExternalAPI(TALENTA_BASE_URL + empPath, 'GET', {}, empHeader);
    var empRows = (empResp && empResp.data) ? empResp.data : [];
    for (var j = 0; j < empRows.length; j++) { employees.push(empRows[j]); }
    hasMore = empRows.length === limit;
    page = page + 1;
  }
}

function monthsBetween(joinDateStr, refDate) {
  var jd = new Date(joinDateStr);
  var months = (refDate.getFullYear() - jd.getFullYear()) * 12 + (refDate.getMonth() - jd.getMonth());
  if (refDate.getDate() < jd.getDate()) months = months - 1;
  return months;
}

var result = [];
var refDate = new Date();

for (var k = 0; k < employees.length; k++) {
  var emp = employees[k];
  var userId = emp.user_id || emp.id;
  var joinDate = emp.join_date;
  if (!userId || !joinDate) continue;

  var dayCount = attendanceMap[String(userId)] || 0;
  var fullAttendance = dayCount >= REQUIRED_WORKING_DAYS;
  var tenureMonths = monthsBetween(joinDate, refDate);

  var wajibEligible = fullAttendance && tenureMonths >= 7;
  var tahunanEligible = fullAttendance && tenureMonths >= 12;

  result.push({
    user_id: String(userId),
    employee_name: emp.full_name || emp.name || '',
    join_date: joinDate,
    attendance_day_count: dayCount,
    tenure_months: tenureMonths,
    full_attendance: fullAttendance,
    wajib_increment: wajibEligible ? 1 : 0,
    tahunan_increment: tahunanEligible ? 1 : 0,
    period: periodYyyymm
  });
}

var eligibleOnly = [];
for (var m = 0; m < result.length; m++) {
  if (result[m].wajib_increment === 1 || result[m].tahunan_increment === 1) {
    eligibleOnly.push(result[m]);
  }
}

_log('Period ' + periodYyyymm + ': ' + eligibleOnly.length + ' employee(s) eligible for accrual out of ' + employees.length + ' total.');

var run_period = periodYyyymm;
var run_at = new Date().toISOString();
var total_employees = employees.length;
var eligible_count = eligibleOnly.length;
var result_json_str = JSON.stringify(result);
var run_status = 'success';

all_employee_results = result;
eligible_employees = eligibleOnly;
