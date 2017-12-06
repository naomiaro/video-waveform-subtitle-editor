const express = require('express');
const path = require('path');
const Queue = require('bee-queue');

const router = express.Router();
const queue = new Queue('ytdl');
const VIDEO_ITAG = 43;

router.get('/', function(req, res, next) {
  res.render('media');
});

router.post('/', function(req, res, next) {
  const srtFile = req.files.srt;
  const ytid = req.body.ytid;
  const job = queue.createJob({
    videoItag: VIDEO_ITAG
  }).setId(ytid);

  console.log(srtFile.name);

  job.on('succeeded', function (result) {
    console.log('completed job ' + job.id);
    res.send(result);
  });

  job.on('retrying', (err) => {
    console.log(`Job ${job.id} failed with error ${err.message} but is being retried!`);
  });

  job.on('progress', (progress) => {
    console.log(`Job ${job.id} reported progress: ${progress}%`);
  });

  job.on('failed', (err) => {
    console.log(`Job ${job.id} failed with error ${err.message}`);
  });

  Promise.all([
    srtFile.mv(path.join(__dirname, '..', 'dist', `${ytid}.srt`)),
    job.save()
  ]).catch((err) => {
    console.log(`${err.message}`);
  });
});

module.exports = router;
