const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxwGpC5iQ73vLz8YKHsRfq-ZKCknKuZ69fzTWC9dPPhX8uEVqdd1_6Dh76Ry5X0o1HU/exec";

let oldTripIdToDelete = null; 

const els = {
    form: document.getElementById('tripForm'),
    startDate: document.getElementById('startDate'),
    startTime: document.getElementById('startTime'),
    days: document.getElementById('days'),
    transport: document.getElementById('transport'),
    
    // Phần tử menu chọn xe & ô nhập "Khác"
    carOwnerGroup: document.getElementById('carOwnerGroup'),
    carOwnerSelect: document.getElementById('carOwnerSelect'),
    carOwnerInput: document.getElementById('carOwnerInput'),
    
    // Container chứa các điểm đến (Multi-stop)
    destinationsContainer: document.getElementById('destinationsContainer'),

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

// --- 1. CÁC HÀM XỬ LÝ ĐIỂM ĐẾN (MULTI-STOP) ---

// Thêm ô nhập điểm đến mới
function addDestination(value = "") {
    const count = els.destinationsContainer.querySelectorAll('.destination-item').length + 1;
    const div = document.createElement('div');
    div.className = 'input-group mb-2 destination-item fade-in';
    div.id = `dest-${count}`;
    
    div.innerHTML = `
        <span class="input-group-text bg-light fw-bold text-secondary">${count}</span>
        <input type="text" class="form-control dest-input" placeholder="Điểm đến tiếp theo..." value="${value}" required>
        ${count > 1 ? `<button class="btn btn-outline-danger" type="button" onclick="removeDestination(this)"><i class="bi bi-x-lg"></i></button>` : ''}
    `;
    els.destinationsContainer.appendChild(div);
}

// Xóa điểm đến
function removeDestination(btn) {
    btn.closest('.destination-item').remove();
    reindexDestinations();
}

// Đánh lại số thứ tự (1, 2, 3...) sau khi xóa
function reindexDestinations() {
    const items = els.destinationsContainer.querySelectorAll('.destination-item');
    items.forEach((item, index) => {
        item.querySelector('.input-group-text').innerText = index + 1;
        // Ẩn nút xóa cho dòng đầu tiên
        const removeBtn = item.querySelector('.btn-outline-danger');
        if (index === 0 && removeBtn) removeBtn.remove();
    });
}

// Lấy danh sách các điểm đến (trả về Mảng)
function getDestinationsList() {
    const inputs = els.destinationsContainer.querySelectorAll('.dest-input');
    const dests = [];
    inputs.forEach(input => {
        if(input.value.trim()) dests.push(input.value.trim());
    });
    return dests;
}

// --- 2. CÁC HÀM TIỆN ÍCH KHÁC ---

// Helper: Lấy giá trị thực tế của "Xe của ai"
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
    if(overlay) overlay.classList.remove('d-none');
    
    const interval = setInterval(() => {
        seconds--;
        if(countEl) countEl.innerText = seconds; 
        if (seconds <= 0) {
            clearInterval(interval);
            window.location.href = 'calendar.html'; 
        }
    }, 1000);
}

