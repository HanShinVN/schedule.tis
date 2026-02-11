const ROOM_API_URL = "https://script.google.com/macros/s/AKfycby3f_cFZp8YP6AH9DTBipDves8fMZls7aIkCKuc4iKLrWbL81X8PlTh4bNFUhjhsP8wtw/exec"; 

let checkTimeout = null;
let isBlocked = false;

// Xử lý UI chọn phòng & đổi nền
function selectRoom(roomName, capacity, element, side) {
    document.querySelectorAll('.room-card').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    
    const bgLeft = document.getElementById('bg-left');
    const bgRight = document.getElementById('bg-right');

    if (side === 'left') {
        bgLeft.className = 'bg-half active';
        bgRight.className = 'bg-half inactive';
    } else if (side === 'right') {
        bgLeft.className = 'bg-half inactive';
        bgRight.className = 'bg-half active';
    }

    document.getElementById('selectedRoom').value = roomName;
    document.getElementById('roomAlert').classList.add('d-none');
    checkAvailability(); 
}

// Chặn không cho chọn ngày quá khứ
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('meetingDate');
    if(dateInput) dateInput.setAttribute('min', today);
});

// Lắng nghe sự thay đổi thời gian để check trùng lịch (debounce 500ms)
['meetingDate', 'startTime', 'endTime'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('change', () => {
            clearTimeout(checkTimeout);
            checkTimeout = setTimeout(checkAvailability, 500); 
        });
    }
});

// Hàm kiểm tra trùng lịch
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
    alertBox.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div> Đang kiểm tra lịch phòng...';
    btnSubmit.disabled = true;

    try {
        const res = await fetch(ROOM_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({
                action: 'CHECK_ROOM', room: room, date: date, start: start, end: end
            })
        }).then(r => r.json());

        if (res.status === 'CONFLICT') {
            isBlocked = true;
            alertBox.className = 'alert alert-danger shadow-sm border-danger';
            alertBox.innerHTML = `⛔ <strong>TRÙNG LỊCH!</strong><br>${res.message}`;
        } else {
            isBlocked = false;
            alertBox.className = 'alert alert-success border-success';
            alertBox.innerHTML = '✔ Phòng trống, bạn có thể đặt!';
            btnSubmit.disabled = false;
        }
    } catch (e) {
        alertBox.className = 'alert alert-danger d-block';
        alertBox.innerHTML = 'Lỗi kết nối máy chủ.';
    }
}

// Xử lý sự kiện submit Form đặt phòng
document.getElementById('roomForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isBlocked) {
        return Swal.fire({
            title: 'Cảnh báo!',
            text: 'Phòng đã bị trùng lịch. Vui lòng chọn giờ khác!',
            icon: 'warning',
            confirmButtonColor: '#D61F2F'
        });
    }
    
    const room = document.getElementById('selectedRoom').value;
    if (!room) {
        document.getElementById('roomAlert').classList.remove('d-none');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmit');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang chốt phòng...';
    btnSubmit.disabled = true;

    const payload = {
        action: 'BOOK_ROOM',
        room: room,
        fullName: document.getElementById('fullName').value,
        title: document.getElementById('meetingTitle').value || 'Chưa cập nhật nội dung',
        date: document.getElementById('meetingDate').value,
        start: document.getElementById('startTime').value,
        end: document.getElementById('endTime').value,
        note: document.getElementById('meetingNote').value
    };

    try {
        const res = await fetch(ROOM_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.status === 'success') {
            await Swal.fire({
                title: 'Thành công!',
                html: `Đã đặt <b>${room}</b> thành công!<br><small class="text-muted"></small>`,
                icon: 'success',
                confirmButtonText: 'OK',
                confirmButtonColor: '#D61F2F'
            });
            
            // Reset form sau khi đặt xong
            document.getElementById('roomForm').reset();
            document.getElementById('selectedRoom').value = '';
            document.getElementById('meetingNote').value = '';
            document.querySelectorAll('.room-card').forEach(card => card.classList.remove('selected'));
            document.getElementById('conflictAlert').classList.add('d-none');

            // Reset background
            document.getElementById('bg-left').className = 'bg-half';
            document.getElementById('bg-right').className = 'bg-half';

        } else {
            Swal.fire({
                title: 'Lỗi',
                text: res.message,
                icon: 'error',
                confirmButtonColor: '#D61F2F'
            });
        }
    } catch (err) {
        Swal.fire({
            title: 'Lỗi mạng',
            text: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại mạng!',
            icon: 'error',
            confirmButtonColor: '#D61F2F'
        });
    } finally {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
    }
});