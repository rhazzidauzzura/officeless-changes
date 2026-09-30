// ================================================================
// ASSUMPTIONS - CONFIRM BEFORE PRODUCTION USE:
//  1. POLICY_ID_CUTI_WAJIB and POLICY_ID_CUTI_TAHUNAN must be set
//     as Env Vars (_variableProject) - CR flags these as UNCONFIRMED
//     by client, must be provided before go-live.
//  2. Endpoint: POST {base}/v3/time-off/update-balance
//     body: [ { policy_id, description, input_balance, start_date,
//               end_date, user_id } ]
// ================================================================

var records = all_counters ? all_counters : [];
var TALENTA_BASE_URL = _variableProject.TALENTA_BASE_URL;
var CLIENT_ID = _variableProjectSecret.TALENTA_CLIENT_ID;
var CLIENT_SECRET = _variableProjectSecret.TALENTA_CLIENT_SECRET;
var POLICY_ID_CUTI_WAJIB = _variableProject.POLICY_ID_CUTI_WAJIB;
var POLICY_ID_CUTI_TAHUNAN = _variableProject.POLICY_ID_CUTI_TAHUNAN;

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

var now = new Date();
var year = now.getFullYear();
var startDate = year + '-01-01';
var endDate = year + '-12-31';

var body = [];
var toReset = [];

for (var i = 0; i < records.length; i++) {
  var rec = records[i];
  var wajib = rec.cuti_wajib_counter || 0;
  var tahunan = rec.cuti_tahunan_counter || 0;
  if (wajib === 0 && tahunan === 0) continue;

  if (wajib > 0) {
    body.push({
      policy_id: Number(POLICY_ID_CUTI_WAJIB),
      description: 'Accrual Cuti Wajib from Monthly Scheduler',
      input_balance: wajib,
      start_date: startDate,
      end_date: endDate,
      user_id: Number(rec.user_id)
    });
  }
  if (tahunan > 0) {
    body.push({
      policy_id: Number(POLICY_ID_CUTI_TAHUNAN),
      description: 'Accrual Cuti Tahunan from Monthly Scheduler',
      input_balance: tahunan,
      start_date: startDate,
      end_date: endDate,
      user_id: Number(rec.user_id)
    });
  }
  toReset.push(rec.ids);
}

var result = { body: body, toReset: toReset, apiResponse: null };

if (body.length > 0) {
  var path = '/v3/time-off/update-balance';
  var header = generateHmacHeader('POST', path);
  var resp = _hitExternalAPI(TALENTA_BASE_URL + path, 'POST', body, header);
  result.apiResponse = resp;
  _log('Pushed ' + body.length + ' balance update(s) to Talenta. Response: ' + JSON.stringify(resp));
} else {
  _log('No counters to push this year.');
}

push_result = result;
