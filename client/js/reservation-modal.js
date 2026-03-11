document.addEventListener("DOMContentLoaded", function () {
    // Delete Modal


    const deleteButtons = document.querySelectorAll('button[data-bs-target="#deleteReservationModal"]');
    const deleteReservationIdInput = document.getElementById("delete-reservation-id");

    deleteButtons.forEach(button => {
        button.addEventListener("click", function () {
            const reservationId = this.getAttribute("data-id");
            if (deleteReservationIdInput) {
                deleteReservationIdInput.value = reservationId;
                console.log("Reservation ID set:", reservationId); // for debugging
            }
        });
    });


    // Edit Modal
    const editReservationModal = document.getElementById("editReservationModal");
    if (editReservationModal) {
        const editReservationIdInput = document.getElementById("edit-reservation-id");
        const editLabInput = document.getElementById("edit-laboratory");
        const editDateInput = document.getElementById("edit-date");
        const editTimeInput = document.getElementById("edit-time");

        editReservationModal.addEventListener("show.bs.modal", function (event) {
            const button = event.relatedTarget;
            editReservationIdInput.value = button.getAttribute("data-id");
            editLabInput.value = button.getAttribute("data-laboratory");
            editDateInput.value = button.getAttribute("data-date");
            editTimeInput.value = button.getAttribute("data-time");
        });
    }
});