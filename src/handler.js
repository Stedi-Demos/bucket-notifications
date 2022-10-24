import { BucketsClient, GetObjectCommand, PutObjectCommand } from "@stedi/sdk-client-buckets";
import consumers from "stream/consumers";

export async function handler(event) {
  // The client provides access to Stedi Buckets.
  const bucketsClient = new BucketsClient({
    // The region that hosts your bucket. At the moment, "us" is the only option.
    region: "us",

    // Read your API key from an environment variable. You set the environment variable in the .env
    // file. The environment variables are fixed when you deploy the function.
    apiKey: process.env.STEDI_API_KEY
  });

  // event.Records contains the notifications sent by Stedi Buckets. There’s typically only one
  // notification, but it is possible you receive multiple at once.
  const notifications = event.Records
    // Only process notifications that indicate a new object has been put into the bucket. At the
    // moment, this is the only notification Stedi Buckets will send, but we’re likely to add other
    // notifications in the future.
    .filter(record => record.eventName === "ObjectCreated:Put")

    // The notification contains a lot of data, but we only need the bucket name and the key. You
    // can see an example of a full notification at:
    // https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html#notification-content-structure-examples
    .map(record => ({
      // You can hook up multiple buckets to the same function; the notification will tell you which
      // bucket it came from.
      bucketName: record.s3.bucket.name,

      // The notification contains a URL-encoded version of the key, but Stedi Buckets expects the
      // the key not to be URL-encoded.
      key: decodeKey(record.s3.object.key)
    }));
  
  // Process each notification.
  for (const notification of notifications) {
    // Get the newly uploaded object from Stedi Buckets. The notification only contains the key of
    // the object and we need its contents.
    const getObjectCommand = new GetObjectCommand({
      bucketName: notification.bucketName,
      key: notification.key
    });
    const getObjectResult = await bucketsClient.send(getObjectCommand);

    // The body is returned as a data stream. Here we read the data stream into a string.
    const contents = await consumers.text(getObjectResult.body);

    // Transform the input. For this demo, we convert the contents to upper case. You probably want
    // to change this to something more useful when you implement your own workflow.
    const transformedContents = contents.toUpperCase();

    // The input bucket and the output bucket should be different. If you’d write the output to the
    // input bucket, then the function would trigger again, creating an infinite loop.
    if (notification.bucketName === process.env.OUTPUT_BUCKET) {
      console.error(`Input and output bucket are the same (${notification.bucketName}) for ${notification.key}`);
      continue;
    }

    // Store the output.
    const putObjectCommand = new PutObjectCommand({
      // Read the name of the output bucket from an environment variable. You set the environment
      // variable in the .env file. The environment variables are fixed when you deploy the function.
      bucketName: process.env.OUTPUT_BUCKET,

      // We store the output under the same key as the input object because it’s easy. You could
      // generate a new key if that suits your needs.
      key: notification.key,

      // There isn’t anything to say about the body parameter, but it looks weird if it’s the only
      // parameter without a commment it.
      body: transformedContents
    });
    await bucketsClient.send(putObjectCommand);
  }
}

function decodeKey(key) {
  // JavaScript’s decodeURIComponent() doesn’t bother converting pluses to spaces, so we’ll have to
  // do that in a separate step.
  key = key.replaceAll("+", " ");

  // Decode all the escaped characters.
  return decodeURIComponent(key);
}