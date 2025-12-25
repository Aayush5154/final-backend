// ApiResponse ek standard success response structure deta hai
// taaki frontend ko hamesha predictable response mile

class ApiResponse {
  constructor(
    statusCode,
    data,
    message = "Success"
  ) {
    this.statusCode = statusCode
    this.data = data
    this.message = message
    this.success = statusCode < 400

    Object.freeze(this) // 🔐 optional safety
  }
}

export { ApiResponse }
