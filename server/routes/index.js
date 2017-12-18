const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Video Subtitle Editor' });
});

router.get('/:ytid', function(req, res, next) {
  const ytid = req.params.ytid;
  const audioPath = path.join(__dirname, '..', '..', 'media', `${ytid}.ogg`);

  fs.access(audioPath, fs.constants.R_OK, (err) => {
    if (err) {
      res.redirect('/');
    } else {
      res.render('workspace', { ytid });
    }
  });
});

module.exports = router;
