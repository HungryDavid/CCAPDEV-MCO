class CustomError extends Error {
  constructor(errorNumber, errorName, errorMessage) {
    super(errorMessage);
    this.errorNumber = errorNumber; 
    this.errorName = errorName;     
    this.errorMessage = errorMessage; 
    this.name = errorName;           
  }
}

module.exports = CustomError;
