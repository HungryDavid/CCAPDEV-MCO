document.addEventListener("DOMContentLoaded", function () {

  const bookingTimeElement = document.getElementById("bookingTime");
  const bookingDateElement = document.getElementById("bookingDate");
  const labElement = document.getElementById("labName");
  const reservationIdElement = document.getElementById("reservationId");

  const timeForm = document.getElementById("timeSelectForm");
  const confirmButton = document.getElementById("confirmReservationBtn");
  const updateButton = document.getElementById("updateButton");
  const seatButtons = document.querySelectorAll(".seat-btn");

  const bookingDate = bookingDateElement?.value;
  let bookingTime = bookingTimeElement?.value;
  let selectedLab = labElement?.value;
  const reservationId = reservationIdElement?.value; // safe access, even if element is missing

  const cartInput = document.getElementById("cartSessionInput");
  if (cartInput && cartInput.value) {
    try {
      const cartData = JSON.parse(cartInput.value); // parse server JSON
      sessionStorage.setItem("labCart", JSON.stringify(cartData)); // overwrite existing cart
      console.log("Cart restored/overwritten from server:", cartData);
    } catch (e) {
      console.error("Invalid cart data in cartSessionInput:", e);
    }
  } else {
    console.log("No cart data from server; using existing sessionStorage cart if any.");
  }

  renderSelectedSeats();

  let labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};

  seatButtons.forEach(button => {
    button.addEventListener('click', function (event) {
      event.preventDefault();  // <-- prevent form submission
      const seatNumber = button.dataset.seat;
      bookingTime = bookingTimeElement.value;

      labCart[bookingTime] = { seatNumber, status: 'Checking...' };
      sessionStorage.setItem("labCart", JSON.stringify(labCart));
      renderSelectedSeats();
      alert(`Seat ${seatNumber} has been added/updated for the time slot ${bookingTime}.`);
    });
  });

function renderSelectedSeats() {
  const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
  const tableBody = document.getElementById("selectedSeatsTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const now = new Date();
  const selectedDate = bookingDateElement?.value;

  for (const bookingTime in labCart) {
    if (labCart.hasOwnProperty(bookingTime)) {
      const row = document.createElement("tr");

      const timeCell = document.createElement("td");
      timeCell.textContent = bookingTime;

      const seatCell = document.createElement("td");
      seatCell.textContent = labCart[bookingTime].seatNumber;

      const statusCell = document.createElement("td");
      const status = labCart[bookingTime].status;
      statusCell.textContent = status;
      statusCell.style.color =
        status === "reserved"
          ? "red"
          : status === "available"
          ? "green"
          : "gray";

      const actionCell = document.createElement("td");

      // Combine selected date and slot time
      const slotDateTime = new Date(`${selectedDate}T${bookingTime}`);

      // Only allow delete if slot time is in the future
      if (slotDateTime > now) {
        const deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-danger");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
          deleteSeat(bookingTime);
        });
        actionCell.appendChild(deleteButton);
      }

      row.appendChild(timeCell);
      row.appendChild(seatCell);
      row.appendChild(statusCell);
      row.appendChild(actionCell);

      tableBody.appendChild(row);
    }
  }
}

  function deleteSeat(bookingTime) {
    let labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    delete labCart[bookingTime];
    sessionStorage.setItem("labCart", JSON.stringify(labCart));
    renderSelectedSeats();
  }

  if (bookingTimeElement && timeForm) {
    bookingTimeElement.addEventListener("change", update);
  }

  async function update() {
    if (!selectedLab || !bookingTimeElement || !bookingDateElement) return;

    const bookingTime = bookingTimeElement.value;
    const bookingDate = bookingDateElement.value;

    try {
      const response = await fetch(`/labs/${encodeURIComponent(selectedLab)}/availability?bookingDate=${bookingDate}&bookingTime=${bookingTime}`);
      if (!response.ok) throw new Error(`Failed to fetch data. Status: ${response.status}`);
      const seatStatus = await response.json();
      updateSeatButtons(seatStatus);
      const fetchedData = await fetchCartStatus();
      updateSessionStorage(fetchedData);
      renderSelectedSeats();
    } catch (err) {
      console.error("Seat availability error:", err);
    }
  }

  function updateSeatButtons(seatStatus) {
    if (!bookingTimeElement) return;
    const bookingTime = bookingTimeElement.value;

    seatStatus.forEach(seat => {
      const seatButton = document.querySelector(`[data-seat="${seat.seatNumber}"][data-booking-time="${bookingTime}"]`);
      if (!seatButton) return;

      if (seat.status === "reserved") {
        seatButton.classList.remove("btn-outline-primary");
        seatButton.classList.add("btn-outline-danger");
        seatButton.disabled = true;
        seatButton.title = seat.user?.name || "Unknown";
        seatButton.textContent = seat.user?.name || "Unknown";
      } else if (seat.status === "available") {
        seatButton.classList.remove("btn-outline-danger");
        seatButton.classList.add("btn-outline-primary");
        seatButton.disabled = false;
        seatButton.title = "Available";
        seatButton.textContent = seat.seatNumber;
      }
    });
  }

  async function fetchCartStatus() {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    if (Object.keys(labCart).length === 0) return {};

    try {
      const response = await fetch("/reservation/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedLab, selectedDate: bookingDateElement?.value, labCart }),
      });
      if (!response.ok) throw new Error(`Failed to fetch cart status. Status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Error checking cart status:", error);
      return {};
    }
  }

  function updateSessionStorage(fetchedData) {
    let labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    for (const bookingTime in labCart) {
      if (labCart[bookingTime]) {
        labCart[bookingTime].status = fetchedData[bookingTime]?.status;
      }
    }
    sessionStorage.setItem("labCart", JSON.stringify(labCart));
    renderSelectedSeats();
  }

  // Make confirm button safe
  confirmButton?.addEventListener("click", async function () {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    if (Object.keys(labCart).length === 0) return;

    const confirmation = confirm("Are you sure you want to confirm the reservation?");
    if (!confirmation) return;

    try {
      const response = await fetch(`/reservation/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId, selectedLab, selectedDate: bookingDateElement?.value, labCart }),
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.message);
        return;
      }

      alert(result.message || "Reservation confirmed successfully!");
      sessionStorage.removeItem("labCart");
      renderSelectedSeats();
    } catch (err) {
      alert(err);
    }
  });

  updateButton?.addEventListener("click", async function () {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    if (Object.keys(labCart).length === 0) {
      alert("No seats selected to update.");
      return;
    }

    const confirmation = confirm("Are you sure you want to update your reservation?");
    if (!confirmation) return;

    try {
      const response = await fetch(`/reservation/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          selectedLab,
          selectedDate: bookingDateElement?.value,
          sessionCart: labCart   // ✅ fix
        }),
      });

      let result;

      try {
        result = await response.json();
      } catch {
        const text = await response.text();
        result = { message: text };
      }

      if (!response.ok) {
        alert(result.message || "Failed to update reservation.");
        return;
      }

      alert(result.message || "Reservation updated successfully!");
      sessionStorage.removeItem("labCart");
      renderSelectedSeats();

    } catch (err) {
      console.error(err);
      alert("Error updating reservation. Please try again.");
    }
  });


  setInterval(update, 2000);
  renderSelectedSeats();

});