function convertDateFormat(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// --- 3. KHỞI TẠO TRANG (LOAD DATA) ---

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    els.startDate.setAttribute('min', today);

    const editDataJson = localStorage.getItem('editTripData');
    if (editDataJson) {
        try {
            const data = JSON.parse(editDataJson);
            console.log("Đang tải dữ liệu sửa:", data);

            oldTripIdToDelete = data.oldId; 

            document.getElementById('fullName').value = data.fullName;
            document.getElementById('department').value = data.dept;
            els.startDate.value = convertDateFormat(data.startDate);
            els.startTime.value = data.startTime;
            els.days.value = data.days;
            els.companions.value = data.companions;

            if (data.destination) {
                const destParts = data.destination.split(' -> ');
                els.destinationsContainer.innerHTML = ''; // Reset
                destParts.forEach(dest => addDestination(dest));
            } else {
                addDestination();
            }

            els.km.value = data.km || 0;
            els.duration.value = data.duration || "";
            els.kmDisplay.innerText = (data.km || 0) + " km";
            els.durationDisplay.innerText = data.duration || "Chưa tính";

            els.transport.value = data.transport;
            els.transport.dispatchEvent(new Event('change'));

            if (data.transport === 'Ô tô') {
                const availableOptions = Array.from(els.carOwnerSelect.options).map(o => o.value);
                if (availableOptions.includes(data.carOwner)) {
                    els.carOwnerSelect.value = data.carOwner;
                } else {
                    els.carOwnerSelect.value = 'Khác';
                    els.carOwnerSelect.dispatchEvent(new Event('change'));
                    els.carOwnerInput.value = data.carOwner;
                }
            }
            
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-warning border-warning shadow-sm fw-bold mb-4';
            alertDiv.innerHTML = `<i class="bi bi-pencil-square"></i> Đang sửa lịch trình của: ${data.fullName}`;
            els.form.prepend(alertDiv);
            
            localStorage.removeItem('editTripData');

        } catch (e) {
            console.error("Lỗi khi điền dữ liệu sửa:", e);
        }
    } else {
        if(els.destinationsContainer.innerHTML.trim() === "") {
             addDestination();
        }
    }

    // --- GÁN SỰ KIỆN CHO FORM ---
    els.transport.addEventListener('change', function() {
        if (this.value === 'Ô tô') {
            els.carOwnerGroup.classList.remove('d-none');
            els.carOwnerSelect.required = true;
            if(!els.carOwnerSelect.value) {
                els.carOwnerSelect.value = "";
                els.carOwnerInput.classList.add('d-none');
            }
        } else {
            els.carOwnerGroup.classList.add('d-none');
            els.carOwnerSelect.required = false;
            els.carOwnerSelect.value = "";
            els.carOwnerInput.required = false;
            els.carOwnerInput.value = "";
        }
        checkSchedule(); 
    });

    els.carOwnerSelect.addEventListener('change', function() {
        if (this.value === 'Khác') {
            els.carOwnerInput.classList.remove('d-none');
            els.carOwnerInput.required = true;
            els.carOwnerInput.focus();
        } else {
            els.carOwnerInput.classList.add('d-none');
            els.carOwnerInput.required = false;
            els.carOwnerInput.value = ""; 
            checkSchedule(); 
        }
    });

    els.carOwnerInput.addEventListener('input', function() {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(checkSchedule, 500);
    });

    els.startDate.addEventListener('change', checkSchedule);
    els.startTime.addEventListener('change', checkSchedule);
    els.days.addEventListener('change', checkSchedule);
    
    // Nút tính tổng KM
    els.btnMeasure.addEventListener('click', measureDistance);
    
    // Nút gửi form
    els.form.addEventListener('submit', handleSubmit);
});

// --- 4. GỌI API ---

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
        // Lưu ý: Nếu đang sửa mà giữ nguyên giờ cũ, hệ thống sẽ báo trùng với chính nó.
        // Mẹo: Tạm thời cứ đổi giờ một chút hoặc bỏ qua nếu bạn chắc chắn sẽ xóa chuyến cũ.
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
    const destList = getDestinationsList();
    if (destList.length === 0) return alert("Vui lòng nhập ít nhất một điểm đến!");

    toggleLoading(true);
    const res = await callApi({ action: 'CALCULATE_DISTANCE', destinations: destList });
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
    if (!els.km.value) return alert("⚠️ Hãy bấm 'Tính Tổng KM' trước!");

    toggleLoading(true);

    const finalDestinationString = getDestinationsList().join(' -> ');

    const payload = {
        action: 'SUBMIT_FORM',
        fullName: document.getElementById('fullName').value,
        department: document.getElementById('department').value,
        startDate: els.startDate.value,
        startTime: els.startTime.value,
        days: els.days.value,
        destination: finalDestinationString,
        km: els.km.value,
        duration: els.duration.value,
        transport: els.transport.value,
        carOwner: getCarOwnerValue(), 
        companions: els.companions.value
    };

    const res = await callApi(payload);

    if (res.status === 'success') {
        if (oldTripIdToDelete) {
            console.log("Đang tự động xóa lịch trình cũ ID:", oldTripIdToDelete);
            await callApi({ action: 'CANCEL_TRIP', id: oldTripIdToDelete });
        }
        
        toggleLoading(false);
        showSuccessAndReload();
    } else {
        toggleLoading(false);
        alert("❌ Lỗi: " + res.message);
    }
}