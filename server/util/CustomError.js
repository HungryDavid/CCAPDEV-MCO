class CustomError extends Error {
  constructor(errorNumber, errorName, errorMessage) {
    super(errorMessage);
    this.errorNumber = errorNumber;  // Custom error number
    this.errorName = errorName;      // Custom error name
    this.errorMessage = errorMessage; // Custom error message
    this.name = errorName;           // Assign error name to the 'name' property
  }
}

module.exports = CustomError;
