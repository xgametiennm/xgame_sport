// Test multi-court concurrent scoring and isolation
const BASE_URL = 'http://localhost:5088/api';

async function testMultiCourts() {
  console.log('--- 1. Create Match on Court 1 (Score 9 - 6) ---');
  await fetch(`${BASE_URL}/live/court/club-multi-court-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courtName: 'Sân Số 1 (Center Court)',
      clubId: 'club-multi',
      score1: 9,
      score2: 6,
      scorerName: 'Trọng Tài Sân 1',
    }),
  });

  console.log('--- 2. Create Match on Court 2 (Score 3 - 2) ---');
  await fetch(`${BASE_URL}/live/court/club-multi-court-2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courtName: 'Sân Số 2',
      clubId: 'club-multi',
      score1: 3,
      score2: 2,
      scorerName: 'Trọng Tài Sân 2',
    }),
  });

  console.log('--- 3. Query All Live Courts for Club ---');
  const res = await fetch(`${BASE_URL}/live/courts?clubId=club-multi`);
  const data = await res.json();
  console.log(`Found ${data.data.length} concurrent live courts.`);
  if (data.data.length !== 2) throw new Error('Expected 2 concurrent courts');

  const c1 = data.data.find(c => c.id === 'club-multi-court-1');
  const c2 = data.data.find(c => c.id === 'club-multi-court-2');
  console.log(`Court 1 Score: ${c1.score1} - ${c1.score2} by ${c1.scorerName}`);
  console.log(`Court 2 Score: ${c2.score1} - ${c2.score2} by ${c2.scorerName}`);

  if (c1.score1 !== 9 || c2.score1 !== 3) {
    throw new Error('Court score bleeding or cross-contamination detected!');
  }

  console.log('--- 4. Finish Court 1 Only ---');
  await fetch(`${BASE_URL}/live/court/club-multi-court-1/finish`, { method: 'POST' });

  const resAfter = await fetch(`${BASE_URL}/live/courts?clubId=club-multi`);
  const dataAfter = await resAfter.json();
  console.log(`Remaining live courts: ${dataAfter.data.length}`);
  if (dataAfter.data.length !== 1 || dataAfter.data[0].id !== 'club-multi-court-2') {
    throw new Error('Court 1 was not properly released or Court 2 was affected');
  }

  // Cleanup Court 2
  await fetch(`${BASE_URL}/live/court/club-multi-court-2/finish`, { method: 'POST' });
  console.log('--- 5. Cleanup finished. All Multi-Court Tests PASSED! ---');
}

testMultiCourts().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
