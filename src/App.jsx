import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient.js';

// Mock Data for Demo (fallback if Supabase env not set)
const initialReservations = [];

// Util functions
function getHourLabel(hour) {
  return (hour < 10 ? `0${hour}` : hour) + ":00 ~ " + (hour+1 < 10 ? `0${hour+1}` : hour+1) + ":00";
}
function getToday() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Color/Theme Variables
const warmTheme = {
  background: "#fff8f3",
  primary: "#ffb689",
  accent: "#f3796e",
  border: "#ffe3d1",
  text: "#6a3b16"
};

// Components
function ReservationSlot({ hour, reserved, onReserveClick, isAdmin, onAdminEdit, userName }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: reserved ? warmTheme.primary : "#fff",
        border: `1px solid ${warmTheme.border}`,
        borderRadius: 8,
        marginBottom: 6,
        padding: "10px 12px",
        opacity: reserved && !isAdmin ? 0.6 : 1,
        justifyContent: "space-between",
        minHeight: 48,
      }}
    >
      <div>
        <div style={{ fontWeight: "bold", color: warmTheme.text }}>
          {getHourLabel(hour)}
        </div>
        {reserved && (
          <span style={{
            display: "inline-block",
            fontSize: 13,
            color: warmTheme.accent,
            marginTop: 2,
            marginLeft: 4
          }}>
            예약자: {reserved.user}
          </span>
        )}
      </div>
      {!reserved && (
        <button
          style={{
            background: warmTheme.accent,
            border: "none",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 16px",
            fontWeight: "bold",
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 1px 3px #faeedc88"
          }}
          onClick={onReserveClick}
        >
          예약
        </button>
      )}
      {isAdmin && reserved && (
        <button
          style={{
            background: "#fff",
            border: `1px solid ${warmTheme.accent}`,
            color: warmTheme.accent,
            borderRadius: 6,
            padding: "4px 12px",
            fontWeight: "bold",
            fontSize: 15,
            cursor: "pointer",
            marginLeft: 6
          }}
          onClick={onAdminEdit}
        >
          수정
        </button>
      )}
    </div>
  );
}

