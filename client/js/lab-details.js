document.addEventListener("DOMContentLoaded", function () {

  const bookingTimeElement = document.getElementById("bookingTime");
  const bookingDateElement = document.getElementById("bookingDate");
  const labElement = document.getElementById("labName");
  const reservationIdElement = document.getElementById("reservationId");

  const timeForm = document.getElementById("timeSelectForm");
  const confirmButton = document.getElementById("confirmReservationBtn");
  const updateButton = document.getElementById("updateButton");
  const seatButtons = document.querySelectorAll(".seat-btn");
  const editButton = document.getElementById("editReservationBtn");

  const seatNumberInput = document.getElementById("seatNumber");
  const bookingDate = bookingDateElement?.value;
  let bookingTime = bookingTimeElement?.value;
  let selectedLab = labElement?.value;
  const reservationId = reservationIdElement?.value; 
  const isTechnician = document.getElementById("isTechnician").value === "true";

  const isAnonymousCheckbox = document.getElementById("isAnonymous");


  update();

  const cartInput = document.getElementById("cartSessionInput");
  if (cartInput && cartInput.value) {
    try {
      const cartData = JSON.parse(cartInput.value); 
      sessionStorage.setItem("labCart", JSON.stringify(cartData)); 
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
      event.preventDefault();

      const seatNumber = button.dataset.seat;
      bookingTime = bookingTimeElement.value;

      const studentIdNumber = button.dataset.studentId; 

      if (studentIdNumber) {
        window.location.href = `/user/search?q=${encodeURIComponent(studentIdNumber)}`;
        return; 
      }

      labCart[bookingTime] = { seatNumber, status: 'Checking...' };
      sessionStorage.setItem("labCart", JSON.stringify(labCart));
      renderSelectedSeats();
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
        if (reservationId) {

          if (isTechnician) {

            // Technician rule: allow delete only 10 minutes after slot time
            const slotPlus10 = new Date(slotDateTime.getTime() + 10 * 60000);

            if (now >= slotPlus10) {
              const deleteButton = document.createElement("button");
              deleteButton.classList.add("btn", "btn-danger");
              deleteButton.textContent = "Delete";
              deleteButton.addEventListener("click", function () {
                deleteSeat(bookingTime);
              });
              actionCell.appendChild(deleteButton);
            }

          } else {

            // Normal users: only if slot time is in the future
            if (slotDateTime > now) {
              const deleteButton = document.createElement("button");
              deleteButton.classList.add("btn", "btn-danger");
              deleteButton.textContent = "Delete";
              deleteButton.addEventListener("click", function () {
                deleteSeat(bookingTime);
              });
              actionCell.appendChild(deleteButton);
            }

          }

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

  bookingTimeElement?.addEventListener("change", () => {
    update();
  });

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
    seatStatus.forEach(seat => {

      const seatButton = document.querySelector(`[data-seat="${seat.seatNumber}"]`);
      seatButton.dataset.studentId = "";
      seatButton.textContent = seatButton.dataset.seat;
      seatButton.title = "Available";

      if (!seatButton) return;

      if (seat.status === "reserved" || (seat.status === "expired" && seat.user.name)) {
        seatButton.classList.remove("btn-outline-primary");
        seatButton.classList.add("btn-outline-danger");
        seatButton.dataset.studentId = seat.user.idNumber;
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
    let studentNumber;
    if (isTechnician) {
      studentNumber = prompt("Enter student ID:");
    }
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    if (Object.keys(labCart).length === 0) return;

    const confirmation = confirm("Are you sure you want to confirm the reservation?");
    if (!confirmation) return;

    try {
      const response = await fetch(`/reservation/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAnonymous: isAnonymousCheckbox.checked, studentNumber, reservationId, selectedLab, selectedDate: bookingDateElement?.value, labCart }),
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
          isAnonymous: isAnonymousCheckbox.checked,
          reservationId,
          selectedLab,
          selectedDate: bookingDateElement?.value,
          sessionCart: labCart
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

  editButton?.addEventListener("click", function () {
    let seatNumber = "";

    if (isTechnician) {
      seatNumber = prompt("Enter seat number to edit:")?.trim() || "";
    }

    if (!seatNumber) return alert("Seat number is required!");

    seatNumberInput.value = seatNumber;
    document.querySelector("#timeSelectForm").submit();
  });


  const deleteButton = document.getElementById("deleteReservationBtn");
  const deleteForm = document.getElementById("deleteReservationForm");
  const deleteSeatInput = document.getElementById("deleteSeatNumber");

  deleteButton?.addEventListener("click", function (e) {
    e.preventDefault(); // Prevent default form submission

    const seatNumber = prompt("Enter seat number to delete:")?.trim();
    if (!seatNumber) return alert("Seat number is required!");

    if (!confirm(`Are you sure you want to delete reservation for seat ${seatNumber}?`)) return;

    deleteSeatInput.value = seatNumber;

    deleteForm.submit();
  });

  setInterval(update, 2000);
  renderSelectedSeats();

});