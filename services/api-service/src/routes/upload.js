import { PutObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { publishEvent } from '../kafka/producer.js';
import s3 from '../config/minio.js';
import { pool } from '../config/db.js';
import e from 'express';

export async function getPresignedUrl(req, res) {
    try {     
        const { fileName, fileType, userId } = req.body;
        if (!fileName || !fileType || !userId) {
            return res.status(400).json({ error: 'fileName, fileType, userId are required' });
          } 
        const fileKey = `${userId}-${Date.now()}-${fileName}`;
        const command = new PutObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: fileKey,
            ContentType: fileType,
          });      
        const url = await getSignedUrl(s3, command, { expiresIn: 900 });
        await pool.query(
            'INSERT INTO media_files (user_id, file_url) VALUES ($1, $2)',
            [userId, fileKey]
          );          
        return res.status(200).json({ presignedUrl: url, fileKey });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function getUserMedia(req, res) {
    try {     
        const { userId } = req.params;
        const result =  await pool.query(
            'select file_url from media_files where user_id = $1',
            [userId]
          );
        const files = result.rows.map(row => ({
            fileUrl: `${process.env.CDN_URL}/${process.env.MINIO_BUCKET}/${row.file_url}`
          }));
          return res.status(200).json({ files });          
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

export async function confirmUpload(req, res) {
    try {     
        const { userId, fileKey } = req.body;
        const file = await s3.send(new HeadObjectCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: fileKey
          }));
        await publishEvent('media.uploaded', {userId, fileKey});
        return res.status(200).json({ message: 'Upload confirmed', userId, fileKey });          
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}

export async function startMultipartUpload(req, res) {
    try {
        const {fileName, fileType, userId} = req.body;
        const fileKey = `${userId}-${Date.now()}-${fileName}`;
        
        const response = await s3.send(new CreateMultipartUploadCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: fileKey,
            ContentType: fileType
        }));
        const uploadId = response.UploadId;      
        return res.status(200).json({ uploadId, fileKey });
    } catch (error) {
        return res.status(500).json({ error: error.message});
    }
}

export async function getPartUrl(req, res) {
    try {
        const {uploadId, fileKey, partNumber} = req.body;
        
        const response = new UploadPartCommand({
            Bucket: process.env.MINIO_BUCKET,
            Key: fileKey,
            UploadId: uploadId,
            PartNumber: partNumber,
        });   
        const presignedUrl = await getSignedUrl(s3, response, { expiresIn: 900 });
        return res.status(200).json({ presignedUrl, partNumber });
    } catch (error) {
        return res.status(500).json({ error: error.message});
    }
}

export async function completeMultipartUpload(req, res) {
    try {
      const { uploadId, fileKey, parts } = req.body;
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      }));
      return res.status(200).json({ message: 'Upload complete', fileKey });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
  