function ReservationPage() {
  // Role could be determined via login/session; for demo, use state
  const [role, setRole] = useState("user"); // 'user' or 'admin'
  const [userName, setUserName] = useState("");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [reservations, setReservations] = useState(initialReservations);

  // For admin modal
  const [editingReservation, setEditingReservation] = useState(null);

  // Calendar view state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(null); // 'YYYY-MM-DD'
  const supabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  useEffect(() => {
    if (role === "user" && userName === "") setUserName("홍길동");
    if (role === "admin") setUserName("관리자");
  }, [role]);

  const hours = Array.from({ length: 14 }, (_, idx) => idx + 9); // 9AM ~ 22PM

  // Load reservations for current month
  useEffect(() => {
    if (!supabaseEnabled) return;
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const monthStart = formatDate(new Date(y, m, 1));
    const monthEnd = formatDate(new Date(y, m + 1, 0));
    (async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: true })
        .order('hour', { ascending: true });
      if (error) {
        console.error('Load error', error);
        return;
      }
      setReservations(data || []);
    })();
  }, [currentMonth, supabaseEnabled]);

  async function handleReserve(dateStr, hour) {
    if (!userName) {
      alert("이름을 입력해 주세요.");
      return;
    }
    const dayReservations = reservations.filter(r => r.date === dateStr);
    if (dayReservations.some(r => r.hour === hour)) {
      alert("이미 예약된 시간입니다.");
      return;
    }
    if (supabaseEnabled) {
      const { data, error } = await supabase
        .from('reservations')
        .insert({ date: dateStr, hour, user: userName })
        .select()
        .single();
      if (error) { alert('저장 중 오류가 발생했습니다.'); console.error(error); return; }
      setReservations(rs => [...rs, data]);
    } else {
      setReservations(rs => [
        ...rs,
        { id: Date.now(), date: dateStr, hour, user: userName }
      ]);
    }
    alert('예약되었습니다!');
  }

  async function handleCancelReservation(resvId) {
    if (supabaseEnabled) {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', resvId);
      if (error) { alert('삭제 중 오류가 발생했습니다.'); console.error(error); return; }
    }
    setReservations(rs => rs.filter(r => r.id !== resvId));
  }

  function handleEditReservation(resv) {
    setEditingReservation(resv);
  }

  async function handleAdminEdit(resvId, newName) {
    if (supabaseEnabled) {
      const { error } = await supabase
        .from('reservations')
        .update({ user: newName })
        .eq('id', resvId);
      if (error) { alert('수정 중 오류가 발생했습니다.'); console.error(error); return; }
    }
    setReservations(rs => rs.map(r => (r.id === resvId ? { ...r, user: newName } : r)));
    setEditingReservation(null);
  }
  async function handleAdminDelete(resvId) {
    if (supabaseEnabled) {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', resvId);
      if (error) { alert('삭제 중 오류가 발생했습니다.'); console.error(error); return; }
    }
    setReservations(rs => rs.filter(r => r.id !== resvId));
    setEditingReservation(null);
  }

  // Calendar helpers
  function getMonthCells(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth(); // 0-11
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInPrev = new Date(year, month, 0).getDate();
    const daysInCurr = new Date(year, month + 1, 0).getDate();

    const cells = [];
    // 6 weeks grid (42 cells)
    for (let i = 0; i < 42; i++) {
      const dayOffset = i - startDow + 1;
      let dateObj;
      let inCurrentMonth = true;
      if (dayOffset <= 0) {
        // prev month
        dateObj = new Date(year, month - 1, daysInPrev + dayOffset);
        inCurrentMonth = false;
      } else if (dayOffset > daysInCurr) {
        // next month
        dateObj = new Date(year, month + 1, dayOffset - daysInCurr);
        inCurrentMonth = false;
      } else {
        dateObj = new Date(year, month, dayOffset);
      }
      cells.push({ dateObj, inCurrentMonth });
    }
    return cells;
  }

  function openDateModal(dateStr) {
    setModalDate(dateStr);
    setIsDateModalOpen(true);
  }
  function closeDateModal() {
    setIsDateModalOpen(false);
    setModalDate(null);
  }

  return (
    <div
      style={{
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        minHeight: "100vh",
        background: warmTheme.background,
        paddingBottom: 48
      }}
    >
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(90deg,${warmTheme.primary} 70%,${warmTheme.accent})`,
          padding: "20px 0 16px 0",
          textAlign: "center",
          color: "#fff",
          marginBottom: 16,
          borderBottomLeftRadius: 60,
          borderBottomRightRadius: 60,
          boxShadow: "0 4px 16px #f9cbaa44"
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>
          보컬 연습실 예약
        </div>
        <div style={{
          marginTop: 7,
          fontSize: 17,
          opacity: 0.8,
          fontWeight: 500,
        }}>
          따뜻한 공간에서 노래 연습을 예약하세요!
        </div>
      </div>

      {/* Role Selection */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18, gap: 8 }}>
        <button
          style={{
            background: role === "user" ? warmTheme.accent : "#fff",
            color: role === "user" ? "#fff" : warmTheme.accent,
            border: `1.5px solid ${warmTheme.accent}`,
            borderRadius: 6,
            padding: "5px 18px",
            fontWeight: "bold",
            fontSize: 14,
            cursor: "pointer"
          }}
          onClick={() => setRole("user")}
        >사용자</button>
        <button
          style={{
            background: role === "admin" ? warmTheme.accent : "#fff",
            color: role === "admin" ? "#fff" : warmTheme.accent,
            border: `1.5px solid ${warmTheme.accent}`,
            borderRadius: 6,
            padding: "5px 18px",
            fontWeight: "bold",
            fontSize: 14,
            cursor: "pointer"
          }}
          onClick={() => setRole("admin")}
        >관리자</button>
      </div>

      {/* UserName Input */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "0 0 20px 0" }}>
        <input
          type="text"
          value={userName}
          disabled={role === "admin"}
          onChange={e => setUserName(e.target.value)}
          placeholder="이름을 입력하세요"
          style={{
            padding: 10,
            border: `1.5px solid ${warmTheme.border}`,
            borderRadius: 8,
            fontSize: 15,
            background: "#fff8f3",
            minWidth: 160
          }}
        />
        {role === "admin" && (
          <span style={{
            color: warmTheme.accent,
            fontWeight: "bold",
            lineHeight: "36px"
          }}>관리자 모드</span>
        )}
      </div>

      {/* Calendar Grid */}
      <div style={{ maxWidth: 520, margin: "0 auto 28px", padding: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            style={{ background: "#fff", border: `1.5px solid ${warmTheme.accent}`, color: warmTheme.accent, borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}
          >◀</button>
          <div style={{ fontWeight: 800, fontSize: 20, color: warmTheme.text }}>
            {currentMonth.getFullYear()}년 {String(currentMonth.getMonth() + 1).padStart(2, '0')}월
          </div>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            style={{ background: "#fff", border: `1.5px solid ${warmTheme.accent}`, color: warmTheme.accent, borderRadius: 8, padding: "6px 10px", fontWeight: 700, cursor: "pointer" }}
          >▶</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8, color: "#b38e6a", fontWeight: 700, textAlign: "center" }}>
          {['일','월','화','수','목','금','토'].map(d => (<div key={d}>{d}</div>))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {getMonthCells(currentMonth).map(({ dateObj, inCurrentMonth }, idx) => {
            const dateStr = formatDate(dateObj);
            const isPast = dateStr < getToday();
            const count = reservations.filter(r => r.date === dateStr).length;
            return (
              <button
                key={idx}
                onClick={() => inCurrentMonth && !isPast && openDateModal(dateStr)}
                disabled={!inCurrentMonth || isPast}
                style={{
                  height: 70,
                  background: inCurrentMonth ? "#fff" : "#fff3e6",
                  border: `1px solid ${warmTheme.border}`,
                  borderRadius: 12,
                  padding: 8,
                  textAlign: "left",
                  cursor: inCurrentMonth && !isPast ? "pointer" : "default",
                  opacity: isPast ? 0.6 : 1,
                  position: "relative",
                }}
              >
                <div style={{ fontWeight: 700, color: warmTheme.text }}>{dateObj.getDate()}</div>
                {count > 0 && (
                  <div style={{ position: "absolute", right: 8, bottom: 8, background: warmTheme.accent, color: "#fff", borderRadius: 12, fontSize: 12, padding: "2px 8px", fontWeight: 700 }}>
                    {count}건
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Modal with hourly slots */}
      {isDateModalOpen && modalDate && (
        <div style={{
          position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
          background: "#6a3b16cc", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "#fff9f1", padding: 24, borderRadius: 18, width: "min(520px, 92vw)", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 24px #dcac8570" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 20, color: warmTheme.text }}>{modalDate} 시간 선택</div>
              <button onClick={closeDateModal} style={{ background: "#fff6e4", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer", color: warmTheme.text }}>닫기</button>
            </div>
            <div style={{ background: "#fff6e4", borderRadius: 16, padding: 14, border: `1px solid ${warmTheme.border}` }}>
              {hours.map(hour => {
                const dayReservations = reservations.filter(r => r.date === modalDate);
                const reserved = dayReservations.find(r => r.hour === hour);
                return (
                  <ReservationSlot
                    key={hour}
                    hour={hour}
                    reserved={reserved}
                    userName={userName}
                    isAdmin={role === "admin"}
                    onReserveClick={() => handleReserve(modalDate, hour)}
                    onAdminEdit={() => handleEditReservation(reserved)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* (User) My Reservations */}
      {role === "user" && (
        <div style={{
          maxWidth: 400,
          margin: "0 auto",
          padding: "10px 0",
        }}>
          <div style={{
            margin: "18px 0 8px 0",
            fontWeight: 700,
            fontSize: 18,
            color: warmTheme.text
          }}>나의 예약 현황</div>
          {[...reservations].filter(r => r.user === userName).length === 0 ? (
            <div style={{
              fontSize: 15,
              color: "#b38e6a",
              padding: 10
            }}>예약 내역이 없습니다.</div>
          ) : (
            <table style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "0 7px"
            }}>
              <tbody>
                {[...reservations]
                  .filter(r => r.user === userName)
                  .map(resv => (
                  <tr key={resv.id}>
                    <td style={{
                      background: "#fff9ef",
                      borderRadius: 8,
                      padding: "8px 10px",
                      color: warmTheme.text,
                      fontWeight: 600,
                      fontSize: 15
                    }}>
                      {resv.date} {getHourLabel(resv.hour)}
                    </td>
                    <td>
                      <button onClick={()=>handleCancelReservation(resv.id)}
                        style={{
                          background: warmTheme.accent,
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 10px",
                          cursor: "pointer",
                          fontWeight: 600
                        }}>취소</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* (Admin) Edit Dialog */}
      {role === "admin" && editingReservation && (
        <div style={{
          position: "fixed",
          left: 0, top: 0, right: 0, bottom: 0,
          background: "#6a3b16cc",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{
            background: "#fff9f1",
            padding: 32,
            borderRadius: 18,
            minWidth: 320,
            boxShadow: "0 8px 24px #dcac8570",
            position: "relative"
          }}>
            <div style={{
              fontWeight: 800,
              fontSize: 21,
              marginBottom: 10,
              color: warmTheme.text
            }}>
              예약 수정 · 삭제
            </div>
            <div style={{
              color: warmTheme.text,
              marginBottom: 14
            }}>
              {editingReservation.date} {getHourLabel(editingReservation.hour)}
            </div>
            <div style={{
              marginBottom: 12
            }}>
              <span style={{fontSize: 15, marginRight: 4, color: "#b36b3d"}}>현재 예약자:</span>
              <input
                type="text"
                defaultValue={editingReservation.user}
                style={{
                  padding: 8,
                  fontSize: 15,
                  border: `1.5px solid ${warmTheme.primary}`,
                  borderRadius: 7,
                  minWidth: 140
                }}
                id="admin-user-edit-input"
                autoFocus
              />
            </div>
            <div style={{display: "flex", justifyContent: "flex-end", gap: 10}}>
              <button
                style={{
                  background: warmTheme.accent,
                  color: "#fff",
                  border: "none",
                  padding: "7px 18px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer"
                }}
                onClick={() => {
                  const newName = document.getElementById('admin-user-edit-input').value.trim();
                  if (!newName) { alert('이름을 입력하세요'); return; }
                  handleAdminEdit(editingReservation.id, newName);
                }}
              >수정</button>
              <button
                style={{
                  background: "#fff",
                  color: warmTheme.accent,
                  border: `1.5px solid ${warmTheme.accent}`,
                  padding: "7px 18px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer"
                }}
                onClick={() => handleAdminDelete(editingReservation.id)}
              >삭제</button>
              <button
                style={{
                  background: "#fff6e4",
                  color: warmTheme.text,
                  border: "none",
                  padding: "7px 18px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer"
                }}
                onClick={() => setEditingReservation(null)}
              >닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// HYBRID (Mobile-responsive) Wrapper
export default function App() {
  return (
    <div style={{maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fffcf7"}}>
      <ReservationPage />
      <div style={{
        height: 45, paddingTop: 12, fontSize: 13, color: "#b38e6a",
        textAlign: "center", fontWeight: 500, opacity: 0.8, marginTop: 8
      }}>
        2024 © 따뜻한 보컬연습실 예약
      </div>
    </div>
  );
}


