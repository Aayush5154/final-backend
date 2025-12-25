//API error sirf ek structure h error krsa dikhega user ko 
//error kis tarah se jaa rahe h use design kar sakte hain
// ek sahuliyat ke liye file bane li h ki aage jake agr errors aayenge to ese aayenge 
class ApiError extends Error {
  // ApiError = Error + extra backend details
  constructor(// jab bhi ham object banaega to constructor call hoga 
    // ye sab ek tarah se argument h e.g -> constructor(statusCode, message, error...)
     statusCode,
     message = "Something went wrong",
     errors = [],
     stack = ""   //Error kis jagah aayi, uska trace
  ){// now we will override this
    super(message)
    this.statusCode = statusCode
    this.data = null 
    this.message = message
    this.success = false
    this.errors = errors

    if (stack) {
        //properly jo bhi bhi backend likh rha h usko exact trace ho jaye ki yaha yaha ye error aa rahi hain
        this.stack = stack
    }else{
        Error.captureStackTrace(this, this.constructor) //debugging behaviour setup kar raha hai
    }

  }
}

export {ApiError}