document.addEventListener("DOMContentLoaded", function () {

  const reservationId = document.getElementById('reservationId')?.value || null;
  const bookingTimeElement = document.getElementById("bookingTime");
  const bookingDateInput = document.getElementById("bookingDate");
  const labInput = document.getElementById("labNameInput");
  const timeForm = document.getElementById("timeSelectForm");
  let bookingTime = bookingTimeElement ? bookingTimeElement.value : '';
  let selectedLab = labInput ? labInput.value : '';


  const confirmButton = document.getElementById("confirmReservationBtn");

  const seatButtons = document.querySelectorAll(".seat-btn");

  let slotsInCart = {};

  if (reservationId && window.initialCart) {
    // Edit flow: initialize cart strictly from existing reservation seats
    for (const [time, seats] of Object.entries(window.initialCart)) {
      if (Array.isArray(seats) && seats.length > 0) {
        slotsInCart[time] = {
          seatNumber: String(seats[0]),
          status: 'selected'
        };
      }
    }
    sessionStorage.setItem("labCart", JSON.stringify(slotsInCart));
  } else {
    // Create flow or no initial data: merge existing cart with initial slots if provided
    slotsInCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    if (window.initialCart) {
      for (const [time, seats] of Object.entries(window.initialCart)) {
        if (!slotsInCart[time] && Array.isArray(seats) && seats.length > 0) {
          slotsInCart[time] = {
            seatNumber: String(seats[0]),
            status: 'selected'
          };
        }
      }
      sessionStorage.setItem("labCart", JSON.stringify(slotsInCart));
    }
  }

  console.log("Initial Cart", window.initialCart, "reservationId", reservationId);


  // ADD TO CART FUNCTION
  seatButtons.forEach(button => {
    button.addEventListener('click', function (event) {
      // Retrieve seat number and booking time from the button's data attributes
      const seatNumber = event.target.getAttribute('data-seat');
      const bookingTime = event.target.getAttribute('data-booking-time');

      // Get the existing cart from sessionStorage or initialize as an empty object
      let labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};

      // Overwrite the seat for the selected time slot (even if it's already booked)
      labCart[bookingTime] = {
        seatNumber: seatNumber,
        status: 'Checking...'
      };

      // Save the updated cart back to sessionStorage
      sessionStorage.setItem("labCart", JSON.stringify(labCart));
      renderSelectedSeats();
      // Provide feedback to the user
      alert(`Seat ${seatNumber} has been added/updated for the time slot ${bookingTime}.`);

    });
  });


  function renderSelectedSeats() {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    const tableBody = document.getElementById("selectedSeatsTableBody");

    // Clear the existing table rows
    tableBody.innerHTML = "";

    // Loop through each entry in the labCart and add a row to the table
    for (const bookingTime in labCart) {
      if (labCart.hasOwnProperty(bookingTime)) {
        const seatNumber = labCart[bookingTime];

        // Create a new row
        const row = document.createElement("tr");

        // Create the cells for the row
        const timeCell = document.createElement("td");
        timeCell.textContent = bookingTime;

        const seatCell = document.createElement("td");
        seatCell.textContent = labCart[bookingTime].seatNumber;

        const statusCell = document.createElement("td");
        const status = labCart[bookingTime].status;
        if (status === "reserved") {
          statusCell.textContent = status;
          statusCell.style.color = "red";           // White text on green
        } else if (status === "available") {
          statusCell.textContent = status;
          statusCell.style.color = "green";           // White text on red
        } else {
          statusCell.textContent = status;
          statusCell.style.color = "gray";           // White text on gray
        }

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-danger");
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function () {
          deleteSeat(bookingTime); // Call the delete function for this time slot
        });

        // Append the delete button to the action cell
        actionCell.appendChild(deleteButton);

        // Append the cells to the row
        row.appendChild(timeCell);
        row.appendChild(seatCell);
        row.appendChild(statusCell);
        row.appendChild(actionCell);

        // Append the row to the table body
        tableBody.appendChild(row);
      }
    }
  }

  // Function to delete a seat from the cart
  function deleteSeat(bookingTime) {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    delete labCart[bookingTime]; // Remove the seat for the selected time slot
    sessionStorage.setItem("labCart", JSON.stringify(labCart)); // Save the updated cart back to sessionStorage
    renderSelectedSeats(); // Re-render the table after deletion
  }

  /* =========================
     TIME CHANGE
  ========================= */
  if (bookingTimeElement && timeForm) {
    bookingTimeElement.addEventListener("change", function () {
      const cartDataInput = document.getElementById("cartDataInput");
      cartDataInput.value = JSON.stringify(slotsInCart); // send cart to server
      timeForm.submit();
    });
  }


  /* =========================
     AJAX AUTO UPDATE
  ========================= */
  async function update() {
    // Get labName from hidden input
    const labNameInput = document.getElementById("labNameInput");
    const labName = labNameInput ? labNameInput.value : "";
    const bookingDate = bookingDateInput.value;
    const bookingTime = bookingTimeElement.value;

    if (!labName) {
      return;
    }

    try {
      // Fetch the available seats from the server
      const response = await fetch(`/labs/${encodeURIComponent(labName)}/availability?bookingDate=${bookingDate}&bookingTime=${bookingTime}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch data. Status: ${response.status}`);
      }

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
    // Own reservation seat map for edit mode to avoid disabling owned seats
    const ownSeatMap = {};
    if (reservationId && window.initialCart) {
      Object.entries(window.initialCart).forEach(([time, seats]) => {
        if (Array.isArray(seats)) {
          seats.forEach(seat => {
            ownSeatMap[`${time}|${seat}`] = true;
          });
        }
      });
    }

    // Loop through each seat status returned from the server
    seatStatus.forEach(seat => {
      // Find the button for the seat based on seat number and booking time
      const seatButton = document.querySelector(`[data-seat="${seat.seatNumber}"][data-booking-time="${bookingTime}"]`);

      // Check if the button is found
      if (seatButton) {
        const isOwnSeat = ownSeatMap[`${bookingTime}|${seat.seatNumber}`];

        if (isOwnSeat) {
          seatButton.classList.remove("btn-outline-danger", "btn-outline-primary");
          seatButton.classList.add("btn-success");
          seatButton.disabled = false;
          seatButton.title = "Selected (your reservation)";
          seatButton.textContent = seat.seatNumber;
          return;
        }

        // Update the seat button based on the status from the server
        if (seat.status === "reserved") {
          seatButton.classList.remove("btn-outline-primary");
          seatButton.classList.add("btn-outline-danger"); // Reserved status (red)
          seatButton.disabled = true; // Disable button if reserved
          seatButton.title = `${seat.user.name || "Unknown"}`; // Show user info if available
          seatButton.textContent = `${seat.user.name || "Unknown"}`;
        } else if (seat.status === "available") {
          seatButton.classList.remove("btn-outline-danger", "btn-success");
          seatButton.classList.add("btn-outline-primary"); // Available status (blue)
          seatButton.disabled = false; // Enable button if available
          seatButton.title = "Available"; // Available seat
          seatButton.textContent = seat.seatNumber; // Show seat number for available seats
        }
      } else {
        // Log an error if the button is not found
        console.error("Button not found for seat:", seat.seatNumber, "Booking Time:", bookingTime);
      }
    });
  }

  async function fetchCartStatus() {
    // Retrieve the cart from sessionStorage
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};

    // If the cart is empty, exit the function
    if (Object.keys(labCart).length === 0) {
      console.log("Cart is empty.");
      return {};
    }

    try {
      // Prepare the request body
      const requestBody = {
        selectedLab,               // Assuming selectedLab is already available in scope
        selectedDate: bookingDateInput.value,  // Assuming bookingDateInput is the date input element
        labCart,                   // Include the full cart (optional if you need it)
      };

      // Send the request to the server
      const response = await fetch("/reservation/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // If the response is not ok, throw an error
      if (!response.ok) {
        throw new Error(`Failed to fetch cart status. Status: ${response.status}`);
      }

      // Parse the server's response
      const statusResponse = await response.json();
      return statusResponse;  // Return the status data for further use
    } catch (error) {
      console.error("Error checking cart status:", error);
      return {};  // Return an empty object if there's an error
    }
  }

  function updateSessionStorage(fetchedData) {
    // 1. Retrieve existing data from sessionStorage (or initialize as empty object if not available)
    let labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};
    // 2. Loop through the fetched data and check if the time matches with the sessionStorage
    for (const bookingTime in labCart) {
      if (labCart[bookingTime]) {  // Check if the booking time exists in labCart
        // If it matches, update the status
        labCart[bookingTime].status = fetchedData[bookingTime]?.status;  // Update status to "reserved"
      } 
    }


    // 3. Save the updated labCart back to sessionStorage
    sessionStorage.setItem("labCart", JSON.stringify(labCart));

    // 4. Re-render the table (or UI) to reflect the updated status
    renderSelectedSeats();
  }

  confirmButton.addEventListener("click", async function () {
    const labCart = JSON.parse(sessionStorage.getItem("labCart")) || {};

    // If the cart is empty, exit the function
    if (Object.keys(labCart).length === 0) {
      console.log("Cart is empty.");
      return {};
    }

    const confirmation = confirm("Are you sure you want to confirm the reservation?");
    if (!confirmation) return;

    const endpoint = reservationId ? "/reservation/edit" : "/reservation/create";

    // Prepare payload based on mode
    let requestBody;

    if (reservationId) {
      const times = Object.keys(labCart);
      const firstTime = times[0];
      const firstSeat = firstTime ? labCart[firstTime]?.seatNumber : null;
      requestBody = {
        id: reservationId,
        laboratory: selectedLab,
        date: bookingDateInput.value,
      };

      if (times.length > 0) {
        requestBody.time = times.join(",");
      }

      if (firstSeat !== null && firstSeat !== undefined) {
        requestBody.seat = String(firstSeat);
      }
    } else {
      const walkInInput = document.getElementById("walkInStudent");
      const walkInStudent = walkInInput ? walkInInput.value : null;
      requestBody = {
        selectedLab,
        selectedDate: bookingDateInput.value,
        labCart,
        walkInStudent
      };
    }

    try {
      // Call your API or backend to save the reservation data
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (!response.ok) {
        // This will alert: "Conflict: You have already reserved... (409)"
        alert(result.message);
        return; // Stop execution here
      }

      // 2. If response was successful (200 OK)
      alert(result.message || (reservationId ? "Reservation updated successfully!" : "Reservation confirmed successfully!"));

      // Post-Update Cleanup: clear cart and redirect to history
      sessionStorage.removeItem("labCart");
      renderSelectedSeats();
      window.location.href = "/reservation";
    } catch (err) {
      alert(err);
    }
  });

  setInterval(update, 2000);
  renderSelectedSeats();

});