const { response } = require('express');
var express = require('express');
const { Db } = require('mongodb');
const { doLogin } = require('../helpers/owner-helpers');
const ownerHelpers = require('../helpers/owner-helpers');
var router = express.Router();
var objectId = require('mongodb').ObjectID
var paypal = require('paypal-rest-sdk');
const mapboxgl = require('mapbox-gl');
var userHelpers = require('../helpers/user-helpers')
var serviceid = "VA3543a1df020f68982834326968197063";
var accountSid = "AC81058b7974c9c9cd6ca7ca1c87863d61";  // Your Account SID from www.twilio.com/console 
var authToken = "58f66a5b8bce31f154b509897975f2b0"; // Your Auth Token from www.twilio.com/console

const client = require('twilio')(accountSid, authToken)


paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': 'Ac8sM23Byt944JvVNBaZpIpU16nhgK2Ytz5wbdFkllpvuMl3IK_0X4z5fnS7Uhv81AXe3ckkSilQJNl7',
  'client_secret': 'EASJHFNR6Vh9_syXp9M4KL66ORScvyY4z4vAA-9lbHn-3KPHU0exb8gR5B0RCOZz62GpBaOAS2C0Tf31'
});

const verifyLogin = (req, res, next) => {
  if (req.session.loggedIn) {
    next()
  } else {
    res.redirect('/login')
  }
}
/* GET users listing. */
router.get('/', async (req, res, next) => {
  let UpComingMoviesList = await userHelpers.getUpcomingMovie()
  userHelpers.getMovies().then((moviesList) => {
    
    res.render('user/index', { moviesList, UpComingMoviesList,"location":req.session.location, user: req.session.user })
  })

});


//user login

router.get('/signin', (req, res) => {

  res.render('user/signin', { "isUser": req.session.isUser })
  req.session.isUser = false
})

router.post('/getcode', (req, res) => {
  userHelpers.userAvailability(req.body.phonenumber).then((response) => {
    if (response.status) {
      client
        .verify
        .services(serviceid)
        .verifications
        .create({
          to: `+91${req.body.phonenumber}`,
          channel: "sms"
        }).then((data) => {
          res.render('user/verify', { "phone": req.body.phonenumber })
        })
    } else {
      req.session.isUser = "Phone Number alredy exist";
      res.redirect('/signin')
    }
  })

})


router.post('/verify/:phone', (req, res) => {
  console.log('sms');
  client
    .verify
    .services(serviceid)
    .verificationChecks
    .create({
      to: `+91${req.params.phone}`,
      code: req.body.code
    }).then((data) => {
      if (data.status == "approved") {
        res.render('user/login-details', { "phone": req.params.phone })
      } else {
        res.render('user/verify', { error: "invalid code", "phone": req.params.phone })
      }

    })
})

router.post('/singup', (req, res) => {
  userHelpers.signup(req.body,req.session.longitude,req.session.latitude).then((response) => {
    req.session.user = response
    req.session.loggedIn = true
    res.redirect('/')
  })
})

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//user login
router.get('/login', (req, res) => {
  res.render('user/login', { "userLoginError": req.session.userLoginError })
  req.session.userLoginError = false
})

router.post('/login', (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.userDetails = response.user;
      client
        .verify
        .services(serviceid)
        .verifications
        .create({
          to: `+91${req.body.phonenumber}`,
          channel: "sms"
        }).then((data) => {
          res.render('user/verify-login', { "phone": req.body.phonenumber })
        })
    } else {
      req.session.userLoginError = "Incorrect PhoneNumber or password ";
      res.redirect("/login");
    }
  })


})

