// import multer from "multer"
// // Multer browser se aayi files ko server par temporary store karta hai,
// // aur unka data req.body aur req.files me attach kar deta hai.
// const storage = multer.diskStorage({
//     destination : function(req, res, cb) {
//         cb(null, "../public/temp") 
//     },
//     filename : function (req, file, cb) {
//         cb(null, file.originalname)
//     }
// })
// // saves the file in ./public/temp/
// // Adds a new property req.files with info about the uploaded files
// // Adds text fields to req.body
// export const upload = multer({
//     storage,
// })
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(
      null,
      path.resolve(process.cwd(), "public/temp")
    );
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage });


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


// 3️⃣ Multer yahan kya karta hai? 🔧

// Multer middleman hai jo:

// ✔ Files ko temporary folder me save karta hai
// ✔ Text data ko req.body me daal deta hai
// ✔ File info ko req.files me daal deta hai