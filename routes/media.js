const express = require('express');
const router = express.Router();

const Queue = require('bee-queue');
const queue = new Queue('ytdl');

/* GET users listing. */
router.get('/:id', function(req, res, next) {
  const ytId = req.params.id;
  const job = queue.createJob({
    audioQuality: 251,
    videoQuality: 248
  }).setId(ytId);

  job.on('succeeded', function (result) {
    console.log('completed job ' + job.id);
    res.send('output: ' + result);
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

  job.save(function (err, job) {
    if (err) {
      console.log('job failed to save');
      return res.send('job failed to save');
    }
    console.log('saved job ' + job.id);
  });
});

module.exports = router;
