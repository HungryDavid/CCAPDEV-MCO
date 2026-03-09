document.addEventListener("DOMContentLoaded", function () {

  const timeSelect = document.getElementById("timeSelect");
  const timeForm = document.getElementById("timeSelectForm");

  const seatButtons = document.querySelectorAll(".seat-btn");
  const openCartBtn = document.getElementById("openCartBtn");
  const totalSelected = document.getElementById("totalSelected");

  const selectedSeatsTableContainer = document.getElementById("selectedSeatsTableContainer");
  const selectedSeatsTableBody = document.getElementById("selectedSeatsTableBody");

  const confirmButton = document.getElementById("confirmReservationBtn");

  let selectedSeatsByTime = {};
  let cartSeats = JSON.parse(localStorage.getItem("cartSeats")) || {};

  const selectedTime = "{{selectedTime}}";

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

  if (timeSelect && timeForm) {
    timeSelect.addEventListener("change", function () {
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

        selectedSeatsByTime[time] = [seat];

        this.classList.remove("btn-outline-primary");
        this.classList.add("btn-primary");
      }

      updateCartUI();
    });

  });

  /* =========================
     ADD TO CART
  ========================= */

  openCartBtn.addEventListener("click", function () {

    for (const [time, seats] of Object.entries(selectedSeatsByTime)) {
      cartSeats[time] = [...seats];
    }

    localStorage.setItem("cartSeats", JSON.stringify(cartSeats));

    renderSelectedSeatsTable();

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
    updateCartUI();
  }

  /* =========================
     CART COUNT
  ========================= */

  function updateCartUI() {

    const total = Object.values(cartSeats)
      .reduce((acc, seats) => acc + seats.length, 0);

    totalSelected.textContent = `(${total})`;

  }

  /* =========================
     CONFIRM RESERVATION
  ========================= */

confirmButton?.addEventListener("click", async () => {
  try {
    const labId = window.location.pathname.split("/")[2];
    const date = document.querySelector("input[name='date']").value;

    // Build payload in format { time: [seats] }
    const selections = cartSeats; // { "14:30": [1,2], "15:00": [3] }

    if (Object.keys(selections).length === 0) {
      alert("No seats selected!");
      return;
    }

    // POST to /reservations/create
    const res = await fetch("/reservations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId, date, selections })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Reservation successful!");
      
      // Clear local cart
      cartSeats = {};
      localStorage.removeItem("cartSeats");
      selectedSeatsByTime = {};

      renderSelectedSeatsTable();
      updateCartUI();

      // Optionally refresh availability immediately
      checkSeatAvailability();
    } else {
      alert(data.error || "Failed to reserve seats");
    }

  } catch (err) {
    console.error(err);
    alert("Something went wrong!");
  }
});

  /* =========================
     AJAX AUTO UPDATE
  ========================= */

  setInterval(checkSeatAvailability, 3000);

  async function checkSeatAvailability() {

    try {

      const labId = window.location.pathname.split("/")[2];
      const date = document.querySelector("input[name='date']").value;

      const res = await fetch(`/slots-availability/${labId}/availability?date=${date}`);

      const reservedSeats = await res.json();

      updateTableStatus(reservedSeats);

    } catch (err) {

      console.error("Seat availability error:", err);

    }

  }

  /* =========================
     UPDATE TABLE STATUS
  ========================= */

  function updateTableStatus(reservedSeats) {

    Array.from(selectedSeatsTableBody.rows).forEach(row => {

      const time = row.cells[0].textContent;
      const seat = row.cells[1].textContent;
      const statusCell = row.cells[2];

      if (reservedSeats[time] && reservedSeats[time].includes(seat)) {

        statusCell.textContent = "Reserved";
        statusCell.classList.add("text-danger");

      } else {

        statusCell.textContent = "Available";
        statusCell.classList.remove("text-danger");

      }

    });

  }

  renderSelectedSeatsTable();
  updateCartUI();

});