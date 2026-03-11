document.addEventListener("DOMContentLoaded", function () {

  const bookingTime = document.getElementById("bookingTime");
  const bookingDateInput = document.getElementById("bookingDate");
  const timeForm = document.getElementById("timeSelectForm");
  const selectedTime = bookingTime.value;

  const addToCartBtn = document.getElementById("cart");

  const selectedSeatsTableContainer = document.getElementById("selectedSeatsTableContainer");
  const selectedSeatsTableBody = document.getElementById("selectedSeatsTableBody");
  const confirmButton = document.getElementById("confirmReservationBtn");

  const seatButtons = document.querySelectorAll(".seat-btn");
  const selectedSeatsByTime = {};

  let slotsInCart = JSON.parse(sessionStorage.getItem("labCart")) || {};


  if (window.initialCart) {
    slotsInCart = window.initialCart;
    sessionStorage.setItem("labCart", JSON.stringify(slotsInCart));
  }

  function updateSeatHighlights(selectedTime) {
    seatButtons.forEach(btn => {
      const seat = btn.dataset.seat;
      if (selectedSeatsByTime[selectedTime] === seat) {
        btn.classList.add("btn-primary");
        btn.classList.remove("btn-outline-primary");
      } else {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-outline-primary");
      }
    });
  }

  // Handle seat button clicks
  seatButtons.forEach(button => {
    button.addEventListener("click", function () {
      if (this.disabled) return;

      const seat = this.dataset.seat;
      const selectedTime = bookingTime.value;

      // Initialize slot if it doesn't exist
      if (!selectedSeatsByTime[selectedTime]) selectedSeatsByTime[selectedTime] = null;

      // Deselect if clicked again
      if (selectedSeatsByTime[selectedTime] === seat) {
        selectedSeatsByTime[selectedTime] = null;
      } else {
        // Select new seat
        selectedSeatsByTime[selectedTime] = seat;
      }

      // Update button highlights for this time slot
      updateSeatHighlights(selectedTime);

      console.log("Selected seats for current session:", selectedSeatsByTime);
    });
  });

  // Update highlights whenever dropdown changes
  bookingTime.addEventListener("change", () => {
    const selectedTime = bookingTime.value;
    updateSeatHighlights(selectedTime);
  });

  // Handle Add to Cart button click
  addToCartBtn.addEventListener("click", () => {
    const cart = JSON.parse(sessionStorage.getItem("labCart")) || {};

    for (const [time, seat] of Object.entries(selectedSeatsByTime)) {
      if (!seat) continue;
      cart[time] = [seat]; // overwrite previous seat for this time slot
    }

    sessionStorage.setItem("labCart", JSON.stringify(cart));
    alert("Seat(s) added to cart!");

    // Reset selection for next pick
    for (const time in selectedSeatsByTime) selectedSeatsByTime[time] = null;

    const currentTime = bookingTime.value;
    updateSeatHighlights(currentTime);
    renderCartTable();
  });


  /* =========================
     TIME CHANGE
  ========================= */
  if (bookingTime && timeForm) {
    bookingTime.addEventListener("change", function () {
      const cartDataInput = document.getElementById("cartDataInput");
      cartDataInput.value = JSON.stringify(slotsInCart); // send cart to server
      timeForm.submit();
    });
  }


  // Render the cart table
  function renderCartTable() {
    slotsInCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    selectedSeatsTableBody.innerHTML = "";

    // Hide table if empty
    if (Object.keys(slotsInCart).length === 0) {
      selectedSeatsTableContainer.style.display = "none";
      return;
    }

    selectedSeatsTableContainer.style.display = "block";

    for (const [time, seats] of Object.entries(slotsInCart)) {
      seats.forEach(seat => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${time}</td>
        <td>${seat}</td>
        <td class="status-cell">Checking...</td>
        <td>
          <button class="btn btn-danger btn-sm delete-seat" data-time="${time}" data-seat="${seat}">Delete</button>
        </td>
      `;

        selectedSeatsTableBody.appendChild(row);
      });
    }
  }


  //Get Time and Seat of Delete Button
  selectedSeatsTableBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-seat")) {
      const time = e.target.dataset.time;
      const seat = e.target.dataset.seat;
      deleteSeatFromSelection(time, seat);
    }
  });

  // Delete a seat from cart
  function deleteSeatFromSelection(time, seat) {
    if (slotsInCart[time]) {
      slotsInCart[time] = slotsInCart[time].filter(s => s !== seat);
      if (slotsInCart[time].length === 0) delete slotsInCart[time];
    }

    sessionStorage.setItem("labCart", JSON.stringify(slotsInCart));
    renderCartTable();
  }


  function updateTableStatus(seatStatus) {
    const rows = selectedSeatsTableBody.querySelectorAll("tr");

    rows.forEach(row => {
      const seat = parseInt(row.children[1].textContent); // seat number
      const statusCell = row.querySelector(".status-cell");

      // Find seat info from the latest status
      const seatInfo = seatStatus.find(s => parseInt(s.seatNumber) === seat);
      console.log("Seat INfo" + seatInfo);

      if (seatInfo) {
        const status = seatInfo.status;
        statusCell.textContent = status;

        // Reset classes first
        statusCell.classList.remove("text-success", "text-danger", "text-warning");

        // Apply color based on status
        if (status === "available") {
          statusCell.classList.add("text-success"); // green
        } else if (status === "reserved") {
          statusCell.classList.add("text-danger"); // red
        } else {
          statusCell.classList.add("text-warning"); // yellow/orange for other statuses
        }
      } else {
        statusCell.textContent = "Unknown";
        statusCell.classList.remove("text-success", "text-danger");
        statusCell.classList.add("text-warning");
      }
    });
  }


  setInterval(update, 3000);
  /* =========================
     AJAX AUTO UPDATE
  ========================= */
  async function update() {
    console.log("Updating seat status...");
    const labName = window.location.pathname.split("/")[3];
    const bookingDate = bookingDateInput.value;

    try {
      // Fetch the available seats from the server
      const response = await fetch(`/labs/${labName}/availability?bookingDate=${bookingDate}`);

      // Check if the response is successful (status 200)
      if (!response.ok) {
        throw new Error(`Failed to fetch data. Status: ${response.status}`);
      }


      const seatStatus = await response.json();
      console.log("Fetched Seats Data:", seatStatus);  // Log the response to verify its content

      // Update the table status based on the fetched data
      updateTableStatus(seatStatus);
    } catch (err) {
      console.error("Seat availability error:", err);
    }
  }

  /* =========================
     UPDATE TABLE STATUS
  ========================= */


  // Start the auto-update every 3 seconds


  confirmButton.addEventListener("click", async function () {
    const selectedSeats = slotsInCart;

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
          labName: labName,
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
      sessionStorage.removeItem("labCart");
      renderCartTable();
    } catch (err) {
      console.error("Reservation error:", err);
      alert("An error occurred while confirming the reservation.");
    }
  });

  renderCartTable();

});