// Test script to verify Live Court Realtime API and Backend endpoints
const BASE_URL = 'http://localhost:5088/api';

async function runTests() {
  console.log('--- 1. Testing Health Check ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  console.log('Health:', healthData);
  if (healthData.status !== 'ok') throw new Error('Health check failed');

  console.log('\n--- 2. Testing Initial Live Courts ---');
  const courtsRes = await fetch(`${BASE_URL}/live/courts`);
  const courtsData = await courtsRes.json();
  console.log('Active live courts:', courtsData.data?.length);

  console.log('\n--- 3. Testing POST Live Court Update ---');
  const postPayload = {
    courtName: 'Sân Số 1 (Center Court)',
    clubId: 'test-club-live',
    clubName: 'CLB Pickleball Test',
    score1: 7,
    score2: 4,
    serverNumber: 1,
    servingTeam: 1,
    t1Right: { id: 'p1', name: 'Nguyễn Văn A', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=A', doublesRating: 4.1 },
    t1Left: { id: 'p2', name: 'Trần Thị B', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=B', doublesRating: 3.8 },
    t2Right: { id: 'p3', name: 'Lê Văn C', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=C', doublesRating: 4.0 },
    t2Left: { id: 'p4', name: 'Phạm Thị D', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=D', doublesRating: 3.9 },
    activeServerId: 'p1',
    scoringType: 'sideout',
    targetScore: 11,
    isGameOver: false,
    winnerTeam: null,
    scorerName: 'Trọng tài test',
  };

  const updateRes = await fetch(`${BASE_URL}/live/court/test-club-live-court-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postPayload),
  });
  const updateData = await updateRes.json();
  console.log('Update result:', updateData.success, 'Score:', updateData.data?.score1, '-', updateData.data?.score2);
  if (!updateData.success) throw new Error('Update live court failed');

  console.log('\n--- 4. Testing GET Single Court State ---');
  const getCourtRes = await fetch(`${BASE_URL}/live/court/test-club-live-court-1`);
  const getCourtData = await getCourtRes.json();
  console.log('Fetched Court Data:', getCourtData.success, getCourtData.data?.courtName, 'Score:', getCourtData.data?.score1, '-', getCourtData.data?.score2);
  if (getCourtData.data?.score1 !== 7 || getCourtData.data?.score2 !== 4) {
    throw new Error('Court data mismatch');
  }

  console.log('\n--- 5. Testing GET All Live Courts ---');
  const allCourtsRes = await fetch(`${BASE_URL}/live/courts?clubId=test-club-live`);
  const allCourtsData = await allCourtsRes.json();
  console.log('Courts for club:', allCourtsData.data?.length, 'Found Court:', allCourtsData.data?.[0]?.id);
  if (allCourtsData.data?.length === 0) throw new Error('Live courts listing failed');

  console.log('\n--- 6. Testing Finish Live Court ---');
  const finishRes = await fetch(`${BASE_URL}/live/court/test-club-live-court-1/finish`, {
    method: 'POST',
  });
  const finishData = await finishRes.json();
  console.log('Finish result:', finishData.success);

  console.log('\n=========================================');
  console.log('✅ ALL REALTIME LIVE MATCH TESTS PASSED!');
  console.log('=========================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
