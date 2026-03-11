const bookingForm = document.getElementById('bookingForm');
const bookingDate = document.getElementById('bookingDate');
const bookingTime = document.getElementById('bookingTime');
const labName = document.getElementById('labName');

sessionStorage.clear();
// Submit form when any filter changes
[bookingDate, bookingTime, labName].forEach(element => {
  element.addEventListener('change', () => {
    bookingForm.submit();
  });
});