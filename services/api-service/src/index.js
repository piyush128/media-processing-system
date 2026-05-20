import 'dotenv/config';
import express from 'express';
import { connectDB } from './config/db.js';
import { getPresignedUrl, getUserMedia, confirmUpload, startMultipartUpload, getPartUrl, completeMultipartUpload, searchMedia } from './routes/upload.js';
import { connectProducer } from './kafka/producer.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.post('/upload/presigned-url', getPresignedUrl);
app.get('/media/search', searchMedia);
app.get('/media/:userId', getUserMedia);
app.post('/upload/confirm', confirmUpload);
app.post('/upload/multipart/start', startMultipartUpload);
app.post('/upload/multipart/part-url', getPartUrl);
app.post('/upload/multipart/complete', completeMultipartUpload);

async function startServer() {
    try {
        await connectDB();
        await connectProducer();
        app.listen(PORT, () => {
            console.log(`API Service running on port ${PORT}`);
        })
    } catch (error) {
        console.log('Error in starting server: ', error);
        process.exit(1);
    }
}

startServer();
