const API_URL = 'https://script.google.com/macros/s/AKfycbwVXj8-WuohDjwhHj5SvRvS3gfYrnk9GX5Xpk4G5Pn6fmMnGMBx1xCFqPKxXef9p1bYow/exec';

const el = (id) => document.getElementById(id);
const setLoader = (show) => el('loader').classList.toggle('d-none', !show);
const urlParams = new URLSearchParams(window.location.search);
const isDashboardView = urlParams.get('view') === 'dashboard';

let leaveCalendarInstance = null;

function formatDateVN(dateStr) {
    if (!dateStr) return "";
    const p = dateStr.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
}

function getCalendarDates(dateStr, days) {
    let p = dateStr.split(' ')[0].split('/');
    if (p.length !== 3) return null;
    let start = new Date(p[2], p[1] - 1, p[0]);
    let startISO = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;

    let endISO = null;
    if (days > 1) {
        let end = new Date(start);
        end.setDate(end.getDate() + Math.ceil(days));
        endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    }
    return { start: startISO, end: endISO };
}

// KHỞI TẠO TRANG
document.addEventListener('DOMContentLoaded', async () => {
    const savedEmail = localStorage.getItem('tis_email');
    const savedToken = localStorage.getItem('tis_token');

    if (savedEmail && savedToken) {
        setLoader(true);
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'AUTO_LOGIN', email: savedEmail, token: savedToken })
            }).then(r => r.json());

            setLoader(false);
            if (res.status === 'success') handleLoginSuccess(res, savedEmail);
            else localStorage.removeItem('tis_token');
        } catch (e) { setLoader(false); }
    }
});

// XỬ LÝ ĐĂNG NHẬP THÀNH CÔNG
function handleLoginSuccess(data, email) {
    localStorage.setItem('tis_email', email);
    if (data.token) localStorage.setItem('tis_token', data.token);

    if (isDashboardView) showDashboard(email);
    else showForm(data, email);
}

// HIỂN THỊ FORM ĐĂNG KÝ
function showForm(data, email) {
    el('mainContainer').classList.remove('d-none');
    el('dashboardContainer').classList.add('d-none');
    el('stepEmail').classList.add('d-none');
    el('stepOtp').classList.add('d-none');
    el('stepForm').classList.remove('d-none');
    el('historySection').classList.remove('d-none');

    el('email').value = email;
    el('myName').innerText = data.name;
    el('myDept').innerText = data.dept;
    el('myBal').innerText = data.balance;
    el('bossEmail').value = data.manager;

    const role = (data.role || "").toLowerCase();
    if (['admin', 'manager', 'quản lý'].includes(role)) {
        el('btnToDashboard').classList.remove('d-none');
    } else {
        el('btnToDashboard').classList.add('d-none');
    }

    loadHistory(email);
    calculateLeave();
}

// HIỂN THỊ DASHBOARD QUẢN LÝ
async function showDashboard(email) {
    el('mainContainer').classList.add('d-none');
    el('dashboardContainer').classList.remove('d-none');
    setLoader(true);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'GET_ALL_HISTORY', email: email })
        }).then(r => r.json());
        setLoader(false);
        if(res.status === 'success') renderDashboard(res.data);
    } catch(e) { setLoader(false); }
}