router.post('/verify-login/:phone', (req, res) => {
  console.log(req.params.phone, req.body);
  client
    .verify
    .services(serviceid)
    .verificationChecks
    .create({
      to: `+91${req.params.phone}`,
      code: req.body.code
    }).then((data) => {
      if (data.status == "approved") {
        req.session.user = req.session.userDetails
        req.session.loggedIn = true;
        res.redirect('/')
      } else {
        req.session.user = false;
        req.session.loggedIn = false
        res.render('user/verify-login', { error: "invalid code", "phone": req.params.phone })
      }

    })
})

router.get('/details/:id', (req, res) => {
  userHelpers.viewDetails(req.params.id).then((movieDetails) => {
    console.log(movieDetails);
    res.render('user/view-details', { movieDetails ,user: req.session.user})
  })
})

router.get('/seat-layout/:screenId,:showId', verifyLogin, async (req, res) => {

  let screenDetails = await userHelpers.getScreenD(req.params.screenId)

  userHelpers.getBookedSeats(req.params.showId).then((showDeatils) => {
   
    res.render('user/seat-layout', { screenDetails, "showDeatils": showDeatils,user: req.session.user })
  })

})



router.get('/video-play', (req, res) => {
  res.render('user/video-play')
})

//pick time
router.get('/time/:movietitle', (req, res) => {
  userHelpers.getTime(req.params.movietitle).then((timeList) => {

    if (timeList) {
      console.log(timeList);
      timeList[0].longitude = req.session.longitude
      timeList[0].latitude = req.session.latitude

      res.render('user/pick-time', { data:true,timeList, movietitle: req.params.movietitle, user: req.session.user })
    }else{
      res.render('user/pick-time',{data:false, user: req.session.user })
    }
  })
})

//book seats
router.post('/book-seats/:showId', verifyLogin, async (req, res) => {
  let response = await userHelpers.getBookedSeat(req.params.showId, req.body)
  
  let details={}
  details.user=objectId(req.session.user._id)
  details.screen=objectId(response.show[0].screen._id)
  details.theater=objectId(response.show[0].theater._id)
  details.price=response.price
  details.seats=response.seatsDetails
  let addCheckout=await userHelpers.addCheckout(details,req.params.showId,req.session.user._id)
  
  
  let date=new Date()

  
  if (response.status) {
    console.log(response.price);
    res.render('user/checkout',{"price":response.price,user: req.session.user,"bookedseats":req.body,"showId":req.params.showId,"tickets":response.seatsDetails,date,"movie":response.show[0]})
  } else {
    console.log('err');
  }
})

//payment 
router.get('/payment',verifyLogin,async(req,res)=>{
  let cart= await userHelpers.getCart(req.session.user._id)
  res.render('user/payment',{cart,user: req.session.user})
})

//razorpay
router.post('/place-order',verifyLogin,async(req,res)=>{
  let cart = await userHelpers.getCart(req.session.user._id)
  userHelpers.placeOrder(req.session.user._id,cart).then((bookingId)=>{
    if(bookingId){
    userHelpers.generateRazorpay(bookingId,cart.price).then((response)=>{
      res.json(response)
    })
  }else{
    res.json(false)
  }
  })
})

//verifypayment
router.post('/verify-payment',verifyLogin,async(req,res)=>{
  let bookings=await userHelpers.getbookings(req.body['order[receipt]'])
  let insert = await userHelpers.insertBookedSeats(bookings.seats,bookings.showId)
  userHelpers.verifyPayment(req.body).then(()=>{
    userHelpers.chanePaymentStatus(req.body['order[receipt]'],req.session.user.email).then(()=>{
      res.json({status:true})
    })
  }).catch((err)=>{
    console.log(err);
    res.json({status:false,errMsg:''})
  })
})


//paypal 
router.post('/paypal',verifyLogin,async(req,res)=>{
  let cart = await userHelpers.getCart(req.session.user._id)
  const create_payment_json = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": "http://localhost:3000/",
        "cancel_url": "http://cancel.url"
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "item",
                "sku": "item",
                "price": ""+cart.price+"",
                "currency": "INR",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "INR",
            "total": ""+cart.price+"",
        },
        "description": "This is the payment description."
    }]
};

