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
    const editButtons = document.querySelectorAll('a[href*="/reservation/"][title="Edit reservation"]');

    editButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent default navigation if needed

            // Get the closest row (tr for desktop, card-body for mobile)
            const row = button.closest('tr') || button.closest('.card-body');

            if (!row) return;

            let timeSlot, seatNo;

            // Desktop (table row)
            if (row.tagName === 'TR') {
                timeSlot = row.children[3].textContent.trim(); // 4th column -> Time
                seatNo = row.children[5].textContent.trim();   // 6th column -> Seat#
            } else {
                // Mobile (card)
                timeSlot = row.querySelector('small:contains("Booking Time")')?.textContent.split(':')[1].trim();
                seatNo = row.querySelector('small:contains("Seat#")')?.textContent.split('#')[1].trim();
            }

            // Optional: redirect to the edit page
            window.location.href = button.getAttribute('href');
        });
    });

});