// RENDER DỮ LIỆU DASHBOARD (Danh sách + Lịch Tổng Thể)
function renderDashboard(data) {
    const tbody = el('allHistoryBody');
    const todayGrid = el('todayGrid');
    const filterMonthSelect = el('filterMonth');

    data.sort((a, b) => {
        const parseDate = (dateStr) => {
            if (!dateStr) return new Date(0);
            const parts = dateStr.split(' ')[0].split('/'); 
            return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : new Date(0);
        };
        return parseDate(b.start) - parseDate(a.start);
    });

    tbody.innerHTML = ''; 
    if(todayGrid) todayGrid.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Chưa có dữ liệu.</td></tr>'; 
        if(todayGrid) todayGrid.innerHTML = '<div class="col-12 text-muted small fst-italic">Không có dữ liệu.</div>';
        return;
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let hasToday = false;
    const uniqueMonths = new Set();
    
    let calendarEvents = [];

    data.forEach(item => {
        let badgeClass = item.status === 'Đã duyệt' ? 'bg-success' : (item.status === 'Chờ duyệt' ? 'bg-warning text-dark' : 'bg-danger');

        // Lọc các tháng có dữ liệu
        if (item.start) {
            const dateParts = item.start.split(' ')[0].split('/');
            if (dateParts.length >= 2) uniqueMonths.add(`${dateParts[1]}/${dateParts[2]}`);
        }

        // 1. Render Table List
        tbody.innerHTML += `<tr>
            <td class="ps-3 fw-bold text-secondary text-nowrap">${item.start}</td>
            <td>
                <div class="fw-bold text-dark">${item.name}</div>
                <small class="text-muted">${item.dept}</small>
            </td>
            <td>
                <div class="small text-dark fw-bold">${item.type}</div>
                <small class="text-muted fst-italic">"${item.reason || 'Không có'}"</small>
            </td>
            <td class="text-end pe-3"><span class="badge ${badgeClass}">${item.status}</span></td>
        </tr>`;
        
        // 2. Render Nghỉ Hôm Nay & Lịch Tổng Thể (Bỏ qua các đơn bị từ chối)
        if (item.status !== 'Từ chối') { 
            let isOffToday = false;
            if(item.start) {
                const dateOnlyStr = item.start.split(' ')[0]; 
                const p = dateOnlyStr.split('/');
                if(p.length === 3) {
                    const startDate = new Date(p[2], p[1] - 1, p[0]);
                    startDate.setHours(0,0,0,0);
                    const days = parseFloat(item.days) || 1;
                    const duration = Math.ceil(days);
                    const endDate = new Date(startDate.getTime());
                    endDate.setDate(startDate.getDate() + duration - 1);
                    if(currentDate >= startDate && currentDate <= endDate) isOffToday = true;
                }
            }
            if (isOffToday && todayGrid) { 
                todayGrid.innerHTML += `<div class="col-md-4 col-sm-6"><div class="p-3 bg-white rounded border-start border-4 ${item.status === 'Đã duyệt' ? 'border-success' : 'border-warning'} shadow-sm h-100"><div class="d-flex justify-content-between mb-2"><span class="fw-bold text-dark">${item.start}</span><span class="badge ${badgeClass}">${item.status}</span></div><h6 class="mb-1 fw-bold">${item.name}</h6><p class="small text-muted mb-1">${item.type} (${item.days} ngày)</p></div></div>`;
                hasToday = true; 
            }

            // Gói data cho Lịch FullCalendar
            const calDates = getCalendarDates(item.start, parseFloat(item.days));
            if (calDates) {
                calendarEvents.push({
                    title: `${item.name} (${item.days} ngày)`,
                    start: calDates.start,
                    end: calDates.end,
                    className: item.status === 'Đã duyệt' ? 'event-approved' : 'event-pending',
                    extendedProps: { ...item }
                });
            }
        }
    });

    if (!hasToday && todayGrid) {
        todayGrid.innerHTML = '<div class="col-12"><div class="alert alert-light border text-muted small fst-italic mb-0"><i class="fa-solid fa-mug-hot me-2 text-warning"></i>Hôm nay không có ai nghỉ. Mọi người đều đi làm đầy đủ!</div></div>';
    }

    initLeaveCalendar(calendarEvents);

    const currentMonthVal = filterMonthSelect.value; 
    filterMonthSelect.innerHTML = '<option value="all">📅 Tất cả thời gian</option>';
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => {
        const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
        return new Date(yB, mB - 1) - new Date(yA, mA - 1);
    });
    sortedMonths.forEach(m => filterMonthSelect.innerHTML += `<option value="${m}">Tháng ${m}</option>`);
    if(Array.from(filterMonthSelect.options).some(opt => opt.value === currentMonthVal)) filterMonthSelect.value = currentMonthVal;

    const filterFunc = () => {
        const txt = el('searchBox').value.toLowerCase().trim();
        const stat = el('filterStatus').value;
        const monthStr = el('filterMonth').value; 
        Array.from(tbody.rows).forEach(row => {
            if (row.cells.length < 4) return;
            const rowDate = row.cells[0].innerText; 
            const name = row.cells[1].innerText.toLowerCase();
            const status = row.cells[3].innerText;
            const matchName = name.includes(txt);
            const matchStat = (stat === 'all' || status.includes(stat));
            const matchMonth = (monthStr === 'all' || rowDate.includes(monthStr)); 
            row.style.display = (matchName && matchStat && matchMonth) ? '' : 'none';
        });
    };
    el('searchBox').oninput = filterFunc; el('filterStatus').onchange = filterFunc; el('filterMonth').onchange = filterFunc;
}

