//Async route ke andar aane wale kisi bhi error ko pakad kar Express ke global error middleware tak pahunchana. 
//finally baar baar try catch me wrap nahi karna padega.
const asyncHandler = (requestHandler) => {return (req, res, next) => {
        Promise.resolve(requestHandler(req, res,next)).catch((err) => next(err))
    }
} // requesthandler likha ya fn ek hi baat h 
// bas ham promise retrun kar rahe h rather than putra execute karna ki jagah 

// chapter 8 part 
export {asyncHandler}

// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {} //  ek tarah se me ek function ke ander function daal raha hu inko higher order function function kehta h jo function as a input le sakte hain and response bhi de sakte hain 
// const asyncHandler = (func) => async() => {}

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         // we are basically creating the wrapper function
//        await fn(req, res, next)
//        } catch (error){
//         res.status(err.code || 500).json({
//             success : false,
//             message : err.message
//         })
//      }
// }// this is the try catch method 