paypal.payment.create(create_payment_json, function (error, payment) {
  if (error) {
      throw error;
  } else {
    console.log(payment);
    for(let i=0; i< payment.links.length; i++){
      
      if(payment.links[i].rel === 'approval_url'){
      
        res.redirect(payment.links[i].href)

      }
    }
  }
});
 
})

router.get('/order-success',verifyLogin,(req,res)=>{
  res.render('user/order-success',{user:req.session.user._id})
})



//Popup map
router.post('/location',(req,res)=>{
  console.log(req.body,"hh");
  req.session.location=true
  req.session.longitude=req.body.longitude
  req.session.latitude=req.body.latitude
  res.json({status:true})
})

//user bookings
router.get('/my-bookings',verifyLogin,(req,res)=>{
  userHelpers.getAllBookings(req.session.user._id).then((allbookings)=>{
    res.render('user/my-bookings',{user:req.session.user,allbookings})
  })
  
})

//payment for pending orders

router.post('/pending-order',verifyLogin,(req,res)=>{
  userHelpers.getBookingDetails(req.body.orderId).then((response)=>{
    if(response){
      userHelpers.generateRazorpay(response._id,response.price).then((response)=>{
        res.json(response)
      })
    }else{
      res.json(false)
    }
  })
})

//all movies
router.get('/all-movies',(req,res)=>{
  userHelpers.getAllMovies().then((response)=>{
    res.render('user/all-movies',{response,user:req.session.user})
  })
 
})

//user Profile

router.get('/profile',verifyLogin,(req,res)=>{
  userHelpers.gerUserDetails(req.session.user._id).then((userdetails)=>{
    res.render('user/profile',{user:req.session.user,userdetails})
  })
 
})

router.get('/edit-photo',verifyLogin,(req,res)=>{
  res.render('user/update-photo',{user:req.session.user})
})

router.post('/changePhoto',verifyLogin,(req,res)=>{
  id=req.session.user._id
  if (req.files.Image) {
    let image = req.files.Image
    image.mv('./public/user-photo/' + id + '.jpg', (err) => {
        if (!err) {
            req.session.userImagesucc = "Photo Updated successfully"
            res.redirect('/profile')
        } else {
            req.session.userImgerror = "Something went wrong try again"
            res.redirect('/profile')
        }
    })

}
})

router.get('/edit-profile',verifyLogin,async(req,res)=>{
  let userdetails=await userHelpers.gerUserDetails(req.session.user._id)
 
  res.render('user/edit-profile',{userdetails,user:req.session.user})
})

router.post('/edit-profile',verifyLogin,(req,res)=>{
  userHelpers.editProfile(req.body,req.session.user._id).then((response)=>{
    if(response){
      res.redirect('/profile')
    }else{
      res.redirect('/profle')
    }
  })
})

//about page
router.get('/about',(req,res)=>{
  res.render('user/about',{user:req.session.user})
})

//settings page

router.get('/settings',verifyLogin,(req,res)=>{
  res.render('user/settings',{user:req.session.user,"longitude":req.session.longitude,"latitude":req.session.latitude})
})

//user change password
router.get('/change-password',verifyLogin,(req,res)=>{
  res.render('user/change-password',{user:req.session.user,"changePasswordSucc": req.session.changePasswordSucc, "changePasswordError": req.session.changePasswordError })
  req.session.changePasswordSucc = false
  req.session.changePasswordError = false
})

router.post('/change-password',(req,res)=>{
  console.log(req.body);
  userHelpers.changePassword(req.body,req.session.user._id).then((response)=>{
    if (response.status) {
      req.session.changePasswordSucc = "Password Updated Successfully"
      res.redirect('/change-password')
  } else {
      req.session.changePasswordError = response.message
      res.redirect('/change-password')
  }
  })
})

module.exports = router;
