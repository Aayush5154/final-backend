//error kis tarah se jaa rahe h use design kar sakte hain
// ek sahuliyat ke liye file bane li h ki aage jake agr errors aayenge to ese aayenge 
class ApiError extends Error {
  constructor(
     statusCode,
     message = "Something went wrong",
     errors = [],
     stack = ""   
  ){// now we will override this
    super(message)
    this.statusCode = statusCode
    this.data = null 
    this.message = message
    this.success = false
    this.errors = this.errors

    if (stack) {
        //properly jo bhi bhi backend likh rha h usko exact trace ho jaye ki yaha yaha ye error aa rahi hain
        this.stack = stack
    }else{
        Error.captureStackTrace(this, this.constructor)
    }

  }
}

export {ApiError}