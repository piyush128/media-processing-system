import 'dotenv/config';
import express from 'express';
import { connectDB } from './config/db.js';
import { getPresignedUrl, getUserMedia, confirmUpload } from './routes/upload.js';
import { connectProducer } from './kafka/producer.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.post('/upload/presigned-url', getPresignedUrl);
app.get('/media/:userId', getUserMedia);
app.post('/upload/confirm', confirmUpload);

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
