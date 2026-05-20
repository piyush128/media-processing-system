
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'worker-service',
    brokers: [process.env.KAFKA_BROKER]
  });
  

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

export async function connectConsumer() {
    await consumer.connect();
}

export async function consumeEvents(callback) {
    await consumer.subscribe({
        topic: 'media.uploaded',
        fromBeginning: true
    })
    await consumer.run({
        eachMessage: async ({ message }) => {
        const data = JSON.parse(message.value.toString());
        await callback(data);
        }
    });
}
