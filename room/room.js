const ROOM_API_URL = "https://script.google.com/macros/s/AKfycby3f_cFZp8YP6AH9DTBipDves8fMZls7aIkCKuc4iKLrWbL81X8PlTh4bNFUhjhsP8wtw/exec"; 

let checkTimeout = null;
let isBlocked = false;

// 1. Logic Chọn phòng & Đổi hình nền
function selectRoom(roomName, capacity, element, side) {
    document.querySelectorAll('.room-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    const bgLeft = document.getElementById('bg-left');
    const bgRight = document.getElementById('bg-right');

    if (side === 'left') { bgLeft.className = 'bg-half active'; bgRight.className = 'bg-half inactive'; } 
    else { bgLeft.className = 'bg-half inactive'; bgRight.className = 'bg-half active'; }

    document.getElementById('selectedRoom').value = roomName;
    checkAvailability(); 
}

// 2. Kiểm tra trùng lịch
async function checkAvailability() {
    const room = document.getElementById('selectedRoom').value;
    const date = document.getElementById('meetingDate').value;
    const start = document.getElementById('startTime').value;
    const end = document.getElementById('endTime').value;
    const alertBox = document.getElementById('conflictAlert');
    const btnSubmit = document.getElementById('btnSubmit');

    if (!room || !date || !start || !end) return;
    if (start >= end) {
        alertBox.className = 'alert alert-warning d-block';
        alertBox.innerHTML = '⚠️ Giờ kết thúc phải sau giờ bắt đầu!';
        btnSubmit.disabled = true;
        return;
    }

    alertBox.className = 'alert alert-info d-block';
    alertBox.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div> Đang kiểm tra...';

    try {
        const res = await fetch(ROOM_API_URL, {
            method: "POST",
            body: JSON.stringify({ action: 'CHECK_ROOM', room, date, start, end })
        }).then(r => r.json());

        if (res.status === 'CONFLICT') {
            isBlocked = true;
            alertBox.className = 'alert alert-danger d-block';
            alertBox.innerHTML = `⛔ <strong>TRÙNG LỊCH!</strong><br>${res.message}`;
            btnSubmit.disabled = true;
        } else {
            isBlocked = false;
            alertBox.className = 'alert alert-success d-block';
            alertBox.innerHTML = '✔ Phòng trống, bạn có thể đặt!';
            btnSubmit.disabled = false;
        }
    } catch (e) { alertBox.innerHTML = 'Lỗi kết nối máy chủ.'; }
}

let isEditMode = false;
let oldMeetingData = {};

// 3. Khởi tạo & Logic Auto-fill khi Đổi lịch
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('meetingDate').setAttribute('min', today);

    const editDataRaw = localStorage.getItem('edit_meeting_data');
    if (editDataRaw) {
        const data = JSON.parse(editDataRaw);
        isEditMode = true;
        oldMeetingData = { room: data.oldRoom, date: data.oldDate, start: data.oldStart };

        document.getElementById('fullName').value = data.fullName;
        document.getElementById('meetingTitle').value = data.title;
        document.getElementById('meetingNote').value = data.note;
        
        if (data.date.includes('/')) {
            const p = data.date.split('/');
            document.getElementById('meetingDate').value = `${p[2]}-${p[1]}-${p[0]}`;
        } else {
            document.getElementById('meetingDate').value = data.date;
        }
        
        document.getElementById('startTime').value = data.start;
        document.getElementById('endTime').value = data.end;

        const side = data.room.includes('Lớn') ? 'left' : 'right';
        document.querySelectorAll('.room-card').forEach(card => {
            if (card.querySelector('h6').innerText === data.room) selectRoom(data.room, 0, card, side);
        });

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.innerHTML = '<i class="bi bi-pencil-square me-2"></i> CẬP NHẬT LỊCH';
        btnSubmit.classList.replace('btn-submit', 'btn-warning');
        btnSubmit.classList.add('text-dark', 'fw-bold');

        localStorage.removeItem('edit_meeting_data');
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Chế độ chỉnh sửa lịch họp', showConfirmButton: false, timer: 3000 });
    }
});

// 4. Xử lý Gửi Form
document.getElementById('roomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isBlocked && !isEditMode) return;

    const btnSubmit = document.getElementById('btnSubmit');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div> Đang xử lý...';

    const payload = {
        action: isEditMode ? 'UPDATE_ROOM' : 'BOOK_ROOM',
        room: document.getElementById('selectedRoom').value,
        fullName: document.getElementById('fullName').value,
        title: document.getElementById('meetingTitle').value,
        date: document.getElementById('meetingDate').value,
        start: document.getElementById('startTime').value,
        end: document.getElementById('endTime').value,
        note: document.getElementById('meetingNote').value
    };

    if (isEditMode) {
        payload.oldRoom = oldMeetingData.room;
        payload.oldDate = oldMeetingData.date;
        payload.oldStart = oldMeetingData.start;
    }

    try {
        const res = await fetch(ROOM_API_URL, { method: "POST", body: JSON.stringify(payload) }).then(r => r.json());
        if (res.status === 'success') {
            await Swal.fire('Thành công!', isEditMode ? 'Đã cập nhật lịch!' : 'Đã chốt đặt phòng!', 'success');
            window.location.href = 'list_room.html';
        } else {
            Swal.fire('Lỗi', res.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (err) { 
        Swal.fire('Lỗi', 'Không thể kết nối.', 'error'); 
    } finally { 
        btnSubmit.disabled = false; 
        btnSubmit.innerHTML = originalText; 
    }
});

// Lắng nghe thay đổi giờ để check trùng
['meetingDate', 'startTime', 'endTime'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkAvailability, 500);
    });
});