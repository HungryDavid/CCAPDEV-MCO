function to24HourFormat(timeStr) {
    // Converts "2:30 PM" -> "14:30"
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);

    if (modifier === 'PM' && hours !== 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }

    // Pad with 0
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    return `${hh}:${mm}`;
}

document.addEventListener('DOMContentLoaded', function () {
    const editModal = document.getElementById('editLabModal');

    editModal.addEventListener('show.bs.modal', function (event) {
        const button = event.relatedTarget;
        const row = button.closest('tr');

        const name = row.querySelector('td:nth-child(1)').textContent.trim();
        let openTime = row.querySelector('td:nth-child(2)').textContent.trim();
        let closeTime = row.querySelector('td:nth-child(3)').textContent.trim();
        const capacity = row.querySelector('td:nth-child(4)').textContent.trim();
        const id = button.getAttribute('data-id');

        // Convert times to 24-hour
        openTime = to24HourFormat(openTime);
        closeTime = to24HourFormat(closeTime);

        document.getElementById('editLabForm').action = "/manage-labs/edit/" + id;
        document.getElementById('editName').value = name;
        document.getElementById('editOpenTime').value = openTime;
        document.getElementById('editCloseTime').value = closeTime;
        document.getElementById('editCapacity').value = capacity;
    });

    const deleteModal = document.getElementById('deleteLabModal');
    const deleteForm = document.getElementById('deleteLabForm');

    deleteModal.addEventListener('show.bs.modal', function (event) {
        const button = event.relatedTarget;
        const id = button.getAttribute('data-id');
        deleteForm.action = "/manage-labs/delete/" + id;
    });
});