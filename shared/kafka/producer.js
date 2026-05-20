import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'media-service',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

let isConnected = false;

export async function connectProducer() {
    await producer.connect();
    isConnected = true;
}

export async function publishEvent(topic, message) {
    if(!isConnected){
        await producer.connect();
        isConnected = true;
    }
    await producer.send({
        topic,
        messages: [{
            key: String(message.userId),
            value: JSON.stringify(message),
        }]
    })
}
