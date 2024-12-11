const express = require('express');
const axios = require('axios');
const { spawn } = require('child_process');

const app = express();

const NIJIVOICE_API_KEY = process.env.NIJIVOICE_API_KEY;

app.get('/speak', async (req, res) => {
  const actorId = req.query.actor;
  const text = req.query.text;

  if (!actorId || !text) {
    return res.status(400).send('actorとtextは必須です。例: /speak?actor=ACTOR_ID&text=こんにちは');
  }

  try {
    const response = await axios.post(
      `https://api.nijivoice.com/api/platform/v1/voice-actors/${encodeURIComponent(actorId)}/generate-voice`,
      {
        script: text,
        speed: "1.0",
        format: "wav"
      },
      {
        responseType: 'arraybuffer',
        headers: {
          'x-api-key': NIJIVOICE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    const wavBuffer = Buffer.from(response.data);

    const ffmpegPath = require('ffmpeg-static');
    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-f', 'ogg',
      '-acodec', 'libopus',
      'pipe:1'
    ]);
    

    ffmpeg.stdin.write(wavBuffer);
    ffmpeg.stdin.end();

    res.setHeader('Content-Type', 'audio/ogg');

    ffmpeg.stdout.on('data', (chunk) => {
      res.write(chunk);
    });

    ffmpeg.stdout.on('end', () => {
      res.end();
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error('ffmpeg stderr:', data.toString());
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg process exited with code ${code}`);
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('音声生成に失敗しました');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
