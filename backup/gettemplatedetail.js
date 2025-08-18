const axios = require('axios');

const fetchMonthlyAnalytics = async () => {
  const accessToken = 'EAAVJ5ZCWCvtgBPMgJHL4vgyoRdib6nFt7diq1axax7h3GgJYgpNdDNSMrZBWNsmmBoIQy50o3R6MQDQvkLTh7sICTovHhZBc1MTZCTvONgcnUj8H5VLVg6jArqZCZCEBDXILrLbWWpiMQOwpzpk2H9TnMRKdYZC9T3qnsb2mZAmIZCDDcLW5vSpPIlOM2TomVNFEtik3VKzKl8e91VVCe0YDiFPwh1DwOEvt6TsOlwnDhhfN3mQZDZD';
  const wabaId = '1220709106476133';

  // 1. Get current date
  const now = new Date();

  // 2. Start of month (1st day at 00:00)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  // 3. End of month (last day at 23:59:59)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  // 4. Convert to Unix timestamps (in seconds)
  const startTs = Math.floor(startOfMonth.getTime() / 1000);
  const endTs = Math.floor(endOfMonth.getTime() / 1000);
console.log("startOfMonth:", startTs);
console.log('endOfMonth:', endTs);

  // 5. Prepare API request
  const url = `https://graph.facebook.com/v19.0/${wabaId}?fields=conversation_analytics.start(${startTs}).end(${endTs}).granularity(MONTHLY).conversation_categories(["MARKETING","UTILITY","AUTHENTICATION"]).dimensions(["CONVERSATION_CATEGORY"])&access_token=${accessToken}`;

  try {
    const res = await axios.get(url);
    console.log("Monthly Analytics Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Meta API error:", err.response?.data || err.message);
  }
};

fetchMonthlyAnalytics();
