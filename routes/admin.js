var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('admin/login');
});

router.get('/dashboard',(req,res)=>{
  res.render('admin/dashboard')
})

module.exports = router;
