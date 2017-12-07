const express = require('express');
const path = require('path');
const Queue = require('bee-queue');
const fs = require('fs');

const router = express.Router();
const queue = new Queue('ytdl', {
  redis: {
    host: 'redis',
    port: 6379
  }
});
const VIDEO_ITAG = 43;

router.post('/', function(req, res, next) {
  const srtFile = req.files.srt;
  const ytid = req.body.ytid;
  const audioPath = path.join(__dirname, '..', 'dist', `${ytid}.ogg`);

  fs.access(audioPath, fs.constants.R_OK, (err) => {
    if (err) {
      const job = queue.createJob({
        videoItag: VIDEO_ITAG
      }).setId(ytid);

      job.on('succeeded', function (result) {
        console.log('completed job ' + job.id);
        res.redirect(`/${ytid}`);
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
    } else {
      res.redirect(`/${ytid}`);
    }
  });
});

module.exports = router;
