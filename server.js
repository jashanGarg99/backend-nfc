const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const shortid = require('shortid');


// Initialize the app
const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

//MongoDB connection
mongoose.connect('mongodb+srv://jashan9garg:eeEwlxHsIWP2bzU5@cluster0.j1qae.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

// User creation 
const userSchema = new mongoose.Schema({
    name: String,
    id : { type: String, unique: true},
    url: String,
    qr_count : {type:Number, default:0},
    activation: Number,
  });
const user = mongoose.model('user', userSchema);
app.post('/add_new_user', async(req,res)=>{
    try{
        const { name , url , activation } = req.body;
        const uniqueId = shortid.generate();
        const newUser = new user({ name, id:uniqueId , url , activation, qr_count:0 });
        const saveUser  = await newUser.save();
        res.json({ success: true,userId : saveUser.id, uniqueId: saveUser._id });
    }
    catch(error){
        res.status(500).json({ success: false, message: error });
    }
});
// user creation end



// user updation
app.put('/update_user/:id', async (req, res) => {
  try {
      const userId = req.params.id;
      const { name, url, activation } = req.body;
      const updatedUser = await user.findOneAndUpdate(
          { id: userId },
          { name, url, activation },
          { new: true }
      );

      if (!updatedUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true, updatedUser });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
});
// user upation end



//QR id generation or QR linking
const qrSchema = new mongoose.Schema({
  qr_id : { type: String, unique: true},
  id : String,
});
const qr = mongoose.model('qr', qrSchema);
app.post('/add_new_qr', async(req,res)=>{
  try {
    const { id } = req.body;
    const existingUser = await user.findOne({ id });
    if (!existingUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    const uniqueId = shortid.generate();
    const newQr = new qr({qr_id:uniqueId,id});
    const saveQr = await newQr.save();
    await user.findOneAndUpdate(
      { id }, // Find the user by their ID
      { $inc: { qr_count: 1 } }, // Increment the qr_count by 1
      { new: true } // Return the updated document
  );
    res.json({ success: true, qr_id: saveQr.qr_id , uniqueId: saveQr._id });
  } 
  catch (error) {
    res.status(500).json({ success: false, message: error });
  }
});
//Qr id generation end




// Qr id updation
app.put('/update_qr/:idQr', async (req, res) => {
  try {
    const qrId = req.params.idQr;  // Extract QR ID from params
    const { id } = req.body;       // Extract user ID from body

    // Check if the user exists
    const existingUser = await user.findOne({ id });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find the QR record by QR ID
    const findQr = await qr.findOne({ qr_id: qrId });
    if (!findQr) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    // Decrease qr_count for the old user
    const oldUser = await user.findOneAndUpdate(
      { id: findQr.id },
      { $inc: { qr_count: -1 } },
      { new: true }
    );

    // Increase qr_count for the new user
    const newUser = await user.findOneAndUpdate(
      { id },
      { $inc: { qr_count: 1 } },
      { new: true }
    );

    // Update the QR code with the new user ID
    const updateQr = await qr.findOneAndUpdate(
      { qr_id: qrId },
      { id },
      { new: true }
    );

    // If QR update fails
    if (!updateQr) {
      return res.status(404).json({ success: false, message: 'QR not found' });
    }

    // Return success response with updated QR and new user's qr_count
    res.json({ success: true, updatedQr: updateQr, newQrCount: newUser.qr_count });
    
  } catch (error) {
    // Handle any errors that occur
    res.status(500).json({ success: false, message: error.message });
  }
});
// Qr id updation end




// get url 
app.get('/get_url/:qr_id', async (req, res) => {
  try {
    const qr_id = req.params.qr_id;

    // Find QR data by qr_id
    const qrData = await qr.findOne({ qr_id });
    if (!qrData) {
      return res.status(404).json({ success: false, message: 'QR not found' });
    }

    // Get the associated user by ID
    const userId = qrData.id;
    const userData = await user.findOne({ id: userId });
    if (!userData) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has a URL and activation status is 1 or 2
    if (userData.url && (userData.activation === 1 || userData.activation === 2)) {
      const formattedUrl = userData.url.startsWith('http://') || userData.url.startsWith('https://') 
        ? userData.url 
        : `http://${userData.url}`; // Add http:// if not present

      // Redirect to the user's URL
      return res.redirect(formattedUrl);
    } else {
      // If no URL or inactive user, return an error response
      return res.status(400).json({ success: false, message: 'URL not found or user not active' });
    }
  } catch (error) {
    // Internal Server Error for any unhandled errors
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});



// get url end



// Get data 
app.get('/user_data/:id',async(req,res)=>{
  const userID = req.params.id;
  const userData = await user.findOne({id:userID});
  if (!userData) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  const qrData = await qr.find({id:userID});
  if (!qrData || qrData.length === 0){
    return res.status(404).json({ success: false, userData, message: 'QR not linked' });
  }
  res.status(200).json({ success: true, userData , qrData });
});
// Get data end 



// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
