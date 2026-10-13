import React, { useState } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { 
  Sparkles, 
  ArrowRight
} from 'lucide-react';

export const DuprGuideModal: React.FC = () => {
  const { lang, setActiveTab } = usePickleball();

  // Quiz state
  const [dinkSkill, setDinkSkill] = useState<number>(3);
  const [dropSkill, setDropSkill] = useState<number>(3);
  const [resetSkill, setResetSkill] = useState<number>(3);
  const [speedupSkill, setSpeedupSkill] = useState<number>(3);

  const estimatedScore = (
    2.0 +
    (dinkSkill * 0.7 + dropSkill * 0.9 + resetSkill * 0.8 + speedupSkill * 0.6) / 4
  ).toFixed(3);

  const rubric = [
    {
      level: '2.0 - 2.5',
      title: '🌱 Tân Thủ Nhập Môn (Novice)',
      shots: 'Biết giao bóng qua lưới, học cách đếm điểm 0-0-2, di chuyển còn ngập ngừng.',
      tactics: 'Thường đứng ở giữa sân ("No-man\'s land"), chưa quen lên vạch bếp Non-Volley Zone.',
    },
    {
      level: '3.0',
      title: '⚡ Cao Thủ Giao Lưu (Intermediate)',
      shots: 'Giao bóng đều đặn, đánh bóng thuận tay (forehand) ổn định, dink qua lưới nhưng bóng còn bổng.',
      tactics: 'Biết tiến lên vạch bếp sau khi đối thủ trả bóng, hiểu luật không được nhảy vào bếp khi vô-lê.',
    },
    {
      level: '3.5',
      title: '🎯 Bậc Thầy Dinking (High Intermediate)',
      shots: 'Bắt đầu sử dụng Third-Shot Drop hiệu quả, biết dink chéo sân để mở góc, kiểm soát bóng xoáy.',
      tactics: 'Phối hợp di chuyển cùng bạn cặp (bước ngang song song), nhận biết thời cơ speedup tấn công.',
    },
    {
      level: '4.0',
      title: '💎 Chiến Binh Tinh Anh (Advanced)',
      shots: 'Third-shot drop và Third-shot drive thành thạo, reset bóng từ cuối sân về bếp êm ái khi bị đập.',
      tactics: 'Kiểm soát nhịp độ trận đấu, kiên nhẫn trong các loạt dink dài (>10 nhịp), hạn chế tối đa lỗi tự đánh hỏng.',
    },
    {
      level: '4.5 - 5.0',
      title: '🏆 Đại Sư Sân Đấu (Semi-Pro)',
      shots: 'Tốc độ tay cực nhanh tại vạch bếp, tấn công góc hiểm, cú đánh Erne và Around-The-Post (ATP).',
      tactics: 'Phán đoán hướng bóng đối thủ trước khi chạm vợt, chiến thuật stacking đôi nam nữ hoàn hảo.',
    },
    {
      level: '5.5+',
      title: '👑 Huyền Thoại Sân Đấu (Pro / Elite)',
      shots: 'Đạt đẳng cấp PPA / MLP Tour, phản xạ siêu phàm, kỹ thuật hoàn hảo ở mọi góc sân.',
      tactics: 'Thi đấu quốc tế, bản lĩnh tâm lý thép trong các điểm quyết định.',
    },
  ];

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '24px 16px' }}>
      {/* Banner */}
      <div className="hero-gradient card" style={{ marginBottom: 24, padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="badge badge-neon" style={{ background: '#d9f99d', color: '#365314', border: '1px solid #bef264' }}>
            OFFICIAL DUPR BENCHMARK
          </span>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>USA PICKLEBALL & DUPR STANDARD</span>
        </div>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, color: '#ffffff' }}>
          {lang === 'vi' ? 'Cẩm Nang & Tự Đánh Giá Trình Độ DUPR' : 'Official DUPR Skills Guide & Self-Assessment'}
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', marginTop: 6, maxWidth: 700 }}>
          {lang === 'vi'
            ? 'Khám phá tiêu chí đánh giá kỹ thuật DUPR từ 2.0 đến 6.0+ và làm trắc nghiệm nhanh để ước lượng rating xuất phát điểm của bạn.'
            : 'Explore technical rubrics from 2.0 to 6.0+ and estimate your starting DUPR rating with the interactive test.'}
        </p>
      </div>

      {/* Grid: Rubric on Left, Self-Assessment Calculator on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        {/* Rubric Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#0f172a' }}>
            <span>📖</span> {lang === 'vi' ? 'Tiêu Chuẩn Kỹ Năng DUPR Từng Cấp' : 'DUPR Skill Rubric'}
          </h2>

          {rubric.map((item, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: 16,
                borderLeft: '4px solid #059669',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 900, color: '#059669' }}>
                  DUPR {item.level}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{item.title}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: 4 }}>
                <strong style={{ color: '#059669' }}>Kỹ thuật:</strong> {item.shots}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                <strong style={{ color: '#0284c7' }}>Chiến thuật:</strong> {item.tactics}
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Self-Assessment Quiz (Light Card) */}
        <div>
          <div className="card" style={{
            background: '#ffffff',
            border: '1.5px solid #059669',
            padding: 24,
            position: 'sticky',
            top: 90,
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Sparkles size={20} color="#059669" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                {lang === 'vi' ? 'Trắc Nghiệm Ước Lượng DUPR' : 'Estimate Your DUPR'}
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 20 }}>
              Kéo thanh trượt theo khả năng thực tế của bạn trên sân:
            </p>

            {/* Slider 1: Dink */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>1. Khả năng Dink tại vạch bếp</span>
                <span className="mono" style={{ color: '#059669', fontWeight: 800 }}>{dinkSkill}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={dinkSkill}
                onChange={(e) => setDinkSkill(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                1 = Chưa biết dink | 3 = Dink qua lưới đều | 5 = Dink biến hóa, xoáy hiểm
              </div>
            </div>

            {/* Slider 2: Third Shot Drop */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>2. Cú đánh thứ 3 (Third-Shot Drop)</span>
                <span className="mono" style={{ color: '#059669', fontWeight: 800 }}>{dropSkill}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={dropSkill}
                onChange={(e) => setDropSkill(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                1 = Toàn đập mạnh (Drive) | 3 = Thả bếp được 50% | 5 = Thả mềm mại, chuẩn xác
              </div>
            </div>

            {/* Slider 3: Reset Defense */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>3. Reset phòng ngự khi bị đập</span>
                <span className="mono" style={{ color: '#059669', fontWeight: 800 }}>{resetSkill}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={resetSkill}
                onChange={(e) => setResetSkill(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                1 = Khó đỡ bóng nhanh | 3 = Đỡ bóng cao | 5 = Hấp thụ lực đưa bóng vào bếp
              </div>
            </div>

            {/* Slider 4: Speedup & Attacks */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>4. Tấn công nhanh (Speedup & Vô-lê)</span>
                <span className="mono" style={{ color: '#059669', fontWeight: 800 }}>{speedupSkill}/5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={speedupSkill}
                onChange={(e) => setSpeedupSkill(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#059669' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                1 = Không dám đánh nhanh | 3 = Đánh vào giữa | 5 = Phản xạ chớp nhoáng
              </div>
            </div>

            {/* ESTIMATED DUPR SCORE BOX */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 16,
              padding: 16,
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                DUPR Ước Tính Ban Đầu
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.6rem',
                fontWeight: 900,
                color: '#059669',
                lineHeight: 1.1,
                margin: '6px 0',
              }}>
                {estimatedScore}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Bạn có thể dùng điểm số này để bắt đầu ghép cặp thi đấu tại CLB!
              </p>

              <button
                onClick={() => setActiveTab('calculator')}
                className="btn-primary"
                style={{ width: '100%', marginTop: 12, padding: '10px 16px', fontSize: '0.9rem' }}
              >
                <span>Dùng Điểm Này Vào Máy Tính</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
