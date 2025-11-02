import multer from "multer"

const storage = multer.diskStorage({
    destination : function(req, res, cb) {
        cb(null, "./public/temp")
    },
    filename : function (req, file, cb) {
        cb(null, file.originalname)
    }
})
// aves the file in ./public/temp/
// Adds a new property req.files with info about the uploaded files
// Adds text fields to req.body
export const upload = multer({
    storage,
})

// in js it will store like 
// req.body = {
//   fullname: "Reshu Vijay",
//   username: "reshu123",
//   email: "reshu@gmail.com",
//   password: "mypassword"
// }

// req.files = {
//   avatar: [
//     {
//       fieldname: 'avatar',
//       originalname: 'mypic.jpg',
//       path: 'public/temp/mypic.jpg',
//       ...
//     }
//   ],
//   coverImage: [
//     {
//       fieldname: 'coverImage',
//       originalname: 'cover.jpg',
//       path: 'public/temp/cover.jpg',
//       ...
//     }
//   ]
// }
