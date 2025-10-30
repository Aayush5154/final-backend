const asyncHandler = (requestHandler) => {(req, res, next) => {
        Promise.resolve(requestHandler(req, res,next)).catch((err) => next(err))
    }
}

// chapter 8 part 2
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