function initLeaveCalendar(events) {
    const calendarEl = document.getElementById('leaveCalendar');
    if (!calendarEl) return;

    if (leaveCalendarInstance) {
        leaveCalendarInstance.destroy();
    }

    leaveCalendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        buttonText: { today: 'Hôm nay', month: 'Tháng', week: 'Tuần' },
        events: events,
        eventClick: function(info) {
            const p = info.event.extendedProps;
            let badge = p.status === 'Đã duyệt' ? 'bg-success' : 'bg-warning text-dark';
            Swal.fire({
                title: `<span class="text-danger fw-bold">${p.name}</span>`,
                html: `
                    <div class="text-start mt-3" style="font-size: 1.05rem; line-height: 1.8;">
                        <p class="mb-2"><i class="fa-solid fa-building-user text-muted me-2"></i><strong>Phòng ban:</strong> ${p.dept}</p>
                        <p class="mb-2"><i class="fa-solid fa-umbrella-beach text-primary me-2"></i><strong>Loại:</strong> ${p.type} (${p.days} ngày)</p>
                        <p class="mb-2"><i class="fa-regular fa-clock text-danger me-2"></i><strong>Ngày nghỉ:</strong> ${p.start}</p>
                        <p class="mb-2"><i class="fa-solid fa-comment-dots text-info me-2"></i><strong>Lý do:</strong> ${p.reason || 'Không có'}</p>
                        <p class="mb-0"><i class="fa-solid fa-circle-check text-success me-2"></i><strong>Trạng thái:</strong> <span class="badge ${badge}">${p.status}</span></p>
                    </div>
                `,
                confirmButtonColor: '#D61F2F'
            });
        }
    });

    leaveCalendarInstance.render();
}

document.getElementById('pills-cal-tab').addEventListener('shown.bs.tab', function () {
    if (leaveCalendarInstance) {
        leaveCalendarInstance.render();
    }
});

// XỬ LÝ NÚT LẤY OTP
el('btnGetOtp').onclick = async () => {
    const email = el('email').value.trim();
    if(!email.includes('@')) return Swal.fire("Lỗi", "Vui lòng nhập email hợp lệ", "warning");
    setLoader(true);
    try {
        const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({action:'REQUEST_OTP', email}) }).then(r=>r.json());
        setLoader(false);
        if(res.status==='success') {
            el('stepEmail').classList.add('d-none'); el('stepOtp').classList.remove('d-none');
            Swal.fire("Đã gửi mã", "Vui lòng kiểm tra email của bạn", "success");
        } else Swal.fire("Lỗi", res.message, "error");
    } catch(e) { setLoader(false); Swal.fire("Lỗi mạng", "Thử lại sau", "error"); }
};

// XỬ LÝ NÚT XÁC NHẬN OTP
el('btnVerify').onclick = async () => {
    const email = el('email').value.trim();
    const otp = el('otpCode').value.trim();
    setLoader(true);
    try {
        const res = await fetch(API_URL, { method:'POST', body:JSON.stringify({action:'VERIFY_OTP', email, otp}) }).then(r=>r.json());
        setLoader(false);
        if(res.status==='success') handleLoginSuccess(res, email);
        else Swal.fire("Lỗi", res.message, "error");
    } catch(e) { setLoader(false); }
};

el('btnBack').onclick = (e) => { e.preventDefault(); el('stepOtp').classList.add('d-none'); el('stepEmail').classList.remove('d-none'); };
const doLogout = () => { localStorage.removeItem('tis_token'); window.location.href = window.location.pathname; };
el('btnLogout').onclick = doLogout; el('btnLogoutDash').onclick = doLogout;
el('btnToDashboard').onclick = () => showDashboard(localStorage.getItem('tis_email'));
el('btnBackToForm').onclick = () => window.location.href = window.location.pathname;

