document.addEventListener("DOMContentLoaded", function () {
  const bookingTime = document.getElementById("bookingTime");
  const bookingDateInput = document.getElementById("bookingDate");
  const timeForm = document.getElementById("timeSelectForm");

  const seatButtons = document.querySelectorAll(".seat-btn");
  const openCartBtn = document.getElementById("openCartBtn");

  const selectedSeatsTableContainer = document.getElementById("selectedSeatsTableContainer");
  const selectedSeatsTableBody = document.getElementById("selectedSeatsTableBody");

  const confirmButton = document.getElementById("confirmReservationBtn");

  let selectedSeatsByTime = {};
  let cartSeats = JSON.parse(localStorage.getItem("cartSeats")) || {};

  const selectedTime = bookingTime.value;

  /* =========================
     RESTORE CART HIGHLIGHT
  ========================= */
  if (cartSeats[selectedTime]) {
    cartSeats[selectedTime].forEach(seat => {
      const btn = document.querySelector(
        `.seat-btn[data-seat='${seat}'][data-time='${selectedTime}']`
      );

      if (btn) {
        btn.classList.remove("btn-outline-primary");
        btn.classList.add("btn-primary");
      }
    });
  }

  /* =========================
     TIME CHANGE
  ========================= */
  if (bookingTime && timeForm) {
    bookingTime.addEventListener("change", function () {
      localStorage.setItem("cartSeats", JSON.stringify(cartSeats));
      timeForm.submit();
    });
  }

  /* =========================
     SEAT SELECTION
  ========================= */
  seatButtons.forEach(button => {
    button.addEventListener("click", function () {
      if (this.disabled) return;

      const seat = this.dataset.seat;
      const time = this.dataset.time;

      if (!selectedSeatsByTime[time]) {
        selectedSeatsByTime[time] = [];
      }

      if (selectedSeatsByTime[time].includes(seat)) {
        selectedSeatsByTime[time] = [];
        this.classList.remove("btn-primary");
        this.classList.add("btn-outline-primary");
      } else {
        // Reset other seats in the same time
        seatButtons.forEach(btn => {
          if (btn.dataset.time === time) {
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-outline-primary");
          }
        });

        selectedSeatsByTime[time] = [seat];
        this.classList.remove("btn-outline-primary");
        this.classList.add("btn-primary");
      }

    });
  });

  /* =========================
     RENDER TABLE
  ========================= */
  function renderSelectedSeatsTable() {
    selectedSeatsTableBody.innerHTML = "";

    if (Object.keys(cartSeats).length === 0) {
      selectedSeatsTableContainer.style.display = "none";
      return;
    }

    selectedSeatsTableContainer.style.display = "block";

    for (const [time, seats] of Object.entries(cartSeats)) {
      seats.forEach(seat => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${time}</td>
          <td>${seat}</td>
          <td class="status-cell">Checking...</td>
          <td>
            <button class="btn btn-danger btn-sm delete-seat">
              Delete
            </button>
          </td>
        `;

        row.querySelector(".delete-seat").addEventListener("click", () => {
          deleteSeatFromSelection(time, seat);
        });

        selectedSeatsTableBody.appendChild(row);
      });
    }
  }

  openCartBtn.addEventListener("click", function () {
    for (const [time, seats] of Object.entries(selectedSeatsByTime)) {
      cartSeats[time] = [...seats];
    }

    localStorage.setItem("cartSeats", JSON.stringify(cartSeats));
    renderSelectedSeatsTable();
  });


  /* =========================
     DELETE SEAT
  ========================= */
  function deleteSeatFromSelection(time, seat) {
    if (cartSeats[time]) {
      cartSeats[time] = cartSeats[time].filter(s => s !== seat);

      if (cartSeats[time].length === 0) {
        delete cartSeats[time];
      }
    }

    localStorage.setItem("cartSeats", JSON.stringify(cartSeats));
    renderSelectedSeatsTable();
  }
  /* =========================
     AJAX AUTO UPDATE
  ========================= */
async function update() {
    console.log("Updating seat status...");

    // Get labId from the URL path
    const labName = window.location.pathname.split("/")[3];
    console.log("Lab Name:", labName);  // Log labName to make sure it's correct

    // Get the booking date
    const bookingDate = bookingDateInput.value;
    console.log("Booking Date:", bookingDate);  // Log booking date to verify it's correct

    try {
        // Fetch the available seats from the server
        const response = await fetch(`/labs/${labName}/availability?bookingDate=${bookingDate}`);

        // Check if the response is successful (status 200)
        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        const flattenedSeats = await response.json();
        console.log("Fetched Seats Data:", flattenedSeats);  // Log the response to verify its content

        // Update the table status based on the fetched data
        updateTableStatus(flattenedSeats);
    } catch (err) {
        console.error("Seat availability error:", err);
    }
}

/* =========================
   UPDATE TABLE STATUS
========================= */
function updateTableStatus(flattenedSeats) {
  const seatMap = flattenedSeats.reduce((map, seatData) => {
    const key = `${seatData.seatNumber}-${seatData.time}`;
    map[key] = seatData.reserved;
    return map;
  }, {});

  // Convert the table rows into an array for easier iteration
  Array.from(selectedSeatsTableBody.rows).forEach(row => {
    const time = row.cells[0].textContent;  // Get the time from the table row
    const seat = row.cells[1].textContent;  // Get the seat number from the table row
    const statusCell = row.cells[2];  // The cell where the status will be displayed

    const seatKey = `${seat}-${time}`;
    const isReserved = seatMap[seatKey];

    if (isReserved !== undefined) {
      // Update status based on reserved, available, or expired
      if (isReserved) {
        statusCell.textContent = "Reserved";
        statusCell.classList.add("text-danger");
        statusCell.classList.remove("text-success", "text-muted");  // Removing other styles
      } else {
        statusCell.textContent = "Available";
        statusCell.classList.add("text-success");
        statusCell.classList.remove("text-danger", "text-muted");  // Removing other styles
      }
    } else {
      // If the status is not reserved or available, mark it as expired
      statusCell.textContent = "Expired";
      statusCell.classList.add("text-muted");
      statusCell.classList.remove("text-danger", "text-success");  // Removing other styles
    }
  });
}

  // Start the auto-update every 3 seconds
  setInterval(update, 3000);
  renderSelectedSeatsTable();

  confirmButton.addEventListener("click", async function () {
    const selectedSeats = cartSeats;

    if (Object.keys(selectedSeats).length === 0) {
      alert("Please select at least one seat.");
      return;
    }

    const confirmation = confirm("Are you sure you want to confirm the reservation?");
    if (!confirmation) return;

    try {
      const labName = window.location.pathname.split("/")[3];
      const bookingDate = bookingDateInput.value;
      const selectedTime = bookingTime.value;


      // Call your API or backend to save the reservation data
      const response = await fetch(`/reservation/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labId: labName,
          date: bookingDate,
          selections: selectedSeats, // Send the entire cart data (time and seats)
        }),
      });

      if (!response.ok) {
        throw new Error("Reservation failed. Please try again.");
      }

      const result = await response.json();
      alert(result.message || "Reservation confirmed successfully!");

      // Clear the local storage and reset the cart
      localStorage.removeItem("cartSeats");
      cartSeats = {};
      renderSelectedSeatsTable();
    } catch (err) {
      console.error("Reservation error:", err);
      alert("An error occurred while confirming the reservation.");
    }
  });



});