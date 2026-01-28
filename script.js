const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxwGpC5iQ73vLz8YKHsRfq-ZKCknKuZ69fzTWC9dPPhX8uEVqdd1_6Dh76Ry5X0o1HU/exec";

const els = {
    form: document.getElementById('tripForm'),
    startDate: document.getElementById('startDate'),
    startTime: document.getElementById('startTime'),
    days: document.getElementById('days'),
    destination: document.getElementById('destination'),
    transport: document.getElementById('transport'),
    
    // Cập nhật các element mới cho phần chọn xe
    carOwnerGroup: document.getElementById('carOwnerGroup'),
    carOwnerSelect: document.getElementById('carOwnerSelect'),
    carOwnerInput: document.getElementById('carOwnerInput'),
    
    companions: document.getElementById('companions'),
    
    btnMeasure: document.getElementById('btnMeasure'),
    btnSubmit: document.getElementById('btnSubmit'),
    alertBox: document.getElementById('scheduleAlert'),
    loader: document.getElementById('loadingOverlay'),
    km: document.getElementById('km'),
    kmDisplay: document.getElementById('kmDisplay'),
    duration: document.getElementById('duration'),
    durationDisplay: document.getElementById('durationDisplay')
};

let isBlocked = false;
let checkTimeout = null;

// Hàm lấy giá trị thực tế của "Xe của ai"
function getCarOwnerValue() {
    if (els.transport.value !== 'Ô tô') return '';
    const selected = els.carOwnerSelect.value;
    if (selected === 'Khác') {
        return els.carOwnerInput.value.trim();
    }
    return selected;
}

const toggleLoading = (show) => {
    if(els.loader) els.loader.classList.toggle('d-none', !show);
};

function showSuccessAndReload() {
    const overlay = document.getElementById('successOverlay');
    const countEl = document.getElementById('countdown');
    let seconds = 3; 
    overlay.classList.remove('d-none');
    
    const interval = setInterval(() => {
        seconds--;
        if(countEl) countEl.innerText = seconds; 
        if (seconds <= 0) {
            clearInterval(interval);
            window.location.href = 'calendar.html'; 
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    els.startDate.setAttribute('min', today);

    // Xử lý khi chọn Phương tiện
    els.transport.addEventListener('change', function() {
        if (this.value === 'Ô tô') {
            els.carOwnerGroup.classList.remove('d-none');
            els.carOwnerSelect.required = true;
            // Reset trạng thái
            els.carOwnerSelect.value = "";
            els.carOwnerInput.classList.add('d-none');
            els.carOwnerInput.value = "";
        } else {
            els.carOwnerGroup.classList.add('d-none');
            els.carOwnerSelect.required = false;
            els.carOwnerSelect.value = "";
            els.carOwnerInput.required = false;
            els.carOwnerInput.value = "";
        }
        checkSchedule(); 
    });

    // Xử lý khi chọn Menu xe
    els.carOwnerSelect.addEventListener('change', function() {
        if (this.value === 'Khác') {
            els.carOwnerInput.classList.remove('d-none');
            els.carOwnerInput.required = true;
            els.carOwnerInput.focus();
        } else {
            els.carOwnerInput.classList.add('d-none');
            els.carOwnerInput.required = false;
            els.carOwnerInput.value = ""; // Xóa giá trị nhập tay nếu chọn lại xe có sẵn
            checkSchedule(); // Check ngay khi chọn xe có sẵn
        }
    });

    // Xử lý khi nhập tay tên xe (Check sau khi dừng gõ)
    els.carOwnerInput.addEventListener('input', function() {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkSchedule, 500);
    });

    els.startDate.addEventListener('change', checkSchedule);
    els.startTime.addEventListener('change', checkSchedule);
    els.days.addEventListener('change', checkSchedule);
    
    els.btnMeasure.addEventListener('click', measureDistance);
    els.form.addEventListener('submit', handleSubmit);
});

async function callApi(payload) {
    try {
        const res = await fetch(GAS_API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch (error) {
        return { status: 'error', message: 'Lỗi kết nối Server!' };
    }
}

async function checkSchedule() {
    const dateStr = els.startDate.value; 
    if (!dateStr || !els.startTime.value) return;

    // Nếu là ô tô thì phải có tên xe mới check
    const carOwnerVal = getCarOwnerValue();
    if (els.transport.value === 'Ô tô' && carOwnerVal.length < 2) return;

    els.alertBox.className = 'alert alert-info d-block';
    els.alertBox.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Đang kiểm tra lịch xe...';
    els.btnSubmit.disabled = true;

    const res = await callApi({
        action: 'CHECK_AVAILABILITY',
        date: dateStr,
        time: els.startTime.value,
        days: els.days.value,
        transport: els.transport.value,
        carOwner: carOwnerVal
    });

    els.btnSubmit.disabled = false;

    if (res.status === 'BLOCKED') {
        isBlocked = true;
        els.alertBox.className = 'alert alert-danger shadow-sm border-danger';
        els.alertBox.innerHTML = `⛔ <strong>KHÔNG THỂ ĐĂNG KÝ</strong>\n</br>${res.message}`;
        els.btnSubmit.disabled = true;
    } else if (res.status === 'WARNING') {
        isBlocked = false;
        els.alertBox.className = 'alert alert-warning shadow-sm border-warning';
        els.alertBox.innerHTML = `⚠️ <strong>CẢNH BÁO TRÙNG</strong>\n</br>${res.message}`;
    } else {
        isBlocked = false;
        els.alertBox.className = 'alert alert-success border-success';
        els.alertBox.innerHTML = '✔ Lịch trống!';
        setTimeout(() => els.alertBox.classList.add('d-none'), 3000);
    }
}

async function measureDistance() {
    const dest = els.destination.value.trim();
    if (dest.length < 5) return alert("Vui lòng nhập địa chỉ cụ thể!");
    toggleLoading(true);
    const res = await callApi({ action: 'CALCULATE_DISTANCE', destinations: [dest] }); // Fix: gửi mảng destinations cho đúng API mới
    toggleLoading(false);

    if (res.status === 'success') {
        els.km.value = res.km;
        els.duration.value = res.duration;
        els.kmDisplay.innerText = `${res.km} km`;
        els.durationDisplay.innerText = res.duration;
    } else alert("Lỗi: " + res.message);
}

async function handleSubmit(e) {
    e.preventDefault();
    if (isBlocked) return alert("⛔ Trùng lịch xe! Vui lòng kiểm tra lại.");
    if (!els.km.value) return alert("⚠️ Hãy đo KM trước!");

    toggleLoading(true);

    const payload = {
        action: 'SUBMIT_FORM',
        fullName: document.getElementById('fullName').value,
        department: document.getElementById('department').value,
        startDate: els.startDate.value,
        startTime: els.startTime.value,
        days: els.days.value,
        destination: els.destination.value,
        km: els.km.value,
        duration: els.duration.value,
        transport: els.transport.value,
        carOwner: getCarOwnerValue(), // Sử dụng hàm lấy tên xe mới
        companions: els.companions.value
    };

    const res = await callApi(payload);
    toggleLoading(false);

    if (res.status === 'success') {
        showSuccessAndReload();
    } else {
        alert("❌ Lỗi: " + res.message);
    }
}