function calculateLeave() {
    const bal = parseFloat(el('myBal').innerText)||0, days = parseFloat(el('days').value)||0;
    const typeInp = el('type'), msg = el('calcMsg');
    if(days<=0) return;
    if(bal>=days) { typeInp.value = "Phép năm"; typeInp.className = "form-control fw-bold bg-light text-success"; msg.classList.add('d-none'); }
    else if(bal<=0) { typeInp.value = `Nghỉ không lương (${days} ngày)`; typeInp.className = "form-control fw-bold bg-light text-danger"; msg.innerHTML='Hết phép. Tính nghỉ không lương.'; msg.classList.remove('d-none'); }
    else { const unpaid = days-bal; typeInp.value = `${bal} Phép năm + ${unpaid} Không lương`; typeInp.className="form-control fw-bold bg-light text-warning"; msg.innerHTML='Thiếu phép. Hệ thống sẽ tự tách đơn.'; msg.classList.remove('d-none'); }
}

el('days').addEventListener('input', () => {
    calculateLeave();
    const daysVal = parseFloat(el('days').value) || 0;
    if (daysVal % 1 !== 0) {
        el('sessionContainer').classList.remove('d-none');
    } else {
        el('sessionContainer').classList.add('d-none');
    }
});

async function loadHistory(email) {
    try {
        const tbody = el('listBody'); 
        tbody.innerHTML='<tr><td colspan="4" class="text-center">Đang tải dữ liệu...</td></tr>';
        const res = await fetch(`${API_URL}?action=GET_LIST&email=${email}`).then(r=>r.json());
        tbody.innerHTML='';
        if(!res.data || res.data.length===0) { 
            tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted">Chưa có lịch sử đăng ký</td></tr>'; 
            return; 
        }
        res.data.forEach(item => {
            let badge = item.status==='Chờ duyệt' ? 'bg-warning text-dark' : (item.status==='Đã duyệt' ? 'bg-success' : 'bg-danger');
            tbody.innerHTML += `
            <tr>
                <td class="ps-3 py-3 fw-bold">${item.start}</td>
                <td><span class="badge bg-light text-dark border">${item.days} ngày</span></td>
                <td><small>${item.type}</small></td>
                <td class="text-end pe-3"><span class="badge ${badge}">${item.status}</span></td>
            </tr>`;
        });
    } catch(e) {}
}

// XỬ LÝ SUBMIT FORM TẠO ĐƠN MỚI
el('leaveForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayDate = formatDateVN(el('startDate').value);
    const confirm = await Swal.fire({ 
        title: 'Gửi yêu cầu nghỉ?', 
        html: `<b>Bạn đang đăng ký nghỉ ${el('days').value} ngày</b><br>Bắt đầu từ: <b>${displayDate}</b>`, 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: 'Gửi đơn', 
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#D61F2F' 
    });
    if(!confirm.isConfirmed) return;

    setLoader(true);
    
    const daysVal = parseFloat(el('days').value) || 0;
    let sessionChoice = "";
    if (daysVal % 1 !== 0) {
        sessionChoice = el('leaveSession').value;
    }

    const payload = { 
        action: 'SUBMIT', 
        fullName: el('myName').innerText, 
        email: el('email').value, 
        dept: el('myDept').innerText, 
        manager: el('bossEmail').value, 
        startDate: el('startDate').value, 
        days: el('days').value, 
        type: el('type').value, 
        reason: el('reason').value || "Không có",
        session: sessionChoice
    };
    
    try {
        await fetch(API_URL, { method:'POST', body:JSON.stringify(payload) });
        setLoader(false);
        
        const managerEmail = el('bossEmail').value;
        await Swal.fire({
            title: "Thành công!",
            html: `Đã gửi đơn chờ duyệt đến quản lý:<br><strong>${managerEmail}</strong>`,
            icon: "success",
            confirmButtonColor: '#D61F2F'
        });

        // Reset form sau khi gửi thành công
        el('leaveForm').reset(); 
        el('days').value = 1; 
        el('type').value = ""; 
        el('sessionContainer').classList.add('d-none');
        loadHistory(el('email').value);
    } catch(e) { setLoader(false); Swal.fire("Lỗi kết nối", "Vui lòng thử lại sau", "error"); }
});